# Guía del facilitador — Workshop Integratel "Retener sin multas"

**Duración:** 3 horas · **Formato:** híbrido (demo guiada + 2 ejercicios) · **Workspace:** `ey-chile-demo`
**Pedido de Christian (Integratel):** Databricks Apps + CI/CD de Databricks SQL de desarrollo a producción. Le sumamos el Knowledge Assistant como protagonista.

> Todo el contenido es **sintético**. Dilo al inicio: "los datos, políticas y documentos son ficticios, construidos para que se parezcan a su realidad".

---

## 1. Enlaces de la demo

| Qué | Prod (lo que se muestra) | Dev |
|---|---|---|
| App Centro de Retención 360 | https://integratel-retencion-prod-7405608876622599.19.azure.databricksapps.com | https://integratel-retencion-dev-7405608876622599.19.azure.databricksapps.com |
| Dashboard AI/BI | https://adb-7405608876622599.19.azuredatabricks.net/dashboardsv3/01f1c4d5cd32177a81d64b2887c18993/published | …/dashboardsv3/01f1c4c1a8ec143182f82cd55d9c6936/published |
| Genie | https://adb-7405608876622599.19.azuredatabricks.net/genie/rooms/01f1c4d859c21ce1b0af94e151b25f5d | …/genie/rooms/01f1c4c1a8731b4da931a1b398d52662 |
| Job pipeline SQL | https://adb-7405608876622599.19.azuredatabricks.net/jobs/1086132420089648 | …/jobs/961527949859046 |
| Alerta incidencia masiva | https://adb-7405608876622599.19.azuredatabricks.net/sql/alerts-v2/1495136624927282 | …/sql/alerts-v2/838495087087721 |
| Repo GitHub (público) | https://github.com/freddy-perezv/integratel-workshop-databricks | |
| Knowledge Assistant | *Agents* → "Integratel - Asistente de Retencion y Soporte" (`ka-1c0409da-endpoint`) | (compartido) |
| Supervisor Agent | *Agents* → "Integratel - Copiloto de Retencion" (`mas-9a907f04-endpoint`) | (compartido) |
| Catálogos | `integratel_prod` | `integratel_dev` |

---

## 2. Preparación

### El día anterior
1. **VPN encendida** y laptop conectada (el workspace tiene IP Access List: solo tu red llega).
2. **Runner de GitHub encendido** (ver §7). Verifica en GitHub → *Settings → Actions → Runners* que `freddy-mac-integratel` esté **Idle** (verde).
3. **Ensayo del CI**: abre y cierra un PR de prueba, o relanza el último CI verde (`gh run rerun <id>`).
4. **Limpia la demo** (planes y conversaciones de prueba): en cada App, botón *Reset demo* del header (o `POST /api/admin/reset`).
5. **Precalienta**: abre las dos Apps, el dashboard y Genie (el warehouse serverless arranca solo, pero así evitas el primer segundo de espera).
6. **Graba el plan B** (ver §8): un video corto de cada momento wow.

### 1 hora antes
- `databricks current-user me -p ey-chile-demo` (si falla: `databricks auth login --profile ey-chile-demo`).
- `gh auth status` ✓ · runner *Idle* ✓ · App prod RUNNING ✓.
- Pestañas abiertas en este orden: (1) slides, (2) GitHub repo, (3) Catalog `integratel_prod`, (4) SQL Editor, (5) dashboard prod, (6) Genie prod, (7) Agents (KA), (8) App prod.

---

## 3. La historia (para contarla, no leerla)

> "En Perú, cada cliente que se va por portabilidad cuesta dos veces: la renta que deja de pagar y, muchas veces, la multa por un reclamo mal atendido.
> Esta semana una tarjeta PON se degradó en la OLT de **Cayma** (nodo AQP-CAY-03): **1,184 clientes** con cortes intermitentes durante 9 días.
> Los tickets se dispararon, llegaron los reclamos… y otro operador empezó a consultar portabilidades.
> Hoy vamos a ver cómo **Lucía**, **Diego** y **Carla** convierten ese problema en una oportunidad, en una sola plataforma."

