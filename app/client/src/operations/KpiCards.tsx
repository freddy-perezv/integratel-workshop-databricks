/**
 * KPIs de la Cola de retención. Cuando el agente registra un plan (dataMutated),
 * solo las tarjetas cuyo valor cambió hacen el pulso.
 */
import { AlertTriangle, Coins, PhoneForwarded, ClipboardCheck } from 'lucide-react';
import { usePulseOnChange } from '@/lib/usePulseOnChange';
import { soles, type Resumen } from '@/lib/clientes';

type Variant = 'dark' | 'brand' | 'muted';

export function KpiCards({ resumen }: { resumen: Resumen }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
      <Card
        label="Riesgo crítico / alto"
        value={resumen.clientes_criticos + resumen.clientes_altos}
        display={`${resumen.clientes_criticos} · ${resumen.clientes_altos}`}
        caption="clientes críticos · altos"
        icon={<AlertTriangle className="size-4" />}
        variant="dark"
      />
      <Card
        label="Renta en riesgo"
        value={resumen.renta_en_riesgo}
        display={soles(resumen.renta_en_riesgo, true)}
        caption={`${soles(resumen.renta_en_riesgo)} al mes`}
        icon={<Coins className="size-4" />}
        variant="brand"
      />
      <Card
        label="Consultas de portabilidad"
        value={resumen.consultas_portabilidad_30d}
        display={resumen.consultas_portabilidad_30d.toLocaleString('es-PE')}
        caption="últimos 30 días · contactar ≤ 24 h"
        icon={<PhoneForwarded className="size-4" />}
        variant="muted"
      />
      <Card
        label="Planes registrados hoy"
        value={resumen.acciones_hoy}
        display={resumen.acciones_hoy.toLocaleString('es-PE')}
        caption={`${resumen.acciones_pendientes_supervisor} pendientes de supervisor`}
        icon={<ClipboardCheck className="size-4" />}
        variant="muted"
      />
    </div>
  );
}

function Card(props: { label: string; value: number; display: string; caption: string; icon: React.ReactNode; variant: Variant }) {
  const pulse = usePulseOnChange(props.value);
  const filled = props.variant !== 'muted';
  const style =
    props.variant === 'dark'
      ? { background: 'var(--brand-ink-strong)' }
      : props.variant === 'brand'
        ? { background: 'var(--primary)' }
        : undefined;
  const subtle = filled ? 'text-white/70' : 'text-muted-foreground';
  return (
    <div
      className={`rounded-2xl p-4 sm:p-6 transition-shadow ${filled ? 'text-white' : 'bg-muted text-foreground'} ${pulse ? 'animate-pulse-ring' : ''}`}
      style={style}
    >
      <div className={`flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] ${subtle}`}>
        {props.icon}
        <span className="truncate">{props.label}</span>
      </div>
      <div className="display mt-3 text-2xl sm:text-4xl font-semibold tracking-tight">{props.display}</div>
      <div className={`mt-2 text-[11px] sm:text-xs truncate ${subtle}`}>{props.caption}</div>
    </div>
  );
}
