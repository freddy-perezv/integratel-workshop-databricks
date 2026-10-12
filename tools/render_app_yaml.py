#!/usr/bin/env python3
"""Genera app/app.yaml para un entorno (dev | prod | integratel) desde app/app.yaml.tmpl.

  python3 tools/render_app_yaml.py dev

Lo corre tools/deploy.sh y el pipeline de CI/CD antes de `databricks bundle deploy`.
En `integratel` (workspace del cliente) los endpoints del KA y del Supervisor se leen de
agents/recursos.json, que escriben los scripts de agents/ al crearlos en ese workspace.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTORNOS = {
    "dev": {"DEMO_CATALOG": "integratel_dev"},
    "prod": {"DEMO_CATALOG": "integratel_prod"},
    "integratel": {"DEMO_CATALOG": "integratel_prod"},
}
COMUNES = {
    "DEMO_SCHEMA": "gold",
    "MAS_ENDPOINT_NAME": "mas-9a907f04-endpoint",
    "AGENT_MODEL": "databricks-claude-sonnet-5-5",
    "DASHBOARD_ID": os.environ.get("DASHBOARD_ID", ""),
}

target = sys.argv[1] if len(sys.argv) > 1 else "dev"
if target == "integratel":
    rec = json.load(open(os.path.join(ROOT, "agents", "recursos.json"), encoding="utf-8"))
    COMUNES["MAS_ENDPOINT_NAME"] = rec["supervisor_agent"]["endpoint_name"]
    COMUNES["KA_ENDPOINT_NAME"] = rec["knowledge_assistant"]["endpoint_name"]
    COMUNES["AGENT_MODEL"] = os.environ.get("AGENT_MODEL", COMUNES["AGENT_MODEL"])
valores = {**COMUNES, **ENTORNOS[target], "AGENT_MLFLOW_EXPERIMENT_PATH": f"/Shared/integratel-workshop/retencion-{target}-agent-traces"}
tmpl = open(os.path.join(ROOT, "app", "app.yaml.tmpl"), encoding="utf-8").read()
extra = "".join(f'  - name: {k}\n    value: "{v}"\n' for k, v in valores.items())
out = tmpl.rstrip() + "\n\n  # ── Generado por tools/render_app_yaml.py (" + target + ") ──\n" + extra
open(os.path.join(ROOT, "app", "app.yaml"), "w", encoding="utf-8").write(out)
print(f"app/app.yaml → {target}: {valores['DEMO_CATALOG']}")
