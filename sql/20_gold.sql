-- ============================================================================
-- 20_gold.sql — Tablas de negocio: cliente 360 con riesgo, soporte, churn, red
-- Parámetro: :catalog
-- Fecha de corte fija (2026-10-15) para que el workshop sea reproducible;
-- en producción sería current_date().
-- ============================================================================
USE CATALOG IDENTIFIER(:catalog);
CREATE SCHEMA IF NOT EXISTS gold COMMENT 'Productos de datos listos para negocio: dashboards, Genie, App';

DECLARE OR REPLACE VARIABLE fecha_corte DATE DEFAULT DATE'2026-10-15';

-- ── Cliente 360 + score de riesgo de fuga ──────────────────────────────────
CREATE OR REPLACE TABLE gold.cliente_360
COMMENT 'Una fila por cliente: servicios, valor, experiencia de soporte, señales de portabilidad y score de riesgo de fuga. Fuente principal de la App de retención y de Genie.'
AS
WITH serv AS (
  SELECT cliente_id,
         count(*) AS servicios_activos,
         concat_ws(', ', sort_array(collect_list(plan_codigo))) AS planes,
         max(tecnologia <> 'MOVIL') AS tiene_hogar,
         max_by(plan_codigo, CASE WHEN tecnologia <> 'MOVIL' THEN 1 ELSE 0 END) AS plan_principal,
         max(CASE WHEN tecnologia <> 'MOVIL' THEN tecnologia END) AS tecnologia_hogar,
         max(CASE WHEN tecnologia <> 'MOVIL' THEN plan_codigo END) AS plan_hogar,
         max(CASE WHEN tecnologia <> 'MOVIL' THEN precio_aplicado END) AS renta_hogar,
         max(CASE WHEN tecnologia <> 'MOVIL' THEN nodo_id END) AS nodo_hogar,
         sum(precio_aplicado) AS renta_mensual
  FROM silver.servicios
  GROUP BY cliente_id
),
-- ARPU: se agrega por cliente ANTES de unir (evita duplicar filas del cliente).
fact AS (
  SELECT cliente_id,
         round(avg(monto), 2) AS arpu_6m,
         max_by(dias_atraso, periodo) AS dias_atraso_actual
  FROM silver.facturacion
  GROUP BY cliente_id
),
tck AS (
  SELECT cliente_id,
         count(*) AS tickets_30d,
         count_if(es_falla_red) AS fallas_red_30d,
         count_if(estado = 'Abierto') AS tickets_abiertos
  FROM silver.tickets
  WHERE fecha_apertura >= fecha_corte - INTERVAL 30 DAYS
  GROUP BY cliente_id
),
rcl AS (
  SELECT cliente_id, count_if(estado = 'Abierto') AS reclamos_abiertos, count(*) AS reclamos_90d,
         max_by(CASE WHEN estado = 'Abierto' THEN reclamo_id END, CASE WHEN estado = 'Abierto' THEN fecha_registro END) AS reclamo_abierto_id,
         max_by(CASE WHEN estado = 'Abierto' THEN descripcion END, CASE WHEN estado = 'Abierto' THEN fecha_registro END) AS reclamo_abierto_detalle
  FROM silver.reclamos
  WHERE fecha_registro >= fecha_corte - INTERVAL 90 DAYS
  GROUP BY cliente_id
),
por AS (
  SELECT cliente_id,
         max(fecha) AS fecha_ultima_consulta_portabilidad,
         max_by(operador_destino, fecha) AS operador_consultado
  FROM silver.portabilidad_eventos
  WHERE tipo_evento = 'Consulta previa' AND fecha >= fecha_corte - INTERVAL 30 DAYS
  GROUP BY cliente_id
),
ret_ok AS (
  SELECT DISTINCT cliente_id FROM silver.portabilidad_eventos
  WHERE tipo_evento = 'Retenido' AND fecha >= fecha_corte - INTERVAL 30 DAYS
),
ret AS (
  SELECT cliente_id, max(fecha) AS fecha_ultima_retencion FROM silver.retenciones_historicas GROUP BY cliente_id
),
inc AS (
  SELECT nodo_id, max_by(incidencia_id, inicio) AS incidencia_masiva_id
  FROM silver.incidencias_red
  WHERE severidad = 'Crítica' AND fin >= fecha_corte - INTERVAL 30 DAYS
  GROUP BY nodo_id
),
base AS (
  SELECT c.cliente_id, c.nombre_completo, c.region, c.provincia, c.distrito, c.estado,
         c.fecha_alta, round(datediff(fecha_corte, c.fecha_alta) / 365.25, 1) AS antiguedad_anios,
         c.fecha_baja, c.motivo_baja, c.operador_destino,
         s.servicios_activos, s.planes, coalesce(s.tiene_hogar, false) AS tiene_hogar, s.tecnologia_hogar,
         s.plan_hogar, s.renta_hogar, s.nodo_hogar, s.renta_mensual,
         CASE WHEN s.renta_mensual >= 150 THEN 'Oro' WHEN s.renta_mensual >= 80 THEN 'Plata' ELSE 'Bronce' END AS segmento_valor,
         f.arpu_6m, coalesce(f.dias_atraso_actual, 0) AS dias_atraso,
         coalesce(f.dias_atraso_actual, 0) > 60 AS deuda_vencida_60d,
         coalesce(t.tickets_30d, 0) AS tickets_30d, coalesce(t.fallas_red_30d, 0) AS fallas_red_30d,
         coalesce(t.tickets_abiertos, 0) AS tickets_abiertos,
         coalesce(r.reclamos_abiertos, 0) AS reclamos_abiertos, coalesce(r.reclamos_90d, 0) AS reclamos_90d,
         r.reclamo_abierto_id, r.reclamo_abierto_detalle,
         p.fecha_ultima_consulta_portabilidad IS NOT NULL AND ro.cliente_id IS NULL AS consulta_portabilidad_30d,
         p.fecha_ultima_consulta_portabilidad, p.operador_consultado,
         i.incidencia_masiva_id, i.incidencia_masiva_id IS NOT NULL AS afectado_incidencia_masiva,
         rt.fecha_ultima_retencion,
         NOT (coalesce(f.dias_atraso_actual, 0) > 60)
           AND (rt.fecha_ultima_retencion IS NULL OR rt.fecha_ultima_retencion < fecha_corte - INTERVAL 6 MONTHS)
           AS elegible_retencion
  FROM silver.clientes c
  LEFT JOIN serv s USING (cliente_id)
  LEFT JOIN fact f USING (cliente_id)
  LEFT JOIN tck t USING (cliente_id)
  LEFT JOIN rcl r USING (cliente_id)
  LEFT JOIN por p USING (cliente_id)
  LEFT JOIN ret_ok ro USING (cliente_id)
  LEFT JOIN ret rt USING (cliente_id)
  LEFT JOIN inc i ON i.nodo_id = s.nodo_hogar
)
SELECT *,
       CASE WHEN score_riesgo >= 0.80 THEN 'Crítico' WHEN score_riesgo >= 0.60 THEN 'Alto'
            WHEN score_riesgo >= 0.40 THEN 'Medio' ELSE 'Bajo' END AS nivel_riesgo
