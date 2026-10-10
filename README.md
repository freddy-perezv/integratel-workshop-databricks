# Workshop Databricks · Integratel — "Retener sin multas"

Workshop de 3 horas (formato híbrido) sobre **Databricks Apps**, **Agent Bricks (Knowledge Assistant + Supervisor)** y **CI/CD de Databricks SQL de desarrollo a producción**.
Todo el contenido (datos, documentos, políticas) es **sintético** y fue creado solo para este workshop.

## La historia
Una incidencia masiva en el nodo de fibra de Cayma (Arequipa) dispara tickets, reclamos y consultas de portabilidad.
Tres personajes la resuelven con la plataforma: **Lucía** (analista SQL) define las métricas, **Diego** (plataforma) las lleva a producción con CI/CD,
y **Carla** (ejecutiva de retención) actúa desde una Databricks App con un copiloto que combina datos y documentos oficiales. Detalle en [`docs/CANON.md`](docs/CANON.md).

## Qué hay en el repo
| Carpeta | Contenido |
|---|---|
| `sql/` | Pipeline Databricks SQL: bronze → silver → gold → metric views (parametrizado por catálogo) |
| `tests/` | Tests de calidad en SQL (`raise_error`): si uno falla, no se promueve a producción |
| `resources/` | Declarative Automation Bundle: job SQL, dashboard AI/BI, alerta, espacio Genie y la App |
| `dashboards/` | Dashboard AI/BI (`.lvdash.json`, generado por `tools/generar_dashboard.py`) |
| `knowledge/` | 7 documentos (PDF) del Knowledge Assistant + set de evaluación |
| `agents/` | Scripts de Agent Bricks (Knowledge Assistant y Supervisor) |
| `app/` | Databricks App "Centro de Retención 360" (AppKit + Lakebase + agente) |
| `.github/workflows/` | CI (PR → dev + tests) y CD (main → aprobación → prod) |
| `data/landing/` | CSVs sintéticos (generados por `tools/generar_datos.py`, semilla 42) |

## Flujo de CI/CD
```
rama ──PR──▶ CI: validate → deploy dev → pipeline SQL + tests ──✅──▶ merge a main
                                                                       │
                                     CD: aprobación manual (environment "produccion")
                                                                       ▼
                                          deploy prod → pipeline SQL + tests en prod
```
Todo se despliega y ejecuta como el service principal `sp-integratel-cicd`.

## Comandos útiles
```bash
databricks bundle validate -t dev
python3 tools/render_app_yaml.py dev && (cd app && ./scripts/build-app.sh)
databricks bundle deploy -t dev
databricks bundle run pipeline_sql -t dev
python3 tools/probar_app.py dev     # prueba de humo del flujo de Rosa en la App
```
