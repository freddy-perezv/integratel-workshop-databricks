-- ============================================================================
-- 10_silver.sql — Tipificación, limpieza y enriquecimiento básico
-- Parámetro: :catalog
-- ============================================================================
USE CATALOG IDENTIFIER(:catalog);
CREATE SCHEMA IF NOT EXISTS silver COMMENT 'Datos limpios y tipados, una fila por entidad de negocio';

CREATE OR REPLACE TABLE silver.planes COMMENT 'Catálogo vigente de planes y tarifas (S/)' AS
SELECT plan_codigo,
       nombre,
       tipo,
       tecnologia,
       CAST(precio_mensual AS DECIMAL(10,2)) AS precio_mensual,
       CAST(velocidad_mbps AS INT) AS velocidad_mbps,
       CAST(datos_gb AS INT) AS datos_gb
FROM bronze.planes;
ALTER TABLE silver.planes ALTER COLUMN plan_codigo COMMENT 'Código del plan (ej. FIB-400)';
ALTER TABLE silver.planes ALTER COLUMN nombre COMMENT 'Nombre comercial del plan';
ALTER TABLE silver.planes ALTER COLUMN tipo COMMENT 'Movil postpago | Movil prepago | Hogar';
ALTER TABLE silver.planes ALTER COLUMN tecnologia COMMENT 'FTTH (fibra) | HFC (cable) | MOVIL';
ALTER TABLE silver.planes ALTER COLUMN precio_mensual COMMENT 'Precio de lista mensual en soles (S/)';
ALTER TABLE silver.planes ALTER COLUMN velocidad_mbps COMMENT 'Velocidad contratada (planes hogar)';
ALTER TABLE silver.planes ALTER COLUMN datos_gb COMMENT 'GB de alta velocidad (planes móviles)';

CREATE OR REPLACE TABLE silver.nodos_red COMMENT 'Nodos de red fija (OLT fibra / cabeceras HFC)' AS
SELECT nodo_id,
       region,
       provincia,
       distrito,
       tecnologia,
       CAST(lat AS DOUBLE) AS lat,
       CAST(lng AS DOUBLE) AS lng
FROM bronze.nodos_red;
ALTER TABLE silver.nodos_red ALTER COLUMN nodo_id COMMENT 'Identificador del nodo/OLT (ej. AQP-CAY-03)';
ALTER TABLE silver.nodos_red ALTER COLUMN tecnologia COMMENT 'FTTH | HFC';

CREATE OR REPLACE TABLE silver.clientes COMMENT 'Maestro de clientes (titulares)' AS
SELECT cliente_id,
       nombres,
       apellidos,
       concat(nombres, ' ', apellidos) AS nombre_completo,
       numero_documento,
       lower(trim(email)) AS email,
       telefono,
       region,
       provincia,
       distrito,
       to_date(fecha_alta) AS fecha_alta,
       canal_alta,
       estado,
       to_date(fecha_baja) AS fecha_baja,
       nullif(motivo_baja, '') AS motivo_baja,
       nullif(operador_destino, '') AS operador_destino
FROM bronze.clientes
QUALIFY row_number() OVER (PARTITION BY cliente_id ORDER BY _ingestado_en DESC) = 1;
ALTER TABLE silver.clientes ALTER COLUMN cliente_id COMMENT 'Identificador del cliente (CLI-xxxxxx)';
ALTER TABLE silver.clientes ALTER COLUMN nombre_completo COMMENT 'Nombres y apellidos';
ALTER TABLE silver.clientes ALTER COLUMN numero_documento COMMENT 'DNI del titular (PII)';
ALTER TABLE silver.clientes ALTER COLUMN email COMMENT 'Correo de contacto (PII)';
ALTER TABLE silver.clientes ALTER COLUMN telefono COMMENT 'Teléfono de contacto (PII)';
ALTER TABLE silver.clientes ALTER COLUMN region COMMENT 'Región del Perú';
ALTER TABLE silver.clientes ALTER COLUMN fecha_alta COMMENT 'Fecha en que el cliente se dio de alta';
ALTER TABLE silver.clientes ALTER COLUMN estado COMMENT 'Activo | Baja';
ALTER TABLE silver.clientes ALTER COLUMN fecha_baja COMMENT 'Fecha de baja (nula si está activo)';
ALTER TABLE silver.clientes ALTER COLUMN motivo_baja COMMENT 'Portabilidad | Precio | Calidad del servicio | Mudanza | Otros';
ALTER TABLE silver.clientes ALTER COLUMN operador_destino COMMENT 'Operador al que se portó (si aplica)';

