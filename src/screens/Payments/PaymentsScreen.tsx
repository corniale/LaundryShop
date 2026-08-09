/**
 * Bayad — summary figures, unpaid tab (oldest first) with one-tap payment,
 * full ledger, aging buckets, CSV export.
 *
 * Every figure on this screen is a control: tapping one filters the table
 * below to exactly the rows that add up to it, so a number can always be
 * traced back to the entries behind it. The active filter is stated in a
 * banner with a way out, so no one is left looking at a partial table
 * wondering where the rest went.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { IconCurrencyPeso } from '@tabler/icons-react'
import { db } from '../../data/db'
import type { PaymentMethod } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos, parsePesosInput } from '../../domain/money'
import { balanceCentavos, agingBucket, lastPaymentAt, type AgingBucket } from '../../domain/payments'
import { recordPayment } from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { Card, Button, Sheet, Field, Input, Chip, Stat } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { fmtDate, fmtDateTime, todayRange, monthRange, inRange, downloadCsv } from '../../app/format'
import { toCsv } from '../../domain/csv'

const METHODS: PaymentMethod[] = ['cash', 'gcash', 'maya', 'bank', 'other']
const BUCKETS: AgingBucket[] = ['0-7', '8-30', '31+']

/**
 * Row control. The circled icon is the app's grammar for "this does
 * something" (the Orders table advances a stage the same way); the column
 * header carries the verb once instead of repeating it down forty rows.
 * Amber is the payments colour throughout the app.
 */
function RecordButton({ onClick, labelled = false }: { onClick: (e: React.MouseEvent) => void; labelled?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={t('payments.record')}
      title={t('payments.record')}
      className={
        labelled
          ? 'inline-flex min-h-touch items-center gap-1.5 whitespace-nowrap rounded-input border px-3 text-xs font-semibold transition-colors duration-150'
          : 'inline-flex h-9 w-9 items-center justify-center rounded-pill border transition-colors duration-150'
      }
      style={{ borderColor: 'var(--sun-700)', color: 'var(--sun-700)' }}
    >
      <IconCurrencyPeso size={labelled ? 15 : 18} stroke={2} />
      {labelled ? t('payments.record') : null}
    </button>
  )
}

