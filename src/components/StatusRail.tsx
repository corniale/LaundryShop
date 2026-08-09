/**
 * Status rail — the most-touched control in the app.
 *
 * One tap advances an order to the next stage: no menu, no dialog, an
 * optimistic write and a short haptic. Skips and backward moves confirm
 * first and always write complete history. Claimed is locked until the
 * user deliberately unlocks it, because un-claiming an order in front of
 * a customer is the worst failure this screen can produce.
 *
 * Icons are the primary signal; labels stay visible at every width.
 * Only the current node animates, and never while the tab is hidden.
 */
import { useEffect, useState } from 'react'
import {
  IconBasket,
  IconWashMachine,
  IconWind,
  IconHanger,
  IconShoppingBag,
} from '@tabler/icons-react'
import type { OrderStatus } from '../data/types'
import { STATUS_ORDER, statusIndex } from '../domain/status'
import { t } from '../i18n/strings'
import { statusLabel } from './WashLine'
import { Sheet, Button } from './ui'

const ICONS: Record<OrderStatus, typeof IconBasket> = {
  received: IconBasket,
  washing: IconWashMachine,
  drying: IconWind,
  ready: IconHanger,
  claimed: IconShoppingBag,
}

/** Only washing and drying move; the rest are static by design. */
const MOTION: Partial<Record<OrderStatus, string>> = {
  washing: 'rail-spin',
  drying: 'rail-sway',
}

/** Pause animation while the app is backgrounded. */
function useVisible(): boolean {
  const [visible, setVisible] = useState(
    typeof document === 'undefined' || document.visibilityState !== 'hidden',
  )
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}

