/**
 * Orders — searchable, filterable, paginated list of order cards with
 * one-tap wash-line advance. Table view unlocks at ≥1024px.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { Order, OrderStatus } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos } from '../../domain/money'
import { paymentStatus } from '../../domain/payments'
import { STATUS_ORDER, prevStatus } from '../../domain/status'
import { advanceOrderStatus } from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { WashLine, statusLabel } from '../../components/WashLine'
import { Card, Chip, Input, Button, EmptyState, Sheet } from '../../components/ui'
import { fmtDate } from '../../app/format'
import { OrderIntake } from './OrderIntake'
import { useDebounced } from '../../app/useDebounced'

const PAGE = 30

export function payToneClass(status: 'unpaid' | 'partial' | 'paid'): string {
  return status === 'unpaid'
    ? 'bg-danger-500/10 text-danger-700'
    : status === 'partial'
      ? 'bg-sun-500/15 text-sun-700'
      : 'bg-accent-400/30 text-accent-700'
}

export function OrdersScreen() {
  const navigate = useNavigate()
  const toast = useToast()
  const { currentUser } = useAuth()
  const [params, setParams] = useSearchParams()
  const statusFilter = (params.get('status') as OrderStatus | null) ?? null
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 250)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [intakeOpen, setIntakeOpen] = useState(false)

  const orders = useLiveQuery(() => db.orders.orderBy('receivedAt').reverse().toArray(), []) ?? []
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.payments.toArray(), []) ?? []

  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const paymentsByOrder = useMemo(() => {
    const map = new Map<string, typeof payments>()
    for (const p of payments) {
      const list = map.get(p.orderId) ?? []
      list.push(p)
      map.set(p.orderId, list)
    }
    return map
  }, [payments])

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<OrderStatus, number>
    for (const o of orders) if (!o.voidedAt) c[o.status]++
    return c
  }, [orders])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false
      if (fromDate && o.receivedAt < `${fromDate}T00:00:00`) return false
      if (toDate && o.receivedAt > `${toDate}T23:59:59`) return false
      if (!q) return true
      const cust = o.customerId ? customersById.get(o.customerId) : undefined
      return (
        o.code.toLowerCase().includes(q) ||
        (o.walkInName?.toLowerCase().includes(q) ?? false) ||
        (cust?.name.toLowerCase().includes(q) ?? false) ||
        (cust?.contact?.includes(q) ?? false)
      )
    })
  }, [orders, statusFilter, debouncedSearch, fromDate, toDate, customersById])

  const visible = filtered.slice(0, limit)

  function customerName(o: Order): string {
    return o.walkInName ?? (o.customerId ? customersById.get(o.customerId)?.name ?? '—' : '—')
  }

  async function advance(o: Order, to: OrderStatus) {
    if (!currentUser) return
    await advanceOrderStatus(o.id, to, currentUser.id)
    const from = o.status
    toast({
      message: t('orders.advanced', { code: o.code, status: statusLabel(to) }),
      undoLabel: t('orders.undo'),
      onUndo: () => {
        void advanceOrderStatus(o.id, from, currentUser.id, 'Undo')
      },
    })
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-bold">{t('orders.title')}</h1>
        <Button className="!py-2" onClick={() => setIntakeOpen(true)}>
          + {t('orders.new')}
        </Button>
      </div>

      <Input placeholder={t('orders.search')} value={search} onChange={(e) => setSearch(e.target.value)} type="search" />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip selected={statusFilter === null} onClick={() => setParams({})}>
          {t('orders.all')} ({orders.filter((o) => !o.voidedAt).length})
        </Chip>
        {STATUS_ORDER.map((s) => (
          <Chip key={s} selected={statusFilter === s} onClick={() => setParams({ status: s })}>
            {statusLabel(s)} ({counts[s]})
          </Chip>
        ))}
      </div>

      <details className="text-sm">
        <summary className="min-h-touch cursor-pointer py-2 font-medium text-ink-muted">{t('orders.dateRange')}</summary>
        <div className="flex gap-2 pb-2">
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </details>

      {visible.length === 0 ? (
        <EmptyState>{t('orders.empty')}</EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((o) => {
            const pays = paymentsByOrder.get(o.id) ?? []
            const pStatus = paymentStatus(o.totalCentavos, pays)
            return (
              <Card key={o.id} onClick={() => navigate(`/orders/${o.id}`)} className={o.voidedAt ? 'opacity-50' : ''}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="font-mono text-sm font-medium">{o.code}</span>
                    <span className="truncate">{customerName(o)}</span>
                    {o.voidedAt && (
                      <span className="rounded-pill bg-danger-500/10 px-2 py-0.5 text-xs font-bold text-danger-700">
                        {t('orders.voidedBadge')}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-medium">{formatCentavos(o.totalCentavos)}</span>
                </div>
                <div className="mb-2 mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                  <span>
                    {o.serviceNameSnapshot} · {o.kilos} {t('orders.kg')} · {t('orders.promised')}: {fmtDate(o.promisedAt)}
                  </span>
                  <span className={`rounded-pill px-2 py-0.5 font-semibold ${payToneClass(pStatus)}`}>
                    {t(`pay.${pStatus}` as 'pay.unpaid')}
                  </span>
                </div>
                {!o.voidedAt && <WashLine status={o.status} onAdvance={(to) => void advance(o, to)} />}
              </Card>
            )
          })}
          {filtered.length > limit && (
            <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
              +{filtered.length - limit}
            </Button>
          )}
        </div>
      )}

      <Sheet open={intakeOpen} onClose={() => setIntakeOpen(false)} title={t('orders.new')} wide>
        <OrderIntake
          onClose={() => setIntakeOpen(false)}
          onSaved={(id, code) => {
            setIntakeOpen(false)
            toast({ message: t('orders.saved', { code }) })
            navigate(`/orders/${id}`)
          }}
        />
      </Sheet>
    </div>
  )
}
