#!/usr/bin/env python3
"""Generador determinista de datos sintéticos — Workshop Integratel "Retener sin multas".

Escribe CSVs en data/landing/ (semilla 42, fecha ancla 2026-10-15). Los hechos clave
(planes, nodo AQP-CAY-03, incidencia INC-AQP-2026-0412, cliente CLI-104217) siguen docs/CANON.md.

Uso: python3 tools/generar_datos.py
"""
import csv, os, random
from datetime import date, datetime, timedelta

random.seed(42)
ANCHOR = date(2026, 10, 15)
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "landing")
N_CLIENTES = 12000

PLANES = [
    # plan_codigo, nombre, tipo, tecnologia, precio, velocidad_mbps, datos_gb
    ("MOV-MAX-39", "Max 39.90", "Movil postpago", "MOVIL", 39.90, None, 25),
    ("MOV-MAX-59", "Max 59.90", "Movil postpago", "MOVIL", 59.90, None, 60),
    ("MOV-ILI-79", "Max Ilimitado 79.90", "Movil postpago", "MOVIL", 79.90, None, 120),
    ("MOV-ILI-109", "Max Ilimitado Plus 109.90", "Movil postpago", "MOVIL", 109.90, None, 250),
    ("PRE-REC", "Prepago Recarga", "Movil prepago", "MOVIL", 0.00, None, None),
    ("FIB-200", "Fibra 200 Mbps", "Hogar", "FTTH", 89.00, 200, None),
    ("FIB-400", "Fibra 400 Mbps", "Hogar", "FTTH", 109.00, 400, None),
    ("FIB-600", "Fibra 600 Mbps", "Hogar", "FTTH", 129.00, 600, None),
    ("FIB-1000", "Fibra 1 Gbps", "Hogar", "FTTH", 169.00, 1000, None),
    ("HFC-100", "Cable 100 Mbps", "Hogar", "HFC", 79.00, 100, None),
    ("HFC-200", "Cable 200 Mbps", "Hogar", "HFC", 95.00, 200, None),
]
PRECIO = {p[0]: p[4] for p in PLANES}

# nodo_id, region, provincia, distrito, tecnologia, lat, lng
NODOS = [
    ("LIM-MIR-01", "Lima", "Lima", "Miraflores", "FTTH", -12.1211, -77.0297),
    ("LIM-SIS-02", "Lima", "Lima", "San Isidro", "FTTH", -12.0977, -77.0365),
    ("LIM-SUR-02", "Lima", "Lima", "Santiago de Surco", "FTTH", -12.1459, -76.9917),
    ("LIM-SJL-04", "Lima", "Lima", "San Juan de Lurigancho", "FTTH", -11.9816, -77.0067),
    ("LIM-COM-05", "Lima", "Lima", "Comas", "FTTH", -11.9447, -77.0623),
    ("LIM-ATE-03", "Lima", "Lima", "Ate", "HFC", -12.0262, -76.9180),
    ("LIM-CAL-01", "Lima", "Callao", "Callao", "HFC", -12.0566, -77.1181),
    ("AQP-CAY-03", "Arequipa", "Arequipa", "Cayma", "FTTH", -16.3826, -71.5467),
    ("AQP-CER-01", "Arequipa", "Arequipa", "Cerro Colorado", "FTTH", -16.3721, -71.5591),
    ("AQP-JLB-04", "Arequipa", "Arequipa", "José Luis Bustamante y Rivero", "FTTH", -16.4285, -71.5225),
    ("AQP-YAN-02", "Arequipa", "Arequipa", "Yanahuara", "HFC", -16.3887, -71.5440),
    ("TRU-VIC-01", "La Libertad", "Trujillo", "Víctor Larco Herrera", "FTTH", -8.1340, -79.0450),
    ("TRU-CEN-02", "La Libertad", "Trujillo", "Trujillo", "HFC", -8.1116, -79.0288),
    ("PIU-CAS-01", "Piura", "Piura", "Castilla", "FTTH", -5.1960, -80.6260),
    ("PIU-CEN-02", "Piura", "Piura", "Piura", "HFC", -5.1945, -80.6328),
    ("CIX-CEN-01", "Lambayeque", "Chiclayo", "Chiclayo", "FTTH", -6.7714, -79.8409),
    ("CIX-LVI-02", "Lambayeque", "Chiclayo", "La Victoria", "HFC", -6.7900, -79.8380),
    ("CUS-WAN-01", "Cusco", "Cusco", "Wanchaq", "FTTH", -13.5250, -71.9600),
    ("CUS-SSE-02", "Cusco", "Cusco", "San Sebastián", "FTTH", -13.5320, -71.9330),
    ("HYO-TAM-01", "Junín", "Huancayo", "El Tambo", "FTTH", -12.0560, -75.2140),
    ("HYO-CEN-02", "Junín", "Huancayo", "Huancayo", "HFC", -12.0651, -75.2049),
]
CELDAS = {"Lima": "CEL-LIM-01", "Arequipa": "CEL-AQP-01", "La Libertad": "CEL-TRU-01", "Piura": "CEL-PIU-01",
          "Lambayeque": "CEL-CIX-01", "Cusco": "CEL-CUS-01", "Junín": "CEL-HYO-01"}
