-- TEST: la tasa de churn mensual es plausible (entre 0% y 10%) y las bajas no superan la base.
USE CATALOG IDENTIFIER(:catalog);
SELECT CASE WHEN count(*) > 0
  THEN raise_error(concat('FALLA test_05: ', count(*), ' meses con tasa de churn fuera de rango (', max(tasa), ')'))
  ELSE 'OK test_05: tasa de churn mensual en rango' END AS resultado
FROM (
  SELECT mes, sum(bajas) / sum(clientes_inicio) AS tasa FROM gold.churn_mensual GROUP BY mes
) WHERE tasa < 0 OR tasa > 0.10;
