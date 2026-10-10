#!/usr/bin/env python3
"""Crea (idempotente) el Knowledge Assistant de Integratel, su fuente de documentos y el set de evaluación.

  python3 agents/setup_knowledge_assistant.py

Agent Bricks aún no es un recurso de Bundle, así que se gestiona con la CLI (`databricks knowledge-assistants`).
Guarda los IDs en agents/recursos.json para la App y el Supervisor.
"""
import json, os, subprocess, sys, time

PROFILE = os.environ.get("DATABRICKS_CONFIG_PROFILE", "ey-chile-demo")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECURSOS = os.path.join(ROOT, "agents", "recursos.json")
NOMBRE = "Integratel - Asistente de Retencion y Soporte"
VOLUME = "/Volumes/integratel_prod/conocimiento/documentos/"
DESCRIPCION = ("Responde preguntas sobre troubleshooting de fibra/HFC/móvil, reclamos y compensaciones, política de "
               "retención 2026, catálogo de planes, portabilidad y la incidencia masiva de Cayma, citando los documentos oficiales.")
INSTRUCCIONES = ("Eres el asistente experto de Integratel para ejecutivos de retención y soporte. Responde SIEMPRE en español, "
                 "de forma concreta y accionable, citando el documento y la sección (ej. POL-RET-2026 §3). Cuando haya montos, "
                 "muestra el cálculo. Si una acción requiere aprobación, dilo explícitamente y quién aprueba. Nunca sugieras "
                 "obstaculizar o condicionar la portabilidad. Si la respuesta no está en los documentos, dilo y no inventes.")


def cli(*args, body=None, retries=6):
    cmd = ["databricks", "knowledge-assistants", *args, "-p", PROFILE, "-o", "json"]
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
    raise RuntimeError(f"reintentos agotados: {' '.join(args)}")


def main():
    rec = json.load(open(RECURSOS)) if os.path.exists(RECURSOS) else {}
    kas = cli("list-knowledge-assistants")
    kas = kas if isinstance(kas, list) else kas.get("knowledge_assistants", [])
    ka = next((k for k in kas if k.get("display_name") == NOMBRE), None)
    if not ka:
        ka = cli("create-knowledge-assistant", NOMBRE, DESCRIPCION, "--instructions", INSTRUCCIONES)
        print(f"KA creado: {ka['name']}")
    else:
        print(f"KA existente: {ka['name']}")
    parent = ka["name"]

    fuentes = cli("list-knowledge-sources", parent)
    fuentes = fuentes if isinstance(fuentes, list) else fuentes.get("knowledge_sources", [])
    if not any(f.get("files", {}).get("path") == VOLUME for f in fuentes):
        cli("create-knowledge-source", parent, body={
            "display_name": "Documentos oficiales Integratel",
            "description": "Manuales técnicos, guía de reclamos, política de retención 2026, catálogo de planes, "
                           "procedimiento de portabilidad, contrato/FAQ y comunicado de la incidencia INC-AQP-2026-0412.",
            "source_type": "files", "files": {"path": VOLUME}})
        print("Fuente de documentos creada")

    existentes = cli("list-examples", parent)
    existentes = existentes if isinstance(existentes, list) else existentes.get("examples", [])
    ya = {e.get("question") for e in existentes}
    evals = json.load(open(os.path.join(ROOT, "knowledge", "ka_eval.json")))
    for e in evals:
        if e["question"] in ya:
            continue
        cli("create-example", parent, body={"question": e["question"], "guidelines": e["guidelines"]})
        print(f"  + ejemplo: {e['question'][:70]}")

    rec["knowledge_assistant"] = {"name": parent, "id": ka["id"], "endpoint_name": ka.get("endpoint_name")}
    json.dump(rec, open(RECURSOS, "w"), indent=2, ensure_ascii=False)
    print(f"OK → {RECURSOS}")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        sys.exit(f"ERROR: {e}")
