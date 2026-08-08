/**
 * Bayad — summary figures, unpaid tab (oldest first) with one-tap payment,
 * full ledger, aging buckets, CSV export.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { PaymentMethod } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos, parsePesosInput } from '../../domain/money'
import { balanceCentavos, paymentStatus, agingBucket } from '../../domain/payments'
import { recordPayment } from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { Card, Button, Sheet, Field, Input, Chip, Stat, EmptyState } from '../../components/ui'
import { fmtDate, fmtDateTime, todayRange, monthRange, inRange, downloadCsv } from '../../app/format'
import { toCsv } from '../../domain/csv'

const METHODS: PaymentMethod[] = ['cash', 'gcash', 'maya', 'bank', 'other']

export function PaymentsScreen() {
  const navigate = useNavigate()
  const toast = useToast()
  const { currentUser } = useAuth()
  const [tab, setTab] = useState<'unpaid' | 'all'>('unpaid')
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
        unpaidOrders.length === 0 ? (
          <EmptyState>{t('payments.allPaid')}</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {unpaidOrders.slice(0, limit).map(({ order, balance }) => (
              <Card key={order.id} onClick={() => navigate(`/orders/${order.id}`)}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-sm font-medium">{order.code}</span>
                      <span>{orderName(order.id)}</span>
                    </div>
                    <div className="text-xs text-ink-muted">
                      {fmtDate(order.receivedAt)} · {t('orders.total')} {formatCentavos(order.totalCentavos)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-danger-700">{formatCentavos(balance)}</span>
                    <Button
                      className="!py-2 text-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPayTarget({ orderId: order.id, code: order.code, balance })
                        setPayAmount((balance / 100).toFixed(2))
                      }}
                    >
                      {t('payments.record')}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {unpaidOrders.length > limit && (
              <Button variant="secondary" onClick={() => setLimit((l) => l + 50)}>
                +{unpaidOrders.length - limit}
              </Button>
            )}
          </div>
        )
      ) : payments.length === 0 ? (
        <EmptyState>{t('payments.empty')}</EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {payments.slice(0, limit).map((p) => (
            <Card key={p.id} onClick={() => navigate(`/orders/${p.orderId}`)} className="!py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-mono font-medium">{ordersById.get(p.orderId)?.code}</span>
                    <span>{orderName(p.orderId)}</span>
                    {(p.reversalOfPaymentId || p.reversedByPaymentId) && (
                      <span className="rounded-pill bg-danger-500/10 px-2 py-0.5 text-xs font-semibold text-danger-700">
                        {t('payments.reversedBadge')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {fmtDateTime(p.receivedAt)} · {t(`payments.method.${p.method}` as 'payments.method.cash')} ·{' '}
                    {usersById.get(p.byUserId)}
                  </div>
                </div>
                <span className={`font-mono font-medium ${p.amountCentavos < 0 ? 'text-danger-700' : ''}`}>
                  {formatCentavos(p.amountCentavos)}
                </span>
              </div>
            </Card>
          ))}
          {payments.length > limit && (
            <Button variant="secondary" onClick={() => setLimit((l) => l + 50)}>
              +{payments.length - limit}
            </Button>
          )}
        </div>
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
