/**
 * Wrappers de fetch para la Cola de retención (todos pasan por okOrThrow para
 * que los errores muestren el mensaje real del servidor).
 */
import { okOrThrow } from '@/lib/api';

export type Cliente = {
  clienteId: string;
  nombreCompleto: string | null;
  region: string | null;
  distrito: string | null;
  antiguedadAnios: number | null;
  planes: string | null;
  planHogar: string | null;
  nodoHogar: string | null;
  rentaHogar: number | null;
  rentaMensual: number | null;
  segmentoValor: string | null;
  tickets30d: number | null;
  fallasRed30d: number | null;
  reclamosAbiertos: number | null;
  consultaPortabilidad30d: boolean | null;
  fechaUltimaConsultaPortabilidad: string | null;
  operadorConsultado: string | null;
  afectadoIncidenciaMasiva: boolean | null;
  incidenciaMasivaId: string | null;
  deudaVencida60d: boolean | null;
  elegibleRetencion: boolean | null;
  scoreRiesgo: number | null;
  nivelRiesgo: string | null;
};

export type Oferta = { codigo: string; detalle: string; descuento_pct?: number | null };
export type AuditEntry = { at: string; by: string; action: string; notes?: string };

export type Accion = {
  id: string;
  clienteId: string;
  ofertas: Oferta[];
  compensacionSoles: number;
  requiereAprobacion: boolean;
  aprobador: string | null;
  estado: string;
  guionContacto: string;
  creadoPor: string;
  auditTrail: AuditEntry[];
  createdAt: string;
  decidedAt: string | null;
};

export type Resumen = {
  clientes_criticos: number;
  clientes_altos: number;
  renta_en_riesgo: number;
  consultas_portabilidad_30d: number;
  afectados_incidencia: number;
  acciones_hoy: number;
  acciones_pendientes_supervisor: number;
};

export type Ticket = {
  ticket_id: string;
  fecha_apertura: string;
  codigo_falla: string;
  canal: string;
  estado: string;
  horas_resolucion: string | null;
  incidencia_id: string | null;
  descripcion: string;
};

export type FiltrosCola = { nivel?: string; distrito?: string; segmento?: string };

export async function fetchClientes(f: FiltrosCola = {}): Promise<Cliente[]> {
  const qs = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
  qs.set('limit', '200');
  const res = await okOrThrow(await fetch(`/api/clientes?${qs}`), '/api/clientes');
  return res.json();
}

export async function fetchResumen(): Promise<Resumen> {
  const res = await okOrThrow(await fetch('/api/summary'), '/api/summary');
  return res.json();
}

export async function fetchCliente(id: string): Promise<{ cliente: Cliente; acciones: Accion[] }> {
  const res = await okOrThrow(await fetch(`/api/clientes/${encodeURIComponent(id)}`), `/api/clientes/${id}`);
  return res.json();
}

export async function fetchTickets(id: string): Promise<Ticket[]> {
  const res = await okOrThrow(
    await fetch(`/api/clientes/${encodeURIComponent(id)}/tickets`),
    `/api/clientes/${id}/tickets`,
  );
  return res.json();
}

export async function decidirAccion(id: string, decision: 'Aprobada' | 'Rechazada'): Promise<Accion> {
  const res = await okOrThrow(
    await fetch(`/api/acciones/${encodeURIComponent(id)}/decidir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    }),
    `/api/acciones/${id}/decidir`,
  );
  return res.json();
}

export const soles = (n: number | null | undefined, compact = false) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : 2,
      }).format(n);

export type ActivityEvent = {
  kind: 'action';
  action_id: string;
  cliente_id: string;
  nombre: string | null;
  at: string;
  by: string;
  estado: string;
};

export async function fetchActivity(limit = 20): Promise<ActivityEvent[]> {
  const res = await okOrThrow(await fetch(`/api/activity/recent?limit=${limit}`), '/api/activity/recent');
  return res.json();
}
