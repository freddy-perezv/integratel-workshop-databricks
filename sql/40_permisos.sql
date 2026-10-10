-- ============================================================================
-- 40_permisos.sql — Gobierno como código: quién puede LEER los productos de datos.
-- Lectura de gold para todos los usuarios de la cuenta (datos sintéticos del workshop):
-- dashboard, Genie y el copiloto consultan con la identidad de cada persona.
-- bronze y silver quedan cerrados (solo el service principal del pipeline).
-- Parámetro: :catalog
-- ============================================================================
USE CATALOG IDENTIFIER(:catalog);
GRANT USE CATALOG ON CATALOG IDENTIFIER(:catalog) TO `account users`;
GRANT USE SCHEMA, SELECT ON SCHEMA gold TO `account users`;
