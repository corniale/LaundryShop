/**
 * Bayad — summary figures, unpaid tab (oldest first) with one-tap payment,
 * full ledger, aging buckets, CSV export.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { PaymentMethod } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos, parsePesosInput } from '../../domain/money'
import { balanceCentavos, paymentStatus, agingBucket } from '../../domain/payments'
import { recordPayment } from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { Card, Button, Sheet, Field, Input, Chip, Stat } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { fmtDate, fmtDateTime, todayRange, monthRange, inRange, downloadCsv } from '../../app/format'
import { toCsv } from '../../domain/csv'

const METHODS: PaymentMethod[] = ['cash', 'gcash', 'maya', 'bank', 'other']

export function PaymentsScreen() {
  const navigate = useNavigate()
  const toast = useToast()
  const { currentUser } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab: 'unpaid' | 'all' = params.get('tab') === 'all' ? 'all' : 'unpaid'
  const setTab = (next: 'unpaid' | 'all') => setParams(next === 'all' ? { tab: 'all' } : {})
  const [payTarget, setPayTarget] = useState<{ orderId: string; code: string; balance: number } | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [payReference, setPayReference] = useState('')
  const [confirmOverpay, setConfirmOverpay] = useState(false)
  const [limit, setLimit] = useState(50)

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
        .map((o) => ({ order: o, balance: balanceCentavos(o.totalCentavos, paymentsByOrder.get(o.id) ?? []) }))
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
      key: 'balance',
      header: t('orders.balance'),
      align: 'right',
      sortValue: (r) => r.balance,
      render: (r) => <span className="font-mono font-medium text-danger-700">{formatCentavos(r.balance)}</span>,
    },
    {
      key: 'action',
      header: t('payments.record'),
      align: 'right',
      render: (r) => (
        <Button
          className="!py-1.5 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            setPayTarget({ orderId: r.order.id, code: r.order.code, balance: r.balance })
            setPayAmount((r.balance / 100).toFixed(2))
          }}
        >
          {t('payments.record')}
        </Button>
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
        <Stat label={t('payments.collectedToday')} value={formatCentavos(collectedToday)} tone="accent" />
        <Stat label={t('payments.collectedMonth')} value={formatCentavos(collectedMonth)} />
        <Stat label={t('payments.outstanding')} value={formatCentavos(outstanding)} tone={outstanding > 0 ? 'danger' : undefined} />
        <Stat label={t('payments.unpaidCount')} value={String(unpaidOrders.length)} />
      </div>

      {/* Aging */}
      {outstanding > 0 && (
        <Card>
          <div className="mb-1 text-xs font-medium text-ink-muted">{t('payments.aging')}</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(['0-7', '8-30', '31+'] as const).map((b) => (
              <div key={b}>
                <div className={`font-mono text-base font-medium ${b === '31+' && aging[b] > 0 ? 'text-danger-700' : ''}`}>
                  {formatCentavos(aging[b])}
                </div>
                <div className="text-xs text-ink-muted">{t(`payments.aging.${b}` as 'payments.aging.0-7')}</div>
              </div>
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

      {tab === 'unpaid' ? (
        <DataTable
          rows={unpaidOrders}
          getRowKey={(r) => r.order.id}
          onRowClick={(r) => navigate(`/orders/${r.order.id}`)}
          initialSortKey="received"
          initialSortDesc={false}
          emptyText={t('payments.allPaid')}
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
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-xs text-ink-muted">
                  {fmtDate(r.order.receivedAt)} · {t('orders.total')} {formatCentavos(r.order.totalCentavos)}
                </span>
                <Button
                  className="!py-1.5 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPayTarget({ orderId: r.order.id, code: r.order.code, balance: r.balance })
                    setPayAmount((r.balance / 100).toFixed(2))
                  }}
                >
                  {t('payments.record')}
                </Button>
              </div>
            </>
          )}
        />
      ) : (
        <DataTable
          rows={payments}
          getRowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/orders/${p.orderId}`)}
          initialSortKey="date"
          emptyText={t('payments.empty')}
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
