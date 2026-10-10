-- TEST: el score de riesgo está en [0,1] y todo cliente activo tiene nivel de riesgo.
USE CATALOG IDENTIFIER(:catalog);
SELECT CASE WHEN count(*) > 0
  THEN raise_error(concat('FALLA test_03: ', count(*), ' clientes activos con score fuera de rango o sin nivel_riesgo'))
  ELSE 'OK test_03: score_riesgo en [0,1] y nivel_riesgo completo' END AS resultado
FROM gold.cliente_360
WHERE estado = 'Activo' AND (score_riesgo IS NULL OR score_riesgo < 0 OR score_riesgo > 1 OR nivel_riesgo IS NULL);