| Personaje | Rol | Bloque |
|---|---|---|
| **Lucía Ramos** | Analista de datos (Databricks SQL) | Bloque 1 |
| **Diego Salazar** | Ingeniero de plataforma (CI/CD) | Bloque 1 |
| **Carla Mendoza** | Ejecutiva de retención (Arequipa) | Bloques 2 y 3 |
| **Rosa Huamán** (CLI-104217) | La clienta: Oro, 7 años, 3 caídas en una semana, consulta de portabilidad | Hilo conductor |

**Promesa del workshop:** *"El cambio que Lucía hace en el minuto 40 llega a la pantalla de Carla en el minuto 170 — probado, aprobado y gobernado."*

---

## 4. Agenda minuto a minuto

### 0:00–0:15 · Apertura (slides 1–5)
- Historia + personajes. **Muestra el final primero**: abre la App prod, cola de retención, Rosa arriba con score 0.91. "Al final del día van a saber construir esto."
- Arquitectura en una slide: UC → SQL → Metric Views → Dashboard/Genie → Agent Bricks → App → todo por CI/CD.

### 0:15–0:35 · Fundaciones: Unity Catalog (slides 6–8)
- Catalog Explorer → `integratel_dev` vs `integratel_prod`: **mismo código, dos catálogos**.
- Abre `gold.cliente_360` → pestaña **Lineage**: de `bronze.tickets` (CSV del CRM) a la métrica.
- Comentarios en columnas (`score_riesgo`, `segmento_valor`): "esto es lo que lee Genie".
- **Owner** de las tablas = `sp-integratel-cicd`: "nadie crea tablas de prod a mano".
- Permisos como código: `sql/40_permisos.sql` (gold legible por todos; bronze/silver cerrados).

### 0:35–1:25 · Bloque 1 ⭐ Databricks SQL + CI/CD (lo que pidió Christian) (slides 9–16)
**Lucía (0:35–0:55)**
- SQL Editor: abre `sql/20_gold.sql` del repo y explica el score (reglas transparentes, versionadas).
- Metric View `gold.mv_churn`: "**una sola definición** de churn para dashboard, Genie y App".
  ```sql
  SELECT mes, region, MEASURE(tasa_churn) FROM integratel_prod.gold.mv_churn GROUP BY ALL ORDER BY mes;
  ```
- Dashboard prod: página *Soporte y red* → el pico de Arequipa = INC-AQP-2026-0412.
- Alerta SQL: regla del manual técnico ("≥10 LOS rojo en un nodo en un día") hecha alerta.

**Diego (0:55–1:25)**
- Repo: `databricks.yml` (targets dev/prod), `resources/*.yml` (job, dashboard, Genie, alerta, **App**), `tests/*.sql`.
- Los tests: "si algo falla, `raise_error` detiene el pipeline". Muestra `test_06_caso_dorado_rosa.sql`: *test de regresión de negocio*.
- **🎯 Ejercicio 1 — Romper el build** (ver §5). **Momento wow.**
- Después del ejercicio: muestra el CD de un merge anterior: **approval gate** del environment `produccion` → deploy → tests en prod.
- Remata: "Todo corre como un **service principal**; ninguna persona tiene permisos de escritura en prod".

### 1:25–1:35 · ☕ Break

### 1:35–2:15 · Bloque 2 · IA para el negocio: Knowledge Assistant ⭐ (slides 17–21)
- **Genie** prod: *"¿Cuántos clientes en riesgo crítico o alto hay por distrito en Arequipa y cuánta renta representan?"* → 67 clientes, ~S/10K/mes, todos en Cayma.
- **Knowledge Assistant** (*Agents* → el KA) — los 7 PDFs en el volume `integratel_prod.conocimiento.documentos`. Tres preguntas, una por "mundo":
  1. Técnico: *"Veo el LED LOS en rojo en el ONT, ¿qué hago?"* → revisar incidencia masiva antes de agendar visita.
  2. Regulatorio: *"Un cliente con FIB-400 estuvo 3 días sin servicio, ¿cuánto le compenso y en qué plazo respondo el reclamo?"* → **S/10.90**, 5 días hábiles.
  3. Ética comercial: *"¿Puedo condicionar la portabilidad a que acepte una oferta?"* → **No** (PRO-POR-004).
  - Señala las **citas** al documento y sección: "por esto confían".
- **Evaluación del KA**: pestaña de ejemplos/evaluación (14 preguntas con criterios). "Así se mide que no alucina".
- **Supervisor Agent**: combina Genie + KA. *"¿Por qué CLI-104217 está en riesgo crítico y qué le ofrezco según la política?"* → datos + política en una respuesta.
- **🎯 Ejercicio 2 — Pregúntale al copiloto** (ver §6).

