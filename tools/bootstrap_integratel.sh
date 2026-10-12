#!/usr/bin/env bash
# Despliegue compartido del workshop en el workspace PROPIO del cliente (target `integratel`).
# Lo corre una vez su admin, desde la raíz del repo clonado. Idempotente: se puede re-ejecutar.
#
#   ./tools/bootstrap_integratel.sh <profile> [nivel]
#
#   nivel 1 · datos + pipeline SQL + dashboard + Genie + alerta      (CLI + python3)      ~15 min
#   nivel 2 · Knowledge Assistant + Supervisor Agent                  (CLI + python3)      ~30-45 min (indexa PDFs)
#   nivel 3 · Databricks App + Lakebase                               (+ node 20+, psql)   ~15 min
#   Sin [nivel] corre 1, 2 y 3 en orden. Cada nivel requiere el anterior.
#
# Variables opcionales:
#   WAREHOUSE_ID   SQL Warehouse a usar (por defecto busca "Serverless Starter Warehouse")
#   STORAGE_ROOT   ubicación (abfss://, s3://, gs://) para crear el catálogo, si el metastore la exige
#   AGENT_MODEL    endpoint del LLM de la App (por defecto databricks-claude-sonnet-5-5)
#
# Windows: correr en Git Bash (viene con Git for Windows) o WSL; PowerShell/CMD no sirven.
set -euo pipefail

PROFILE="${1:?Uso: $0 <profile> [1|2|3]}"
NIVEL="${2:-todo}"
cd "$(dirname "$0")/.."
export DATABRICKS_CONFIG_PROFILE="$PROFILE"

