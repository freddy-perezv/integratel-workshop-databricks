# Despliegue del workshop en el workspace de Integratel

Guía para el **admin del workspace** (una sola vez, antes del workshop). Deja todo el proyecto desplegado en su workspace para que los participantes lo usen con sus propios usuarios.
Todo el contenido es **sintético**: no se usan ni se tocan datos de Integratel.

## 1. Requisitos

| Qué | Para qué | Cómo verificar |
|---|---|---|
| Admin del workspace, con permiso para crear catálogos en Unity Catalog | Crear `integratel_prod`, schemas, volumes, job, dashboard, Genie, agentes y la App | — |
| SQL Warehouse **serverless** | Pipeline, dashboard, Genie y alerta | *SQL Warehouses* |
| Habilitados en el workspace: **Agent Bricks** (Knowledge Assistant y Supervisor), **Databricks Apps**, **Lakebase**, **Genie** y metric views | Bloques 2 y 3 del workshop | Menú lateral: *Agents*, *Compute → Apps*, *Lakebase* |
| Endpoint de modelo `databricks-claude-sonnet-5-5` (u otro Claude) en *Serving* | El copiloto de la App | *Serving* |
| [Databricks CLI](https://docs.databricks.com/dev-tools/cli/install.html) v1.x (probado con v1.20), `git`, `python3` | Niveles 1 y 2 | `databricks version` |
| Node.js 20+ y `psql` | Solo nivel 3 (la App) | `node --version`, `psql --version` |
| macOS, Linux o Windows con **WSL / Git Bash** | El script es bash | — |

## 2. Preparación (5 min)

```bash
git clone https://github.com/freddy-perezv/integratel-workshop-databricks.git
cd integratel-workshop-databricks
databricks auth login --host https://<su-workspace> --profile integratel
databricks current-user me -p integratel          # debe mostrar su usuario
```

## 3. Despliegue por niveles

```bash
./tools/bootstrap_integratel.sh integratel 1    # datos + pipeline SQL + dashboard + Genie + alerta (~15 min)
./tools/bootstrap_integratel.sh integratel 2    # Knowledge Assistant + Supervisor (~30-45 min, indexa los PDFs)
./tools/bootstrap_integratel.sh integratel 3    # Databricks App + Lakebase (~15 min)
```

- Cada nivel requiere el anterior y es **idempotente**: si algo falla, se corrige y se vuelve a correr el mismo nivel.
- Si el warehouse no se llama *Serverless Starter Warehouse*: `export WAREHOUSE_ID=<id>` antes de correr.
- Si el metastore exige ubicación para crear catálogos: `export STORAGE_ROOT=<abfss://… | s3://…>`.
- **Nivel 3:** no se conecten con su usuario a la base Lakebase `integratel_retencion` antes de correrlo. La App crea sus propios schemas en el primer arranque y debe ser su dueña.
- El job y la alerta corren con la identidad de quien despliega.

**Qué crea:**

| Nivel | Recursos |
|---|---|
| 1 | Catálogo `integratel_prod` (bronze, silver, gold, metric views, conocimiento), volumes con CSV y PDF, job *Integratel · Pipeline SQL retención*, dashboard, Genie y alerta (en `/Workspace/Shared/integratel-workshop`), proyecto Lakebase `integratel-retencion` |
| 2 | Knowledge Assistant *Integratel - Asistente de Retencion y Soporte*, Supervisor *Integratel - Copiloto de Retencion* (herramientas KA + Genie) |
| 3 | App *integratel-retencion-integratel* con su base Lakebase |

## 4. Verificación (5 min)

```sql
-- SQL Editor
SELECT cliente_id, nivel_riesgo, score_riesgo, reclamo_abierto_id
FROM integratel_prod.gold.cliente_360 WHERE cliente_id = 'CLI-104217';
-- Esperado: Crítico · 0.91 · RCL-2026-08812
```
- **Genie** (*Integratel · Genie de Retención y Soporte*): *¿Cuántos clientes en riesgo crítico o alto hay por distrito en Arequipa?* → 67, en Cayma.
- **KA** (*Agents*): *Un cliente con FIB-400 estuvo 3 días sin servicio, ¿cuánto le compenso?* → **S/10.90** con cita.
- **Supervisor**: *¿Por qué CLI-104217 está en riesgo crítico y qué le ofrezco según la política?* (~75 s).
- **App**: *Compute → Apps → integratel-retencion-integratel* → RUNNING; Rosa arriba en la cola.

## 5. Accesos para los participantes

- **Datos:** el pipeline ya otorga `USE CATALOG` sobre `integratel_prod` y `SELECT` sobre `gold` a `account users` (`sql/40_permisos.sql`); bronze y silver quedan cerrados.
- **Dashboard, Genie y App:** el Bundle da uso al grupo `users` del workspace.
- **Warehouse:** los participantes necesitan `CAN_USE` sobre el warehouse.
- **Knowledge Assistant y Supervisor:** en *Agents* → cada agente → *Permissions* → **Can query** al grupo `users`.

## 6. Después del workshop

```bash
databricks apps stop integratel-retencion-integratel -p integratel
databricks bundle destroy -t integratel -p integratel      # job, dashboard, Genie, alerta y App
```
Luego se borran a mano el KA y el Supervisor (*Agents*), el proyecto Lakebase `integratel-retencion` y el catálogo `integratel_prod` (`DROP CATALOG integratel_prod CASCADE`).