### 2:15–2:45 · Bloque 3 · Databricks App (slides 22–25)
App prod, como **Carla**:
1. *Cola de retención*: KPIs, filtros, Rosa arriba → abre su panel (Ficha 360, Tickets desde Delta, Acciones).
2. Chip del copiloto (o escribe): **"¿Por qué Rosa Huamán (CLI-104217) está en riesgo crítico y qué dice la política que le puedo ofrecer?"** → panel *Thinking*: `buscar_cliente` (Lakebase) → `ask_mas` → KA.
3. **"Prepara el plan de retención para Rosa con el guion de llamada."** → borrador: R2 upgrade + R1 25% + compensación **S/10.90** (3 días de su reclamo RCL-2026-08812), guion sin condicionar la portabilidad. **Se detiene a pedir aprobación.**
4. **"Sí, registra el plan con 25% de descuento."** → escribe en **Lakebase**, la cola se actualiza en vivo, estado **Aprobada**.
5. **Wow de gobierno:** *"Mejor ofrécele 30% de descuento: es clienta Oro desde 2019."* → el sistema lo registra como **Pendiente aprobación supervisor** (regla en código, no en el prompt). Abre el panel de Rosa → pestaña *Acciones* → **Aprobar** (rol Jorge Paredes).
6. Cuenta lo que no se ve: la App está **en el Bundle** (sale a prod por el mismo CI/CD), cada entorno tiene su **rama de Lakebase**, cada turno queda **trazado en MLflow**.

### 2:45–3:00 · Cierre (slides 26–28)
- Recap con los 3 personajes y la promesa cumplida.
- Qué sería distinto en Integratel: workspaces separados por entorno, OIDC de GitHub en vez de secretos, Lakeflow para ingesta real (CRM/BSS/NOC), score con ML.
- **Próximo paso propuesto:** POC de 2–3 semanas con un caso real de Integratel sobre este mismo template (el repo es público y clonable).

---

## 5. Ejercicio 1 — "Romper el build" (15 min)

**Objetivo:** ver que un error de SQL **no llega a producción**.

**Contexto para la audiencia:** "Lucía quiere agregar el monto de la última factura a la ficha 360. Lo hace rápido… ¿qué podría salir mal?"

1. Abre el PR desde la rama preparada:
   ```bash
   gh pr create -R freddy-perezv/integratel-workshop-databricks --base main --head ejercicio/romper-el-build \
     --title "Agregar monto de la última factura a cliente_360" --body "Cambio de Lucía"
   ```
   (o en GitHub: *Compare & pull request* sobre `ejercicio/romper-el-build`).
2. **Pregunta a la sala:** *"¿Pasará los tests?"* — muestra el diff: `LEFT JOIN silver.facturacion fx USING (cliente_id)`.
3. Mientras corre el CI (~5 min), explica los pasos: validar → desplegar a dev → pipeline → tests.
4. Resultado esperado (pestaña *Checks* → *Resumen*):
   - `FALLA test_01: 11739 cliente_id duplicados en gold.cliente_360 … ¿Un JOIN sin agregar?`
   - `FALLA test_02: cliente_360 tiene 68378 filas pero silver.clientes tiene 12000`
   - `FALLA test_06: CLI-104217 cambió (filas=6)`
   - ❌ el check queda rojo → **no se puede promover**; la App de dev **no se reinicia**; prod intacto.
5. **La corrección** (pídele a un voluntario que la dicte): agregar en la CTE `fact` y usarla, en lugar del JOIN directo:
   ```sql
   -- en fact AS (...):
          max_by(monto, periodo) AS monto_ultima_factura,
   -- en base: f.monto_ultima_factura   (y borrar el LEFT JOIN silver.facturacion fx)
   ```
   Commit en la misma rama → el CI corre de nuevo → ✅ verde.
6. **No hagas merge** en el workshop (o hazlo si quieres mostrar el approval gate completo; tarda ~10 min).
7. **Después del workshop**: cierra el PR y restaura dev relanzando el último CI verde de `main`.

> Hands-on real: si los asistentes tienen usuario de GitHub, invítalos como colaboradores y que uno abra el PR desde su cuenta. Si no, modo **copiloto**: un voluntario dicta, tú tecleas.

