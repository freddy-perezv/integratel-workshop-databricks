-- TEST: integridad referencial — tickets y servicios apuntan a clientes y planes existentes.
USE CATALOG IDENTIFIER(:catalog);
SELECT CASE WHEN huerfanos > 0
  THEN raise_error(concat('FALLA test_04: ', huerfanos, ' registros huérfanos (tickets sin cliente o servicios sin plan)'))
  ELSE 'OK test_04: integridad referencial' END AS resultado
FROM (
  SELECT (SELECT count(*) FROM silver.tickets t LEFT ANTI JOIN silver.clientes c USING (cliente_id))
       + (SELECT count(*) FROM silver.servicios s LEFT ANTI JOIN silver.planes p USING (plan_codigo)) AS huerfanos
);
