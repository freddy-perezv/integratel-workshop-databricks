#!/usr/bin/env python3
"""Genera app/app.yaml para un entorno (dev | prod) desde app/app.yaml.tmpl.

  python3 tools/render_app_yaml.py dev

Lo corre tools/deploy.sh y el pipeline de CI/CD antes de `databricks bundle deploy`.
"""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTORNOS = {
    "dev": {"DEMO_CATALOG": "integratel_dev", "DASHBOARD_ID": "01f1c4242ec9191fbec80fed77227449"},
    "prod": {"DEMO_CATALOG": "integratel_prod"},
}
COMUNES = {
    "DEMO_SCHEMA": "gold",
    "MAS_ENDPOINT_NAME": "mas-9a907f04-endpoint",
    "AGENT_MODEL": "databricks-claude-sonnet-5-5",
    "DASHBOARD_ID": os.environ.get("DASHBOARD_ID", ""),
}

target = sys.argv[1] if len(sys.argv) > 1 else "dev"
valores = {**COMUNES, **ENTORNOS[target], "AGENT_MLFLOW_EXPERIMENT_PATH": f"/Shared/integratel-workshop/retencion-{target}-agent-traces"}
tmpl = open(os.path.join(ROOT, "app", "app.yaml.tmpl"), encoding="utf-8").read()
extra = "".join(f'  - name: {k}\n    value: "{v}"\n' for k, v in valores.items())
out = tmpl.rstrip() + "\n\n  # ── Generado por tools/render_app_yaml.py (" + target + ") ──\n" + extra
open(os.path.join(ROOT, "app", "app.yaml"), "w", encoding="utf-8").write(out)
print(f"app/app.yaml → {target}: {valores['DEMO_CATALOG']}")
