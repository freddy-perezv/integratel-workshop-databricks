/**
 * Panel lateral del cliente: Ficha 360 · Tickets (Delta vía warehouse) · Acciones
 * (planes de retención en Lakebase, con Aprobar/Rechazar para el supervisor).
 * Se refresca cuando el agente registra un plan (`dataMutated`).
 */
import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@databricks/appkit-ui/react';
import { dataMutated } from '@/lib/events';
import { dockController } from '@/chat/dockController';
import {
  decidirAccion,
  fetchCliente,
  fetchTickets,
  soles,
  type Accion,
  type Cliente,
  type Ticket,
} from '@/lib/clientes';
import { EstadoBadge, RiesgoBadge } from '@/shared/badges';

export function ClienteDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (cid: string) => {
    try {
      const r = await fetchCliente(cid);
      setCliente(r.cliente);
      setAcciones(r.acciones);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    if (!id) return;
    setCliente(null);
    setTickets(null);
    void load(id);
    fetchTickets(id).then(setTickets, () => setTickets([]));
    return dataMutated.subscribe(() => void load(id));
  }, [id]);

  const decidir = async (accionId: string, d: 'Aprobada' | 'Rechazada') => {
    await decidirAccion(accionId, d);
    dataMutated.emit();
  };

  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{cliente?.nombreCompleto ?? id}</SheetTitle>
          <SheetDescription>
            {id} · {cliente?.distrito}, {cliente?.region}
          </SheetDescription>
        </SheetHeader>
        {error && <div className="p-4 text-sm text-destructive">{error}</div>}
        {cliente && (
          <div className="px-4 pb-6 space-y-4">
            <div className="flex items-center gap-3">
              <RiesgoBadge nivel={cliente.nivelRiesgo} />
              <span className="text-sm text-muted-foreground">
                score <b className="text-foreground">{cliente.scoreRiesgo?.toFixed(2)}</b> · segmento{' '}
                <b className="text-foreground">{cliente.segmentoValor}</b>
              </span>
              <button
                className="ml-auto text-xs rounded-md px-3 py-1.5 font-medium"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                onClick={() =>
                  dockController.openAndSend(
                    `¿Por qué ${cliente.nombreCompleto} (${cliente.clienteId}) está en riesgo y qué dice la política que le puedo ofrecer?`,
                  )
                }
              >
                Preguntar al copiloto
              </button>
            </div>
            <Tabs defaultValue="ficha">
              <TabsList>
                <TabsTrigger value="ficha">Ficha 360</TabsTrigger>
                <TabsTrigger value="tickets">Tickets</TabsTrigger>
                <TabsTrigger value="acciones">Acciones ({acciones.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="ficha">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mt-3">
                  <Item k="Planes" v={cliente.planes} />
                  <Item k="Nodo hogar" v={cliente.nodoHogar} />
                  <Item k="Renta mensual" v={soles(cliente.rentaMensual)} />
                  <Item k="Renta hogar" v={soles(cliente.rentaHogar)} />
                  <Item k="Antigüedad" v={`${cliente.antiguedadAnios ?? '—'} años`} />
                  <Item k="Tickets 30 d" v={`${cliente.tickets30d} (${cliente.fallasRed30d} de red)`} />
                  <Item k="Reclamos abiertos" v={cliente.reclamosAbiertos} />
                  {cliente.reclamoAbiertoId && (
                    <div className="col-span-2">
                      <Item k={`Reclamo ${cliente.reclamoAbiertoId}`} v={cliente.reclamoAbiertoDetalle} />
                    </div>
                  )}
                  <Item k="Incidencia masiva" v={cliente.afectadoIncidenciaMasiva ? cliente.incidenciaMasivaId : 'No'} />
                  <Item
                    k="Consulta de portabilidad"
                    v={
                      cliente.consultaPortabilidad30d
                        ? `${cliente.fechaUltimaConsultaPortabilidad?.slice(0, 10)} → ${cliente.operadorConsultado}`
                        : 'No'
                    }
                  />
                  <Item k="Elegible retención" v={cliente.elegibleRetencion ? 'Sí' : 'No'} />
                  <Item k="Deuda vencida > 60 d" v={cliente.deudaVencida60d ? 'Sí' : 'No'} />
                </dl>
              </TabsContent>
              <TabsContent value="tickets">
                {tickets === null ? (
                  <div className="text-sm text-muted-foreground mt-3">Consultando el warehouse…</div>
                ) : tickets.length === 0 ? (
                  <div className="text-sm text-muted-foreground mt-3">Sin tickets.</div>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {tickets.map((t) => (
                      <li key={t.ticket_id} className="rounded-lg border border-border p-3 text-sm">
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <b className="text-foreground">{t.codigo_falla}</b>
                          <span>{t.fecha_apertura?.slice(0, 16).replace('T', ' ')}</span>
                          <span>· {t.canal}</span>
                          <span className="ml-auto">{t.estado}</span>
                        </div>
                        <div className="mt-1">{t.descripcion}</div>
                        {t.incidencia_id && <div className="mt-1 text-xs text-muted-foreground">⚡ {t.incidencia_id}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="acciones">
                {acciones.length === 0 ? (
                  <div className="text-sm text-muted-foreground mt-3">
                    Aún no hay planes de retención. Pídele al copiloto que prepare uno.
                  </div>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {acciones.map((a) => (
                      <li key={a.id} className="rounded-lg border border-border p-3 text-sm space-y-2">
                        <div className="flex items-center gap-2">
                          <EstadoBadge estado={a.estado} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(a.createdAt).toLocaleString('es-PE')} · {a.creadoPor}
                          </span>
                        </div>
                        <ul className="list-disc pl-5">
                          {a.ofertas.map((o, i) => (
                            <li key={i}>
                              <b>{o.codigo}</b> {o.detalle}
                            </li>
                          ))}
                          {a.compensacionSoles > 0 && <li>Compensación regulatoria: {soles(a.compensacionSoles)}</li>}
                        </ul>
                        {a.guionContacto && (
                          <details>
                            <summary className="cursor-pointer text-xs text-muted-foreground">Guion de contacto</summary>
                            <p className="mt-1 whitespace-pre-wrap">{a.guionContacto}</p>
                          </details>
                        )}
                        {a.estado === 'Pendiente aprobación supervisor' && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-xs text-muted-foreground mr-auto">Aprueba: {a.aprobador}</span>
                            <button className="text-xs rounded-md border px-3 py-1" onClick={() => void decidir(a.id, 'Rechazada')}>
                              Rechazar
                            </button>
                            <button
                              className="text-xs rounded-md px-3 py-1 text-white"
                              style={{ background: 'var(--primary)' }}
                              onClick={() => void decidir(a.id, 'Aprobada')}
                            >
                              Aprobar
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{v ?? '—'}</dd>
    </div>
  );
}