# ── Windows (Git Bash / MSYS): ajustes que heredan todos los scripts que se llaman ─────
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
        # Sin esto Git Bash convierte /Workspace/... en C:/Program Files/Git/Workspace/...
        export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
        # Python en Windows usa cp1252 por defecto: los acentos de recursos.json lo rompen.
        export PYTHONUTF8=1 PYTHONIOENCODING=utf-8
        # `python3` suele no existir (o abre la Microsoft Store): se crea un alias a python / py -3.
        if ! python3 -c 'import sys' >/dev/null 2>&1; then
            mkdir -p .bootstrap-bin
            if python -c 'import sys; assert sys.version_info >= (3, 8)' >/dev/null 2>&1; then
                printf '#!/usr/bin/env bash\nexec python "$@"\n' > .bootstrap-bin/python3
            elif py -3 -c 'import sys' >/dev/null 2>&1; then
                printf '#!/usr/bin/env bash\nexec py -3 "$@"\n' > .bootstrap-bin/python3
            fi
            chmod +x .bootstrap-bin/python3 2>/dev/null || true
            export PATH="$PWD/.bootstrap-bin:$PATH"
        fi
        # El instalador de PostgreSQL no agrega psql al PATH.
        if ! command -v psql >/dev/null; then
            for d in "/c/Program Files/PostgreSQL"/*/bin; do [[ -x "$d/psql.exe" ]] && export PATH="$PATH:$d"; done
        fi
        ;;
esac
TARGET=integratel
CATALOG=integratel_prod
APP_NAME="integratel-retencion-$TARGET"

paso() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  ✓ %s\n' "$*"; }
falla() { printf '\n✗ %s\n' "$*" >&2; exit 1; }
existe() { "$@" >/dev/null 2>&1; }

# ── Comprobaciones comunes ──────────────────────────────────────────────────
paso "Comprobando herramientas y acceso ($PROFILE)"
command -v databricks >/dev/null || falla "falta la Databricks CLI (Windows: winget install Databricks.DatabricksCLI, y reabre Git Bash)"
python3 -c "import sys" >/dev/null 2>&1 || falla "falta Python 3 (Windows: winget install Python.Python.3.12, y reabre Git Bash)"
YO="$(databricks current-user me -o json | python3 -c 'import sys,json; print(json.load(sys.stdin)["userName"])')" \
    || falla "no pude autenticar con el profile '$PROFILE': databricks auth login --profile $PROFILE"
ok "usuario: $YO · CLI $(databricks version 2>/dev/null | tr -d '\n')"

if [[ -z "${WAREHOUSE_ID:-}" ]]; then
    WAREHOUSE_ID="$(databricks warehouses list -o json | python3 -c '
import sys,json
ws=json.load(sys.stdin)
w=next((w for w in ws if w.get("name")=="Serverless Starter Warehouse"), None) or next((w for w in ws if w.get("enable_serverless_compute")), None)
print(w["id"] if w else "")')"
fi
[[ -n "$WAREHOUSE_ID" ]] || falla "no encontré un SQL Warehouse serverless: exporta WAREHOUSE_ID=<id>"
export BUNDLE_VAR_warehouse_id="$WAREHOUSE_ID" WAREHOUSE_ID
ok "warehouse: $WAREHOUSE_ID"

# ── Nivel 1 ─────────────────────────────────────────────────────────────────
nivel1() {
    paso "Nivel 1 · Catálogo, schemas y volumes"
    if existe databricks catalogs get "$CATALOG"; then
        ok "catálogo $CATALOG ya existe"
    else
        databricks catalogs create "$CATALOG" ${STORAGE_ROOT:+--storage-root "$STORAGE_ROOT"} \
            --comment "Workshop Integratel · Retener sin multas (datos sintéticos)" >/dev/null \
            || falla "no pude crear $CATALOG (¿el metastore exige ubicación? exporta STORAGE_ROOT=…)"
        ok "catálogo $CATALOG creado"
    fi
    for s in bronze conocimiento; do
        existe databricks schemas get "$CATALOG.$s" || databricks schemas create "$s" "$CATALOG" >/dev/null
        ok "schema $CATALOG.$s"
    done
    existe databricks volumes read "$CATALOG.bronze.landing" || databricks volumes create "$CATALOG" bronze landing MANAGED >/dev/null
    existe databricks volumes read "$CATALOG.conocimiento.documentos" || databricks volumes create "$CATALOG" conocimiento documentos MANAGED >/dev/null
    ok "volumes bronze.landing y conocimiento.documentos"

    paso "Nivel 1 · Subiendo datos sintéticos (CSV) y documentos (PDF)"
    databricks fs cp -r --overwrite data/landing "dbfs:/Volumes/$CATALOG/bronze/landing" >/dev/null
    databricks fs cp -r --overwrite knowledge/pdfs "dbfs:/Volumes/$CATALOG/conocimiento/documentos" >/dev/null
    ok "$(ls data/landing | wc -l | tr -d ' ') CSV y $(ls knowledge/pdfs | wc -l | tr -d ' ') PDF"

    paso "Nivel 1 · Carpeta compartida y base Lakebase (la App la referencia)"
    databricks workspace mkdirs /Workspace/Shared/integratel-workshop
    (cd app && ./scripts/lakebase_setup_db.sh --db-name integratel_retencion --project-id integratel-retencion) \
        || falla "no pude crear el proyecto Lakebase integratel-retencion"
    ok "Lakebase integratel-retencion/production"

    paso "Nivel 1 · Primer bundle deploy (Genie y App pueden fallar: gold aún no existe)"
    databricks bundle deploy -t "$TARGET" --auto-approve || echo "  (esperado en el primer despliegue; sigue)"

    paso "Nivel 1 · Pipeline SQL: bronze → silver → gold → metric views → permisos → 6 tests (~3 min)"
    databricks bundle run pipeline_sql -t "$TARGET" || falla "el pipeline falló: revisa el run del job en el workspace"
    ok "pipeline + tests en verde"

    paso "Nivel 1 · Segundo bundle deploy (ahora sí Genie, dashboard y alerta)"
    databricks bundle deploy -t "$TARGET" --auto-approve || falla "el segundo deploy falló"
    ok "dashboard, Genie y alerta desplegados"
    python3 tools/sql.py "SELECT cliente_id, nivel_riesgo, score_riesgo, reclamo_abierto_id FROM $CATALOG.gold.cliente_360 WHERE cliente_id='CLI-104217'"
}

# ── Nivel 2 ─────────────────────────────────────────────────────────────────
nivel2() {
    paso "Nivel 2 · Knowledge Assistant (7 PDFs + 14 ejemplos de evaluación)"
    python3 agents/setup_knowledge_assistant.py || falla "no pude crear el Knowledge Assistant"
    paso "Nivel 2 · Supervisor Agent (espera a que el KA termine de indexar)"
    BUNDLE_TARGET="$TARGET" python3 agents/setup_supervisor.py || falla "no pude crear el Supervisor"
}

# ── Nivel 3 ─────────────────────────────────────────────────────────────────
nivel3() {
    paso "Nivel 3 · Comprobando node y psql"
    command -v node >/dev/null || falla "falta Node.js 20+ para compilar la App (Windows: winget install OpenJS.NodeJS.LTS)"
    command -v psql >/dev/null || falla "falta psql (Windows: winget install PostgreSQL.PostgreSQL.17 · macOS: brew install libpq && brew link --force libpq)"
    ok "node $(node --version) · $(psql --version | head -1)"
    # La App crea y es dueña de sus schemas en Lakebase al primer arranque: no conectes tu usuario
    # a la base integratel_retencion antes de este paso (si no, los schemas quedan a tu nombre).
    paso "Nivel 3 · Build + deploy de la App"
    ./tools/deploy.sh "$TARGET"
    paso "Nivel 3 · Permisos de la App en Lakebase"
    (cd app && ./scripts/lakebase_grant_app_credential.sh --app-name "$APP_NAME" \
        --project-id integratel-retencion --db-name integratel_retencion --branch-id production)
    paso "Nivel 3 · Arrancando la App (sincroniza gold → Lakebase)"
    databricks bundle run app_retencion -t "$TARGET"
    databricks apps get "$APP_NAME" -o json | python3 -c 'import sys,json; d=json.load(sys.stdin); print("  ✓ App", d["app_status"]["state"], d.get("url",""))'
}

case "$NIVEL" in
    1) nivel1 ;;
    2) nivel2 ;;
    3) nivel3 ;;
    todo) nivel1; nivel2; nivel3 ;;
    *) falla "nivel inválido: $NIVEL (usa 1, 2 o 3)" ;;
esac
paso "Listo (nivel $NIVEL). Verificación: docs/BOOTSTRAP_INTEGRATEL.md §4"
