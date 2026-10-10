import { sql } from 'drizzle-orm';
import { getExecutionContext } from '@databricks/appkit';
import type { AppDb } from './index.js';
import { getTableColumns } from 'drizzle-orm';
import { cliente360Mirror } from './schema.js';

// SET col = excluded.col para todas las columnas salvo la clave primaria.
const UPSERT_SET = Object.fromEntries(
  Object.entries(getTableColumns(cliente360Mirror))
    .filter(([key]) => key !== 'clienteId')
    .map(([key, col]) => [key, sql.raw(`excluded."${col.name}"`)]),
);

/**
 * One-shot Delta → Lakebase sync — Centro de Retención 360 · Integratel.
 *
 * Pulls the READ-ONLY Gold mirror:
 *   - integratel_dev.gold.cliente_360  (active customers with risk scores)
 *
 * `acciones_retencion` is the app's own WRITABLE table — never synced, starts empty.
 *
 * Idempotent in the "only-if-destination-empty" sense — if the cliente_360
 * mirror has rows, we skip. Pass `{ forceIfAnyEmpty: true }` to re-sync
 * on demand (used by the "Reset demo" button).
 */

type DataConfig = {
  catalog: string;
  schema: string;
  tables: {
    cliente360: string; // integratel_dev.gold.cliente_360
  };
};

const num = (v: string | null): number | null => (v === null || v === '' ? null : Number(v));
const bool = (v: string | null): boolean | null => (v === null ? null : v === 'true' || v === '1');
const date = (v: string | null): Date | null => (v ? new Date(v) : null);

export async function syncFromDelta(
  db: AppDb,
  cfg: DataConfig,
  opts: { forceIfAnyEmpty?: boolean } = {},
): Promise<void> {
  // El espejo se refresca (upsert) en CADA arranque: tras correr el pipeline SQL basta
  // reiniciar la App para que Lakebase refleje la última versión de gold.cliente_360.
  void opts;

  const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;
  if (!warehouseId) {
    console.warn('[sync] DATABRICKS_WAREHOUSE_ID not set — skipping Delta sync');
    return;
  }

  console.log('[sync] Starting Delta → Lakebase sync (cliente_360)…');
  const t0 = Date.now();

  const fqCliente = `${cfg.catalog}.${cfg.schema}.${cfg.tables.cliente360}`;

  // Sync cliente_360 — page through it with LIMIT/OFFSET to keep memory bounded
  // La Statement API devuelve todo como texto: se convierte con num/bool/date.
  type ClienteSrc = Record<string, string | null> & { cliente_id: string };

  const PAGE_SIZE = 10_000;
  let totalInserted = 0;

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await execSql<ClienteSrc>(
      warehouseId,
      `SELECT
         cliente_id, nombre_completo, region, provincia, distrito, estado,
         fecha_alta, antiguedad_anios, motivo_baja, servicios_activos, planes,
         tiene_hogar, tecnologia_hogar, plan_hogar, renta_hogar, nodo_hogar, renta_mensual,
         segmento_valor, arpu_6m, dias_atraso, deuda_vencida_60d, tickets_30d,
         fallas_red_30d, tickets_abiertos, reclamos_abiertos, reclamos_90d, reclamo_abierto_id, reclamo_abierto_detalle,
         consulta_portabilidad_30d, fecha_ultima_consulta_portabilidad,
         operador_consultado, incidencia_masiva_id, afectado_incidencia_masiva,
         fecha_ultima_retencion, elegible_retencion, score_riesgo, nivel_riesgo
       FROM ${fqCliente}
       WHERE estado = 'Activo'
       ORDER BY cliente_id
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    );

    if (!page.length) break;

    await chunkInsert(page, 1_000, (chunk) =>
      db
        .insert(cliente360Mirror)
        .values(
          chunk.map((r) => ({
            clienteId: r.cliente_id,
            nombreCompleto: r.nombre_completo,
            region: r.region,
            provincia: r.provincia,
            distrito: r.distrito,
            estado: r.estado,
            fechaAlta: date(r.fecha_alta),
            antiguedadAnios: num(r.antiguedad_anios),
            motivoBaja: r.motivo_baja,
            serviciosActivos: num(r.servicios_activos),
            planes: r.planes,
            tieneHogar: bool(r.tiene_hogar),
            tecnologiaHogar: r.tecnologia_hogar,
            planHogar: r.plan_hogar,
            rentaHogar: num(r.renta_hogar),
            nodoHogar: r.nodo_hogar,
            rentaMensual: num(r.renta_mensual),
            segmentoValor: r.segmento_valor,
            arpu6m: num(r.arpu_6m),
            diasAtraso: num(r.dias_atraso),
            deudaVencida60d: bool(r.deuda_vencida_60d),
            tickets30d: num(r.tickets_30d),
            fallasRed30d: num(r.fallas_red_30d),
            ticketsAbiertos: num(r.tickets_abiertos),
            reclamosAbiertos: num(r.reclamos_abiertos),
            reclamos90d: num(r.reclamos_90d),
            reclamoAbiertoId: r.reclamo_abierto_id,
            reclamoAbiertoDetalle: r.reclamo_abierto_detalle,
            consultaPortabilidad30d: bool(r.consulta_portabilidad_30d),
            fechaUltimaConsultaPortabilidad: date(r.fecha_ultima_consulta_portabilidad),
            operadorConsultado: r.operador_consultado,
            incidenciaMasivaId: r.incidencia_masiva_id,
            afectadoIncidenciaMasiva: bool(r.afectado_incidencia_masiva),
            fechaUltimaRetencion: date(r.fecha_ultima_retencion),
            elegibleRetencion: bool(r.elegible_retencion),
            scoreRiesgo: num(r.score_riesgo),
            nivelRiesgo: r.nivel_riesgo,
          })),
        )
        .onConflictDoUpdate({ target: cliente360Mirror.clienteId, set: UPSERT_SET }),
    );

    totalInserted += page.length;
    if (page.length < PAGE_SIZE) break;
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[sync] cliente_360: ${totalInserted} rows in ${dt}s`);
  console.log(`[sync] Done`);
}

