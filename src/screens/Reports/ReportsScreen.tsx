/**
 * Reports — Owner-only. Hand-built CSS bars, mono figures, CSV export,
 * date presets: Ngayon / Linggong ito / Buwang ito / Custom.
 */
import { Fragment, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  addHours,
  endOfHour,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  differenceInCalendarDays,
} from 'date-fns'
import { db } from '../../data/db'
import { t } from '../../i18n/strings'
import { formatCentavos } from '../../domain/money'
import { balanceCentavos } from '../../domain/payments'
import { allLines } from '../../domain/orders'
import { addOnTotals } from '../../domain/addOns'
import { Card, Button, EmptyState } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import { DateRangePicker, useDateRange } from '../../components/DateRangePicker'
import { inRange, downloadCsv } from '../../app/format'
import { toCsv } from '../../domain/csv'

/** Bar list. Service names are as long as they are, so the layout gives them the room. */
function BarList({ rows }: { rows: Array<{ label: string; value: number; display: string }> }) {
  const max = Math.max(...rows.map((r) => r.value), 0)
  const track = (value: number) => (
    <div className="h-5 overflow-hidden rounded-input bg-wash">
      <div
        className="h-full rounded-input"
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: 'var(--primary)' }}
      />
    </div>
  )
  return (
    <>
      {/* Phone: name and figure share a line, track sits beneath at full width */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-ink-muted">{r.label}</span>
              <span className="shrink-0 font-mono text-xs">{r.display}</span>
            </div>
            {track(r.value)}
          </div>
        ))}
      </div>

      {/* md and up: one shared grid, so the name column sizes to the longest
          name instead of a fixed width, and every track still starts on the
          same line. Nothing is cut while there is space beside it. */}
      <div className="hidden grid-cols-[minmax(0,max-content)_minmax(0,1fr)_max-content] items-center gap-x-3 gap-y-2 text-sm md:grid">
        {rows.map((r) => (
          <Fragment key={r.label}>
            <span className="truncate text-ink-muted">{r.label}</span>
            {track(r.value)}
            <span className="text-right font-mono text-xs">{r.display}</span>
          </Fragment>
        ))}
      </div>
    </>
  )
}

