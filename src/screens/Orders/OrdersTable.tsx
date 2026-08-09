/**
 * Orders table — sortable, dense, and still legible about progress.
 *
 * Icon grammar shared with the board and the rail: a circled icon is a
 * control, a bare icon is state. So the Stage cell shows a plain icon
 * and the Next cell a circled one in the destination stage's colour.
 * Phones get the same data and the same one-click advance as stacked
 * rows, since a nine-column table cannot be used at 360px.
 */
import type { Order, OrderStatus, Payment } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos } from '../../domain/money'
import { paymentStatus } from '../../domain/payments'
import { statusIndex, nextStatus } from '../../domain/status'
import { statusLabel } from '../../components/WashLine'
import { StageIcon } from '../../components/StatusRail'
import { IconCheck } from '@tabler/icons-react'
import { fmtDate } from '../../app/format'
import { payToneClass } from './OrdersScreen'

const STATUS_VAR: Record<OrderStatus, string> = {
  received: 'var(--status-received)',
  washing: 'var(--status-washing)',
  drying: 'var(--status-drying)',
  ready: 'var(--status-ready)',
  claimed: 'var(--status-claimed)',
}

export type OrderSortKey = 'code' | 'customer' | 'service' | 'kilos' | 'total' | 'payment' | 'promised' | 'stage'

export interface OrderRow {
  order: Order
  customerName: string
  payments: Payment[]
}

export function sortOrderRows(rows: OrderRow[], key: OrderSortKey, desc: boolean): OrderRow[] {
  const value = (r: OrderRow): string | number => {
    switch (key) {
      case 'customer':
        return r.customerName.toLowerCase()
      case 'service':
        return r.order.serviceNameSnapshot.toLowerCase()
      case 'kilos':
        return r.order.kilos
      case 'total':
        return r.order.totalCentavos
      case 'payment': {
        const s = paymentStatus(r.order.totalCentavos, r.payments)
        return s === 'unpaid' ? 0 : s === 'partial' ? 1 : 2
      }
      case 'promised':
        return r.order.promisedAt
      case 'stage':
        return statusIndex(r.order.status)
      default:
        return r.order.code
    }
  }
  const dir = desc ? -1 : 1
  return [...rows].sort((a, b) => {
    // Voided orders stay visible for the record but never lead a sort.
    const voidA = a.order.voidedAt ? 1 : 0
    const voidB = b.order.voidedAt ? 1 : 0
    if (voidA !== voidB) return voidA - voidB
    const va = value(a)
    const vb = value(b)
    if (va !== vb) return (va < vb ? -1 : 1) * dir
    // Tie-break on the promised date so equal keys (especially stage)
    // still surface the most urgent load first.
    return a.order.promisedAt.localeCompare(b.order.promisedAt)
  })
}

/**
 * The app's one advance control, shared with the board: a circled icon
 * in the destination stage's colour. Circles are controls; bare icons
 * are state — which is why the Stage cell renders its icon uncircled.
 */
function NextButton({ status, onAdvance }: { status: OrderStatus; onAdvance: (to: OrderStatus) => void }) {
  const next = nextStatus(status)
  if (!next) {
    return (
      <IconCheck
        size={15}
        stroke={2.25}
        className="inline-block"
        style={{ color: 'var(--status-claimed)' }}
        aria-label={statusLabel(status)}
      />
    )
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onAdvance(next)
      }}
      aria-label={t('rail.advanceTo', { status: statusLabel(next) })}
      title={t('rail.advanceTo', { status: statusLabel(next) })}
      className="inline-flex h-9 w-9 items-center justify-center rounded-pill border transition-colors duration-150"
      style={{ borderColor: STATUS_VAR[next], color: STATUS_VAR[next] }}
    >
      <StageIcon status={next} size={18} />
    </button>
  )
}

