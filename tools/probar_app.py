#!/usr/bin/env python3
"""Prueba de humo del flujo protagonista contra la App desplegada (SSE /api/chat/stream).

  python3 tools/probar_app.py [dev|prod]

Recorre los pasos del guion de Rosa (investigar → plan → aprobar) y muestra, por turno,
las herramientas que usó el agente y la respuesta final.
"""
import json, subprocess, sys, urllib.request

TARGET = sys.argv[1] if len(sys.argv) > 1 else "dev"
URL = f"https://integratel-retencion-{TARGET}-7405608876622599.19.azure.databricksapps.com"
PASOS = [
    "¿Por qué Rosa Huamán (CLI-104217) está en riesgo crítico y qué dice la política que le puedo ofrecer?",
    "Prepara el plan de retención para Rosa con el guion de llamada.",
    "Sí, registra el plan con 25% de descuento.",
]

TOKEN = json.loads(subprocess.check_output(
    ["databricks", "auth", "token", "-p", "ey-chile-demo", "-o", "json"]))["access_token"]


def post(path, body, stream=False):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=600)


def turno(convo_id, historial):
    texto, tools = [], []
    with post("/api/chat/stream", {"conversationId": convo_id, "messages": historial}) as r:
        for raw in r:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"):
                continue
            try:
                ev = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                continue
            t = ev.get("type", "")
            if t == "response.output_text.delta":
                texto.append(ev.get("delta", ""))
            elif t == "response.output_item.done":
                item = ev.get("item", {})
                if item.get("type") in ("function_call", "tool_call"):
                    tools.append(item.get("name"))
            elif t in ("error", "response.error"):
                texto.append(f"\n[ERROR] {ev}")
    return "".join(texto), tools


convo = json.load(post("/api/conversations", {"title": f"Prueba {TARGET}"}))
historial = []
for i, paso in enumerate(PASOS, 1):
    historial.append({"role": "user", "content": paso})
    respuesta, tools = turno(convo["id"], historial)
    historial.append({"role": "assistant", "content": respuesta})
    print(f"\n━━ Paso {i}: {paso}\n   herramientas: {tools}\n")
    print(respuesta.strip()[:2500])
