# Canon de la historia — "Retener sin multas"

Fuente única de verdad para datos, documentos del Knowledge Assistant, App y guion.
Todo es **sintético** (solo para workshop). Nada representa políticas, precios ni normativa reales.

## Contexto
- Cliente del workshop: **Integratel Perú** (telco). Documentos con pie: *"Documento sintético elaborado para workshop Databricks — no representa políticas reales de Integratel."*
- Fecha ancla de los datos: **2026-10-15** (datos hasta ese día). Workshop: lunes 2026-10-19.
- Moneda: soles (S/). Regiones: Lima, Arequipa, La Libertad, Piura, Cusco, Lambayeque, Junín.
- Tecnologías: FTTH (fibra), HFC (cable), Móvil (4G/5G).
- Competidores: nunca con nombre real → "Operador A", "Operador B", "Operador C".

## Personajes
- **Lucía Ramos** — Analista de Datos (Databricks SQL). Mantiene las métricas de churn y soporte.
- **Diego Salazar** — Ingeniero de Plataforma. Dueño del pipeline CI/CD (Bundles + GitHub Actions).
- **Carla Mendoza** — Ejecutiva de Retención, sede Arequipa. Usa la App "Centro de Retención 360".
- **Jorge Paredes** — Supervisor de Retención (aprueba descuentos > 25%).

## Catálogo de planes (códigos usados en datos y documentos)
| plan_codigo | nombre | tipo | tecnología | precio S/ | velocidad/datos |
|---|---|---|---|---|---|
| MOV-MAX-39 | Max 39.90 | Móvil postpago | Móvil | 39.90 | 25 GB |
| MOV-MAX-59 | Max 59.90 | Móvil postpago | Móvil | 59.90 | 60 GB |
| MOV-ILI-79 | Max Ilimitado 79.90 | Móvil postpago | Móvil | 79.90 | Ilimitado (alta velocidad 120 GB) |
| MOV-ILI-109 | Max Ilimitado Plus 109.90 | Móvil postpago | Móvil | 109.90 | Ilimitado (alta velocidad 250 GB) + roaming América |
| PRE-REC | Prepago Recarga | Móvil prepago | Móvil | 0.00 | según recarga |
| FIB-200 | Fibra 200 Mbps | Hogar | FTTH | 89.00 | 200 Mbps |
| FIB-400 | Fibra 400 Mbps | Hogar | FTTH | 109.00 | 400 Mbps |
| FIB-600 | Fibra 600 Mbps | Hogar | FTTH | 129.00 | 600 Mbps |
| FIB-1000 | Fibra 1 Gbps | Hogar | FTTH | 169.00 | 1000 Mbps |
| HFC-100 | Cable 100 Mbps | Hogar | HFC | 79.00 | 100 Mbps |
| HFC-200 | Cable 200 Mbps | Hogar | HFC | 95.00 | 200 Mbps |

Dúo (hogar + móvil postpago del mismo titular): 15% de descuento en el plan móvil.

## Segmentación y riesgo (usado en gold.cliente_360 y en la Política de Retención)
- Segmento de valor por renta mensual total: **Oro** ≥ S/150 · **Plata** S/80–149.99 · **Bronce** < S/80.
- Nivel de riesgo por score_riesgo (0–1): **Crítico** ≥ 0.80 · **Alto** 0.60–0.79 · **Medio** 0.40–0.59 · **Bajo** < 0.40.

## Política de Retención 2026 (ofertas)
- **R1 Descuento de fidelización**: Oro o Plata con riesgo Crítico/Alto → hasta 30% de la renta del servicio hogar por 6 meses (Plata: tope 20%). **> 25% requiere aprobación del Supervisor de Retención.**
- **R2 Upgrade de velocidad sin costo 12 meses** (un escalón: FIB-200→400, 400→600, 600→1000; HFC-100→200): clientes hogar afectados por falla de red. **Pre-aprobado** si el cliente está afectado por una incidencia masiva vigente.
- **R3 Bono de datos móvil** 20 GB/mes por 3 meses (postpago).
- **R4 Visita técnica prioritaria** + cambio de ONT/módem sin costo.
- Máximo **2 beneficios comerciales** simultáneos. La compensación regulatoria por interrupción **no** cuenta como beneficio comercial.
- **Restricciones**: no aplica si deuda vencida > 60 días; máximo 1 retención cada 6 meses por cliente.
- Ante consulta/solicitud de portabilidad: contactar en ≤ 24 h. **Prohibido** obstaculizar, demorar o condicionar la portabilidad; la oferta es voluntaria.

