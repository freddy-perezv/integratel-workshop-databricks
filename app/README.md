# Centro de Retención 360 · Integratel Perú

**Aplicación de retención de clientes impulsada por IA para Integratel.**

Ejecutivas de retención (ej: Carla Mendoza, Arequipa) investigan clientes en riesgo crítico/alto de churn, consultan la política de retención regulatoria vía el Supervisor Agent, preparan planes personalizados (ofertas R1–R4 + compensación por interrupción + guion de contacto), obtienen aprobación del supervisor (para descuentos > 25%), y registran las acciones con auditoría completa. El agente (Claude Sonnet 5.5 via Chat Completions) conduce: investigación → propuesta → aprobación → ejecución, con visibilidad en tiempo real en la cola de retención y trazas MLflow.

---

## Inicio rápido

### Local (dev)

```bash
cd app

# 1. Instala dependencias
npm install --registry https://npm-proxy.dev.databricks.com/

# 2. Construye (servidor + cliente)
npm run build:source

# 3. Dev server (escucha en localhost:8765)
npm run dev
```

### Despliegue (Databricks Apps)

```bash
# Despliega como integratel-retencion-dev
bash scripts/deploy.sh
```

---

## Configuración

### Variables de entorno (`.env`)

```bash
# Databricks
DATABRICKS_HOST=https://adb-7405608876622599.19.azuredatabricks.net
DATABRICKS_TOKEN=<PAT>

# Catálogo (datos Delta)
DEMO_CATALOG=integratel_dev
DEMO_SCHEMA=gold

# App
DATABRICKS_APP_NAME=integratel-retencion-dev
DATABRICKS_APP_PORT=8765

# Data backend (Supervisor Agent)
MAS_ENDPOINT_NAME=mas-9a907f04-endpoint

# Modelo (Chat Completions, NOT Responses API)
AGENT_MODEL=databricks-claude-sonnet-5-5

# Lakebase
LAKEBASE_PROJECT_ID=integratel-retencion
PGHOST=<host-provided-by-lakebase>
PGDATABASE=integratel_retencion

# Dashboard
DASHBOARD_ID=01f1c4242ec9191fbec80fed77227449

# SQL Warehouse
WAREHOUSE_ID=5060ebc0c46f84b1
```

---

## Flujo hero (demostración)

### 1. Investiga

Carla abre la app → ve **Rosa Huamán (CLI-104217, Arequipa, Crítico, S/176.92)** en la cola.

**Carla pregunta**: *"¿Por qué Rosa está en riesgo crítico y qué dice la política?"*

**Agente**:
- Llama `buscar_cliente(cliente_id='CLI-104217')` → datos completos (deuda, tickets, consulta portabilidad, elegible_retencion=true, score_riesgo=0.91)
- Llama `ask_mas(question='Política para Rosa...')` → Supervisor + Knowledge Assistant → "R2 pre-aprobado (incidencia INC-AQP-2026-0412 vigente), R1 máx 25% sin supervisor, compensación S/10.90 por interrupción 3 días"

**Respuesta**: Rosa elegible para R2 (upgrade gratuito 12m) + R1 (descuento hasta 25%) + compensación regulatoria S/10.90. Contactar ≤24h sin condicionar portabilidad.

### 2. Propone

**Carla**: *"Prepara el plan de retención para Rosa con guion de llamada."*

**Agente**: Draft con 2 ofertas (R2 + R1 25%) y guion respetuoso. **STOP para aprobación**.

### 3. Aprueba

**Carla**: *"Sí, registra el plan con 25% de descuento."*

**Agente**: `registrar_plan_retencion(...)` → INSERT en `app.acciones_retencion` con estado='Aprobada', auditoría completa.

**La página se refresca en vivo**: Rosa → "Plan aprobado", KPI actualizado, Activity tab muestra la acción.

---

## Arquitectura

```
Databricks App (Express + React)
    ↓
    ├─→ Lakebase (PostgreSQL)
    │   ├─ app.cliente_360 (mirror, read-only, synced desde Delta)
    │   └─ app.acciones_retencion (writable, audit trail)
    │
    ├─→ MAS Endpoint (ask_mas tool)
    │   └─ Supervisor Agent + Knowledge Assistant (policy reasoning)
    │
    ├─→ SQL Warehouse (analytics queries)
    │
    └─→ AI/BI Dashboard (embedded)

Delta (integratel_dev.gold)
    ├─ cliente_360 (synced at boot)
    ├─ tickets_enriquecidos
    ├─ reclamos_enriquecidos
    └─ nodos_salud
```

