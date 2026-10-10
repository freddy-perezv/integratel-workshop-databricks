import {
  text,
  timestamp,
  uuid,
  integer,
  doublePrecision,
  jsonb,
  pgSchema,
  index,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';

/**
 * Lakebase schema, under `app.*` — Centro de Retención 360 · Integratel.
 *
 * Three groups:
 *   1. Chat state      (conversations, messages, feedback) — REUSE AS-IS.
 *                      Standard conversation + message CRUD + feedback ratings.
 *   2. Synced mirror   (cliente360Mirror) — READ-ONLY copy of
 *                      integratel_dev.gold.cliente_360 that `db/sync.ts` pulls
 *                      at boot. The app SELECTs from this for per-customer reads;
 *                      never writes.
 *   3. Write-surface   `acciones_retencion` — the ONLY table the app writes.
 *                      Records approved retention plans with offers, compensation,
 *                      contact script, and audit trail.
 *
 * Why Lakebase: transactional Postgres sitting next to the lakehouse with UC
 * governance. Lets the app do real transactional writes while analytics queries Delta.
 */
export const appSchema = pgSchema('app');

// ============================================================================
// Chat state
// ============================================================================

export const conversations = appSchema.table(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userEmail: text('user_email').notNull(),
    title: text('title').notNull(),
    // 'default' for regular chats, 'demo_dock' for the floating dock's
    // persistent conversation (one per user).
    kind: text('kind', { enum: ['default', 'demo_dock'] })
      .notNull()
      .default('default'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('conversations_user_idx').on(t.userEmail, t.updatedAt),
    index('conversations_kind_idx').on(t.userEmail, t.kind),
  ],
);

export const messages = appSchema.table(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    position: integer('position').notNull(),
    traceId: text('trace_id'),
    // Captured reasoning steps (tool calls, outputs, intermediate messages)
    // for assistant messages. Shape matches client's ThinkingEvent union.
    thinking: jsonb('thinking').$type<ThinkingEntry[]>().notNull().default([]),
    // If the agent run failed, the error message is persisted here so a
    // page reload still shows what went wrong (instead of an empty bubble).
    error: text('error'),
    // True when the turn was stopped by the user (Stop button or page
    // navigation away from an in-flight stream). The assistant's partial
    // streamed content is still kept in `content` for context; the UI
    // renders a "Canceled by the user" banner below it.
    canceled: boolean('canceled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Unique on (conversation_id, position) so the `SELECT MAX + 1` race in
    // appendMessage surfaces as a constraint error (caller retries) instead
    // of silently inserting two messages at the same position — which
    // would break the on-reload ordering. Doubles as the lookup index.
    uniqueIndex('messages_convo_pos_uq').on(t.conversationId, t.position),
  ],
);

export const feedback = appSchema.table(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userEmail: text('user_email').notNull(),
    value: text('value', { enum: ['up', 'down'] }).notNull(),
    rationale: text('rationale'),
    traceId: text('trace_id'),
    mlflowAssessmentId: text('mlflow_assessment_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('feedback_message_idx').on(t.messageId)],
);

// ============================================================================
// Synced read-only mirror (from Delta — Integratel Gold tables)
//
// This mirrors `integratel_dev.gold.cliente_360`. In production, it's a UC
// synced table — read-only from the app. `db/sync.ts` pulls it at boot; the
// app SELECTs from it and never writes.
// ============================================================================

// `cliente_360` — one row per active customer. Core retention data:
// customer profile, services, risk scoring, ticket/claim history, recent
// portability inquiries, eligibility for retention.
export const cliente360Mirror = appSchema.table(
  'cliente_360',
  {
    clienteId: text('cliente_id').primaryKey(),
    nombreCompleto: text('nombre_completo'),
    region: text('region'),
    provincia: text('provincia'),
    distrito: text('distrito'),
    estado: text('estado'), // 'Activo' | 'Baja'
    fechaAlta: timestamp('fecha_alta', { withTimezone: true }),
    antiguedadAnios: doublePrecision('antiguedad_anios'),
    motivoBaja: text('motivo_baja'),
    serviciosActivos: integer('servicios_activos'),
    planes: text('planes'), // lista separada por comas
    tieneHogar: boolean('tiene_hogar'),
    tecnologiaHogar: text('tecnologia_hogar'), // 'FTTH' | 'HFC' | etc.
    planHogar: text('plan_hogar'), // e.g. 'FIB-400'
    rentaHogar: doublePrecision('renta_hogar'),
    nodoHogar: text('nodo_hogar'), // nodo/OLT del servicio hogar (ej. AQP-CAY-03)
    rentaMensual: doublePrecision('renta_mensual'),
    segmentoValor: text('segmento_valor'), // 'Oro' | 'Plata' | 'Bronce'
    arpu6m: doublePrecision('arpu_6m'),
    diasAtraso: integer('dias_atraso'),
    deudaVencida60d: boolean('deuda_vencida_60d'),
    tickets30d: integer('tickets_30d'),
    fallasRed30d: integer('fallas_red_30d'),
    ticketsAbiertos: integer('tickets_abiertos'),
    reclamosAbiertos: integer('reclamos_abiertos'),
    reclamos90d: integer('reclamos_90d'),
    reclamoAbiertoId: text('reclamo_abierto_id'),
    reclamoAbiertoDetalle: text('reclamo_abierto_detalle'),
    consultaPortabilidad30d: boolean('consulta_portabilidad_30d'),
    fechaUltimaConsultaPortabilidad: timestamp('fecha_ultima_consulta_portabilidad', {
      withTimezone: true,
    }),
    operadorConsultado: text('operador_consultado'),
    incidenciaMasivaId: text('incidencia_masiva_id'),
    afectadoIncidenciaMasiva: boolean('afectado_incidencia_masiva'),
    fechaUltimaRetencion: timestamp('fecha_ultima_retencion', { withTimezone: true }),
    elegibleRetencion: boolean('elegible_retencion'),
    scoreRiesgo: doublePrecision('score_riesgo'), // 0–1
    nivelRiesgo: text('nivel_riesgo'), // 'Crítico' | 'Alto' | 'Medio' | 'Bajo'
    sincronizadoAt: timestamp('sincronizado_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('cliente_nivel_riesgo_idx').on(t.nivelRiesgo),
    index('cliente_distrito_idx').on(t.distrito),
    index('cliente_score_riesgo_idx').on(t.scoreRiesgo),
  ],
);

// ============================================================================
// Writable operational table (the app writes here — Build-1 writable table)
//
// `acciones_retencion` is the ONLY table the app writes. Approved retention
// plans insert here: customer ID, offers (R1/R2/R3/R4), regulatory compensation,
// contact script, approval status + approver, audit trail. Append-only
// `audit_trail` makes each row a standalone timeline.
// ============================================================================

export const accionesRetencion = appSchema.table(
  'acciones_retencion',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clienteId: text('cliente_id').notNull(),
    // Array of up to 2 commercial offers: { codigo: 'R1'|'R2'|'R3'|'R4', detalle: string }
    ofertas: jsonb('ofertas').$type<OfertaRetencion[]>().notNull().default([]),
    // Regulatory compensation for service interruption (soles)
    compensacionSoles: doublePrecision('compensacion_soles').notNull().default(0),
    // True if discount > 25% (requires supervisor approval)
    requiereAprobacion: boolean('requiere_aprobacion').notNull().default(false),
    // If requiereAprobacion=true, the supervisor who needs to approve
    aprobador: text('aprobador'),
    // 'Borrador' | 'Pendiente aprobación supervisor' | 'Aprobada' | 'Registrada' | 'Rechazada'
    estado: text('estado', {
      enum: [
        'Borrador',
        'Pendiente aprobación supervisor',
        'Aprobada',
        'Registrada',
        'Rechazada',
      ],
    })
      .notNull()
      .default('Borrador'),
    // Contact script for the retention call
    guionContacto: text('guion_contacto').notNull(),
    // User who created/approved (OBO email)
    creadoPor: text('creado_por').notNull(),
    // Append-only audit trail: { at, by, action, notes?, tool? }
    auditTrail: jsonb('audit_trail').$type<AuditEntry[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    index('acciones_cliente_idx').on(t.clienteId),
    index('acciones_estado_idx').on(t.estado),
    index('acciones_created_idx').on(t.createdAt),
  ],
);

// ============================================================================
// JSONB entry shapes
// ============================================================================

/** One retention offer (R1–R4) in acciones_retencion.ofertas array */
export type OfertaRetencion = {
  codigo: 'R1' | 'R2' | 'R3' | 'R4';
  detalle: string;
  descuento_pct?: number | null;
};

export type AuditEntry = {
  at: string;
  by: string;
  action:
    | 'creado'
    | 'aprobado'
    | 'registrado'
    | 'rechazado'
    | 'contactado'
    | 'portabilidad_confirmada'
    | 'nota';
  notes?: string;
  tool?: string;
};

export type ThinkingEntry =
  | { kind: 'tool_call'; callId: string; name: string; args: string }
  | { kind: 'tool_output'; callId: string; output: string }
  | { kind: 'intermediate_message'; text: string };
