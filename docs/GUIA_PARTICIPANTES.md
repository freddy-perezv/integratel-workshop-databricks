# Guía de participantes — Workshop "Retener sin multas"

Bienvenidos. En este workshop vamos a ver, sobre un caso de una telco, cómo una sola plataforma lleva un dato desde el sistema fuente hasta una decisión en manos de una ejecutiva de retención: **gobernado, probado y aprobado**.

> Todo el contenido (clientes, documentos, políticas y normativa) es **sintético**, creado para este workshop.

## 1. El caso en 1 minuto
Una tarjeta PON se degradó en la OLT de **Cayma** (nodo AQP-CAY-03) del 2 al 11 de octubre: 1,184 clientes con cortes de fibra. Suben los tickets, los reclamos y las consultas de portabilidad. Seguimos a:
- **Lucía**, analista de datos, que define las métricas en Databricks SQL;
- **Diego**, ingeniero de plataforma, que lleva cada cambio de dev a prod con CI/CD;
- **Carla**, ejecutiva de retención, que atiende a **Rosa Huamán (CLI-104217)** con un copiloto de IA.

## 2. Prerrequisitos

| # | Qué | Para qué | Modo |
|---|---|---|---|
| 1 | Usuario en el workspace de Databricks del workshop | Catalog, SQL, Genie, Agents y la App | Guiado y hands-on |
| 2 | Navegador (Chrome o Edge) | Todo se usa desde el navegador | Ambos |
| 3 | Cuenta de GitHub | Abrir el Pull Request del Ejercicio 1 | Hands-on |
| 4 | Git y el repositorio clonado | Ver el código: `git clone https://github.com/freddy-perezv/integratel-workshop-databricks` | Hands-on |
| 5 | Databricks CLI v1.x (opcional) | `databricks bundle validate` en tu máquina | Hands-on avanzado |

**Dos modos:**
- **Guiado (copiloto):** el facilitador comparte pantalla; ustedes dictan las preguntas y deciden los cambios.
- **Hands-on:** con usuario en el workspace y en GitHub, cada uno ejecuta los pasos.

## 3. Qué hay en el repositorio
| Carpeta | Contenido |
|---|---|
| `sql/` | Pipeline Databricks SQL: bronze → silver → gold → metric views → permisos |
| `tests/` | 6 tests de calidad en SQL (si uno falla, no se promueve) |
| `databricks.yml`, `resources/` | El proyecto como código (Bundle): job, dashboard, alerta, Genie y App |
| `.github/workflows/` | CI (en cada Pull Request) y CD (a producción, con aprobación) |
| `knowledge/` | Los 7 documentos del Knowledge Assistant y su set de evaluación |
| `app/` | La Databricks App "Centro de Retención 360" |
| `docs/CANON.md` | La historia y los datos clave del caso |

## 4. Orden de ejecución (y por qué)

El proyecto se despliega siempre en este orden, tanto en dev como en prod:

1. **Datos de origen en Unity Catalog** (`bronze`): los archivos de los sistemas fuente aterrizan en un Volume gobernado.
   *Por qué:* todo lo demás (métricas, agentes, App) depende de datos gobernados.
2. **Pipeline SQL** (`sql/00` → `sql/40`): bronze → silver → gold → metric views → permisos.
   *Por qué:* gold es el "producto de datos" que consumen el dashboard, Genie y la App; las metric views definen cada KPI una sola vez.
3. **Tests de calidad** (`tests/`): corren al final del pipeline.
   *Por qué:* si un cambio duplica clientes o rompe una métrica, el pipeline falla **antes** de llegar a producción.
4. **Dashboard, alerta y Genie**: se despliegan desde el Bundle sobre las tablas gold.
   *Por qué:* necesitan que gold exista.
5. **Agentes** (Knowledge Assistant + Supervisor): el KA indexa los 7 documentos; el Supervisor combina el KA con Genie.
   *Por qué:* el Supervisor necesita que existan sus herramientas.
6. **Databricks App**: se despliega con el Bundle y arranca **después** del pipeline.
   *Por qué:* al arrancar copia la versión ya probada de gold a su base Lakebase.

En CI/CD esto es automático:
```
Pull Request → CI (dev): validar → desplegar → pipeline + tests → arrancar la App
Merge a main → CD (prod): aprobación humana → validar → desplegar → pipeline + tests → arrancar la App
```

## 5. Paso a paso por bloque

### Part 1 · Unity Catalog (15 min)
1. **Catalog** → `integratel_prod` → `gold` → `cliente_360`. Lee los comentarios de las columnas `score_riesgo`, `segmento_valor` y `nivel_riesgo`.
2. Pestaña **Lineage**: sigue el camino desde `bronze.tickets` hasta `cliente_360`.
3. Pestaña **Details**: ¿quién es el *owner*? (un service principal, no una persona).
4. Compara con `integratel_dev`: mismas tablas, otro entorno.

