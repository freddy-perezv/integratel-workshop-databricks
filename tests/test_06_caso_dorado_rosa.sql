-- TEST DE REGRESIÓN DE NEGOCIO ("caso dorado"): la clienta CLI-104217 (Rosa Huamán) debe
-- seguir viéndose exactamente como la conoce el negocio. Si un cambio la mueve, alguien debe revisarlo.
USE CATALOG IDENTIFIER(:catalog);
SELECT CASE WHEN count(*) <> 1 OR count_if(nivel_riesgo = 'Crítico' AND segmento_valor = 'Oro' AND renta_mensual = 176.92
                      AND afectado_incidencia_masiva AND consulta_portabilidad_30d AND reclamos_abiertos = 1) <> 1
  THEN raise_error(concat('FALLA test_06: CLI-104217 cambió (filas=', count(*), ') → nivel=', max(nivel_riesgo),
                          ' segmento=', max(segmento_valor), ' renta=', max(renta_mensual), ' score=', max(score_riesgo)))
  ELSE concat('OK test_06: caso dorado CLI-104217 score=', max(score_riesgo)) END AS resultado
FROM gold.cliente_360 WHERE cliente_id = 'CLI-104217';