export function StatusRail({
  status,
  onChange,
  locked = false,
}: {
  status: OrderStatus
  /** Resolves false if the write failed, so the rail can roll back. */
  onChange: (to: OrderStatus) => Promise<boolean>
  locked?: boolean
}) {
  const visible = useVisible()
  // Optimistic stage: render the move immediately, roll back on failure.
  const [optimistic, setOptimistic] = useState<OrderStatus | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pending, setPending] = useState<{ to: OrderStatus; kind: 'skip' | 'back' } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setOptimistic(null)
  }, [status])

  const shown = optimistic ?? status
  const current = statusIndex(shown)
  const claimedLock = shown === 'claimed' && !unlocked
  const readOnly = locked || claimedLock

  async function commit(to: OrderStatus) {
    setError(null)
    setOptimistic(to)
    try {
      if (navigator.vibrate) navigator.vibrate(15)
    } catch {
      // haptics are a nicety, never a failure path
    }
    const ok = await onChange(to)
    if (!ok) {
      setOptimistic(null)
      setError(t('rail.saveFailed'))
    }
  }

  function handleTap(to: OrderStatus) {
    if (readOnly) return
    const toIndex = statusIndex(to)
    if (toIndex === current) return // no-op: wet counters produce double taps
    if (toIndex === current + 1) return void commit(to)
    setPending({ to, kind: toIndex > current ? 'skip' : 'back' })
  }

  const skipped = pending
    ? STATUS_ORDER.slice(current + 1, statusIndex(pending.to)).map(statusLabel).join(', ')
    : ''

  return (
    <div>
      <div role="group" aria-label={t('rail.group')} className="relative flex items-start">
        {/* One connector track behind the nodes: the fill grows across it,
            so the line stays visible even on a 360px screen. */}
        <div
          aria-hidden
          className="absolute top-[22px] h-0.5"
          style={{ left: '10%', right: '10%', backgroundColor: 'var(--line)' }}
        />
        <div
          aria-hidden
          className="absolute top-[22px] h-0.5 transition-[width] duration-[250ms] ease-out"
          style={{
            left: '10%',
            width: `${(current / (STATUS_ORDER.length - 1)) * 80}%`,
            backgroundColor: 'var(--rail-accent)',
          }}
        />
        {STATUS_ORDER.map((s, i) => {
          const Icon = ICONS[s]
          const done = i < current
          const now = i === current
          const animation = now && visible ? MOTION[s] : undefined

          const label =
            i === current
              ? t('rail.currently', { status: statusLabel(s) })
              : i > current
                ? t('rail.advanceTo', { status: statusLabel(s) })
                : t('rail.moveBackTo', { status: statusLabel(s) })

          return (
            <div key={s} className="relative flex flex-1 justify-center">
              <div className="flex w-full flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTap(s)}
                  disabled={readOnly}
                  aria-label={label}
                  aria-current={now ? 'step' : undefined}
                  className={`flex h-[46px] w-[46px] items-center justify-center rounded-pill transition-transform duration-[180ms] ${
                    readOnly ? 'cursor-default' : ''
                  }`}
                  style={{
                    transform: now ? 'scale(1.12)' : 'scale(1)',
                    // Unfilled, but opaque: a see-through node would let
                    // the connector line cross the icon behind it.
                    backgroundColor: done
                      ? 'var(--rail-accent)'
                      : now
                        ? 'var(--surface)'
                        : 'var(--wash-deep)',
                    border: now
                      ? '2px solid var(--rail-accent)'
                      : done
                        ? '2px solid var(--rail-accent)'
                        : '1.5px solid var(--line)',
                    color: done
                      ? 'var(--rail-on-accent)'
                      : now
                        ? 'var(--rail-accent)'
                        : 'var(--ink-muted)',
                  }}
                >
                  <Icon
                    size={22}
                    stroke={1.75}
                    className={animation ? `rail-anim-${animation}` : undefined}
                    style={animation ? { animationPlayState: visible ? 'running' : 'paused' } : undefined}
                  />
                </button>
                <span
                  className={`text-center text-[0.6875rem] leading-tight ${
                    now ? 'font-medium' : ''
                  }`}
                  style={{ color: now ? 'var(--rail-accent)' : done ? 'var(--ink-muted)' : 'var(--ink-muted)' }}
                >
                  {statusLabel(s)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {claimedLock && !locked && (
        <button
          type="button"
          onClick={() => setUnlocked(true)}
          className="mt-3 min-h-touch text-sm font-semibold text-primary-600"
        >
          {t('rail.unlock')}
        </button>
      )}

      {error && <p className="mt-2 text-sm text-danger-700">{error}</p>}

      <Sheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title={
          pending?.kind === 'skip'
            ? t('rail.skipTitle', { status: statusLabel(pending.to) })
            : pending
              ? t('rail.backTitle', { status: statusLabel(pending.to) })
              : ''
        }
      >
        {pending && (
          <div className="flex flex-col gap-4">
            <p className="text-ink-muted">
              {pending.kind === 'skip'
                ? t('rail.skipBody', { skipped })
                : t('rail.backBody', { current: statusLabel(shown) })}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-none" onClick={() => setPending(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  const to = pending.to
                  setPending(null)
                  void commit(to)
                }}
              >
                {pending.kind === 'skip' ? t('rail.skipConfirm') : t('rail.backConfirm')}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

/** The stage's icon on its own, for compact controls. */
export function StageIcon({ status, size = 20 }: { status: OrderStatus; size?: number }) {
  const Icon = ICONS[status]
  return <Icon size={size} stroke={1.75} aria-hidden />
}

/**
 * Compact variant for list rows: the current stage icon only. Never
 * advances — tapping the row opens the order, where the staffer can see
 * which customer they are touching. Static: twenty spinning drums in a
 * scroll view is battery drain and noise.
 */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const Icon = ICONS[status]
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill"
      style={{ border: '1.5px solid var(--rail-accent)', color: 'var(--rail-accent)' }}
      title={statusLabel(status)}
    >
      <Icon size={20} stroke={1.75} aria-hidden />
      <span className="sr-only">{statusLabel(status)}</span>
    </span>
  )
}