CREATE OR REPLACE TABLE silver.servicios COMMENT 'Servicios contratados por cliente, con precio efectivo' AS
SELECT s.servicio_id,
       s.cliente_id,
       s.plan_codigo,
       s.tecnologia,
       s.nodo_id,
       nullif(s.numero_linea, '') AS numero_linea,
       to_date(s.fecha_activacion) AS fecha_activacion,
       s.estado,
       to_date(s.fecha_baja) AS fecha_baja,
       s.es_duo = 'S' AS es_duo,
       p.precio_mensual AS precio_lista,
       CAST(round(p.precio_mensual * CASE WHEN s.es_duo = 'S' THEN 0.85 ELSE 1 END, 2) AS DECIMAL(10,2)) AS precio_aplicado
FROM bronze.servicios s
JOIN silver.planes p USING (plan_codigo);
ALTER TABLE silver.servicios ALTER COLUMN nodo_id COMMENT 'Nodo fijo o celda móvil';
ALTER TABLE silver.servicios ALTER COLUMN numero_linea COMMENT 'Número móvil (PII)';
ALTER TABLE silver.servicios ALTER COLUMN es_duo COMMENT 'Móvil con descuento dúo (15%) por tener hogar';
ALTER TABLE silver.servicios ALTER COLUMN precio_lista COMMENT 'Precio de lista del plan';
ALTER TABLE silver.servicios ALTER COLUMN precio_aplicado COMMENT 'Precio mensual efectivo (con descuento dúo)';

CREATE OR REPLACE TABLE silver.incidencias_red COMMENT 'Incidencias de red registradas por el NOC' AS
SELECT incidencia_id,
       nodo_id,
       to_timestamp(inicio) AS inicio,
       to_timestamp(fin) AS fin,
       tipo,
       severidad,
       CAST(clientes_afectados AS INT) AS clientes_afectados,
       descripcion,
       round((unix_timestamp(to_timestamp(fin)) - unix_timestamp(to_timestamp(inicio))) / 3600, 1) AS duracion_horas
FROM bronze.incidencias_red;
ALTER TABLE silver.incidencias_red ALTER COLUMN severidad COMMENT 'Crítica | Alta | Media | Baja';
ALTER TABLE silver.incidencias_red ALTER COLUMN duracion_horas COMMENT 'Duración total de la incidencia en horas';

CREATE OR REPLACE TABLE silver.tickets COMMENT 'Tickets de soporte técnico y de facturación' AS
SELECT ticket_id,
       cliente_id,
       servicio_id,
       to_timestamp(fecha_apertura) AS fecha_apertura,
       to_timestamp(fecha_cierre) AS fecha_cierre,
       categoria,
       codigo_falla,
       codigo_falla IN ('F-101', 'F-102', 'F-301', 'M-401') AS es_falla_red,
       canal,
       estado,
       descripcion,
       nullif(incidencia_id, '') AS incidencia_id,
       round((unix_timestamp(to_timestamp(fecha_cierre)) - unix_timestamp(to_timestamp(fecha_apertura))) / 3600, 1) AS horas_resolucion
FROM bronze.tickets;
ALTER TABLE silver.tickets ALTER COLUMN categoria COMMENT 'Técnico | Facturación';
ALTER TABLE silver.tickets ALTER COLUMN codigo_falla COMMENT 'F-101 LOS rojo, F-102 PON, F-201 lentitud, F-301 HFC, M-401 móvil, B-501 facturación';
ALTER TABLE silver.tickets ALTER COLUMN es_falla_red COMMENT 'TRUE si el código es una falla de red (F-101, F-102, F-301, M-401)';
ALTER TABLE silver.tickets ALTER COLUMN estado COMMENT 'Abierto | Cerrado';
ALTER TABLE silver.tickets ALTER COLUMN descripcion COMMENT 'Texto libre del reporte del cliente';
ALTER TABLE silver.tickets ALTER COLUMN incidencia_id COMMENT 'Incidencia masiva vinculada (si aplica)';
ALTER TABLE silver.tickets ALTER COLUMN horas_resolucion COMMENT 'Horas entre apertura y cierre';