FROM (
  SELECT *,
         -- Score de riesgo v1 (reglas transparentes, versionadas en git). Pesos en docs/CANON.md.
         CASE WHEN estado = 'Baja' THEN NULL ELSE
           CAST(least(0.99, 0.10
             + 0.30 * CAST(consulta_portabilidad_30d AS INT)
             + 0.07 * least(fallas_red_30d, 3)
             + 0.10 * CAST(reclamos_abiertos > 0 AS INT)
             + 0.12 * CAST(afectado_incidencia_masiva AS INT)
             + 0.08 * CAST(tickets_30d >= 4 AS INT)
             + 0.06 * CAST(dias_atraso > 30 AS INT)) AS DECIMAL(3,2))
         END AS score_riesgo
  FROM base
);

ALTER TABLE gold.cliente_360 ALTER COLUMN score_riesgo COMMENT 'Probabilidad estimada de fuga (0–1). Nulo para clientes de baja.';
ALTER TABLE gold.cliente_360 ALTER COLUMN nivel_riesgo COMMENT 'Crítico ≥0.80 · Alto 0.60–0.79 · Medio 0.40–0.59 · Bajo <0.40';
ALTER TABLE gold.cliente_360 ALTER COLUMN segmento_valor COMMENT 'Oro ≥ S/150 · Plata S/80–149.99 · Bronce < S/80 de renta mensual';
ALTER TABLE gold.cliente_360 ALTER COLUMN renta_mensual COMMENT 'Renta mensual total del cliente en soles (precio efectivo, incluye dúo)';
ALTER TABLE gold.cliente_360 ALTER COLUMN consulta_portabilidad_30d COMMENT 'TRUE si otro operador hizo consulta previa de portabilidad en los últimos 30 días y no fue retenido';
ALTER TABLE gold.cliente_360 ALTER COLUMN afectado_incidencia_masiva COMMENT 'TRUE si su nodo tuvo una incidencia crítica en los últimos 30 días';
ALTER TABLE gold.cliente_360 ALTER COLUMN reclamo_abierto_detalle COMMENT 'Descripción del reclamo abierto más reciente (ej. días sin servicio que reclama el cliente)';
ALTER TABLE gold.cliente_360 ALTER COLUMN elegible_retencion COMMENT 'Sin deuda vencida > 60 días y sin retención en los últimos 6 meses (Política POL-RET-2026)';

