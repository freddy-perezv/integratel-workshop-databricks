/**
 * Badges reutilizados en la Cola de retención y el feed de actividad.
 * Reusan los tokens de color --pos-* del tema (rojo/ámbar/azul/verde).
 */
const RIESGO: Record<string, string> = {
  Crítico: 'bg-[var(--pos-stockout-subtle)] text-[var(--pos-stockout-subtle-foreground)]',
  Alto: 'bg-[var(--pos-at-risk-subtle)] text-[var(--pos-at-risk-subtle-foreground)]',
  Medio: 'bg-[var(--pos-overstock-subtle)] text-[var(--pos-overstock-subtle-foreground)]',
  Bajo: 'bg-[var(--pos-healthy-subtle)] text-[var(--pos-healthy-subtle-foreground)]',
};

const ESTADO: Record<string, string> = {
  Aprobada: 'bg-[var(--pos-healthy-subtle)] text-[var(--pos-healthy-subtle-foreground)]',
  'Pendiente aprobación supervisor': 'bg-[var(--pos-at-risk-subtle)] text-[var(--pos-at-risk-subtle-foreground)]',
  Rechazada: 'bg-[var(--pos-stockout-subtle)] text-[var(--pos-stockout-subtle-foreground)]',
};

const pill = 'inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap';

export function RiesgoBadge({ nivel }: { nivel: string | null }) {
  return <span className={`${pill} ${RIESGO[nivel ?? ''] ?? 'bg-muted text-muted-foreground'}`}>{nivel ?? '—'}</span>;
}

export function EstadoBadge({ estado }: { estado: string }) {
  return <span className={`${pill} ${ESTADO[estado] ?? 'bg-muted text-muted-foreground'}`}>{estado}</span>;
}