export function PaymentsScreen() {
  const navigate = useNavigate()
  const toast = useToast()
  const { currentUser } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab: 'unpaid' | 'all' = params.get('tab') === 'all' ? 'all' : 'unpaid'
  const range = params.get('range') === 'today' ? 'today' : params.get('range') === 'month' ? 'month' : null
  const bucket = BUCKETS.find((b) => b === params.get('bucket')) ?? null
  const largestFirst = params.get('sort') === 'balance'
  const setTab = (next: 'unpaid' | 'all') => setParams(next === 'all' ? { tab: 'all' } : {})
  const [payTarget, setPayTarget] = useState<{ orderId: string; code: string; balance: number } | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [payReference, setPayReference] = useState('')
  const [confirmOverpay, setConfirmOverpay] = useState(false)

  const orders = useLiveQuery(() => db.orders.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.payments.orderBy('receivedAt').reverse().toArray(), []) ?? []
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? []
  const users = useLiveQuery(() => db.users.toArray(), []) ?? []

  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers])
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users])
  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders])
  const paymentsByOrder = useMemo(() => {
    const map = new Map<string, typeof payments>()
    for (const p of payments) {
      const list = map.get(p.orderId) ?? []
      list.push(p)
      map.set(p.orderId, list)
    }
    return map
  }, [payments])

  const { from: todayFrom, to: todayTo } = todayRange()
  const { from: monthFrom, to: monthTo } = monthRange()
  const collectedToday = payments.filter((p) => inRange(p.receivedAt, todayFrom, todayTo)).reduce((s, p) => s + p.amountCentavos, 0)
  const collectedMonth = payments.filter((p) => inRange(p.receivedAt, monthFrom, monthTo)).reduce((s, p) => s + p.amountCentavos, 0)

  const unpaidOrders = useMemo(
    () =>
      orders
        .filter((o) => !o.voidedAt)
        .map((o) => {
          const list = paymentsByOrder.get(o.id) ?? []
          return {
            order: o,
            balance: balanceCentavos(o.totalCentavos, list),
            lastPaidAt: lastPaymentAt(list),
          }
        })
        .filter((x) => x.balance > 0)
        .sort((a, b) => a.order.receivedAt.localeCompare(b.order.receivedAt)),
    [orders, paymentsByOrder],
  )
  const outstanding = unpaidOrders.reduce((s, x) => s + x.balance, 0)

  const aging = useMemo(() => {
    const now = new Date()
    const buckets = { '0-7': 0, '8-30': 0, '31+': 0 }
    for (const { order, balance } of unpaidOrders) buckets[agingBucket(order.receivedAt, now)] += balance
    return buckets
  }, [unpaidOrders])

  // ── What the tiles drill into ───────────────────────────────────
  const ledgerRows = useMemo(() => {
    if (!range) return payments
    const { from, to } = range === 'today' ? todayRange() : monthRange()
    return payments.filter((p) => inRange(p.receivedAt, from, to))
  }, [payments, range])

  const unpaidRows = useMemo(() => {
    if (!bucket) return unpaidOrders
    const now = new Date()
    return unpaidOrders.filter((x) => agingBucket(x.order.receivedAt, now) === bucket)
  }, [unpaidOrders, bucket])

  const filtered = tab === 'all' ? range !== null : bucket !== null || largestFirst
  const scopeLabel = !filtered
    ? null
    : tab === 'all'
      ? t(range === 'today' ? 'payments.scope.today' : 'payments.scope.month')
      : bucket
        ? t('payments.scope.aging', { bucket: t(`payments.aging.${bucket}` as 'payments.aging.0-7') })
        : t('payments.scope.outstanding')
  const scopeCount =
    tab === 'all'
      ? t('payments.paymentCount', { n: ledgerRows.length })
      : t('customers.orderCount', { n: unpaidRows.length })
  const scopeTotal =
    tab === 'all'
      ? ledgerRows.reduce((s, p) => s + p.amountCentavos, 0)
      : unpaidRows.reduce((s, x) => s + x.balance, 0)

  function orderName(orderId: string): string {
    const o = ordersById.get(orderId)
    if (!o) return '—'
    return o.walkInName ?? (o.customerId ? customersById.get(o.customerId) ?? '—' : '—')
  }

  async function submitPayment() {
    if (!currentUser || !payTarget) return
    const amount = parsePesosInput(payAmount)
    if (!amount || amount <= 0) return
    if (amount > payTarget.balance && !confirmOverpay) {
      setConfirmOverpay(true)
      return
    }
    await recordPayment(payTarget.orderId, amount, payMethod, currentUser.id, payReference || undefined)
    toast({ message: t('payments.recorded', { amount: formatCentavos(amount) }) })
    setPayTarget(null)
    setPayAmount('')
    setPayReference('')
    setConfirmOverpay(false)
  }

  function exportLedger() {
    const rows = payments.map((p) => {
      const o = ordersById.get(p.orderId)
      return [
        p.receivedAt,
        o?.code ?? '',
        orderName(p.orderId),
        (p.amountCentavos / 100).toFixed(2),
        p.method,
        p.reference ?? '',
        usersById.get(p.byUserId) ?? '',
        p.reversalOfPaymentId ? 'reversal' : p.reversedByPaymentId ? 'reversed' : '',
      ]
    })
    downloadCsv('payments.csv', toCsv(['Date', 'Order', 'Customer', 'Amount', 'Method', 'Reference', 'By', 'Flag'], rows))
  }

  const unpaidColumns: Array<Column<(typeof unpaidOrders)[number]>> = [
    {
      key: 'code',
      header: t('stub.orderCode'),
      sortValue: (r) => r.order.code,
      defaultDesc: false,
      render: (r) => <span className="whitespace-nowrap font-mono font-medium">{r.order.code}</span>,
    },
    {
      key: 'customer',
      header: t('orders.customer'),
      sortValue: (r) => orderName(r.order.id).toLowerCase(),
      defaultDesc: false,
      render: (r) => orderName(r.order.id),
    },
    {
      key: 'received',
      header: t('payments.orderDate'),
      sortValue: (r) => r.order.receivedAt,
      defaultDesc: false,
      render: (r) => <span className="whitespace-nowrap text-xs text-ink-muted">{fmtDate(r.order.receivedAt)}</span>,
    },
    {
      key: 'total',
      header: t('orders.total'),
      align: 'right',
      sortValue: (r) => r.order.totalCentavos,
      render: (r) => <span className="font-mono">{formatCentavos(r.order.totalCentavos)}</span>,
    },
    {
      // Partial payments date here, so the day's collections can be matched
      // against the till without opening each order.
      key: 'lastPaid',
      header: t('payments.paymentDate'),
      sortValue: (r) => (r.lastPaidAt ? new Date(r.lastPaidAt).getTime() : 0),
      render: (r) =>
        r.lastPaidAt ? (
          <span className="whitespace-nowrap text-xs">{fmtDateTime(r.lastPaidAt)}</span>
        ) : (
          <span className="text-xs text-ink-muted">{t('payments.noPaymentYet')}</span>
        ),
    },
    {
      key: 'balance',
      header: t('orders.balance'),
      align: 'right',
      sortValue: (r) => r.balance,
      render: (r) => <span className="font-mono font-medium text-danger-700">{formatCentavos(r.balance)}</span>,
    },
    {
      key: 'action',
      header: t('payments.recordShort'),
      align: 'right',
      render: (r) => (
        <RecordButton
          onClick={(e) => {
            e.stopPropagation()
            setPayTarget({ orderId: r.order.id, code: r.order.code, balance: r.balance })
            setPayAmount((r.balance / 100).toFixed(2))
          }}
        />
      ),
    },
  ]

  const ledgerColumns: Array<Column<(typeof payments)[number]>> = [
    {
      key: 'date',
      header: t('payments.date'),
      sortValue: (p) => p.receivedAt,
      render: (p) => <span className="whitespace-nowrap text-xs text-ink-muted">{fmtDateTime(p.receivedAt)}</span>,
    },
    {
      key: 'code',
      header: t('stub.orderCode'),
      sortValue: (p) => ordersById.get(p.orderId)?.code ?? '',
      defaultDesc: false,
      render: (p) => <span className="whitespace-nowrap font-mono font-medium">{ordersById.get(p.orderId)?.code}</span>,
    },
    {
      key: 'customer',
      header: t('orders.customer'),
      sortValue: (p) => orderName(p.orderId).toLowerCase(),
      defaultDesc: false,
      render: (p) => orderName(p.orderId),
    },
    {
      key: 'amount',
      header: t('payments.amount'),
      align: 'right',
      sortValue: (p) => p.amountCentavos,
      render: (p) => (
        <span className={`font-mono font-medium ${p.amountCentavos < 0 ? 'text-danger-700' : ''}`}>
          {formatCentavos(p.amountCentavos)}
        </span>
      ),
    },
    {
      key: 'method',
      header: t('payments.method'),
      sortValue: (p) => p.method,
      defaultDesc: false,
      render: (p) => (
        <span className="text-xs text-ink-muted">
          {t(`payments.method.${p.method}` as 'payments.method.cash')}
          {p.reference ? ` · ${p.reference}` : ''}
        </span>
      ),
    },
    {
      key: 'by',
      header: t('payments.recordedBy'),
      sortValue: (p) => usersById.get(p.byUserId) ?? '',
      defaultDesc: false,
      render: (p) => <span className="text-xs text-ink-muted">{usersById.get(p.byUserId)}</span>,
    },
    {
      key: 'flag',
      header: t('payments.note'),
      render: (p) =>
        p.reversalOfPaymentId || p.reversedByPaymentId ? (
          <span className="text-xs font-semibold text-danger-700">{t('payments.reversedBadge')}</span>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold">{t('payments.title')}</h1>
        <Button variant="ghost" className="!py-2 text-sm" onClick={exportLedger}>
          {t('reports.exportCsv')}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          label={t('payments.collectedMonth')}
          value={formatCentavos(collectedMonth)}
          onClick={() => setParams({ tab: 'all', range: 'month' })}
        />
        <Stat
          label={t('payments.collectedToday')}
          value={formatCentavos(collectedToday)}
          tone="accent"
          onClick={() => setParams({ tab: 'all', range: 'today' })}
        />
        <Stat
          label={t('payments.outstanding')}
          value={formatCentavos(outstanding)}
          tone={outstanding > 0 ? 'danger' : undefined}
          onClick={() => setParams({ tab: 'unpaid', sort: 'balance' })}
        />
        <Stat
          label={t('payments.unpaidCount')}
          value={String(unpaidOrders.length)}
          onClick={() => setParams({ tab: 'unpaid' })}
        />
      </div>

      {/* Aging — each bucket drills into the orders that make it up */}
      {outstanding > 0 && (
        <Card>
          <div className="mb-1 text-xs font-medium text-ink-muted">{t('payments.aging')}</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {BUCKETS.map((b) => (
              <button
                key={b}
                // An empty bucket has nothing to drill into, so it stops being a control.
                disabled={aging[b] === 0}
                onClick={() => setParams({ tab: 'unpaid', bucket: b })}
                className={`rounded-input py-1 transition-colors duration-150 enabled:hover:bg-wash-deep disabled:cursor-default ${
                  bucket === b ? 'bg-wash-deep' : ''
                }`}
              >
                <div className={`font-mono text-base font-medium ${b === '31+' && aging[b] > 0 ? 'text-danger-700' : ''}`}>
                  {formatCentavos(aging[b])}
                </div>
                <div className="text-xs text-ink-muted">{t(`payments.aging.${b}` as 'payments.aging.0-7')}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Chip selected={tab === 'unpaid'} onClick={() => setTab('unpaid')}>
          {t('payments.tabUnpaid')} ({unpaidOrders.length})
        </Chip>
        <Chip selected={tab === 'all'} onClick={() => setTab('all')}>
          {t('payments.tabAll')}
        </Chip>
      </div>

      {/* Which figure the table is currently explaining, and the way back */}
      {scopeLabel && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-wash-deep px-3 py-2">
          <div className="min-w-0 text-sm">
            <span className="label-caps">{t('payments.showing')}</span>{' '}
            <span className="font-medium">{scopeLabel}</span>
            <span className="text-ink-muted">
              {' · '}
              {scopeCount} · <span className="font-mono">{formatCentavos(scopeTotal)}</span>
            </span>
          </div>
          <Button variant="ghost" className="!py-1.5 text-sm" onClick={() => setTab(tab)}>
            {t('payments.clearFilter')}
          </Button>
        </div>
      )}

      {tab === 'unpaid' ? (
        <DataTable
          key={largestFirst ? 'unpaid-balance' : 'unpaid-received'}
          rows={unpaidRows}
          getRowKey={(r) => r.order.id}
          onRowClick={(r) => navigate(`/orders/${r.order.id}`)}
          initialSortKey={largestFirst ? 'balance' : 'received'}
          initialSortDesc={largestFirst}
          emptyText={bucket ? t('payments.emptyBucket') : t('payments.allPaid')}
          columns={unpaidColumns}
          renderCard={(r) => (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm font-medium">{r.order.code}</span>
                <span className="font-mono text-sm font-medium text-danger-700">
                  {formatCentavos(r.balance)}
                </span>
              </div>
              <div className="truncate text-sm">{orderName(r.order.id)}</div>
              <div className="mt-0.5 text-xs text-ink-muted">
                {fmtDate(r.order.receivedAt)} · {t('orders.total')} {formatCentavos(r.order.totalCentavos)}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs text-ink-muted">
                  {r.lastPaidAt ? `${t('payments.paymentDate')}: ${fmtDateTime(r.lastPaidAt)}` : ''}
                </span>
                {/* No column header on phones to carry the verb, so the label stays */}
                <RecordButton
                  labelled
                  onClick={(e) => {
                    e.stopPropagation()
                    setPayTarget({ orderId: r.order.id, code: r.order.code, balance: r.balance })
                    setPayAmount((r.balance / 100).toFixed(2))
                  }}
                />
              </div>
            </>
          )}
        />
      ) : (
        <DataTable
          rows={ledgerRows}
          getRowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/orders/${p.orderId}`)}
          initialSortKey="date"
          emptyText={
            range === 'today' ? t('payments.emptyToday') : range === 'month' ? t('payments.emptyMonth') : t('payments.empty')
          }
          columns={ledgerColumns}
          renderCard={(p) => (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm font-medium">{ordersById.get(p.orderId)?.code}</span>
                <span className={`font-mono text-sm font-medium ${p.amountCentavos < 0 ? 'text-danger-700' : ''}`}>
                  {formatCentavos(p.amountCentavos)}
                </span>
              </div>
              <div className="truncate text-sm">{orderName(p.orderId)}</div>
              <div className="mt-0.5 text-xs text-ink-muted">
                {fmtDateTime(p.receivedAt)} · {t(`payments.method.${p.method}` as 'payments.method.cash')} ·{' '}
                {usersById.get(p.byUserId)}
              </div>
            </>
          )}
        />
      )}

      <Sheet open={payTarget !== null} onClose={() => setPayTarget(null)} title={`${t('payments.record')} — ${payTarget?.code ?? ''}`}>
        <div className="flex flex-col gap-3">
          <Field label={t('payments.amount')}>
            <Input
              inputMode="decimal"
              className="font-mono !text-xl"
              value={payAmount}
              onChange={(e) => {
                setPayAmount(e.target.value)
                setConfirmOverpay(false)
              }}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <Chip key={m} selected={payMethod === m} onClick={() => setPayMethod(m)}>
                {t(`payments.method.${m}` as 'payments.method.cash')}
              </Chip>
            ))}
          </div>
          {(payMethod === 'gcash' || payMethod === 'maya') && (
            <Input placeholder={t('payments.reference')} value={payReference} onChange={(e) => setPayReference(e.target.value)} />
          )}
          {confirmOverpay && payTarget && (
            <p className="rounded-input bg-sun-500/15 p-3 text-sm text-sun-700">
              {t('payments.overpay', { balance: formatCentavos(payTarget.balance) })}
            </p>
          )}
          <Button onClick={() => void submitPayment()}>{t('payments.record')}</Button>
        </div>
      </Sheet>
    </div>
  )
}