CREATE OR REPLACE TABLE silver.reclamos COMMENT 'Reclamos formales de usuarios (sujetos a plazos regulatorios)' AS
SELECT reclamo_id,
       cliente_id,
       servicio_id,
       nullif(ticket_id, '') AS ticket_id,
       to_timestamp(fecha_registro) AS fecha_registro,
       tipo,
       estado,
       to_date(fecha_respuesta) AS fecha_respuesta,
       CAST(dias_habiles_respuesta AS INT) AS dias_habiles_respuesta,
       CASE WHEN tipo IN ('Interrupción', 'Calidad') THEN 5 ELSE 15 END AS plazo_dias_habiles,
       CAST(dias_habiles_respuesta AS INT) > CASE WHEN tipo IN ('Interrupción', 'Calidad') THEN 5 ELSE 15 END AS fuera_de_plazo,
       CAST(monto_compensado AS DECIMAL(10,2)) AS monto_compensado,
       nullif(incidencia_id, '') AS incidencia_id,
       descripcion
FROM bronze.reclamos;
ALTER TABLE silver.reclamos ALTER COLUMN reclamo_id COMMENT 'Código de reclamo RCL-AAAA-NNNNN';
ALTER TABLE silver.reclamos ALTER COLUMN tipo COMMENT 'Interrupción | Calidad | Facturación';
ALTER TABLE silver.reclamos ALTER COLUMN estado COMMENT 'Abierto | Resuelto favorable | Resuelto no favorable | Apelado';
ALTER TABLE silver.reclamos ALTER COLUMN plazo_dias_habiles COMMENT 'Plazo normativo: 5 (interrupción/calidad) o 15 (otros)';
ALTER TABLE silver.reclamos ALTER COLUMN fuera_de_plazo COMMENT 'TRUE si se respondió después del plazo normativo';

CREATE OR REPLACE TABLE silver.portabilidad_eventos COMMENT 'Eventos del proceso de portabilidad numérica' AS
SELECT evento_id,
       cliente_id,
       to_date(fecha) AS fecha,
       tipo_evento,
       operador_destino
FROM bronze.portabilidad_eventos;
ALTER TABLE silver.portabilidad_eventos ALTER COLUMN tipo_evento COMMENT 'Consulta previa | Portabilidad ejecutada | Retenido';

CREATE OR REPLACE TABLE silver.facturacion COMMENT 'Facturación mensual por cliente (abr–sep 2026)' AS
SELECT factura_id,
       cliente_id,
       periodo,
       CAST(monto AS DECIMAL(10,2)) AS monto,
       estado_pago,
       CAST(dias_atraso AS INT) AS dias_atraso
FROM bronze.facturacion;
ALTER TABLE silver.facturacion ALTER COLUMN periodo COMMENT 'Periodo facturado AAAA-MM';
ALTER TABLE silver.facturacion ALTER COLUMN monto COMMENT 'Monto facturado (S/)';
ALTER TABLE silver.facturacion ALTER COLUMN estado_pago COMMENT 'Pagado | Pendiente | Vencido';

CREATE OR REPLACE TABLE silver.retenciones_historicas COMMENT 'Acciones de retención aplicadas en los últimos 12 meses' AS
SELECT retencion_id,
       cliente_id,
       to_date(fecha) AS fecha,
       oferta_codigo,
       CAST(descuento_pct AS INT) AS descuento_pct,
       resultado,
       ejecutivo
FROM bronze.retenciones_historicas;
ALTER TABLE silver.retenciones_historicas ALTER COLUMN oferta_codigo COMMENT 'R1 descuento | R2 upgrade | R3 bono datos | R4 visita prioritaria';
ALTER TABLE silver.retenciones_historicas ALTER COLUMN resultado COMMENT 'Retenido | No retenido';