export function OrdersTable({
  rows,
  sortKey,
  sortDesc,
  onSort,
  onOpen,
  onAdvance,
}: {
  rows: OrderRow[]
  sortKey: OrderSortKey
  sortDesc: boolean
  onSort: (key: OrderSortKey, defaultDesc?: boolean) => void
  onOpen: (id: string) => void
  onAdvance: (order: Order, to: OrderStatus) => void
}) {
  const arrow = (key: OrderSortKey) => (sortKey === key ? (sortDesc ? ' ↓' : ' ↑') : '')

  const th = (key: OrderSortKey, label: string, right = false, defaultDesc = true) => (
    <th className={right ? 'text-right' : 'text-left'}>
      <button
        onClick={() => onSort(key, defaultDesc)}
        className={`min-h-touch w-full px-3 text-[0.6875rem] font-semibold uppercase tracking-wider ${
          right ? 'text-right' : 'text-left'
        } ${sortKey === key ? 'text-primary-600' : 'text-ink-muted'}`}
      >
        {label}
        {arrow(key)}
      </button>
    </th>
  )

  const now = new Date()

  return (
    <>
      {/* Tablet / desktop: the full sortable table */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-wash-deep">
              {th('code', t('stub.orderCode'), false, false)}
              {th('customer', t('orders.customer'), false, false)}
              {th('service', t('orders.service'), false, false)}
              {th('kilos', t('orders.kilos'), true)}
              {th('total', t('orders.total'), true)}
              {th('payment', t('orders.paymentStatus'), false, false)}
              {th('promised', t('orders.readyBy'), false, false)}
              {th('stage', t('orders.stage'), false, false)}
              <th className="px-3 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                {t('orders.nextStage')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ order, customerName, payments }) => {
              const pStatus = paymentStatus(order.totalCentavos, payments)
              const overdue = order.status !== 'claimed' && new Date(order.promisedAt) < now
              return (
                <tr
                  key={order.id}
                  onClick={() => onOpen(order.id)}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-wash ${order.voidedAt ? 'opacity-50' : ''}`}
                >
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono font-medium">{order.code}</td>
                  <td className="max-w-[12rem] truncate px-3 py-2.5">{customerName}</td>
                  <td className="max-w-[11rem] truncate px-3 py-2.5 text-ink-muted">{order.serviceNameSnapshot}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{order.kilos}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium">{formatCentavos(order.totalCentavos)}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-xs font-semibold ${
                        pStatus === 'paid' ? 'text-ink-muted' : payToneClass(pStatus)
                      }`}
                    >
                      {t(`pay.${pStatus}` as 'pay.unpaid')}
                    </span>
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-xs ${overdue ? 'font-semibold text-danger-700' : 'text-ink-muted'}`}>
                    {fmtDate(order.promisedAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    {order.voidedAt ? (
                      <span className="text-xs font-bold text-danger-700">{t('orders.voidedBadge')}</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span style={{ color: STATUS_VAR[order.status] }}>
                          <StageIcon status={order.status} size={17} />
                        </span>
                        <span className="whitespace-nowrap text-xs text-ink-muted">
                          {statusLabel(order.status)}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!order.voidedAt && (
                      <NextButton status={order.status} onAdvance={(to) => onAdvance(order, to)} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Phone: same columns, stacked into dense rows */}
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map(({ order, customerName, payments }) => {
          const pStatus = paymentStatus(order.totalCentavos, payments)
          const overdue = order.status !== 'claimed' && new Date(order.promisedAt) < now
          return (
            <div
              key={order.id}
              onClick={() => onOpen(order.id)}
              className={`rounded-card border border-line bg-surface px-3 py-2.5 ${order.voidedAt ? 'opacity-50' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm font-medium">{order.code}</span>
                <span className="font-mono text-sm font-medium">{formatCentavos(order.totalCentavos)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate">{customerName}</span>
                <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold ${payToneClass(pStatus)}`}>
                  {t(`pay.${pStatus}` as 'pay.unpaid')}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                {order.voidedAt ? (
                  <span className="text-xs font-bold text-danger-700">{t('orders.voidedBadge')}</span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span style={{ color: STATUS_VAR[order.status] }}>
                      <StageIcon status={order.status} size={17} />
                    </span>
                    <span className="text-xs text-ink-muted">{statusLabel(order.status)}</span>
                  </span>
                )}
                {!order.voidedAt && <NextButton status={order.status} onAdvance={(to) => onAdvance(order, to)} />}
              </div>
              <div className="mt-1 truncate text-xs text-ink-muted">{order.serviceNameSnapshot}</div>
              <div className={`text-xs ${overdue ? 'font-semibold text-danger-700' : 'text-ink-muted'}`}>
                {order.kilos} {t('orders.kg')} · {t('orders.readyBy')}: {fmtDate(order.promisedAt)}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
