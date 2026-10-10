/**
 * Cola de retención — clientes activos ordenados por score de riesgo de fuga.
 *
 * Lee el espejo Lakebase (`app.cliente_360`) vía /api/clientes + /api/summary y se
 * refresca solo cuando el agente registra un plan (`dataMutated`). Click en una fila
 * abre el panel del cliente (ficha 360, tickets, acciones).
 */
import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useSession } from '@/lib/api';
import { dataMutated } from '@/lib/events';
import { dockController } from '@/chat/dockController';
import { fetchClientes, fetchResumen, soles, type Cliente, type FiltrosCola, type Resumen } from '@/lib/clientes';
import { RiesgoBadge } from '@/shared/badges';
import { KpiCards } from './KpiCards';
import { ClienteDrawer } from './ClienteDrawer';

const NIVELES = ['', 'Crítico', 'Alto', 'Medio'];
const SEGMENTOS = ['', 'Oro', 'Plata', 'Bronce'];

export function OperationsView() {
  const { config } = useSession();
  const [filtros, setFiltros] = useState<FiltrosCola>({});
  const [rows, setRows] = useState<Cliente[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [c, r] = await Promise.all([fetchClientes(filtros), fetchResumen()]);
      setRows(c);
      setResumen(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    return dataMutated.subscribe(() => void reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.nivel, filtros.distrito, filtros.segmento]);

  const distritos = Array.from(new Set(rows.map((r) => r.distrito).filter(Boolean))) as string[];
  const set = (k: keyof FiltrosCola) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setFiltros((f) => ({ ...f, [k]: e.target.value || undefined }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 lg:items-end">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
              Retención · Cola priorizada
            </div>
            <h1 className="display text-4xl font-semibold tracking-tight text-foreground mb-2">
              Retener sin multas.
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Clientes activos ordenados por riesgo de fuga. La incidencia masiva de Cayma (INC-AQP-2026-0412) y las
              consultas de portabilidad empujan a la cartera de Arequipa al tope de la cola.
            </p>
          </div>
          {config?.assistantScript?.[0] && (
            <button
              onClick={() => dockController.openAndSend(config.assistantScript[0].prompt)}
              className="w-full text-left rounded-xl border border-border bg-card hover:border-foreground/30 hover:shadow-sm px-5 py-4 transition-all flex items-center gap-4 group"
            >
              <div
                className="size-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <Sparkles className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Pregúntale al copiloto
                </div>
                <div className="text-sm font-medium text-foreground mt-0.5">¿Por qué Rosa Huamán está en riesgo crítico?</div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </button>
          )}
        </div>

        {resumen && <KpiCards resumen={resumen} />}

        <div className="rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border">
            <div className="font-semibold text-foreground mr-auto">
              Clientes en riesgo <span className="text-muted-foreground font-normal">({rows.length})</span>
            </div>
            <Select label="Nivel" value={filtros.nivel} options={NIVELES} onChange={set('nivel')} />
            <Select label="Segmento" value={filtros.segmento} options={SEGMENTOS} onChange={set('segmento')} />
            <Select label="Distrito" value={filtros.distrito} options={['', ...distritos.sort()]} onChange={set('distrito')} />
          </div>
          {error ? (
            <div className="p-6 text-sm text-destructive">
              No se pudo cargar la cola: {error}{' '}
              <button className="underline" onClick={() => void reload()}>
                Reintentar
              </button>
            </div>
          ) : loading ? (
            <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="text-left">
                    {['Cliente', 'Distrito', 'Segmento', 'Plan hogar', 'Renta', 'Score', 'Nivel', 'Señales'].map((h) => (
                      <th key={h} className="px-4 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.clienteId}
                      onClick={() => setSelected(c.clienteId)}
                      className="border-t border-border hover:bg-muted/50 cursor-pointer"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{c.nombreCompleto}</div>
                        <div className="text-xs text-muted-foreground">{c.clienteId}</div>
                      </td>
                      <td className="px-4 py-2.5">{c.distrito}</td>
                      <td className="px-4 py-2.5">{c.segmentoValor}</td>
                      <td className="px-4 py-2.5">{c.planHogar ?? '—'}</td>
                      <td className="px-4 py-2.5 tabular-nums">{soles(c.rentaMensual)}</td>
                      <td className="px-4 py-2.5 tabular-nums font-semibold">{c.scoreRiesgo?.toFixed(2)}</td>
                      <td className="px-4 py-2.5">
                        <RiesgoBadge nivel={c.nivelRiesgo} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground space-x-2 whitespace-nowrap">
                        {c.consultaPortabilidad30d && <span title="Consulta de portabilidad">📲 portabilidad</span>}
                        {c.afectadoIncidenciaMasiva && <span title={c.incidenciaMasivaId ?? ''}>⚡ incidencia</span>}
                        {(c.reclamosAbiertos ?? 0) > 0 && <span>📝 reclamo</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ClienteDrawer id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Select(props: {
  label: string;
  value?: string;
  options: string[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label className="text-xs text-muted-foreground flex items-center gap-1.5">
      {props.label}
      <select
        value={props.value ?? ''}
        onChange={props.onChange}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o || 'Todos'}
          </option>
        ))}
      </select>
    </label>
  );
}
