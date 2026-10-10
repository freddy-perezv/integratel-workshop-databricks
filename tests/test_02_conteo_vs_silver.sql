-- TEST: gold.cliente_360 no pierde ni inventa clientes respecto de silver.clientes.
USE CATALOG IDENTIFIER(:catalog);
SELECT CASE WHEN g.n <> s.n
  THEN raise_error(concat('FALLA test_02: cliente_360 tiene ', g.n, ' filas pero silver.clientes tiene ', s.n))
  ELSE concat('OK test_02: ', g.n, ' clientes en ambas capas') END AS resultado
FROM (SELECT count(*) n FROM gold.cliente_360) g, (SELECT count(*) n FROM silver.clientes) s;