---

## 6. Ejercicio 2 — "Pregúntale al copiloto" (10 min)

Por equipos, cada uno escribe una pregunta en el KA o en la App (si tienen acceso) o te la dictan. Gana la que mejor combine datos + política. Sugerencias:
- *"¿Qué clientes de Cayma consultaron portabilidad y qué les corresponde según la política?"*
- *"Un cliente Plata con deuda de 75 días pide descuento, ¿qué le respondo?"* (→ no elegible)
- *"¿Qué debo decir y qué NO debo decir si el cliente ya pidió la portabilidad?"*
- *"¿Cuánto le compenso a un cliente HFC-100 con 9 días sin servicio?"* (→ S/23.70)

---

## 7. Operación del runner (CI/CD)

El workspace tiene **IP Access List** administrada por la plataforma (`fevm-managed-allowlist-DoNotModify`); los runners hosteados de GitHub quedan bloqueados. Por eso el CI/CD corre en un **runner self-hosted en tu laptop** (`~/actions-runner-integratel`, label `integratel`). Es un patrón real: *runner dentro de la red corporativa*.

```bash
# Encender (queda en segundo plano)
cd ~/actions-runner-integratel && nohup ./run.sh > runner.log 2>&1 &
# Ver estado
tail -3 ~/actions-runner-integratel/runner.log      # "Listening for Jobs"
# Apagar
pkill -f "actions-runner-integratel/bin/Runner.Listener"
```
Seguridad: PRs de forks no se ejecutan en el runner (guarda en el workflow) y todo colaborador externo requiere aprobación.

---

## 8. Plan B

| Si falla… | Haz esto |
|---|---|
| Wifi / VPN | Videos grabados de: CI rojo/verde, approval gate, KA con citas, flujo de Rosa en la App |
| Runner caído | Enciéndelo (§7) y relanza el run con `gh run rerun <id>`; si no, muestra un run anterior (rojo y verde quedan en el historial de Actions) |
| Supervisor lento (~75 s) | Mientras piensa, muestra el panel *Thinking* (herramientas en vivo); o pregunta al KA directo |
| App con error | `databricks apps logs integratel-retencion-prod -p ey-chile-demo`; reinicio: `databricks bundle run app_retencion -t prod` |
| Token CLI vencido | `databricks auth login --profile ey-chile-demo` |

---

## 9. Preguntas frecuentes de la audiencia

- **¿Y si tenemos varios workspaces?** Cada target del Bundle apunta a su `workspace.host`; aquí usamos catálogos por simplicidad.
- **¿Secretos en GitHub?** Hoy un OAuth secret del SP; recomendado: **federación OIDC de GitHub** (sin secretos).
- **¿dbt?** Encaja igual: el job del Bundle puede tener una tarea `dbt_task` sobre el mismo warehouse.
- **¿Cómo sé que el agente no alucina?** Citas del KA + set de evaluación + **trazas MLflow** de cada turno + feedback 👍/👎 como *assessments*.
- **¿Las reglas de negocio las decide el LLM?** No: `registrar_plan_retencion` valida en código (máx. 2 beneficios, >25% → supervisor, deuda >60 días bloquea).
- **¿Costos?** Todo serverless: SQL warehouse, App, Lakebase autoscaling y Agent Bricks escalan a cero cuando no se usan.

---

## 10. Hechos clave (para no equivocarse en vivo)

| Dato | Valor |
|---|---|
| Incidencia | INC-AQP-2026-0412 · nodo AQP-CAY-03 · 2026-10-02 08:15 → 2026-10-11 18:40 · 1,184 afectados |
| Rosa | CLI-104217 · Cayma · Oro · S/176.92/mes · FIB-400 + MOV-ILI-79 (dúo) · score 0.91 Crítico |
| Reclamo de Rosa | RCL-2026-08812 · 3 días sin servicio → compensación S/109 × 3 / 30 = **S/10.90** |
| Oferta correcta | R2 (FIB-400→600, 12 meses, pre-aprobado) + R1 ≤25% (sin aprobación) · 30% → Supervisor Jorge Paredes |
| Cartera en riesgo | 3 críticos + 64 altos · ~S/10,028/mes · 168 consultas de portabilidad (30 d) |
| Fecha de los datos | 15-oct-2026 |