REGION_PESO = [("Lima", 0.44), ("Arequipa", 0.20), ("La Libertad", 0.09), ("Piura", 0.07),
               ("Lambayeque", 0.07), ("Cusco", 0.07), ("Junín", 0.06)]

NOMBRES_F = ["María", "Rosa", "Carmen", "Ana", "Luz", "Lucía", "Milagros", "Patricia", "Elena", "Gabriela",
             "Daniela", "Sofía", "Valeria", "Fiorella", "Karina", "Jessica", "Diana", "Teresa", "Julia", "Mónica"]
NOMBRES_M = ["José", "Luis", "Carlos", "Jorge", "Juan", "Miguel", "César", "Víctor", "Raúl", "Pedro",
             "Diego", "Renzo", "Gonzalo", "Alonso", "Martín", "Fernando", "Ricardo", "Héctor", "Iván", "Julio"]
APELLIDOS = ["Quispe", "Flores", "Huamán", "Mamani", "Rojas", "Sánchez", "García", "Torres", "Ramos", "Chávez",
             "Vásquez", "Mendoza", "Castillo", "Díaz", "Gutiérrez", "Paredes", "Salazar", "Condori", "Cruz", "Vargas",
             "Ccama", "Apaza", "Villanueva", "Espinoza", "Córdova", "Ríos", "Herrera", "Medina", "Aguilar", "Silva"]
OPERADORES = ["Operador A", "Operador B", "Operador C"]
CANALES_TICKET = [("App Integratel", 0.30), ("Call center", 0.40), ("WhatsApp", 0.20), ("Tienda", 0.10)]

DESCR = {
    "F-101": ["Cliente indica que el módem tiene la luz LOS en rojo y no tiene internet desde la mañana.",
              "Sin servicio de internet. El equipo muestra LOS rojo, ya reinició y sigue igual.",
              "Corte total de fibra, luz roja en el ONT. Cliente molesto, trabaja desde casa.",
              "Reporta que es la tercera vez en la semana que se cae el internet con luz roja LOS."],
    "F-102": ["La luz PON parpadea y no conecta. Cliente reinició el equipo varias veces.",
              "ONT sin registro, luz PON intermitente después de un corte de luz."],
    "F-201": ["Internet lento en horario nocturno, no llega a la velocidad contratada.",
              "Señal WiFi débil en el segundo piso, se corta la videollamada.",
              "Velocidad muy por debajo del plan, test indica 40 Mbps."],
    "F-301": ["Módem de cable sin sincronía, luces parpadeando. Sin internet.",
              "Servicio de cable intermitente, se desconecta cada hora."],
    "M-401": ["No tiene señal de datos móviles en su zona desde ayer.",
              "Llamadas se cortan y los datos no cargan en el centro de la ciudad."],
    "B-501": ["Cliente indica cobro duplicado en su recibo del mes.",
              "Reclama cargo no reconocido por servicio adicional en su recibo."],
}
HORAS_RESOL = {"F-101": (12, 60), "F-102": (2, 24), "F-201": (4, 72), "F-301": (6, 48), "M-401": (3, 36), "B-501": (24, 120)}
CODIGOS_TEC = {"FTTH": [("F-101", 0.22), ("F-102", 0.20), ("F-201", 0.48), ("B-501", 0.10)],
               "HFC": [("F-301", 0.50), ("F-201", 0.35), ("B-501", 0.15)],
               "MOVIL": [("M-401", 0.70), ("B-501", 0.30)]}
