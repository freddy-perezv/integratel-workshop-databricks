#!/usr/bin/env python3
"""Crea (idempotente) el Supervisor Agent de Integratel y sus dos herramientas: el Knowledge Assistant y Genie.

  DATABRICKS_CONFIG_PROFILE=<profile> BUNDLE_TARGET=integratel python3 agents/setup_supervisor.py [--dry-run]

--dry-run: solo lee y muestra qué crearía; no crea nada ni escribe agents/recursos.json.

Requiere haber corrido antes agents/setup_knowledge_assistant.py (deja el KA en agents/recursos.json)
y un `bundle deploy` + pipeline del target (crea el espacio Genie). Espera a que el KA quede ACTIVE.
Agent Bricks aún no es un recurso de Bundle, así que se gestiona con la CLI (`databricks supervisor-agents`).
Guarda el endpoint del Supervisor en agents/recursos.json para la App.
"""
import json, os, subprocess, sys, time

PROFILE = os.environ.get("DATABRICKS_CONFIG_PROFILE", "ey-chile-demo")
TARGET = os.environ.get("BUNDLE_TARGET", "integratel")
DRY = "--dry-run" in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECURSOS = os.path.join(ROOT, "agents", "recursos.json")
NOMBRE = "Integratel - Copiloto de Retencion"
DESCRIPCION = ("Combina datos de clientes (Genie) con políticas y normativa (Knowledge Assistant) para resolver "
               "casos de retención y soporte.")
INSTRUCCIONES = ("Eres el copiloto de retención de Integratel. Para preguntas sobre DATOS de clientes, tickets, reclamos, "
                 "churn, nodos o incidencias usa la herramienta de datos (Genie). Para preguntas sobre POLÍTICAS, "
                 "procedimientos, normativa de reclamos, compensaciones, catálogo de planes o portabilidad usa el asistente "
                 "de conocimiento. Para un caso de cliente combina ambas: primero obtén los hechos del cliente con datos, "
                 "luego aplica la política con el asistente de conocimiento. Responde en español, conciso, con cifras y "
                 "citando el documento. Nunca sugieras condicionar la portabilidad.")
DESC_KA = ("Políticas, manuales y normativa oficiales de Integratel: troubleshooting de fibra/HFC/móvil, reclamos y "
           "compensaciones, política de retención 2026 (R1–R4), catálogo de planes, portabilidad y comunicado de la "
           "incidencia de Cayma. Responde con citas.")
DESC_GENIE = ("Datos de clientes de Integratel en Unity Catalog: ficha 360 y score de riesgo de fuga por cliente, tickets "
              "de soporte, reclamos, churn mensual, salud de nodos e incidencias de red. Úsalo para cifras, listas de "
              "clientes y hechos de un cliente específico (ej. CLI-104217).")


def cli(group, *args, body=None, retries=6):
    cmd = ["databricks", group, *args, "-p", PROFILE, "-o", "json"]
    if body is not None:
        cmd += ["--json", json.dumps(body)]
    for i in range(retries):
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            return json.loads(r.stdout or "{}")
        err = r.stderr.strip()
        if any(t in err for t in ("timed out", "INTERNAL_ERROR", "TEMPORARILY_UNAVAILABLE", "try again")):
            time.sleep(10 * (i + 1))
            continue
        raise RuntimeError(err)
    raise RuntimeError(f"reintentos agotados: {group} {' '.join(args)}")


def esperar_ka(nombre, minutos=45):
    """El KA indexa los PDFs al crearse; el Supervisor necesita su endpoint listo."""
    fin = time.time() + minutos * 60
    while True:
        ka = cli("knowledge-assistants", "get-knowledge-assistant", nombre)
        if ka.get("state") == "ACTIVE" and ka.get("endpoint_name"):
            return ka
        if time.time() > fin:
            raise RuntimeError(f"el KA no quedó ACTIVE en {minutos} min (estado: {ka.get('state')})")
        print(f"  KA en estado {ka.get('state')}… esperando")
        time.sleep(30)


def genie_space_id():
    if os.environ.get("GENIE_SPACE_ID"):
        return os.environ["GENIE_SPACE_ID"]
    r = subprocess.run(["databricks", "bundle", "summary", "-t", TARGET, "-p", PROFILE, "-o", "json"],
                       capture_output=True, text=True, cwd=ROOT)
    gid = json.loads(r.stdout or "{}").get("resources", {}).get("genie_spaces", {}).get("genie_retencion", {}).get("id")
    if not gid:
        raise RuntimeError(f"no encontré el espacio Genie del target '{TARGET}': corre antes el bundle deploy + pipeline")
    return gid


def main():
    rec = json.load(open(RECURSOS)) if os.path.exists(RECURSOS) else {}
    if "knowledge_assistant" not in rec:
        raise RuntimeError("falta el KA en agents/recursos.json: corre antes agents/setup_knowledge_assistant.py")
    ka = esperar_ka(rec["knowledge_assistant"]["name"])
    print(f"KA listo: {ka['endpoint_name']}")
    gid = genie_space_id()
    print(f"Genie: {gid}")

    sups = cli("supervisor-agents", "list-supervisor-agents")
    sups = sups if isinstance(sups, list) else sups.get("supervisor_agents", [])
    sup = next((s for s in sups if s.get("display_name") == NOMBRE), None)
    if not sup and DRY:
        print(f"[dry-run] crearía el Supervisor '{NOMBRE}' con herramientas asistente_conocimiento y datos_genie")
        return
    if not sup:
        sup = cli("supervisor-agents", "create-supervisor-agent", NOMBRE,
                  "--description", DESCRIPCION, "--instructions", INSTRUCCIONES)
        print(f"Supervisor creado: {sup['name']}")
    else:
        print(f"Supervisor existente: {sup['name']}")
    parent = sup["name"]

    tools = cli("supervisor-agents", "list-tools", parent)
    tools = tools if isinstance(tools, list) else tools.get("tools", [])
    ya = {t.get("tool_id") for t in tools}
    if DRY:
        for t in ("asistente_conocimiento", "datos_genie"):
            print(f"[dry-run] herramienta {t}: {'existe' if t in ya else 'la crearía'}")
        print(f"[dry-run] endpoint del Supervisor: {sup.get('endpoint_name')}")
        return
    if "asistente_conocimiento" not in ya:
        cli("supervisor-agents", "create-tool", parent, "asistente_conocimiento", "knowledge_assistant", body={
            "description": DESC_KA,
            "knowledge_assistant": {"knowledge_assistant_id": ka["id"] if "id" in ka else rec["knowledge_assistant"]["id"],
                                    "serving_endpoint_name": ka["endpoint_name"]}})
        print("  + herramienta asistente_conocimiento (KA)")
    if "datos_genie" not in ya:
        cli("supervisor-agents", "create-tool", parent, "datos_genie", "genie_space", body={
            "description": DESC_GENIE, "genie_space": {"id": gid}})
        print("  + herramienta datos_genie (Genie)")

    for _ in range(40):
        sup = cli("supervisor-agents", "get-supervisor-agent", parent)
        if sup.get("endpoint_name"):
            break
        time.sleep(15)
    rec["knowledge_assistant"]["endpoint_name"] = ka["endpoint_name"]
    rec["supervisor_agent"] = {"name": parent, "endpoint_name": sup.get("endpoint_name"),
                               "tools": ["asistente_conocimiento (KA)", f"datos_genie (Genie {gid})"]}
    json.dump(rec, open(RECURSOS, "w"), indent=2, ensure_ascii=False)
    print(f"OK → {RECURSOS} (Supervisor: {sup.get('endpoint_name')})")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
