/**
 * Lakebase query helpers — dominio de retención Integratel.
 *
 * Lee de `app.cliente_360` (espejo de solo lectura de gold.cliente_360) y escribe
 * únicamente en `app.acciones_retencion`. Las reglas de la Política POL-RET-2026 se
 * validan AQUÍ (no solo en el prompt del agente): el agente no puede saltárselas.
 */
import { and, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
import type { AppDb } from '../index.js';
import { accionesRetencion, cliente360Mirror } from '../schema.js';
import type { AuditEntry, OfertaRetencion } from '../schema.js';

export type ClienteRow = typeof cliente360Mirror.$inferSelect;
export type AccionRetencion = typeof accionesRetencion.$inferSelect;
export type NivelRiesgo = 'Crítico' | 'Alto' | 'Medio' | 'Bajo';

export const SUPERVISOR = 'Jorge Paredes (Supervisor de Retención)';
const MAX_BENEFICIOS = 2;
const TOPE_DESCUENTO_SIN_APROBACION = 25;
const TOPE_DESCUENTO_ORO = 30;
const TOPE_DESCUENTO_PLATA = 20;

export async function getCliente(db: AppDb, clienteId: string): Promise<ClienteRow | null> {
  const rows = await db
    .select()
    .from(cliente360Mirror)
    .where(eq(cliente360Mirror.clienteId, clienteId))
    .limit(1);
  return rows[0] ?? null;
}

/** Busca por id exacto o por nombre (ILIKE). */
export async function buscarClientes(db: AppDb, texto: string, limit = 5): Promise<ClienteRow[]> {
  const exacto = await getCliente(db, texto.trim().toUpperCase());
  if (exacto) return [exacto];
  return db
    .select()
    .from(cliente360Mirror)
    .where(sql`${cliente360Mirror.nombreCompleto} ILIKE ${'%' + texto.trim() + '%'}`)
    .orderBy(desc(cliente360Mirror.scoreRiesgo))
    .limit(limit);
}

export async function listClientes(
  db: AppDb,
  opts: { nivel?: NivelRiesgo; distrito?: string; nodo?: string; segmento?: string; limit?: number } = {},
): Promise<ClienteRow[]> {
  const conds: SQL[] = [];
  if (opts.nivel) conds.push(eq(cliente360Mirror.nivelRiesgo, opts.nivel));
  else conds.push(inArray(cliente360Mirror.nivelRiesgo, ['Crítico', 'Alto', 'Medio']));
  if (opts.distrito) conds.push(eq(cliente360Mirror.distrito, opts.distrito));
  if (opts.nodo) conds.push(eq(cliente360Mirror.nodoHogar, opts.nodo));
  if (opts.segmento) conds.push(eq(cliente360Mirror.segmentoValor, opts.segmento));
  return db
    .select()
    .from(cliente360Mirror)
    .where(and(...conds))
    .orderBy(desc(cliente360Mirror.scoreRiesgo), desc(cliente360Mirror.rentaMensual))
    .limit(Math.min(opts.limit ?? 100, 500));
}

export type ResumenRiesgo = {
  clientes_criticos: number;
  clientes_altos: number;
  renta_en_riesgo: number;
  consultas_portabilidad_30d: number;
  afectados_incidencia: number;
  acciones_hoy: number;
  acciones_pendientes_supervisor: number;
};

export async function resumenRiesgo(db: AppDb): Promise<ResumenRiesgo> {
  const r = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE nivel_riesgo = 'Crítico')::int AS clientes_criticos,
      count(*) FILTER (WHERE nivel_riesgo = 'Alto')::int AS clientes_altos,
      coalesce(sum(renta_mensual) FILTER (WHERE nivel_riesgo IN ('Crítico','Alto')), 0)::float AS renta_en_riesgo,
      count(*) FILTER (WHERE consulta_portabilidad_30d)::int AS consultas_portabilidad_30d,
      count(*) FILTER (WHERE afectado_incidencia_masiva)::int AS afectados_incidencia,
      (SELECT count(*) FROM app.acciones_retencion WHERE created_at >= date_trunc('day', now()))::int AS acciones_hoy,
      (SELECT count(*) FROM app.acciones_retencion WHERE estado = 'Pendiente aprobación supervisor')::int AS acciones_pendientes_supervisor
    FROM app.cliente_360`);
  return r.rows[0] as ResumenRiesgo;
}

export async function listAccionesRetencion(
  db: AppDb,
  opts: { clienteId?: string; estado?: string; limit?: number } = {},
): Promise<AccionRetencion[]> {
  const conds: SQL[] = [];
  if (opts.clienteId) conds.push(eq(accionesRetencion.clienteId, opts.clienteId));
  if (opts.estado) conds.push(sql`${accionesRetencion.estado} = ${opts.estado}`);
  return db
    .select()
    .from(accionesRetencion)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(accionesRetencion.createdAt))
    .limit(Math.min(opts.limit ?? 50, 500));
}

export async function getAccionRetencion(db: AppDb, id: string): Promise<AccionRetencion | null> {
  const rows = await db.select().from(accionesRetencion).where(eq(accionesRetencion.id, id)).limit(1);
  return rows[0] ?? null;
}

export type PlanInput = {
  clienteId: string;
  ofertas: OfertaRetencion[];
  diasInterrupcion: number | null;
  guionContacto: string;
  userEmail: string;
};

export type PlanResultado =
  | { ok: true; actionId: string; estado: string; requiereAprobacion: boolean; aprobador: string | null; compensacionSoles: number }
  | { ok: false; motivo: string };

/**
 * Valida el plan contra la Política de Retención 2026 y lo registra.
 * - máx. 2 beneficios comerciales (la compensación regulatoria no cuenta)
 * - sin retención si deuda vencida > 60 días o retención en los últimos 6 meses
 * - R1: tope 30% (Oro) / 20% (Plata); > 25% ⇒ requiere aprobación del Supervisor
 * - compensación = renta_hogar × días / 30 (calculada aquí, no por el modelo)
 */
export async function registrarPlanRetencion(db: AppDb, input: PlanInput): Promise<PlanResultado> {
  const cliente = await getCliente(db, input.clienteId);
  if (!cliente) return { ok: false, motivo: `Cliente ${input.clienteId} no existe en la cartera activa.` };
  if (cliente.deudaVencida60d) return { ok: false, motivo: 'Deuda vencida > 60 días: no aplica retención (POL-RET-2026).' };
  if (cliente.elegibleRetencion === false)
    return { ok: false, motivo: 'El cliente ya recibió una retención en los últimos 6 meses (POL-RET-2026).' };
  if (input.ofertas.length > MAX_BENEFICIOS)
    return { ok: false, motivo: `Máximo ${MAX_BENEFICIOS} beneficios comerciales simultáneos; se propusieron ${input.ofertas.length}.` };

  const r1 = input.ofertas.find((o) => o.codigo === 'R1');
  const pct = r1?.descuento_pct ?? 0;
  const tope = cliente.segmentoValor === 'Oro' ? TOPE_DESCUENTO_ORO : cliente.segmentoValor === 'Plata' ? TOPE_DESCUENTO_PLATA : 0;
  if (r1 && pct > tope)
    return { ok: false, motivo: `R1 de ${pct}% excede el tope del segmento ${cliente.segmentoValor ?? '—'} (${tope}%).` };
  if (input.ofertas.some((o) => o.codigo === 'R2') && !cliente.tieneHogar)
    return { ok: false, motivo: 'R2 (upgrade de velocidad) solo aplica a clientes con servicio hogar.' };

  const requiereAprobacion = pct > TOPE_DESCUENTO_SIN_APROBACION;
  const estado = requiereAprobacion ? 'Pendiente aprobación supervisor' : 'Aprobada';
  const dias = Math.max(0, input.diasInterrupcion ?? 0);
  const compensacionSoles = Math.round(((cliente.rentaHogar ?? 0) * dias * 100) / 30) / 100;
  const audit: AuditEntry = {
    at: new Date().toISOString(),
    by: input.userEmail,
    action: 'creado',
    notes: requiereAprobacion
      ? `Plan registrado; R1 ${pct}% > ${TOPE_DESCUENTO_SIN_APROBACION}% → enviado a ${SUPERVISOR}`
      : 'Plan registrado y aprobado dentro de la política',
  };

  const [row] = await db
    .insert(accionesRetencion)
    .values({
      clienteId: cliente.clienteId,
      ofertas: input.ofertas,
      compensacionSoles,
      requiereAprobacion,
      aprobador: requiereAprobacion ? SUPERVISOR : null,
      estado,
      guionContacto: input.guionContacto,
      creadoPor: input.userEmail,
      auditTrail: [audit],
    })
    .returning({ id: accionesRetencion.id });
  return { ok: true, actionId: row.id, estado, requiereAprobacion, aprobador: requiereAprobacion ? SUPERVISOR : null, compensacionSoles };
}

/** Decisión del supervisor sobre un plan pendiente (botones Aprobar / Rechazar). */
export async function decidirAccion(
  db: AppDb,
  args: { id: string; decision: 'Aprobada' | 'Rechazada'; userEmail: string; notas?: string },
): Promise<AccionRetencion | null> {
  const entry: AuditEntry = {
    at: new Date().toISOString(),
    by: args.userEmail,
    action: args.decision === 'Aprobada' ? 'aprobado' : 'rechazado',
    notes: args.notas,
  };
  const [row] = await db
    .update(accionesRetencion)
    .set({
      estado: args.decision,
      decidedAt: new Date(),
      auditTrail: sql`${accionesRetencion.auditTrail} || ${JSON.stringify([entry])}::jsonb`,
    })
    .where(and(eq(accionesRetencion.id, args.id), eq(accionesRetencion.estado, 'Pendiente aprobación supervisor')))
    .returning();
  return row ?? null;
}

/** Feed de actividad reciente (Home). */
export async function recentActivity(db: AppDb, limit = 20) {
  const rows = await db
    .select({
      id: accionesRetencion.id,
      clienteId: accionesRetencion.clienteId,
      nombre: cliente360Mirror.nombreCompleto,
      estado: accionesRetencion.estado,
      creadoPor: accionesRetencion.creadoPor,
      createdAt: accionesRetencion.createdAt,
    })
    .from(accionesRetencion)
    .leftJoin(cliente360Mirror, eq(cliente360Mirror.clienteId, accionesRetencion.clienteId))
    .where(gte(accionesRetencion.createdAt, sql`now() - interval '30 days'`))
    .orderBy(desc(accionesRetencion.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    kind: 'action' as const,
    action_id: r.id,
    cliente_id: r.clienteId,
    nombre: r.nombre,
    at: r.createdAt.toISOString(),
    by: r.creadoPor,
    estado: r.estado,
  }));
}