---

## Tablas Lakebase

### app.cliente_360 (SYNCED, read-only)

Espejo de `integratel_dev.gold.cliente_360`. 32 columnas de perfil + riesgo:
- cliente_id, nombre_completo, región, provincia, distrito
- servicios (móvil, hogar), planes, renta
- score_riesgo (0–1), nivel_riesgo ('Crítico'|'Alto'|'Medio'|'Bajo')
- deuda_vencida_60d, tickets_30d, reclamos_abiertos
- consulta_portabilidad_30d, fecha_ultima_consulta_portabilidad
- incidencia_masiva_id, afectado_incidencia_masiva

### app.acciones_retencion (WRITABLE)

- id (uuid), cliente_id
- ofertas (JSONB: [{codigo:'R1'–'R4', detalle}])
- compensacion_soles (numeric)
- requiere_aprobacion (bool; true si > 25%)
- aprobador (text; 'Jorge Paredes (Supervisor de Retención)')
- estado ('Borrador'|'Pendiente aprobación supervisor'|'Aprobada'|'Registrada'|'Rechazada')
- guion_contacto (text)
- creado_por (OBO email)
- audit_trail (JSONB append-only: [{at, by, action, notes?, tool?}])
- created_at, decided_at

---

## Endpoints API

```bash
# Queue
GET  /api/clientes?nivel=Crítico&distrito=Cayma&limit=50
GET  /api/clientes/top-riesgo?limit=5
GET  /api/clientes/:clienteId

# Actions
GET  /api/acciones?clienteId=CLI-104217&estado=Aprobada
GET  /api/acciones/:accionId
GET  /api/summary

# Chat (SSE)
POST /api/chat/stream

# Config
GET  /api/config
```

---

## Permisos & Grants

**El SP de la app necesita acceso a** (via OBO path; generalmente automático):

- **Unity Catalog**: SELECT en `integratel_dev.gold.cliente_360`
- **SQL Warehouse** (5060ebc0c46f84b1): CAN_QUERY (OBO scope en app.yaml)
- **MAS Endpoint** (mas-9a907f04-endpoint): model-serving scope
- **Lakebase**: binding automático (PGUSER = OBO token)

**La app usa OBO auth para todo**, así que la mayoría de grants no requieren configuración explícita.

---

## Troubleshooting

### Agent devuelve vacío / "Thinking…" forever

1. Verifica `MAS_ENDPOINT_NAME` en .env
2. Confirma que el endpoint es alcanzable: `curl -i https://<host>/serving-endpoints/mas-9a907f04-endpoint/messages`
3. Revisa logs: `npm run dev 2>&1 | grep -i mas`

### Lakebase sync falla / cliente_360 vacía

1. Confirma `DATABRICKS_WAREHOUSE_ID`: `echo $WAREHOUSE_ID`
2. Verifica que el warehouse está RUNNING: `databricks sql get-warehouse <ID>`
3. Confirma que `integratel_dev.gold.cliente_360` existe y tiene datos
4. Fuerza resync: `curl -X POST http://localhost:8765/api/admin/reset`

### Typecheck falla

```bash
cd app
npm run typecheck 2>&1 | grep error
```

Common: imports faltantes, tipos mal aliñados en server/db/queries/clientes.ts o server/agent/retencion.ts. Verifica que no haya referencias a `storeops.ts` o `stores.ts` después de la limpieza.

---

## Scripts útiles

```bash
# Rebuild solo servidor
npm run build:server

# Rebuild solo cliente
npm run build:client

# Generar migración Drizzle (tras editar schema.ts)
npm run db:generate

# Linting
npm run lint
npm run format:fix

# Test
npm run test

# Reset demo (trunca acciones_retencion, re-sync cliente_360)
curl -X POST http://localhost:8765/api/admin/reset
```

---

## Pasos siguientes (post-workshop)

1. **Producción**: Cambiar `DEMO_CATALOG=integratel_dev` → `integratel_prod`
2. **MLflow**: Usa `/api/config` → `agentMlflowExperimentId` para ver trazas
3. **Métricas**: El app escribe trazas con OBO email + cliente_id para auditoría
4. **Escalabilidad**: Si cliente_360 > 100K rows, agrega índices en Lakebase o materializa vista en Delta

---

**Documento sintético elaborado para workshop Databricks — no representa políticas reales de Integratel.**
