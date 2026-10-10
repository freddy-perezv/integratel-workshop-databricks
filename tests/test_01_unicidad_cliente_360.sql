-- TEST: gold.cliente_360 debe tener exactamente una fila por cliente.
-- Si un JOIN mal hecho duplica clientes, TODAS las métricas (renta en riesgo, % churn) se inflan.
USE CATALOG IDENTIFIER(:catalog);
SELECT CASE WHEN count(*) > 0
  THEN raise_error(concat('FALLA test_01: ', count(*), ' cliente_id duplicados en gold.cliente_360 (ej. ', min(cliente_id), '). ¿Un JOIN sin agregar?'))
  ELSE 'OK test_01: cliente_360 sin duplicados' END AS resultado
FROM (SELECT cliente_id FROM gold.cliente_360 GROUP BY cliente_id HAVING count(*) > 1);
