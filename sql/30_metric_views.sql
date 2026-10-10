-- ============================================================================
-- 30_metric_views.sql — Capa semántica gobernada (Unity Catalog Metric Views)
-- Una sola definición de cada KPI, reutilizada por Dashboard, Genie, App y SQL.
-- Parámetro: :catalog
-- ============================================================================
USE CATALOG IDENTIFIER(:catalog);

CREATE OR REPLACE VIEW gold.mv_riesgo_clientes
WITH METRICS LANGUAGE YAML
COMMENT 'KPIs de riesgo de fuga sobre la cartera activa'
AS $$
version: 1.1
source: gold.cliente_360
filter: estado = 'Activo'
dimensions:
  - name: region
    expr: region
  - name: distrito
    expr: distrito
  - name: segmento_valor
    expr: segmento_valor
    comment: "Oro, Plata o Bronce según renta mensual"
  - name: nivel_riesgo
    expr: nivel_riesgo
  - name: tecnologia_hogar
    expr: coalesce(tecnologia_hogar, 'Solo móvil')
  - name: nodo
    expr: nodo_hogar
  - name: afectado_incidencia_masiva
    expr: afectado_incidencia_masiva
  - name: consulta_portabilidad_30d
    expr: consulta_portabilidad_30d
measures:
  - name: clientes
    expr: COUNT(1)
  - name: clientes_riesgo_alto
    expr: COUNT_IF(nivel_riesgo IN ('Crítico', 'Alto'))
    comment: "Clientes con nivel de riesgo Crítico o Alto"
  - name: pct_riesgo_alto
    expr: COUNT_IF(nivel_riesgo IN ('Crítico', 'Alto')) / COUNT(1)
  - name: renta_total
    expr: SUM(renta_mensual)
  - name: renta_en_riesgo
    expr: SUM(CASE WHEN nivel_riesgo IN ('Crítico', 'Alto') THEN renta_mensual ELSE 0 END)
    comment: "Renta mensual (S/) de clientes en riesgo Crítico o Alto"
  - name: score_promedio
    expr: AVG(score_riesgo)
  - name: consultas_portabilidad
    expr: COUNT_IF(consulta_portabilidad_30d)
$$;

CREATE OR REPLACE VIEW gold.mv_soporte
WITH METRICS LANGUAGE YAML
COMMENT 'KPIs de soporte técnico: volumen de tickets, fallas de red y tiempos de resolución'
AS $$
version: 1.1
source: gold.tickets_enriquecidos
dimensions:
  - name: fecha
    expr: fecha
  - name: mes
    expr: mes
  - name: region
    expr: region
  - name: nodo
    expr: nodo_id
  - name: codigo_falla
    expr: codigo_falla
  - name: tecnologia
    expr: tecnologia
  - name: canal
    expr: canal
  - name: vinculado_incidencia
    expr: vinculado_incidencia
  - name: segmento_valor
    expr: segmento_valor
measures:
  - name: tickets
    expr: COUNT(1)
  - name: fallas_red
    expr: COUNT_IF(es_falla_red)
  - name: tickets_abiertos
    expr: COUNT_IF(estado = 'Abierto')
  - name: pct_falla_red
    expr: COUNT_IF(es_falla_red) / COUNT(1)
  - name: horas_resolucion_promedio
    expr: AVG(horas_resolucion)
  - name: clientes_con_ticket
    expr: COUNT(DISTINCT cliente_id)
$$;

CREATE OR REPLACE VIEW gold.mv_churn
WITH METRICS LANGUAGE YAML
COMMENT 'Churn mensual: tasa de bajas y peso de la portabilidad'
AS $$
version: 1.1
source: gold.churn_mensual
dimensions:
  - name: mes
    expr: mes
  - name: region
    expr: region
  - name: segmento_valor
    expr: segmento_valor
  - name: tecnologia
    expr: tecnologia
measures:
  - name: clientes_inicio
    expr: SUM(clientes_inicio)
  - name: bajas
    expr: SUM(bajas)
  - name: tasa_churn
    expr: SUM(bajas) / SUM(clientes_inicio)
    comment: "Bajas del mes / clientes activos al inicio del mes"
  - name: bajas_portabilidad
    expr: SUM(bajas_portabilidad)
  - name: pct_bajas_por_portabilidad
    expr: SUM(bajas_portabilidad) / SUM(bajas)
  - name: renta_perdida
    expr: SUM(renta_perdida)
$$;

CREATE OR REPLACE VIEW gold.mv_reclamos
WITH METRICS LANGUAGE YAML
COMMENT 'Reclamos de usuarios y cumplimiento de plazos normativos'
AS $$
version: 1.1
source: gold.reclamos_enriquecidos
dimensions:
  - name: mes
    expr: mes
  - name: region
    expr: region
  - name: tipo
    expr: tipo
  - name: estado
    expr: estado
  - name: segmento_valor
    expr: segmento_valor
measures:
  - name: reclamos
    expr: COUNT(1)
  - name: reclamos_abiertos
    expr: COUNT_IF(estado = 'Abierto')
  - name: pct_fuera_de_plazo
    expr: COUNT_IF(fuera_de_plazo) / COUNT_IF(estado <> 'Abierto')
    comment: "Reclamos respondidos fuera del plazo normativo (riesgo de silencio positivo y multa)"
  - name: monto_compensado
    expr: SUM(monto_compensado)
$$;
