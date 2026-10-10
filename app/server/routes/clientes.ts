/**
 * Rutas REST de la Cola de retención.
 *   GET  /api/clientes?nivel=&distrito=&nodo=&segmento=&limit=
 *   GET  /api/clientes/:id            → ficha 360 + acciones registradas
 *   GET  /api/clientes/:id/tickets    → tickets recientes (Delta vía SQL Warehouse)
 *   GET  /api/summary                 → KPIs de la cola
 *   GET  /api/acciones?clienteId=&estado=
 *   POST /api/acciones/:id/decidir    → { decision: 'Aprobada'|'Rechazada', notas? } (supervisor)
 */
import express, { type Application, type Request, type Response } from 'express';
import type { AppDb } from '../db/index.js';
import {
  decidirAccion,
  getCliente,
  listAccionesRetencion,
  listClientes,
  resumenRiesgo,
  type NivelRiesgo,
} from '../db/queries/clientes.js';
import { execSql } from '../db/sync.js';
import { getCurrentUserEmail } from '../lib/user.js';

type DataConfig = { catalog: string; schema: string };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
const NIVELES: NivelRiesgo[] = ['Crítico', 'Alto', 'Medio', 'Bajo'];

function fail(res: Response, where: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[${where}]`, err);
  res.status(500).json({ error: msg });
}

export function registerClienteRoutes(
  app: Application,
  { db, data }: { db: AppDb; data?: DataConfig },
): void {
  app.get('/api/clientes', async (req: Request, res: Response) => {
    try {
      const nivel = str(req.query.nivel) as NivelRiesgo | undefined;
      const rows = await listClientes(db, {
        nivel: nivel && NIVELES.includes(nivel) ? nivel : undefined,
        distrito: str(req.query.distrito),
        nodo: str(req.query.nodo),
        segmento: str(req.query.segmento),
        limit: Number(req.query.limit) || 100,
      });
      res.json(rows);
    } catch (err) {
      fail(res, 'GET /api/clientes', err);
    }
  });

  app.get('/api/summary', async (_req, res) => {
    try {
      res.json(await resumenRiesgo(db));
    } catch (err) {
      fail(res, 'GET /api/summary', err);
    }
  });

  app.get('/api/clientes/:id', async (req, res) => {
    try {
      const cliente = await getCliente(db, req.params.id);
      if (!cliente) {
        res.status(404).json({ error: `Cliente ${req.params.id} no encontrado` });
        return;
      }
      const acciones = await listAccionesRetencion(db, { clienteId: cliente.clienteId, limit: 20 });
      res.json({ cliente, acciones });
    } catch (err) {
      fail(res, 'GET /api/clientes/:id', err);
    }
  });

  app.get('/api/clientes/:id/tickets', async (req, res) => {
    const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;
    if (!data || !warehouseId) {
      res.json([]);
      return;
    }
    const id = req.params.id;
    if (!/^CLI-\d{6}$/.test(id)) {
      res.status(400).json({ error: 'cliente_id inválido' });
      return;
    }
    try {
      const rows = await execSql<Record<string, string | null>>(
        warehouseId,
        `SELECT ticket_id, fecha_apertura, codigo_falla, canal, estado, horas_resolucion, incidencia_id, descripcion
         FROM ${data.catalog}.${data.schema}.tickets_enriquecidos
         WHERE cliente_id = '${id}' ORDER BY fecha_apertura DESC LIMIT 20`,
      );
      res.json(rows);
    } catch (err) {
      fail(res, 'GET /api/clientes/:id/tickets', err);
    }
  });

  app.get('/api/acciones', async (req, res) => {
    try {
      res.json(
        await listAccionesRetencion(db, {
          clienteId: str(req.query.clienteId),
          estado: str(req.query.estado),
          limit: Number(req.query.limit) || 50,
        }),
      );
    } catch (err) {
      fail(res, 'GET /api/acciones', err);
    }
  });

  app.post('/api/acciones/:id/decidir', express.json(), async (req, res) => {
    const decision = req.body?.decision;
    if (decision !== 'Aprobada' && decision !== 'Rechazada') {
      res.status(400).json({ error: "decision debe ser 'Aprobada' o 'Rechazada'" });
      return;
    }
    try {
      const row = await decidirAccion(db, {
        id: req.params.id,
        decision,
        userEmail: getCurrentUserEmail(req),
        notas: str(req.body?.notas),
      });
      if (!row) {
        res.status(409).json({ error: 'La acción no existe o ya no está pendiente de aprobación' });
        return;
      }
      res.json(row);
    } catch (err) {
      fail(res, 'POST /api/acciones/:id/decidir', err);
    }
  });
}
