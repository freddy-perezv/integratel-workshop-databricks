-- ============================================================================
-- 00_bronze.sql — Ingesta cruda desde el Volume de aterrizaje
-- Parámetro: :catalog  (integratel_dev | integratel_prod) — lo inyecta el Bundle.
-- Bronze guarda TODO como texto, tal como llega: la tipificación vive en silver.
-- ============================================================================
USE CATALOG IDENTIFIER(:catalog);
CREATE SCHEMA IF NOT EXISTS bronze;

CREATE OR REPLACE TABLE bronze.clientes COMMENT 'Crudo CRM: clientes' AS
SELECT *, _metadata.file_path AS _archivo_origen, current_timestamp() AS _ingestado_en
FROM read_files(concat('/Volumes/', :catalog, '/bronze/landing/clientes.csv'), format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.servicios COMMENT 'Crudo BSS: servicios contratados' AS
SELECT *, _metadata.file_path AS _archivo_origen, current_timestamp() AS _ingestado_en
FROM read_files(concat('/Volumes/', :catalog, '/bronze/landing/servicios.csv'), format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.planes COMMENT 'Crudo BSS: catálogo de planes' AS
SELECT *, _metadata.file_path AS _archivo_origen, current_timestamp() AS _ingestado_en
FROM read_files(concat('/Volumes/', :catalog, '/bronze/landing/planes.csv'), format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.nodos_red COMMENT 'Crudo NOC: nodos de red' AS
SELECT *, _metadata.file_path AS _archivo_origen, current_timestamp() AS _ingestado_en
FROM read_files(concat('/Volumes/', :catalog, '/bronze/landing/nodos_red.csv'), format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.incidencias_red COMMENT 'Crudo NOC: incidencias de red' AS
SELECT *, _metadata.file_path AS _archivo_origen, current_timestamp() AS _ingestado_en
FROM read_files(concat('/Volumes/', :catalog, '/bronze/landing/incidencias_red.csv'), format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.tickets COMMENT 'Crudo CRM: tickets de soporte' AS
SELECT *, _metadata.file_path AS _archivo_origen, current_timestamp() AS _ingestado_en
FROM read_files(concat('/Volumes/', :catalog, '/bronze/landing/tickets.csv'), format => 'csv', header => true, inferSchema => false, multiLine => true);

CREATE OR REPLACE TABLE bronze.reclamos COMMENT 'Crudo CRM: reclamos de usuarios' AS
SELECT *, _metadata.file_path AS _archivo_origen, current_timestamp() AS _ingestado_en
FROM read_files(concat('/Volumes/', :catalog, '/bronze/landing/reclamos.csv'), format => 'csv', header => true, inferSchema => false, multiLine => true);

CREATE OR REPLACE TABLE bronze.portabilidad_eventos COMMENT 'Crudo: eventos de portabilidad numérica' AS
SELECT *, _metadata.file_path AS _archivo_origen, current_timestamp() AS _ingestado_en
FROM read_files(concat('/Volumes/', :catalog, '/bronze/landing/portabilidad_eventos.csv'), format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.facturacion COMMENT 'Crudo BSS: facturación mensual' AS
SELECT *, _metadata.file_path AS _archivo_origen, current_timestamp() AS _ingestado_en
FROM read_files(concat('/Volumes/', :catalog, '/bronze/landing/facturacion.csv'), format => 'csv', header => true, inferSchema => false);

CREATE OR REPLACE TABLE bronze.retenciones_historicas COMMENT 'Crudo CRM: acciones de retención históricas' AS
SELECT *, _metadata.file_path AS _archivo_origen, current_timestamp() AS _ingestado_en
FROM read_files(concat('/Volumes/', :catalog, '/bronze/landing/retenciones_historicas.csv'), format => 'csv', header => true, inferSchema => false);