## Guía de Reclamos y Compensaciones (normativa sintética)
- Interrupción del servicio **> 4 horas continuas** atribuible a la empresa → **devolución proporcional del cargo fijo** por los días afectados (cargo_fijo × días / 30), aplicada en el siguiente recibo, **sin que el cliente lo solicite** si es incidencia masiva.
- Todo reclamo recibe un **código de reclamo** (formato RCL-AAAA-NNNNN) en el primer contacto.
- Plazo de respuesta: **15 días hábiles** (reclamos por interrupción/calidad: **5 días hábiles**). Sin respuesta en plazo → silencio positivo a favor del usuario.
- Segunda instancia: apelación ante el tribunal administrativo del regulador (nombrarlo genéricamente "tribunal de reclamos del regulador").

## Manual de Troubleshooting (códigos de falla usados en tickets)
| código | descripción | acción |
|---|---|---|
| F-101 | ONT con LED **LOS rojo** — pérdida de señal óptica | Verificar si hay incidencia masiva en el nodo. Si hay ≥ 10 tickets F-101 del mismo nodo en 24 h → vincular a incidencia masiva, NO agendar visita individual. Si no: visita técnica (SLA 24 h Lima / 48 h regiones). |
| F-102 | LED PON parpadeando — sin registro en OLT | Reinicio remoto de ONT, re-provisionar. Si persiste → visita. |
| F-201 | Lentitud / WiFi deficiente | Test de velocidad remoto, cambio de canal WiFi, sugerir mesh. |
| F-301 | HFC sin sincronía de módem | Revisar niveles RF, reinicio, visita si persiste. |
| M-401 | Móvil sin cobertura / caída de datos | Verificar celda, reset de red, escalar a NOC. |
| B-501 | Facturación / cobro indebido | Derivar a reclamos (código RCL). |
Potencia óptica normal en ONT: −8 a −27 dBm.

## Incidencia masiva clave
- **INC-AQP-2026-0412** — Nodo **AQP-CAY-03** (OLT Cayma, Arequipa, FTTH). Tarjeta PON degradada.
- Inicio **2026-10-02 08:15**, fin **2026-10-11 18:40** (intermitencias). **1,184 clientes** afectados.
- Protocolo (Comunicado interno CI-2026-031): compensación automática por interrupción + **R2 pre-aprobado** para afectados + visita técnica R4 solo si el problema persiste después del 2026-10-11.

## Cliente protagonista
- **Rosa Huamán Torres** — `CLI-104217`, Arequipa, distrito Cayma, cliente desde **2019-03-14** (7 años).
- Servicios: **FIB-400** (S/109.00, nodo AQP-CAY-03) + **MOV-ILI-79** (S/79.90 → con dúo 15%: S/67.92). Renta total ≈ **S/176.92** → segmento **Oro**.
- 30 días: **4 tickets** (3 × F-101 "LOS rojo", 1 × F-201 lentitud), todos vinculados a INC-AQP-2026-0412 salvo el F-201.
- Reclamo abierto **RCL-2026-08812** (interrupción de 3 días, pide compensación) abierto 2026-10-09.
- **Consulta de portabilidad** registrada **2026-10-13** (destino: Operador B).
- Sin deuda vencida. Nunca recibió retención. Score de riesgo **0.91 → Crítico**.
- Respuesta "correcta" esperada para Rosa: compensación regulatoria automática (S/109 × 3/30 = **S/10.90**) + **R2** upgrade FIB-400→FIB-600 por 12 meses (pre-aprobado) + **R1** descuento hasta 25% sin aprobación (30% requiere a Jorge, el supervisor). Máx 2 beneficios comerciales → R2 + R1. Contactar ≤ 24 h desde la consulta de portabilidad, sin condicionar la portabilidad.