-- ── Tickets enriquecidos (base de la métrica de soporte) ───────────────────
CREATE OR REPLACE TABLE gold.tickets_enriquecidos
COMMENT 'Tickets de soporte con contexto de cliente, nodo e incidencia. Base de la metric view de soporte.'
AS
SELECT t.ticket_id, t.cliente_id, t.servicio_id, t.fecha_apertura, to_date(t.fecha_apertura) AS fecha,
       date_trunc('MONTH', t.fecha_apertura)::DATE AS mes,
       t.fecha_cierre, t.categoria, t.codigo_falla, t.es_falla_red, t.canal, t.estado, t.descripcion,
       t.incidencia_id, t.incidencia_id IS NOT NULL AS vinculado_incidencia, t.horas_resolucion,
       s.tecnologia, s.plan_codigo, s.nodo_id, c.region, c.distrito, c.segmento_valor, c.nivel_riesgo
FROM silver.tickets t
LEFT JOIN silver.servicios s USING (servicio_id)
LEFT JOIN gold.cliente_360 c ON c.cliente_id = t.cliente_id;

-- ── Reclamos enriquecidos ──────────────────────────────────────────────────
CREATE OR REPLACE TABLE gold.reclamos_enriquecidos
COMMENT 'Reclamos con región, segmento y cumplimiento de plazo normativo.'
AS
SELECT r.*, to_date(r.fecha_registro) AS fecha, date_trunc('MONTH', r.fecha_registro)::DATE AS mes,
       c.region, c.distrito, c.segmento_valor, c.nodo_hogar AS nodo_id
FROM silver.reclamos r
LEFT JOIN gold.cliente_360 c USING (cliente_id);

