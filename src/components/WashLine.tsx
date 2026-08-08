/**
 * The Wash Line — five-segment rail showing where a load is.
 * Filled segments use the status colors (cold water → sun → fresh);
 * the NEXT segment is a tap target that advances the order.
 */
import { STATUS_ORDER, statusIndex, nextStatus } from '../domain/status'
import type { OrderStatus } from '../data/types'
import { t } from '../i18n/strings'

const SEG_VAR: Record<OrderStatus, string> = {
  received: 'var(--status-received)',
  washing: 'var(--status-washing)',
  drying: 'var(--status-drying)',
  ready: 'var(--status-ready)',
  claimed: 'var(--status-claimed)',
}

export function statusLabel(s: OrderStatus): string {
  return t(`status.${s}` as 'status.received')
}

export function WashLine({
  status,
  onAdvance,
  compact = false,
}: {
  status: OrderStatus
  /** When provided, tapping the next segment advances the order. */
  onAdvance?: (to: OrderStatus) => void
  compact?: boolean
}) {
  const current = statusIndex(status)
  const next = nextStatus(status)

  return (
    <div>
      <div className="flex gap-1" role="img" aria-label={statusLabel(status)}>
        {STATUS_ORDER.map((s, i) => {
          const filled = i <= current
          const isNext = next !== null && i === current + 1
          const seg = (
            <div
              key={s}
              className={`washline-seg h-2.5 flex-1 rounded-pill ${!filled && !isNext ? 'bg-line' : ''}`}
              style={filled ? { backgroundColor: SEG_VAR[s] } : isNext ? { backgroundColor: 'var(--wash-deep)', border: '1.5px dashed var(--primary-500)' } : undefined}
            />
          )
          return seg
        })}
      </div>
      {!compact && (
        <div className="mt-1 flex gap-1">
          {STATUS_ORDER.map((s, i) => {
            const isNext = next !== null && i === current + 1
            if (isNext && onAdvance) {
              return (
                <button
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation()
                    onAdvance(s)
                  }}
                  className="min-h-touch flex-1 rounded-input text-center text-xs font-semibold text-primary-600"
                >
                  {statusLabel(s)} →
                </button>
              )
            }
            return (
              <div
                key={s}
                className={`flex-1 py-3.5 text-center text-xs ${i <= current ? 'font-medium text-ink' : 'text-ink-muted'}`}
              >
                {statusLabel(s)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Shop rail — today's whole load across the five stages, one glance.
 * Each stage is one flex column holding its bar AND its label, so the
 * text always tracks the graphic; columns grow with their order count
 * but never shrink below a readable label.
 */
export function ShopRail({
  counts,
  onSelect,
}: {
  counts: Record<OrderStatus, number>
  onSelect?: (status: OrderStatus) => void
}) {
  const total = STATUS_ORDER.reduce((sum, s) => sum + counts[s], 0)
  return (
    <div className="flex gap-1.5">
      {STATUS_ORDER.map((s) => {
        const n = counts[s]
        return (
          <button
            key={s}
            onClick={() => onSelect?.(s)}
            aria-label={`${statusLabel(s)}: ${n}`}
            className="washline-seg flex min-w-14 flex-col items-center gap-1"
            style={{ flexGrow: total === 0 ? 1 : Math.max(n, 0.5), flexBasis: 0 }}
          >
            <span
              className="flex h-9 w-full items-center justify-center rounded-input border font-mono text-sm font-semibold text-ink"
              style={{
                backgroundColor:
                  n > 0 ? `color-mix(in srgb, ${SEG_VAR[s]} 14%, transparent)` : 'transparent',
                borderColor:
                  n > 0 ? `color-mix(in srgb, ${SEG_VAR[s]} 45%, transparent)` : 'var(--line)',
                color: n > 0 ? undefined : 'var(--ink-muted)',
              }}
            >
              {n}
            </span>
            <span className="w-full truncate text-center text-xs text-ink-muted">{statusLabel(s)}</span>
          </button>
        )
      })}
    </div>
  )
}
