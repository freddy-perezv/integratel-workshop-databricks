# Knowledge Assistant Document Corpus — Integratel Perú

Este directorio contiene los documentos sintéticos que alimentan el **Knowledge Assistant (Agent Bricks)** para el workshop de Databricks con Integratel Perú.

## Estructura

```
knowledge/
├── src/                    # Documentos HTML (fuentes)
├── pdfs/                   # Documentos PDF (renderizados)
├── ka_eval.json            # Ejemplos de evaluación para el Knowledge Assistant (14 Q&A)
└── README.md              # Este archivo
```

## Documentos

| Archivo | Código | Versión | Propósito | Momentos del Demo |
|---------|--------|---------|----------|-------------------|
| `01_manual_troubleshooting_fibra_hfc_movil` | MAN-TEC-007 | v3.2 | Diagnóstico técnico de fallas FTTH, HFC, móvil. Códigos F-101/F-102/F-201/F-301/M-401/B-501. LEDs, potencia óptica, SLAs, decisión incidencia masiva vs visita. | Intro demo: "¿Qué hacer si LED LOS está rojo?" Escalación a NOC. |
| `02_guia_reclamos_y_compensaciones` | GUI-REC-002 | v2.0 | Marco regulatorio de reclamos. Código RCL-AAAA-NNNNN. Plazos 15/5 días hábiles. Fórmula de compensación: cargo × días / 30. Ejemplos (Rosa: S/10.90). Incidencias masivas automáticas. | Demo compensación: "Cliente 3 días sin servicio" → S/10.90. |
| `03_politica_comercial_retencion_2026` | POL-RET-2026 | v1.1 | Segmentación (Oro/Plata/Bronce), riesgo (Crítico/Alto/Medio/Bajo). Ofertas R1–R4. Matriz de aprobación (25% auto, >25% requiere Jorge). Máx 2 beneficios, restricciones (deuda >60d, 1 cada 6m). Ética portabilidad. Casos Rosa-like. | Demo retención: "Cliente Oro, portabilidad consultada" → R2+R1 options. |
| `04_catalogo_planes_tarifas_2026` | CAT-PLN-2026-10 | v1.0 | Planes FTTH (FIB-200/400/600/1000), HFC (HFC-100/200), Móvil (MOV-MAX-39/59, MOV-ILI-79/109, PRE-REC). Precios exactos. Dúo 15% descuento. Upgrade ladder. Equipo incluido. Instalación sin costo (promo). | Demo ventas: "¿Precio FIB-400?" S/109. Con dúo móvil: savings. |
| `05_procedimiento_portabilidad_numerica` | PRO-POR-004 | v1.3 | Flujo consulta→solicitud→ejecución. Roles cedente/receptor. Contacto ≤24 h. Prohibiciones explícitas (no condicionar, no demorar). Frases permitidas vs prohibidas. Registro CRM. Supervisión. | Demo ético: "¿Puedo condicionar portabilidad?" → NO. Ejemplos. |
| `06_condiciones_contrato_y_faq` | CON-SER-001 | v4.0 | Sin permanencia forzada. Cambio plan libre. Facturación 10 días. Equipamiento: garantía 24m. SLAs. 15 FAQs cobrando: cancelación, cambios, compensación, portabilidad, reclamos. | Demo FAQ: "¿Hay contrato de permanencia?" → No. Cambios gratis. |
| `07_comunicado_incidencia_inc_aqp_2026_0412` | CI-2026-031 | CONF | **Comunicado crítico** (CONFIDENCIAL). Incidencia masiva nodo AQP-CAY-03 (Cayma, 1,184 afectados). Causa: tarjeta PON degradada. Inicio 2026-10-02 08:15, fin 2026-10-11 18:40 (9d). Compensación automática. R2 pre-aprobado. Scripts para agentes. FAQ interna. Monitoreo continuo. | Demo central: incident response. Rosa compensation + R2 pre-approval + portability handling. |

**Páginas por documento:** 4–6 páginas cada uno.

---

## Top 5 "Wow" Questions para Demo en Vivo

Estas son las preguntas que mejor demuestran el poder del Knowledge Assistant:

### 1. **La pregunta de Rosa (compensación + retención + portabilidad ética)**
**Pregunta:**  
"Rosa es cliente Oro en Cayma. Tiene FIB-400 + móvil dúo. Sufrió 3 días sin servicio por la falla en octubre. Acaba de consultar portabilidad. ¿Qué le ofreces y cuánto le compensas?"

**Respuesta esperada del KA:**
- Compensación automática: S/109 × 3 / 30 = **S/10.90** (aplicada sin que lo pida)
- Oferta: **R2 pre-aprobado** (upgrade FIB-400 → FIB-600 × 12 meses sin costo) + **R1 hasta 25%** descuento (sin aprobación adicional)
- Ética: contactar ≤24 h desde consulta de portabilidad, NO condicionar, permitir que decida
- Máximo 2 beneficios: R2 + R1 ✓

**Por qué es "wow":**  
Requiere conectar compensación (doc 2) + retención (doc 3) + portabilidad ética (doc 5) + incident details (doc 7) + planes (doc 4) en una respuesta coherente. Es la pregunta de oro del workshop.

---

### 2. **La pregunta del cálculo: interrupción de diferentes planes**
**Pregunta:**  
"Clientes afectados por INC-AQP-2026-0412: ¿cuánto reciben de compensación si tienen FIB-200, FIB-600, y HFC-100 respectivamente? (Todos tuvieron ~9 días sin servicio)."

**Respuesta esperada:**
- FIB-200 (S/89): (89 × 9) / 30 = **S/26.70**
- FIB-600 (S/129): (129 × 9) / 30 = **S/38.70**
- HFC-100 (S/79): (79 × 9) / 30 = **S/23.70**

