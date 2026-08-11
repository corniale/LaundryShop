/**
 * Orders — two views behind a toggle:
 *  - Table: sortable rows for finding and comparing orders; each row
 *    shows a five-tick stage read and a one-click Next button.
 *  - Board: kanban columns per wash-line stage (see the whole shop at once).
 * Both advance an order in a single click, no drill-down required.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { db } from '../../data/db'
import type { Order, OrderStatus } from '../../data/types'
import { t } from '../../i18n/strings'
import { orderKilos } from '../../domain/orders'
import { formatCentavos } from '../../domain/money'
import { paymentStatus } from '../../domain/payments'
import { STATUS_ORDER, nextStatus } from '../../domain/status'
import { advanceOrderStatus } from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { statusLabel } from '../../components/WashLine'
import { StageIcon } from '../../components/StatusRail'
import { IconCheck } from '@tabler/icons-react'
import { Chip, Input, Button, EmptyState, Sheet } from '../../components/ui'
import { fmtDate, downloadCsv } from '../../app/format'
import { toCsv } from '../../domain/csv'
import { orderCsvRows, ORDER_CSV_HEADER } from '../../domain/ordersCsv'
import { OrderIntake } from './OrderIntake'
import { useDebounced } from '../../app/useDebounced'
import { OrdersTable, sortOrderRows, type OrderRow, type OrderSortKey } from './OrdersTable'

const PAGE = 30
const VIEW_PREF_KEY = 'ordersView' // UI preference only — worthless if lost

const STATUS_VAR: Record<OrderStatus, string> = {
  received: 'var(--status-received)',
  washing: 'var(--status-washing)',
  drying: 'var(--status-drying)',
  ready: 'var(--status-ready)',
  claimed: 'var(--status-claimed)',
}

export function payToneClass(status: 'unpaid' | 'partial' | 'paid'): string {
  return status === 'unpaid'
    ? 'bg-attention-soft text-attention-deep'
    : status === 'partial'
      ? 'bg-attention-soft text-attention-deep'
      : 'bg-positive-soft text-positive-deep'
}

export function OrdersScreen() {
  const navigate = useNavigate()
  const toast = useToast()
  const { currentUser } = useAuth()
  const [params, setParams] = useSearchParams()
  // 'active' (default) hides claimed orders — the counter's normal view.
  const statusParam = params.get('status')
  const statusFilter: OrderStatus | 'active' | 'all' | 'inprogress' =
    statusParam === 'all' || statusParam === 'inprogress'
      ? statusParam
      : statusParam
        ? (statusParam as OrderStatus)
        : 'active'
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 250)
  // Seeded from the URL so Today's tiles can deep-link a date range.
  const [fromDate, setFromDate] = useState(params.get('from') ?? '')
  const [toDate, setToDate] = useState(params.get('to') ?? '')
  const [limit, setLimit] = useState(PAGE)
  const [intakeOpen, setIntakeOpen] = useState(false)
  // Default: earliest stage first, so active work leads and claimed
  // orders fall to the bottom; ties break on the promised date.
  const [sortKey, setSortKey] = useState<OrderSortKey>('stage')
  const [sortDesc, setSortDesc] = useState(false)
  const [view, setView] = useState<'list' | 'board'>(() => {
    try {
      return localStorage.getItem(VIEW_PREF_KEY) === 'board' ? 'board' : 'list'
    } catch {
      return 'list'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_PREF_KEY, view)
    } catch {
      // preference only
    }
  }, [view])

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

  const activeCount = useMemo(
    () => orders.filter((o) => !o.voidedAt && o.status !== 'claimed').length,
    [orders],
  )

  // Search + date filters apply to both views; the status filter is list-only
  // (the board shows every stage by definition).
  const searched = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return orders.filter((o) => {
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
  }, [orders, debouncedSearch, fromDate, toDate, customersById])

  const filtered = useMemo(
    () =>
      searched.filter((o) => {
        if (statusFilter === 'all') return true
        if (statusFilter === 'active') return o.status !== 'claimed' && !o.voidedAt
        if (statusFilter === 'inprogress')
          return !o.voidedAt && (o.status === 'washing' || o.status === 'drying')
        return o.status === statusFilter
      }),
    [searched, statusFilter],
  )

  const boardColumns = useMemo(() => {
    const cols = Object.fromEntries(STATUS_ORDER.map((s) => [s, [] as Order[]])) as Record<OrderStatus, Order[]>
    for (const o of searched) {
      if (o.voidedAt) continue
      // the board is a work queue; claimed is capped and links out
      cols[o.status].push(o)
    }
    for (const s of STATUS_ORDER) {
      cols[s].sort((a, b) => a.promisedAt.localeCompare(b.promisedAt))
    }
    cols.claimed = cols.claimed
      .sort((a, b) => (b.claimedAt ?? b.receivedAt).localeCompare(a.claimedAt ?? a.receivedAt))
      .slice(0, 5)
    return cols
  }, [searched])

  function customerName(o: Order): string {
    return o.walkInName ?? (o.customerId ? customersById.get(o.customerId)?.name ?? '—' : '—')
  }

  const sortedRows = useMemo(() => {
    const rows: OrderRow[] = filtered.map((o) => ({
      order: o,
      customerName: customerName(o),
      payments: paymentsByOrder.get(o.id) ?? [],
    }))
    return sortOrderRows(rows, sortKey, sortDesc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, paymentsByOrder, customersById, sortKey, sortDesc])

  const visible = sortedRows.slice(0, limit)

  function setSort(key: OrderSortKey, defaultDesc = true) {
    if (sortKey === key) setSortDesc((d) => !d)
    else {
      setSortKey(key)
      setSortDesc(defaultDesc)
    }
  }

  /** Exports every row the filters have selected, not just the page shown. */
  function exportCsv() {
    downloadCsv(`orders-${format(new Date(), 'yyyyMMdd')}.csv`, toCsv(ORDER_CSV_HEADER, orderCsvRows(sortedRows)))
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

      <div className="flex items-center gap-2">
        <Input
          placeholder={t('orders.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="search"
          className="flex-1"
        />
        <div className="flex rounded-input border border-line bg-surface p-0.5" role="tablist" aria-label="View">
          {(['list', 'board'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`min-h-touch rounded-[10px] px-3 text-sm font-semibold ${
                view === v ? 'bg-primary text-on-primary' : 'text-ink-muted'
              }`}
            >
              {t(v === 'list' ? 'orders.viewList' : 'orders.viewBoard')}
            </button>
          ))}
        </div>
      </div>

      {/* Intake — a centered floating dialog over a dimmed page */}
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

      {view === 'list' && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip selected={statusFilter === 'active'} onClick={() => setParams({})}>
            {t('orders.active')} ({activeCount})
          </Chip>
          <Chip selected={statusFilter === 'inprogress'} onClick={() => setParams({ status: 'inprogress' })}>
            {t('orders.inProgress')} ({counts.washing + counts.drying})
          </Chip>
          <Chip selected={statusFilter === 'all'} onClick={() => setParams({ status: 'all' })}>
            {t('orders.all')} ({orders.filter((o) => !o.voidedAt).length})
          </Chip>
          {STATUS_ORDER.map((s) => (
            <Chip key={s} selected={statusFilter === s} onClick={() => setParams({ status: s })}>
              {statusLabel(s)} ({counts[s]})
            </Chip>
          ))}
        </div>
      )}

      {/* Date range — always visible, not hidden behind a disclosure */}
      <div className="flex flex-wrap items-end gap-2 rounded-card border border-line bg-surface p-3">
        <label className="flex flex-col gap-1">
          <span className="label-caps">{t('orders.dateFrom')}</span>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="!w-auto" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps">{t('orders.dateTo')}</span>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="!w-auto" />
        </label>
        {(fromDate || toDate) && (
          <Button
            variant="ghost"
            className="!py-2 text-sm"
            onClick={() => {
              setFromDate('')
              setToDate('')
            }}
          >
            {t('orders.dateClear')}
          </Button>
        )}
        {/* Sits with the filters because that is what it exports: whatever
            the chips, the search and these dates have narrowed to. */}
        <Button variant="ghost" className="ml-auto !py-2 text-sm" disabled={sortedRows.length === 0} onClick={exportCsv}>
          {t('orders.exportCsv', { n: sortedRows.length })}
        </Button>
      </div>

      {view === 'board' ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
          {STATUS_ORDER.map((s) => {
            const col = boardColumns[s]
            const next = nextStatus(s)
            const kilos = col.reduce((sum, o) => sum + orderKilos(o), 0)
            return (
              <section
                key={s}
                className="w-[82vw] max-w-[300px] shrink-0 snap-start rounded-card border border-line bg-wash p-2 md:w-[264px]"
                aria-label={statusLabel(s)}
              >
                {/* Header carries the column's identity and load, so the
                    cards never have to repeat the destination stage. */}
                <header className="mb-2 border-b border-line px-2 pb-2 pt-1.5">
                  {/* The header wears the stage icon, so a card's advance
                      button reads as "send it to that column". */}
                  <div className="flex items-center gap-2">
                    <span style={{ color: STATUS_VAR[s] }}>
                      <StageIcon status={s} size={17} />
                    </span>
                    <span className="label-caps !text-ink">{statusLabel(s)}</span>
                    <span className="ml-auto rounded-pill border border-line bg-surface px-2 py-0.5 font-mono text-xs font-medium">
                      {counts[s]}
                    </span>
                  </div>
                  <div className="mt-0.5 pl-[1.6rem] text-xs text-ink-muted">
                    {kilos.toFixed(1)} {t('orders.kg')}
                  </div>
                </header>
                <div className="flex flex-col gap-2">
                  {col.map((o) => {
                    const pStatus = paymentStatus(o.totalCentavos, paymentsByOrder.get(o.id) ?? [])
                    const overdue = s !== 'claimed' && new Date(o.promisedAt) < new Date()
                    return (
                      <div
                        key={o.id}
                        onClick={() => navigate(`/orders/${o.id}`)}
                        className={`relative cursor-pointer rounded-card border border-line bg-surface py-2.5 pl-3 transition-colors duration-150 hover:border-ink-muted/40 ${
                          // The right gutter exists only to hold the advance
                          // button; a terminal card reclaims that space.
                          next ? 'pr-14' : 'pr-3'
                        }`}
                        style={
                          overdue
                            ? { borderLeft: '3px solid var(--attention)', paddingLeft: 'calc(0.75rem - 2px)' }
                            : undefined
                        }
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-mono text-sm font-medium">{o.code}</span>
                          <span className="font-mono text-sm font-medium">{formatCentavos(o.totalCentavos)}</span>
                        </div>
                        <div className="truncate text-sm">{customerName(o)}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
                          {/* Inline, text-level completion mark — deliberately
                              not a control, so it invites no tap. */}
                          {!next && (
                            <IconCheck
                              size={13}
                              stroke={2.25}
                              className="shrink-0"
                              style={{ color: 'var(--status-claimed)' }}
                              aria-label={statusLabel(o.status)}
                            />
                          )}
                          <span>
                            {orderKilos(o)} {t('orders.kg')}
                          </span>
                          <span>·</span>
                          <span className={overdue ? 'font-semibold text-attention-deep' : ''}>
                            {fmtDate(o.promisedAt)}
                          </span>
                          {/* Exception-based: only flag what still owes money */}
                          {pStatus !== 'paid' && (
                            <span className={`rounded-pill px-1.5 py-0.5 font-semibold ${payToneClass(pStatus)}`}>
                              {t(`pay.${pStatus}` as 'pay.unpaid')}
                            </span>
                          )}
                        </div>
                        {next && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              void advance(o, next)
                            }}
                            aria-label={t('rail.advanceTo', { status: statusLabel(next) })}
                            title={t('rail.advanceTo', { status: statusLabel(next) })}
                            className="absolute right-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill border transition-colors duration-150"
                            style={{ borderColor: STATUS_VAR[next], color: STATUS_VAR[next] }}
                          >
                            <StageIcon status={next} size={19} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {col.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-ink-muted">{t('orders.columnEmpty')}</div>
                  )}
                  {/* The board is about work in progress; the archive lives
                      in the table, one tap away. */}
                  {s === 'claimed' && counts.claimed > col.length && (
                    <button
                      onClick={() => {
                        setView('list')
                        setParams({ status: 'claimed' })
                      }}
                      className="min-h-touch rounded-input px-3 text-sm font-semibold text-primary-deep"
                    >
                      {t('orders.viewAllClaimed')} ({counts.claimed}) →
                    </button>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState>{t('orders.empty')}</EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          <OrdersTable
            rows={visible}
            sortKey={sortKey}
            sortDesc={sortDesc}
            onSort={setSort}
            onOpen={(id) => navigate(`/orders/${id}`)}
            onAdvance={(o, to) => void advance(o, to)}
          />
          {sortedRows.length > limit && (
            <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
              +{sortedRows.length - limit}
            </Button>
          )}
        </div>
      )}

    </div>
  )
}