-- ── Churn mensual ──────────────────────────────────────────────────────────
CREATE OR REPLACE TABLE gold.churn_mensual
COMMENT 'Clientes al inicio de mes y bajas por mes, región y segmento. Tasa de churn = bajas / clientes_inicio.'
AS
WITH meses AS (
  SELECT explode(sequence(DATE'2026-04-01', DATE'2026-10-01', INTERVAL 1 MONTH)) AS mes
)
SELECT m.mes, c.region, c.segmento_valor, coalesce(c.tecnologia_hogar, 'Solo móvil') AS tecnologia,
       count_if(c.fecha_alta < m.mes AND (c.fecha_baja IS NULL OR c.fecha_baja >= m.mes)) AS clientes_inicio,
       count_if(c.fecha_baja >= m.mes AND c.fecha_baja < m.mes + INTERVAL 1 MONTH) AS bajas,
       count_if(c.fecha_baja >= m.mes AND c.fecha_baja < m.mes + INTERVAL 1 MONTH AND c.motivo_baja = 'Portabilidad') AS bajas_portabilidad,
       round(sum(CASE WHEN c.fecha_baja >= m.mes AND c.fecha_baja < m.mes + INTERVAL 1 MONTH THEN c.renta_mensual ELSE 0 END), 2) AS renta_perdida
FROM meses m CROSS JOIN gold.cliente_360 c
GROUP BY ALL;

-- ── Salud de red por nodo ──────────────────────────────────────────────────
CREATE OR REPLACE TABLE gold.nodos_salud
COMMENT 'Salud de cada nodo fijo: clientes, tickets de falla de red, incidencias y riesgo de fuga agregado.'
AS
WITH tk AS (
  SELECT s.nodo_id,
         count_if(t.es_falla_red AND t.fecha_apertura >= fecha_corte - INTERVAL 7 DAYS) AS fallas_red_7d,
         count_if(t.es_falla_red AND t.fecha_apertura >= fecha_corte - INTERVAL 30 DAYS) AS fallas_red_30d,
         count_if(t.codigo_falla = 'F-101' AND t.fecha_apertura >= fecha_corte - INTERVAL 30 DAYS) AS los_rojo_30d
  FROM silver.tickets t JOIN silver.servicios s USING (servicio_id)
  GROUP BY s.nodo_id
),
cl AS (
  SELECT nodo_hogar AS nodo_id, count_if(estado = 'Activo') AS clientes_activos,
         count_if(nivel_riesgo IN ('Crítico', 'Alto')) AS clientes_riesgo_alto,
         round(sum(CASE WHEN nivel_riesgo IN ('Crítico', 'Alto') THEN renta_mensual ELSE 0 END), 2) AS renta_en_riesgo
  FROM gold.cliente_360 GROUP BY nodo_hogar
),
inc AS (
  SELECT nodo_id, count(*) AS incidencias_90d, max_by(incidencia_id, inicio) AS ultima_incidencia,
         max_by(severidad, inicio) AS severidad_ultima, max(fin) AS fin_ultima_incidencia
  FROM silver.incidencias_red WHERE inicio >= fecha_corte - INTERVAL 90 DAYS GROUP BY nodo_id
)
SELECT n.*, coalesce(cl.clientes_activos, 0) AS clientes_activos,
       coalesce(tk.fallas_red_7d, 0) AS fallas_red_7d, coalesce(tk.fallas_red_30d, 0) AS fallas_red_30d,
       coalesce(tk.los_rojo_30d, 0) AS los_rojo_30d,
       coalesce(inc.incidencias_90d, 0) AS incidencias_90d, inc.ultima_incidencia, inc.severidad_ultima,
       coalesce(cl.clientes_riesgo_alto, 0) AS clientes_riesgo_alto, coalesce(cl.renta_en_riesgo, 0) AS renta_en_riesgo,
       CASE WHEN inc.severidad_ultima = 'Crítica' AND inc.fin_ultima_incidencia >= fecha_corte - INTERVAL 30 DAYS THEN 'Crítico'
            WHEN coalesce(tk.fallas_red_30d, 0) > 30 THEN 'Degradado' ELSE 'Normal' END AS estado_salud
FROM silver.nodos_red n
LEFT JOIN tk USING (nodo_id) LEFT JOIN cl USING (nodo_id) LEFT JOIN inc USING (nodo_id);
