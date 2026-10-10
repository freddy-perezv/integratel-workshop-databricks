#!/usr/bin/env python3
"""Genera dashboards/retencion.lvdash.json (AI/BI) a partir de definiciones legibles.

Los datasets usan nombres de 2 niveles (gold.x): el catálogo lo fija el Bundle con
`dataset_catalog: ${var.catalog}`, así el mismo dashboard sirve en dev y en prod.

  python3 tools/generar_dashboard.py
"""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "dashboards", "retencion.lvdash.json")

DATASETS = {
    "kpi_riesgo": """SELECT MEASURE(clientes_riesgo_alto) AS clientes_riesgo_alto,
       MEASURE(renta_en_riesgo) AS renta_en_riesgo,
       MEASURE(consultas_portabilidad) AS consultas_portabilidad,
       MEASURE(clientes) AS clientes_activos
FROM gold.mv_riesgo_clientes""",
    "kpi_churn": """SELECT MEASURE(tasa_churn) AS tasa_churn_sep, MEASURE(bajas_portabilidad) AS bajas_portabilidad_sep
FROM gold.mv_churn WHERE mes = DATE'2026-09-01'""",
    "riesgo_zona": """SELECT concat(region, ' · ', distrito) AS zona, nivel_riesgo, MEASURE(clientes) AS clientes
FROM gold.mv_riesgo_clientes WHERE nivel_riesgo <> 'Bajo' GROUP BY ALL""",
    "riesgo_nivel": """SELECT nivel_riesgo, MEASURE(clientes) AS clientes FROM gold.mv_riesgo_clientes
WHERE nivel_riesgo <> 'Bajo' GROUP BY ALL""",
    "fallas_diarias": """SELECT fecha, region, MEASURE(fallas_red) AS fallas_red
FROM gold.mv_soporte WHERE fecha >= DATE'2026-09-01' GROUP BY ALL ORDER BY fecha""",
    "churn_mes": """SELECT mes, region, MEASURE(tasa_churn) AS tasa_churn
FROM gold.mv_churn WHERE mes < DATE'2026-10-01' GROUP BY ALL ORDER BY mes""",
    "reclamos_mes": """SELECT mes, tipo, MEASURE(reclamos) AS reclamos FROM gold.mv_reclamos GROUP BY ALL ORDER BY mes""",
    "nodos": """SELECT nodo_id, region, distrito, tecnologia, estado_salud, fallas_red_7d, fallas_red_30d,
       ultima_incidencia, clientes_riesgo_alto, renta_en_riesgo
FROM gold.nodos_salud ORDER BY fallas_red_30d DESC""",
    "top_clientes": """SELECT cliente_id, nombre_completo, distrito, segmento_valor, plan_hogar, renta_mensual,
       score_riesgo, nivel_riesgo, consulta_portabilidad_30d, reclamos_abiertos
FROM gold.cliente_360 WHERE estado = 'Activo' AND nivel_riesgo IN ('Crítico', 'Alto')
ORDER BY score_riesgo DESC, renta_mensual DESC LIMIT 25""",
}


def ds(name, sql):
    return {"name": name, "displayName": name, "queryLines": [l + "\n" for l in sql.splitlines()]}


def q(dataset, fields):
    return [{"name": "main_query", "query": {"datasetName": dataset,
             "fields": [{"name": n, "expression": f"`{n}`"} for n in fields], "disaggregated": True}}]


def counter(name, dataset, field, title, pos, fmt=None):
    enc = {"fieldName": field, "displayName": title}
    if fmt:
        enc["format"] = fmt
    return {"widget": {"name": name, "queries": q(dataset, [field]),
                       "spec": {"version": 2, "widgetType": "counter", "frame": {"showTitle": True, "title": title},
                                "encodings": {"value": enc}}}, "position": pos}


def chart(name, kind, dataset, x, y, title, pos, color=None, xtype="categorical", yfmt=None):
    fields = [x, y] + ([color] if color else [])
    yenc = {"fieldName": y, "scale": {"type": "quantitative"}, "displayName": y}
    if yfmt:
        yenc["format"] = yfmt
    enc = {"x": {"fieldName": x, "scale": {"type": xtype}, "displayName": x}, "y": yenc}
    if color:
        enc["color"] = {"fieldName": color, "scale": {"type": "categorical"}, "displayName": color}
    return {"widget": {"name": name, "queries": q(dataset, fields),
                       "spec": {"version": 3, "widgetType": kind, "frame": {"showTitle": True, "title": title},
                                "encodings": enc}}, "position": pos}


def pie(name, dataset, cat, val, title, pos):
    return {"widget": {"name": name, "queries": q(dataset, [cat, val]),
                       "spec": {"version": 3, "widgetType": "pie", "frame": {"showTitle": True, "title": title},
                                "encodings": {"angle": {"fieldName": val, "scale": {"type": "quantitative"}, "displayName": val},
                                              "color": {"fieldName": cat, "scale": {"type": "categorical"}, "displayName": cat}}}},
            "position": pos}