**Por qué es "wow":**  
Muestra que el KA maneja fórmulas exactas del canon sin desviarse. Los números importan.

---

### 3. **La pregunta ética (prohibiciones de portabilidad)**
**Pregunta:**  
"¿Puedo decirle a un cliente que primero me confirme el cambio de plan, y luego proceso su portabilidad? ¿O que antes pague una multa de S/50 por 'costo administrativo'?"

**Respuesta esperada:**
- Ambas frases: **PROHIBIDAS**
- Categoría: Condicionar/obstaculizar portabilidad (violación regulatoria)
- Permitido: contactar, ofrecer retención voluntaria, respetar decisión
- Ejemplos de frases correctas vs incorrectas de doc 5

**Por qué es "wow":**  
Demuestra rigor ético del KA. No solo responde "no", sino explica POR QUÉ y qué SÍ hacer.

---

### 4. **La pregunta de aprobación (matriz de retención)**
**Pregunta:**  
"Tengo un cliente Plata, riesgo Crítico, que quiere descuento. ¿Puedo ofrecerle 22%? ¿28%? ¿Quién aprueba?"

**Respuesta esperada:**
- 22% (≤ 25%): **Automático**, sin escalación
- 28% (> 25%): Requiere aprobación de **Supervisor de Retención (Jorge Paredes)**
- Límite Plata: máximo 20% sin aprobación
- Si quiere 28%: puede escalar a Jorge, pero debe preparar el caso

**Por qué es "wow":**  
Muestra que el KA entiende reglas de negocio complejas (diferentes límites por segmento, thresholds, roles).

---

### 5. **La pregunta multi-documento (FAQ + planes + contrato)**
**Pregunta:**  
"¿Cuál es el precio de MOV-ILI-79? ¿Cuánto pago si también tengo Fibra 400? ¿Puedo cancelar sin penalidad si me arrepiento?"

**Respuesta esperada:**
- Precio MOV-ILI-79: **S/79.90**
- Con Fibra 400 (Dúo): 15% de descuento → **S/67.92** (ahorro S/11.98/mes)
- Renta total: S/109 (FIB) + S/67.92 (MOV con dúo) = **S/176.92** (segmento Oro)
- Cancelación: **Sin penalidad**, avisar 5 días de anticipación, devolver equipamiento

**Por qué es "wow":**  
Integra doc 4 (planes/precios), doc 4 (Dúo), doc 3 (segmentación), y doc 6 (FAQ/condiciones) en una respuesta transaccional realista.

---

## Evaluación Automatizada

El archivo **`ka_eval.json`** contiene 14 ejemplos Q&A para evaluar automáticamente el Knowledge Assistant:

```json
[
  {
    "question": "¿Qué debo hacer si veo el LED LOS de mi ONT en rojo?",
    "guidelines": [
      "Indica que hay pérdida de señal óptica (Loss of Signal)",
      "Primer paso: verificar si hay incidencia masiva en el nodo",
      ...
    ],
    "source_doc": "01_manual_troubleshooting_fibra_hfc_movil.pdf"
  },
  ...
]
```

### Temas cubiertos en ka_eval.json:
1. **Troubleshooting técnico** (LED LOS rojo → F-101)
2. **Compensación math** (Rosa: S/10.90)
3. **Reclamos/plazos** (5 días para interrupción)
4. **Aprobación retención** (>25% requiere supervisor)
5. **Límite de beneficios** (máx 2 simultáneos)
6. **Precios de planes** (FIB-600, MOV-ILI-79)
7. **Descuentos Dúo** (15% en móvil)
8. **Ética portabilidad** (prohibición de condicionar)
9. **Plazos contacto portabilidad** (≤24 h)
10. **Equipamiento y garantía** (24 meses, S/100 si no devuelves)
11. **Contrato sin permanencia** (cambio/cancelación libre)
12. **Incidencia masiva** (1,184 afectados, causa técnica)
13. **Caso integrado Rosa** (multi-documento)
14. **Restricciones retención** (deuda >60d, 1 cada 6m, etc.)

---

## Generar PDFs

Los PDFs se regeneran con:

```bash
./tools/build_pdfs.sh
```

Requiere Chrome instalado en `/Applications/Google Chrome.app/`. Cada documento se convierte a PDF con márgenes de 20 mm, sin encabezados/pies de página automáticos (se usan footers CSS fijos).

---

## Notas de Consistencia

✓ Todos los números del canon están presentes: planes, precios, incidencia INC-AQP-2026-0412 (1,184 afectados, 2026-10-02 a 2026-10-11), Rosa CLI-104217 compensación S/10.90.

✓ Segmentación: Oro ≥S/150, Plata S/80–149.99, Bronce <S/80. Rosa: S/176.92 → Oro.

✓ Nivel de riesgo: Crítico ≥0.80, Alto 0.60–0.79, Medio 0.40–0.59, Bajo <0.40. Rosa: 0.91 → Crítico.

✓ Retención: R1 (descuento ≤30% Oro, ≤20% Plata), R2 (upgrade sin costo), R3 (bono datos), R4 (visita prioritaria).

✓ Compensación: (cargo × días) / 30, automática para incidencias masivas.

✓ Portabilidad: contacto ≤24 h, prohibida condicionalidad explícita.

✓ Todas las fechas, nombres (Jorge Paredes), roles, y códigos coinciden con el canon.

---

## Información de Copyright

**Documentos sintéticos para workshop Databricks.** Pie de página en cada documento:

> "Documento sintético elaborado para workshop Databricks — no representa políticas reales de Integratel."

No se han usado números, políticas, ni regulaciones reales.

---

**Creado:** 2026-10-15  
**Actualizado:** 2026-10-15  
**Para:** Workshop Databricks — Integratel Perú