/**
 * Reset: truncate the app's writable table + chat state, then re-sync the
 * read-only mirrors. All agent writes are wiped — retention actions are cleared.
 */
export async function wipeMirroredTables(db: AppDb): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE TABLE app.feedback RESTART IDENTITY CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE app.messages RESTART IDENTITY CASCADE`);
    await tx.execute(sql`TRUNCATE TABLE app.conversations RESTART IDENTITY CASCADE`);
    // The writable action table — where agent writes land
    await tx.execute(sql`TRUNCATE TABLE app.acciones_retencion RESTART IDENTITY CASCADE`);
    // Read-only mirror — re-pulled by syncFromDelta after this
    await tx.execute(sql`TRUNCATE TABLE app.cliente_360 RESTART IDENTITY CASCADE`);
  });
}

export async function execSql<T>(
  warehouseId: string,
  statement: string,
): Promise<T[]> {
  const { client } = getExecutionContext();
  type StmtResp = {
    statement_id: string;
    status: { state: string; error?: { message: string } };
    manifest?: {
      schema: { columns: Array<{ name: string }> };
      chunks?: Array<{ chunk_index: number; row_count: number }>;
    };
    result?: {
      chunk_index: number;
      row_count: number;
      data_array?: Array<Array<unknown>>;
      next_chunk_index?: number;
    };
  };

  const initial = (await client.apiClient.request({
    method: 'POST',
    path: '/api/2.0/sql/statements',
    payload: {
      statement,
      warehouse_id: warehouseId,
      wait_timeout: '50s',
      on_wait_timeout: 'CONTINUE',
      disposition: 'INLINE',
      format: 'JSON_ARRAY',
    },
    headers: new Headers(),
    raw: false,
    query: {},
  })) as StmtResp;

  // Cap total polling at 10 minutes
  const POLL_DEADLINE_MS = 10 * 60 * 1000;
  const startedAt = Date.now();

  let cur = initial;
  while (
    cur.status.state !== 'SUCCEEDED' &&
    cur.status.state !== 'FAILED' &&
    cur.status.state !== 'CANCELED'
  ) {
    if (Date.now() - startedAt > POLL_DEADLINE_MS) {
      throw new Error(
        `[sync] SQL still ${cur.status.state} after 10 minutes — aborting (statement_id=${cur.statement_id})`,
      );
    }
    await new Promise((r) => setTimeout(r, 1000));
    cur = (await client.apiClient.request({
      method: 'GET',
      path: `/api/2.0/sql/statements/${cur.statement_id}`,
      headers: new Headers(),
      raw: false,
      query: {},
    })) as StmtResp;
  }

  if (cur.status.state !== 'SUCCEEDED') {
    throw new Error(
      `[sync] SQL failed: ${cur.status.error?.message ?? cur.status.state}`,
    );
  }

  const cols = cur.manifest?.schema.columns.map((c) => c.name) ?? [];
  const rows: T[] = [];
  let chunk = cur.result;
  while (chunk) {
    for (const row of chunk.data_array ?? []) {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < cols.length; i++) obj[cols[i]] = row[i];
      rows.push(obj as T);
    }
    if (chunk.next_chunk_index === undefined || chunk.next_chunk_index === null) break;
    chunk = (await client.apiClient.request({
      method: 'GET',
      path: `/api/2.0/sql/statements/${cur.statement_id}/result/chunks/${chunk.next_chunk_index}`,
      headers: new Headers(),
      raw: false,
      query: {},
    })) as StmtResp['result'];
  }
  return rows;
}

async function chunkInsert<T>(
  rows: T[],
  size: number,
  fn: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
}
