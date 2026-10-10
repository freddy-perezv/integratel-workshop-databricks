#!/usr/bin/env python3
"""Ejecuta SQL en el SQL Warehouse vía la Statement Execution API (usa la CLI de Databricks).

Uso:
  tools/sql.py "SELECT 1"                       # una sentencia
  tools/sql.py -f sql/20_gold.sql -p catalog=integratel_dev   # archivo (separa por ';' fuera de $$...$$)
Variables: DATABRICKS_CONFIG_PROFILE (default ey-chile-demo), WAREHOUSE_ID (default 5060ebc0c46f84b1).
"""
import argparse, json, os, subprocess, sys, time

PROFILE = os.environ.get("DATABRICKS_CONFIG_PROFILE", "ey-chile-demo")
WAREHOUSE = os.environ.get("WAREHOUSE_ID", "5060ebc0c46f84b1")


def api(method, path, body=None):
    cmd = ["databricks", "api", method, path, "-p", PROFILE]
    if body is not None:
        cmd += ["--json", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or out.stdout.strip())
    return json.loads(out.stdout or "{}")


def split_sql(text):
    """Separa sentencias por ';' respetando strings, comentarios y bloques $$...$$."""
    stmts, buf, i, n = [], [], 0, len(text)
    in_s = in_d = in_dollar = False
    while i < n:
        c = text[i]
        if not (in_s or in_d or in_dollar) and text.startswith("--", i):
            j = text.find("\n", i)
            j = n if j < 0 else j
            buf.append(text[i:j]); i = j; continue
        if text.startswith("$$", i) and not (in_s or in_d):
            in_dollar = not in_dollar; buf.append("$$"); i += 2; continue
        if c == "'" and not (in_d or in_dollar):
            in_s = not in_s
        elif c == '"' and not (in_s or in_dollar):
            in_d = not in_d
        if c == ";" and not (in_s or in_d or in_dollar):
            stmts.append("".join(buf)); buf = []; i += 1; continue
        buf.append(c); i += 1
    stmts.append("".join(buf))
    clean = []
    for s in stmts:
        body = "\n".join(l for l in s.splitlines() if not l.strip().startswith("--")).strip()
        if body:
            clean.append(s.strip())
    return clean


def run(statement, params=None, catalog=None, schema=None, quiet=False):
    body = {"warehouse_id": WAREHOUSE, "statement": statement, "wait_timeout": "50s",
            "on_wait_timeout": "CONTINUE", "format": "JSON_ARRAY", "disposition": "INLINE"}
    if params:
        body["parameters"] = [{"name": k, "value": v} for k, v in params.items()]
    if catalog:
        body["catalog"] = catalog
    if schema:
        body["schema"] = schema
    r = api("post", "/api/2.0/sql/statements", body)
    while r["status"]["state"] in ("PENDING", "RUNNING"):
        time.sleep(3)
        r = api("get", f"/api/2.0/sql/statements/{r['statement_id']}")
    st = r["status"]["state"]
    if st != "SUCCEEDED":
        raise RuntimeError(f"{st}: {r['status'].get('error', {}).get('message', '')}\n--- SQL ---\n{statement[:800]}")
    cols = [c["name"] for c in r.get("manifest", {}).get("schema", {}).get("columns", [])]
    rows = r.get("result", {}).get("data_array", []) or []
    if not quiet and cols:
        print("\t".join(cols))
        for row in rows:
            print("\t".join("" if v is None else str(v) for v in row))
    return cols, rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sql", nargs="?")
    ap.add_argument("-f", "--file")
    ap.add_argument("-p", "--param", action="append", default=[], help="nombre=valor")
    ap.add_argument("--catalog")
    a = ap.parse_args()
    params = dict(p.split("=", 1) for p in a.param)
    text = open(a.file).read() if a.file else a.sql
    stmts = split_sql(text)
    for k, s in enumerate(stmts, 1):
        first = " ".join(s.split())[:90]
        print(f"[{k}/{len(stmts)}] {first}", file=sys.stderr)
        used = {k2: v for k2, v in params.items() if f":{k2}" in s}
        run(s, used or None, catalog=a.catalog)


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