TASA_TICKETS_MES = {"FTTH": 0.12, "HFC": 0.20, "MOVIL": 0.06}

INC_ID, INC_NODO = "INC-AQP-2026-0412", "AQP-CAY-03"
INC_INI, INC_FIN = datetime(2026, 10, 2, 8, 15), datetime(2026, 10, 11, 18, 40)
INC_AFECTADOS = 1184
INCIDENCIAS_MENORES = [  # incidencia_id, nodo, inicio, horas, tipo, severidad, descripcion
    ("INC-LIM-2026-0398", "LIM-SJL-04", datetime(2026, 9, 12, 21, 5), 6, "Corte de fibra troncal", "Alta",
     "Corte de fibra troncal por obra municipal en Av. Próceres."),
    ("INC-PIU-2026-0405", "PIU-CAS-01", datetime(2026, 9, 27, 14, 30), 9, "Falla de energía en nodo", "Media",
     "Caída de energía comercial y falla de UPS en el nodo Castilla."),
    ("INC-TRU-2026-0379", "TRU-CEN-02", datetime(2026, 8, 18, 3, 10), 5, "Falla de amplificador HFC", "Media",
     "Amplificador de red HFC averiado en sector centro."),
    ("INC-CUS-2026-0360", "CUS-WAN-01", datetime(2026, 7, 29, 10, 0), 4, "Mantenimiento correctivo", "Baja",
     "Reemplazo de tarjeta OLT con ventana extendida."),
]


def pick(weighted):
    r, acc = random.random(), 0.0
    for v, w in weighted:
        acc += w
        if r <= acc:
            return v
    return weighted[-1][0]


def rdate(a, b):
    return a + timedelta(days=random.randint(0, (b - a).days))


def rdt(d, h0=8, h1=22):
    return datetime(d.year, d.month, d.day, random.randint(h0, h1 - 1), random.randint(0, 59))


def poisson(lam):
    import math
    L, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= random.random()
        if p <= L:
            return k
        k += 1


def month_start(d):
    return date(d.year, d.month, 1)


def write(name, header, rows):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        for r in rows:
            w.writerow(["" if v is None else v for v in r])
    print(f"  {name:28s} {len(rows):>7,} filas")