def table(name, dataset, cols, title, pos):
    return {"widget": {"name": name, "queries": q(dataset, cols),
                       "spec": {"version": 1, "widgetType": "table", "frame": {"showTitle": True, "title": title},
                                "encodings": {"columns": [{"fieldName": c, "displayName": c} for c in cols]}}},
            "position": pos}


def text(name, md, pos):
    return {"widget": {"name": name, "multilineTextboxSpec": {"lines": [md]}}, "position": pos}


PCT = {"type": "number-percent", "decimalPlaces": {"type": "max", "places": 1}}
SOLES = {"type": "number-currency", "currencyCode": "PEN", "abbreviation": "compact"}

pagina_riesgo = [
    text("t1", "# Retención · Riesgo de fuga\nCartera activa al **15-oct-2026**. Métricas gobernadas desde las *metric views* de Unity Catalog.",
         {"x": 0, "y": 0, "width": 6, "height": 2}),
    counter("k1", "kpi_riesgo", "clientes_riesgo_alto", "Clientes en riesgo crítico/alto", {"x": 0, "y": 2, "width": 2, "height": 3}),
    counter("k2", "kpi_riesgo", "renta_en_riesgo", "Renta mensual en riesgo (S/)", {"x": 2, "y": 2, "width": 2, "height": 3}, SOLES),
    counter("k3", "kpi_riesgo", "consultas_portabilidad", "Consultas de portabilidad (30 d)", {"x": 4, "y": 2, "width": 2, "height": 3}),
    chart("c1", "bar", "riesgo_zona", "zona", "clientes", "Clientes en riesgo (medio, alto, crítico) por zona", {"x": 0, "y": 5, "width": 4, "height": 6}, color="nivel_riesgo"),
    pie("c2", "riesgo_nivel", "nivel_riesgo", "clientes", "Distribución por nivel (sin 'Bajo')", {"x": 4, "y": 5, "width": 2, "height": 6}),
    table("tb1", "top_clientes", ["cliente_id", "nombre_completo", "distrito", "segmento_valor", "plan_hogar", "renta_mensual",
                                  "score_riesgo", "nivel_riesgo", "consulta_portabilidad_30d", "reclamos_abiertos"],
          "Clientes prioritarios para retención", {"x": 0, "y": 11, "width": 6, "height": 7}),
]
pagina_red = [
    text("t2", "# Soporte y red\nFallas de red diarias y salud de nodos. El pico de Arequipa corresponde a la incidencia **INC-AQP-2026-0412** (nodo AQP-CAY-03).",
         {"x": 0, "y": 0, "width": 6, "height": 2}),
    chart("c3", "line", "fallas_diarias", "fecha", "fallas_red", "Fallas de red por día y región", {"x": 0, "y": 2, "width": 6, "height": 6},
          color="region", xtype="temporal"),
    chart("c4", "bar", "reclamos_mes", "mes", "reclamos", "Reclamos por mes y tipo", {"x": 0, "y": 8, "width": 3, "height": 6},
          color="tipo", xtype="temporal"),
    table("tb2", "nodos", ["nodo_id", "region", "distrito", "tecnologia", "estado_salud", "fallas_red_7d", "fallas_red_30d",
                           "ultima_incidencia", "clientes_riesgo_alto", "renta_en_riesgo"],
          "Salud de nodos", {"x": 3, "y": 8, "width": 3, "height": 6}),
]
pagina_churn = [
    text("t3", "# Churn\nTasa de churn = bajas del mes / clientes activos al inicio del mes (definición única en `gold.mv_churn`).",
         {"x": 0, "y": 0, "width": 6, "height": 2}),
    counter("k4", "kpi_churn", "tasa_churn_sep", "Churn septiembre 2026", {"x": 0, "y": 2, "width": 3, "height": 3}, PCT),
    counter("k5", "kpi_churn", "bajas_portabilidad_sep", "Bajas por portabilidad (sep)", {"x": 3, "y": 2, "width": 3, "height": 3}),
    chart("c5", "line", "churn_mes", "mes", "tasa_churn", "Tasa de churn mensual por región", {"x": 0, "y": 5, "width": 6, "height": 7},
          color="region", xtype="temporal", yfmt=PCT),
]

dashboard = {
    "datasets": [ds(n, s) for n, s in DATASETS.items()],
    "pages": [
        {"name": "riesgo", "displayName": "Riesgo de fuga", "layout": pagina_riesgo, "pageType": "PAGE_TYPE_CANVAS"},
        {"name": "red", "displayName": "Soporte y red", "layout": pagina_red, "pageType": "PAGE_TYPE_CANVAS"},
        {"name": "churn", "displayName": "Churn", "layout": pagina_churn, "pageType": "PAGE_TYPE_CANVAS"},
    ],
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(dashboard, f, indent=2, ensure_ascii=False)
print(f"OK → {os.path.normpath(OUT)}")