export function ReportsScreen() {
  const dateRange = useDateRange('month')
  const { range } = dateRange

  const orders = useLiveQuery(() => db.orders.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.payments.toArray(), []) ?? []
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? []
  const users = useLiveQuery(() => db.users.toArray(), []) ?? []
  const statusEvents = useLiveQuery(() => db.statusEvents.toArray(), []) ?? []
  const addOnTypes = useLiveQuery(() => db.addOnTypes.toArray(), []) ?? []

  const liveOrders = useMemo(() => orders.filter((o) => !o.voidedAt), [orders])
  const rangeOrders = useMemo(() => liveOrders.filter((o) => inRange(o.receivedAt, range.from, range.to)), [liveOrders, range])
  const rangePayments = useMemo(() => payments.filter((p) => inRange(p.receivedAt, range.from, range.to)), [payments, range])

  const paymentsByOrder = useMemo(() => {
    const map = new Map<string, typeof payments>()
    for (const p of payments) {
      const list = map.get(p.orderId) ?? []
      list.push(p)
      map.set(p.orderId, list)
    }
    return map
  }, [payments])

  /**
   * Income chart, over whatever range the picker is on. The grain follows
   * the span so the chart stays a chart: a single day would be one fat bar
   * and a year would be 365 hairlines, so one day reads by the hour and
   * anything past two months reads by the week.
   */
  const { grain, buckets } = useMemo(() => {
    const spanDays = differenceInCalendarDays(range.to, range.from) + 1
    if (spanDays <= 1) {
      const base = startOfDay(range.from)
      return {
        grain: 'hourly' as const,
        buckets: Array.from({ length: 24 }, (_, h) => {
          const from = addHours(base, h)
          return { label: format(from, 'h a'), from, to: endOfHour(from) }
        }),
      }
    }
    if (spanDays <= 62) {
      return {
        grain: 'daily' as const,
        buckets: eachDayOfInterval({ start: range.from, end: range.to }).map((d) => ({
          label: format(d, 'MMM d'),
          from: startOfDay(d),
          to: endOfDay(d),
        })),
      }
    }
    return {
      grain: 'weekly' as const,
      buckets: eachWeekOfInterval({ start: range.from, end: range.to }, { weekStartsOn: 1 }).map((d) => ({
        label: format(d, 'MMM d'),
        from: startOfDay(d),
        to: endOfWeek(d, { weekStartsOn: 1 }),
      })),
    }
  }, [range])

  // Drawn from rangePayments, so the partial weeks at either end of a weekly
  // chart cannot pull in money from outside the chosen range.
  const incomeSeries = useMemo(
    () =>
      buckets.map((b) => ({
        label: b.label,
        value: rangePayments.filter((p) => inRange(p.receivedAt, b.from, b.to)).reduce((s, p) => s + p.amountCentavos, 0),
      })),
    [buckets, rangePayments],
  )

  /**
   * Income + kilos by service (range). Read per line, so an order holding
   * two services is split between them rather than credited to whichever
   * one happened to be first. The figure is each line's own money —
   * order-level add-ons and discounts belong to the visit, not to a
   * service, so they stay out of this breakdown.
   */
  const byService = useMemo(() => {
    const map = new Map<string, { income: number; kilos: number }>()
    for (const { line } of allLines(rangeOrders)) {
      const cur = map.get(line.serviceNameSnapshot) ?? { income: 0, kilos: 0 }
      cur.income += line.lineTotalCentavos
      cur.kilos += line.kilos
      map.set(line.serviceNameSnapshot, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].income - a[1].income)
  }, [rangeOrders])

  /**
   * Add-ons (range). Grouped by catalogue entry where there is one, so a
   * bag charged from the chip and a bag typed by hand before the catalogue
   * existed still read as bags rather than as two lines.
   */
  const byAddOn = useMemo(() => addOnTotals(rangeOrders, addOnTypes), [rangeOrders, addOnTypes])

  // Top customers by spend (range)
  const topCustomers = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of rangeOrders) {
      if (!o.customerId) continue
      map.set(o.customerId, (map.get(o.customerId) ?? 0) + o.totalCentavos)
    }
    return [...map.entries()]
      .map(([id, spend]) => ({ name: customers.find((c) => c.id === id)?.name ?? '—', spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10)
  }, [rangeOrders, customers])

  // Customers with outstanding balances (all time)
  const withBalance = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of liveOrders) {
      if (!o.customerId) continue
      const bal = Math.max(0, balanceCentavos(o.totalCentavos, paymentsByOrder.get(o.id) ?? []))
      if (bal > 0) map.set(o.customerId, (map.get(o.customerId) ?? 0) + bal)
    }
    return [...map.entries()]
      .map(([id, balance]) => ({ name: customers.find((c) => c.id === id)?.name ?? '—', balance }))
      .sort((a, b) => b.balance - a.balance)
  }, [liveOrders, paymentsByOrder, customers])

  // Staff activity (range)
  const staffActivity = useMemo(() => {
    return users.map((u) => ({
      name: u.name,
      role: u.role,
      orders: rangeOrders.filter((o) => o.createdBy === u.id).length,
      statusChanges: statusEvents.filter((e) => e.byUserId === u.id && inRange(e.at, range.from, range.to)).length,
      payments: rangePayments.filter((p) => p.byUserId === u.id).length,
    }))
  }, [users, rangeOrders, statusEvents, rangePayments, range])

  const incomeTotal = rangePayments.reduce((s, p) => s + p.amountCentavos, 0)
  const maxBar = Math.max(...incomeSeries.map((d) => d.value), 1)

  function exportAll() {
    const rows: Array<Array<string | number>> = []
    rows.push(['Income (range)', (incomeTotal / 100).toFixed(2)])
    rows.push([])
    rows.push(['Service', 'Income', 'Kilos'])
    for (const [name, v] of byService) rows.push([name, (v.income / 100).toFixed(2), v.kilos.toFixed(1)])
    rows.push([])
    rows.push(['Add-on', 'Times used', 'Income'])
    for (const a of byAddOn) rows.push([a.name, a.count, (a.incomeCentavos / 100).toFixed(2)])
    rows.push([])
    rows.push(['Top customer', 'Spend'])
    for (const c of topCustomers) rows.push([c.name, (c.spend / 100).toFixed(2)])
    rows.push([])
    rows.push(['Staff', 'Orders', 'Status changes', 'Payments'])
    for (const s of staffActivity) rows.push([s.name, s.orders, s.statusChanges, s.payments])
    downloadCsv(`report-${format(range.from, 'yyyyMMdd')}-${format(range.to, 'yyyyMMdd')}.csv`, toCsv(['Report', ''], rows))
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold">{t('reports.title')}</h1>
        <Button variant="ghost" className="!py-2 text-sm" onClick={exportAll}>
          {t('reports.exportCsv')}
        </Button>
      </div>

      <DateRangePicker {...dateRange} />

      <Card>
        <div className="mb-1 text-xs font-medium text-ink-muted">{t('reports.income')}</div>
        <div className="font-mono text-xl font-medium text-positive-deep">{formatCentavos(incomeTotal)}</div>
      </Card>

      {/* Income over the chosen range */}
      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">
          {t('reports.income')} — {t(`reports.${grain}` as 'reports.daily')}
        </h2>
        <div className="flex h-32 items-end gap-[2px]">
          {incomeSeries.map((d, i) => (
            <div
              key={i}
              title={`${d.label}: ${formatCentavos(d.value)}`}
              className="flex-1 rounded-t-[3px]"
              style={{
                height: `${(d.value / maxBar) * 100}%`,
                minHeight: d.value > 0 ? 3 : 1,
                backgroundColor: d.value > 0 ? 'var(--primary)' : 'var(--line)',
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-ink-muted">
          <span>{incomeSeries[0]?.label}</span>
          <span>{incomeSeries[incomeSeries.length - 1]?.label}</span>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('reports.byService')}</h2>
        {byService.length === 0 ? (
          <EmptyState>{t('reports.empty')}</EmptyState>
        ) : (
          <BarList rows={byService.map(([name, v]) => ({ label: name, value: v.income, display: formatCentavos(v.income) }))} />
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('reports.kilosByService')}</h2>
        {byService.length === 0 ? (
          <EmptyState>{t('reports.empty')}</EmptyState>
        ) : (
          <BarList rows={byService.map(([name, v]) => ({ label: name, value: v.kilos, display: `${v.kilos.toFixed(1)} kg` }))} />
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('reports.byAddOn')}</h2>
        {byAddOn.length === 0 ? (
          <EmptyState>{t('reports.empty')}</EmptyState>
        ) : (
          <BarList
            rows={byAddOn.map((a) => ({
              label: a.name,
              value: a.incomeCentavos,
              display: `${formatCentavos(a.incomeCentavos)} · ${t('reports.addOnCount', { n: a.count })}`,
            }))}
          />
        )}
      </Card>

      {/* Two readings of the same customers — who spends and who owes — so
          they belong beside each other. Grid rows stretch, so the cards match
          height whichever list is longer, and neither scrolls inside itself. */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-display text-base font-semibold">{t('reports.topCustomers')}</h2>
          <div className="flex flex-col gap-1.5">
            {topCustomers.map((c, i) => (
              <div key={i} className="flex justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{c.name}</span>
                <span className="shrink-0 font-mono">{formatCentavos(c.spend)}</span>
              </div>
            ))}
            {topCustomers.length === 0 && <div className="text-sm text-ink-muted">{t('reports.empty')}</div>}
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-base font-semibold">{t('reports.withBalance')}</h2>
          <div className="flex flex-col gap-1.5">
            {withBalance.map((c, i) => (
              <div key={i} className="flex justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{c.name}</span>
                <span className="shrink-0 font-mono text-attention-deep">{formatCentavos(c.balance)}</span>
              </div>
            ))}
            {withBalance.length === 0 && <div className="text-sm text-ink-muted">{t('payments.allPaid')}</div>}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('reports.staff')}</h2>
        <DataTable
          rows={staffActivity}
          getRowKey={(s) => s.name}
          initialSortKey="orders"
          emptyText={t('reports.empty')}
          columns={[
            {
              key: 'name',
              header: t('users.name'),
              sortValue: (s) => s.name.toLowerCase(),
              defaultDesc: false,
              render: (s) => (
                <span>
                  {s.name} <span className="text-xs text-ink-muted">({s.role})</span>
                </span>
              ),
            },
            {
              key: 'orders',
              header: t('reports.staffOrders'),
              align: 'right',
              sortValue: (s) => s.orders,
              render: (s) => <span className="font-mono">{s.orders}</span>,
            },
            {
              key: 'status',
              header: t('reports.staffStatus'),
              align: 'right',
              sortValue: (s) => s.statusChanges,
              render: (s) => <span className="font-mono">{s.statusChanges}</span>,
            },
            {
              key: 'payments',
              header: t('reports.staffPayments'),
              align: 'right',
              sortValue: (s) => s.payments,
              render: (s) => <span className="font-mono">{s.payments}</span>,
            },
          ]}
        />
      </Card>
    </div>
  )
}