def main():
    nodos_por_region = {}
    for n in NODOS:
        nodos_por_region.setdefault(n[1], []).append(n)
    nodo_info = {n[0]: n for n in NODOS}

    # ── Clientes ──────────────────────────────────────────────────────────
    clientes, servicios = [], []
    regiones = [pick(REGION_PESO) for _ in range(N_CLIENTES)]
    # Garantiza exactamente INC_AFECTADOS clientes FTTH en AQP-CAY-03 activos al inicio de la incidencia.
    aqp_idx = [i for i, r in enumerate(regiones) if r == "Arequipa"]
    random.shuffle(aqp_idx)
    cayma = set(aqp_idx[:INC_AFECTADOS])
    ROSA_IDX = sorted(cayma)[len(cayma) // 2]

    sid = 0
    def nuevo_servicio(cid, plan, tecno, nodo, f_alta, estado, f_baja, duo):
        nonlocal sid
        sid += 1
        linea = f"9{random.randint(10000000, 99999999)}" if tecno == "MOVIL" else None
        servicios.append([f"SRV-{sid:06d}", cid, plan, tecno, nodo, linea, f_alta.isoformat(), estado,
                          f_baja.isoformat() if f_baja else None, "S" if duo else "N"])

    used_docs = set()
    for i in range(N_CLIENTES):
        cid = f"CLI-{100001 + i}"
        region = regiones[i]
        es_rosa = i == ROSA_IDX
        if es_rosa:
            cid = "CLI-104217"
        elif cid == "CLI-104217":
            cid = f"CLI-{100001 + ROSA_IDX}"  # intercambia el id con la protagonista
        fem = random.random() < 0.5
        nombre = random.choice(NOMBRES_F if fem else NOMBRES_M)
        ap1, ap2 = random.choice(APELLIDOS), random.choice(APELLIDOS)
        f_alta = rdate(date(2015, 1, 1), date(2026, 9, 30))
        if i in cayma:
            f_alta = min(f_alta, date(2026, 9, 15))
        if es_rosa:
            nombre, ap1, ap2, f_alta = "Rosa", "Huamán", "Torres", date(2019, 3, 14)
        doc = None
        while doc is None or doc in used_docs:
            doc = f"{random.randint(10000000, 79999999)}"
        used_docs.add(doc)
        # Baja: riesgo mensual base entre 2026-04-01 y la fecha ancla.
        f_baja, motivo, destino = None, None, None
        if not es_rosa:
            base = 0.016 if region == "Lima" else 0.013
            d = max(f_alta, date(2026, 4, 1))
            while d <= ANCHOR and f_baja is None:
                h = base
                if i in cayma and d >= date(2026, 10, 5):
                    h = 0.05  # efecto incidencia masiva
                if i in cayma and d < date(2026, 10, 2):
                    h = 0.0   # los 1,184 afectados estaban activos al inicio de la incidencia
                if random.random() < h / 30:
                    f_baja = d
                d += timedelta(days=1)
            if f_baja:
                motivo = pick([("Portabilidad", 0.55), ("Precio", 0.15), ("Calidad del servicio", 0.15),
                               ("Mudanza", 0.10), ("Otros", 0.05)])
                if i in cayma and f_baja >= date(2026, 10, 5):
                    motivo = pick([("Portabilidad", 0.70), ("Calidad del servicio", 0.30)])
                destino = random.choice(OPERADORES) if motivo == "Portabilidad" else None
        estado = "Baja" if f_baja else "Activo"
        provincia_dist = nodos_por_region[region][0]
        # Servicios
        tiene_hogar = i in cayma or es_rosa or random.random() < 0.70
        tiene_movil = es_rosa or random.random() < 0.62
        nodo_hogar = None
        if tiene_hogar:
            if i in cayma:
                nodo = nodo_info[INC_NODO]
            else:
                opts = [n for n in nodos_por_region[region] if n[0] != INC_NODO]
                nodo = random.choice(opts)
            nodo_hogar = nodo
            tecno = nodo[4]
            if tecno == "FTTH":
                plan = pick([("FIB-200", 0.30), ("FIB-400", 0.38), ("FIB-600", 0.22), ("FIB-1000", 0.10)])
            else:
                plan = pick([("HFC-100", 0.55), ("HFC-200", 0.45)])
            if es_rosa:
                plan = "FIB-400"
            nuevo_servicio(cid, plan, tecno, nodo[0], f_alta, estado, f_baja, False)
            provincia_dist = nodo
        if tiene_movil:
            plan = pick([("MOV-MAX-39", 0.30), ("MOV-MAX-59", 0.30), ("MOV-ILI-79", 0.28), ("MOV-ILI-109", 0.12)])
            if es_rosa:
                plan = "MOV-ILI-79"
            nuevo_servicio(cid, plan, "MOVIL", CELDAS[region], min(ANCHOR, f_alta + timedelta(days=random.randint(0, 200))) if not es_rosa else date(2020, 6, 2),
                           estado, f_baja, tiene_hogar)
        if not tiene_hogar and not tiene_movil:
            nuevo_servicio(cid, "PRE-REC", "MOVIL", CELDAS[region], f_alta, estado, f_baja, False)
        email = f"{nombre.lower()}.{ap1.lower()}{random.randint(1, 999)}@correo-demo.pe"
        for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ñ", "n")):
            email = email.replace(a, b)
        clientes.append([cid, nombre, f"{ap1} {ap2}", "DNI", doc, email, f"9{random.randint(10000000, 99999999)}",
                         region, provincia_dist[2], provincia_dist[3], f_alta.isoformat(),
                         pick([("Tienda", 0.35), ("Web", 0.25), ("Televentas", 0.25), ("Distribuidor", 0.15)]),
                         estado, f_baja.isoformat() if f_baja else None, motivo, destino])

    cli_by_id = {c[0]: c for c in clientes}
    rosa_id = "CLI-104217"
    cayma_ids = {clientes[i][0] for i in cayma}

    # ── Tickets ───────────────────────────────────────────────────────────
    tickets, tid = [], 0
    def nuevo_ticket(cid, srv, apertura, codigo, inc_id=None, cierre=None):
        nonlocal tid
        tid += 1
        if cierre is None:
            lo, hi = HORAS_RESOL[codigo]
            cierre = apertura + timedelta(hours=random.uniform(lo, hi))
        abierto = cierre.date() > ANCHOR
        tickets.append([f"TCK-{tid:07d}", cid, srv, apertura.isoformat(sep=" ", timespec="minutes"),
                        None if abierto else cierre.isoformat(sep=" ", timespec="minutes"),
                        "Técnico" if codigo != "B-501" else "Facturación", codigo, pick(CANALES_TICKET),
                        "Abierto" if abierto else "Cerrado", random.choice(DESCR[codigo]), inc_id])

    t0 = date(2026, 7, 1)
    for s in servicios:
        srv, cid, plan, tecno, nodo, _, f_alta, estado, f_baja, _ = s
        if cid == rosa_id:
            continue
        ini = max(t0, date.fromisoformat(f_alta))
        fin = date.fromisoformat(f_baja) if f_baja else ANCHOR
        if fin <= ini:
            continue
        meses = (fin - ini).days / 30
        for _ in range(poisson(TASA_TICKETS_MES[tecno] * meses)):
            codigo = pick(CODIGOS_TEC[tecno])
            ap = rdt(rdate(ini, fin))
            if cid in cayma_ids and codigo == "F-101" and INC_INI.date() <= ap.date() <= INC_FIN.date():
                codigo = "F-201"  # los F-101 de esa ventana se modelan abajo, vinculados a la incidencia
            nuevo_ticket(cid, srv, ap, codigo)

    # Incidencia masiva Cayma: tickets F-101 vinculados.
    srv_hogar = {s[1]: s[0] for s in servicios if s[3] != "MOVIL"}
    for cid in sorted(cayma_ids):
        if cid == rosa_id:
            continue
        k = pick([(0, 0.18), (1, 0.44), (2, 0.26), (3, 0.12)])
        fb = cli_by_id[cid][13]
        for _ in range(k):
            ap = INC_INI + timedelta(minutes=random.randint(0, int((INC_FIN - INC_INI).total_seconds() // 60) - 600))
            if fb and ap.date() > date.fromisoformat(fb):
                continue
            cierre = min(INC_FIN + timedelta(hours=random.uniform(1, 30)), ap + timedelta(hours=random.uniform(30, 120)))
            cierre = max(cierre, ap + timedelta(hours=2))
            nuevo_ticket(cid, srv_hogar[cid], ap, "F-101", INC_ID, cierre)
    # Rosa: 3 F-101 vinculados + 1 F-201 (no vinculado, aún abierto)
    rsrv = srv_hogar[rosa_id]
    nuevo_ticket(rosa_id, rsrv, datetime(2026, 10, 3, 7, 52), "F-101", INC_ID, datetime(2026, 10, 4, 16, 10))
    nuevo_ticket(rosa_id, rsrv, datetime(2026, 10, 6, 19, 25), "F-101", INC_ID, datetime(2026, 10, 7, 21, 40))
    nuevo_ticket(rosa_id, rsrv, datetime(2026, 10, 9, 9, 3), "F-101", INC_ID, datetime(2026, 10, 11, 20, 15))
    tickets[-3][9] = "Cliente indica que el módem tiene la luz LOS en rojo y no tiene internet desde la mañana."
    tickets[-2][9] = "Sin servicio de internet otra vez. LOS rojo en el ONT, ya reinició y sigue igual."
    tickets[-1][9] = "Tercera caída en la semana con luz roja LOS. Cliente indica que trabaja desde casa y evalúa cambiarse de operador."
    nuevo_ticket(rosa_id, rsrv, datetime(2026, 10, 13, 20, 41), "F-201", None, datetime(2026, 10, 17, 12, 0))
    tickets[-1][9] = "Después del corte el internet quedó lento en la noche, no llega a los 400 Mbps contratados."

    # Incidencias menores: tickets extra en el nodo y cálculo de afectados
    incidencias = [[INC_ID, INC_NODO, INC_INI.isoformat(sep=" ", timespec="minutes"),
                    INC_FIN.isoformat(sep=" ", timespec="minutes"), "Degradación de tarjeta PON en OLT", "Crítica",
                    INC_AFECTADOS, "Tarjeta PON degradada en OLT Cayma: cortes intermitentes de fibra (LOS) en el distrito de Cayma."]]
    for inc_id, nodo, ini, horas, tipo, sev, desc in INCIDENCIAS_MENORES:
        fin = ini + timedelta(hours=horas)
        afect = [s for s in servicios if s[4] == nodo and date.fromisoformat(s[6]) <= ini.date()
                 and (not s[8] or date.fromisoformat(s[8]) > ini.date())]
        for s in random.sample(afect, k=min(len(afect), max(10, len(afect) // 4))):
            ap = ini + timedelta(minutes=random.randint(5, horas * 60 - 5))
            cod = "F-101" if s[3] == "FTTH" else "F-301"
            nuevo_ticket(s[1], s[0], ap, cod, inc_id, fin + timedelta(hours=random.uniform(0.5, 6)))
        incidencias.append([inc_id, nodo, ini.isoformat(sep=" ", timespec="minutes"),
                            fin.isoformat(sep=" ", timespec="minutes"), tipo, sev, len(afect), desc])

    # ── Reclamos ──────────────────────────────────────────────────────────
    reclamos, n_rcl = [], 7000
    def next_rcl():
        nonlocal n_rcl
        n_rcl += 1
        if n_rcl == 8812:
            n_rcl += 1
        return f"RCL-2026-{n_rcl:05d}"
    tickets.sort(key=lambda t: t[3])
    for t in tickets:
        tck, cid, srv, ap, cierre, cat, cod, canal, est, desc, inc = t
        if cid == rosa_id:
            continue
        p = 0.16 if inc == INC_ID else (0.10 if cod == "B-501" else (0.05 if cod in ("F-101", "F-301", "M-401") else 0.0))
        if random.random() >= p:
            continue
        f = datetime.fromisoformat(ap) + timedelta(hours=random.randint(4, 72))
        if f.date() > ANCHOR:
            continue
        tipo = "Facturación" if cod == "B-501" else ("Interrupción" if cod in ("F-101", "F-301", "M-401") else "Calidad")
        plazo = 15 if tipo == "Facturación" else 5
        dias = random.randint(1, plazo + 3)
        resp = f.date() + timedelta(days=round(dias * 7 / 5))
        if resp > ANCHOR:
            estado, resp_s, dias_s, monto = "Abierto", None, None, None
        else:
            estado = pick([("Resuelto favorable", 0.62), ("Resuelto no favorable", 0.30), ("Apelado", 0.08)])
            resp_s, dias_s = resp.isoformat(), dias
            monto = round(PRECIO.get(next(s[2] for s in servicios if s[0] == srv), 50) * random.randint(1, 4) / 30, 2) \
                if estado == "Resuelto favorable" and tipo != "Calidad" else 0.0
        reclamos.append([next_rcl(), cid, srv, tck, f.isoformat(sep=" ", timespec="minutes"), tipo, estado,
                         resp_s, dias_s, monto, inc,
                         {"Interrupción": "Solicita compensación por días sin servicio.",
                          "Facturación": "Solicita la anulación de un cargo que no reconoce.",
                          "Calidad": "Reclama que la velocidad es menor a la contratada."}[tipo]])
    rosa_tck = next(t[0] for t in tickets if t[1] == rosa_id and t[3].startswith("2026-10-09"))
    reclamos.append(["RCL-2026-08812", rosa_id, rsrv, rosa_tck, "2026-10-09 10:27", "Interrupción",
                     "Abierto", None, None, None, INC_ID,
                     "Cliente reclama 3 días sin servicio de fibra por cortes reiterados (LOS) y solicita compensación."])

    # ── Portabilidad (eventos) ────────────────────────────────────────────
    porta, pid = [], 0
    def evento(cid, f, tipo, destino):
        nonlocal pid
        pid += 1
        porta.append([f"POR-{pid:06d}", cid, f.isoformat(), tipo, destino])
    for c in clientes:
        cid, fb, motivo, destino = c[0], c[13], c[14], c[15]
        if fb and motivo == "Portabilidad":
            fbd = date.fromisoformat(fb)
            evento(cid, fbd - timedelta(days=random.randint(2, 6)), "Consulta previa", destino)
            evento(cid, fbd, "Portabilidad ejecutada", destino)
        elif not fb and cid != rosa_id:
            p = 0.10 if cid in cayma_ids else 0.012
            if random.random() < p:
                f = rdate(date(2026, 10, 6), ANCHOR) if cid in cayma_ids else rdate(date(2026, 7, 1), ANCHOR)
                d = random.choice(OPERADORES)
                evento(cid, f, "Consulta previa", d)
                if f < date(2026, 9, 25) and random.random() < 0.6:
                    evento(cid, f + timedelta(days=random.randint(1, 4)), "Retenido", d)
    evento(rosa_id, date(2026, 10, 13), "Consulta previa", "Operador B")

    # ── Facturación (abr–sep 2026) ────────────────────────────────────────
    renta = {}
    for s in servicios:
        p = PRECIO[s[2]] * (0.85 if s[9] == "S" else 1.0)
        renta[s[1]] = round(renta.get(s[1], 0) + p, 2)
    morosos = {c[0] for c in clientes if random.random() < 0.05 and c[0] != rosa_id}
    facturas, fid = [], 0
    for c in clientes:
        cid, f_alta, fb = c[0], date.fromisoformat(c[10]), c[13]
        for m in range(4, 10):
            per = date(2026, m, 1)
            if f_alta > per + timedelta(days=27) or (fb and date.fromisoformat(fb) < per):
                continue
            fid += 1
            base = renta[cid] if renta[cid] > 0 else random.choice([10, 15, 20, 30])  # prepago: recargas
            monto = round(base * random.uniform(1.0, 1.12), 2)
            atraso = 0
            if cid in morosos and m >= 6:
                atraso = (9 - m) * 30 + random.randint(5, 25)
                estado = "Vencido"
            else:
                estado = "Pagado" if random.random() < 0.96 or m < 9 else "Pendiente"
            facturas.append([f"FAC-{fid:07d}", cid, f"2026-{m:02d}", monto, estado, atraso])

    # ── Retenciones históricas ────────────────────────────────────────────
    retenciones = []
    cand = [c[0] for c in clientes if c[0] not in (rosa_id,)]
    for k, cid in enumerate(random.sample(cand, 520), 1):
        f = rdate(date(2025, 10, 1), date(2026, 9, 30))
        of = pick([("R1", 0.40), ("R2", 0.20), ("R3", 0.25), ("R4", 0.15)])
        pct = random.choice([10, 15, 20, 25, 30]) if of == "R1" else None
        retenciones.append([f"RET-{k:05d}", cid, f.isoformat(), of, pct,
                            pick([("Retenido", 0.68), ("No retenido", 0.32)]),
                            random.choice(["Carla Mendoza", "Pedro Vargas", "Daniela Ríos", "Martín Silva", "Karina Apaza"])])

    print("Escribiendo data/landing/:")
    write("planes.csv", ["plan_codigo", "nombre", "tipo", "tecnologia", "precio_mensual", "velocidad_mbps", "datos_gb"], PLANES)
    write("nodos_red.csv", ["nodo_id", "region", "provincia", "distrito", "tecnologia", "lat", "lng"], NODOS)
    write("clientes.csv", ["cliente_id", "nombres", "apellidos", "tipo_documento", "numero_documento", "email", "telefono",
                           "region", "provincia", "distrito", "fecha_alta", "canal_alta", "estado", "fecha_baja",
                           "motivo_baja", "operador_destino"], clientes)
    write("servicios.csv", ["servicio_id", "cliente_id", "plan_codigo", "tecnologia", "nodo_id", "numero_linea",
                            "fecha_activacion", "estado", "fecha_baja", "es_duo"], servicios)
    write("tickets.csv", ["ticket_id", "cliente_id", "servicio_id", "fecha_apertura", "fecha_cierre", "categoria",
                          "codigo_falla", "canal", "estado", "descripcion", "incidencia_id"], tickets)
    write("incidencias_red.csv", ["incidencia_id", "nodo_id", "inicio", "fin", "tipo", "severidad",
                                  "clientes_afectados", "descripcion"], incidencias)
    write("reclamos.csv", ["reclamo_id", "cliente_id", "servicio_id", "ticket_id", "fecha_registro", "tipo", "estado",
                           "fecha_respuesta", "dias_habiles_respuesta", "monto_compensado", "incidencia_id",
                           "descripcion"], reclamos)
    write("portabilidad_eventos.csv", ["evento_id", "cliente_id", "fecha", "tipo_evento", "operador_destino"], porta)
    write("facturacion.csv", ["factura_id", "cliente_id", "periodo", "monto", "estado_pago", "dias_atraso"], facturas)
    write("retenciones_historicas.csv", ["retencion_id", "cliente_id", "fecha", "oferta_codigo", "descuento_pct",
                                         "resultado", "ejecutivo"], retenciones)
    r = cli_by_id[rosa_id]
    print(f"Protagonista: {r[0]} {r[1]} {r[2]} · {r[8]}/{r[9]} · renta S/{renta[rosa_id]}")


if __name__ == "__main__":
    main()