### Part 2 · Databricks SQL + CI/CD (45 min)
1. **SQL Editor** (warehouse *Serverless Starter Warehouse*):
   ```sql
   SELECT mes, region, MEASURE(tasa_churn) AS tasa_churn
   FROM integratel_prod.gold.mv_churn GROUP BY ALL ORDER BY mes;

   SELECT distrito, MEASURE(clientes_riesgo_alto) AS en_riesgo, MEASURE(renta_en_riesgo) AS renta
   FROM integratel_prod.gold.mv_riesgo_clientes WHERE region = 'Arequipa' GROUP BY ALL;
   ```
2. Abre el **dashboard** "Integratel · Retención y Soporte" → página *Soporte y red*: ¿cuándo empieza el pico de Arequipa?
3. En GitHub, revisa `databricks.yml`, `resources/` y `tests/test_01_unicidad_cliente_360.sql`.
4. **🎯 Ejercicio 1 · Romper el build**
   - Abre un Pull Request desde la rama `ejercicio/romper-el-build` hacia `main` (en GitHub: *Compare & pull request*).
   - Mira el cambio: se agrega `LEFT JOIN silver.facturacion`. **¿Qué test crees que fallará?**
   - Espera el check *CI · Validar y probar en DEV* (~5 min) y lee el *Summary*.
   - Pista para corregirlo: agrega el monto **antes** de unir, en la CTE `fact`, con `max_by(monto, periodo) AS monto_ultima_factura`, y usa `f.monto_ultima_factura`.
   - Haz commit en la misma rama: el check debe quedar ✅.

### Part 3 · Genie + Knowledge Assistant + Supervisor (40 min)
1. **Genie** ("Integratel · Genie de Retención y Soporte"):
   - *¿Cuántos clientes en riesgo crítico o alto hay por distrito en Arequipa y cuánta renta mensual representan?*
   - *¿Qué nodos tienen más fallas de red en los últimos 7 días?*
   - Abre "Show SQL": Genie siempre muestra la consulta que ejecutó.
2. **Knowledge Assistant** (*Agents* → "Integratel - Asistente de Retencion y Soporte"):
   - *Veo el LED LOS en rojo en el ONT, ¿qué hago?*
   - *Un cliente con FIB-400 estuvo 3 días sin servicio, ¿cuánto le compenso y en qué plazo respondo el reclamo?*
   - *¿Puedo condicionar la portabilidad a que acepte una oferta?*
   - Revisa las **citas**: documento y sección.
3. **Supervisor** (*Agents* → "Integratel - Copiloto de Retencion"):
   - *¿Por qué la clienta CLI-104217 está en riesgo crítico y qué le puedo ofrecer según la política?*
4. **🎯 Ejercicio 2:** en equipo, propongan la pregunta que mejor combine **datos + política**. Ideas:
   - *Un cliente Plata con deuda de 75 días pide descuento, ¿qué le respondo?*
   - *¿Cuánto le compenso a un cliente HFC-100 con 9 días sin servicio?*

### Part 4 · Databricks App (30 min)
Abre **Centro de Retención 360** (el facilitador comparte el enlace):
1. **Cola de retención**: KPIs y clientes ordenados por riesgo. Abre la ficha de Rosa (pestañas *Ficha 360*, *Tickets* y *Acciones*).
2. En el copiloto, en orden:
   1. *¿Por qué Rosa Huamán (CLI-104217) está en riesgo crítico y qué dice la política que le puedo ofrecer?*
   2. *Prepara el plan de retención para Rosa con el guion de llamada.* → el copiloto **se detiene** y pide aprobación.
   3. *Sí, registra el plan con 25% de descuento.* → queda **Aprobada** y la cola se actualiza.
   4. *Mejor ofrécele 30% de descuento.* → queda **Pendiente aprobación supervisor** (regla en el código).
3. Abre el panel *Thinking* para ver qué herramientas usó el agente.

## 6. Para llevarse
- **Una sola gobernanza** (Unity Catalog) para datos, métricas, agentes y apps.
- **Una métrica, una definición** (Metric Views) para dashboard, Genie y agentes.
- **CI/CD de verdad**: Pull Request → tests → aprobación → producción, ejecutado por un service principal.
- **IA que cita sus fuentes** (Knowledge Assistant) y **combina datos + reglas** (Supervisor).
- **IA que actúa con control humano** (Databricks App + Lakebase + reglas en código + trazas MLflow).

## 7. Recursos
- Documentación: https://docs.databricks.com
- Declarative Automation Bundles: https://docs.databricks.com/dev-tools/bundles/
- Agent Bricks: https://docs.databricks.com/aws/en/agents/agent-bricks/
- Databricks Academy: https://www.databricks.com/learn/training
