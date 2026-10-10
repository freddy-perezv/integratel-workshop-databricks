#!/usr/bin/env bash
# Despliegue completo de un entorno (lo usan las personas y GitHub Actions por igual):
#   ./tools/deploy.sh dev        # o prod
# 1) genera app/app.yaml del entorno  2) compila la App  3) bundle deploy
# 4) inyecta el id del dashboard (existe recién tras el 1er deploy)  5) arranca la App
set -euo pipefail
TARGET="${1:-dev}"
cd "$(dirname "$0")/.."

dashboard_id() {
  databricks bundle summary -t "$TARGET" -o json 2>/dev/null \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["resources"].get("dashboards",{}).get("retencion",{}).get("id",""))' 2>/dev/null || true
}

echo "▶ [$TARGET] app.yaml + build de la App"
DASHBOARD_ID="$(dashboard_id)" python3 tools/render_app_yaml.py "$TARGET"
(cd app && ./scripts/build-app.sh >/dev/null)

echo "▶ [$TARGET] bundle deploy"
databricks bundle deploy -t "$TARGET" --auto-approve

NEW_ID="$(dashboard_id)"
if ! grep -q "value: \"$NEW_ID\"" app/app.yaml; then
  echo "▶ [$TARGET] inyectando DASHBOARD_ID=$NEW_ID y re-desplegando la App"
  DASHBOARD_ID="$NEW_ID" python3 tools/render_app_yaml.py "$TARGET"
  databricks bundle deploy -t "$TARGET" --auto-approve
fi

echo "▶ [$TARGET] arrancando la App"
databricks bundle run app_retencion -t "$TARGET"
