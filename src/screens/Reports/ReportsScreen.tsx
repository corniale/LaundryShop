/**
 * Reports — Owner-only. Hand-built CSS bars, mono figures, CSV export,
 * date presets: Ngayon / Linggong ito / Buwang ito / Custom.
 */
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { db } from '../../data/db'
import { t } from '../../i18n/strings'
import { formatCentavos } from '../../domain/money'
import { balanceCentavos } from '../../domain/payments'
import { Card, Chip, Input, Button, EmptyState } from '../../components/ui'
import { todayRange, weekRange, monthRange, inRange, downloadCsv } from '../../app/format'
import { toCsv } from '../../domain/csv'

type Preset = 'today' | 'week' | 'month' | 'custom'

function Bar({ label, value, max, display }: { label: string; value: number; max: number; display: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 shrink-0 truncate text-ink-muted">{label}</span>
      <div className="h-5 flex-1 overflow-hidden rounded-input bg-wash-deep">
        <div
          className="h-full rounded-input"
          style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: 'var(--primary-500)' }}
        />
      </div>
      <span className="w-24 shrink-0 text-right font-mono text-xs">{display}</span>
    </div>
  )
}

export function ReportsScreen() {
  const [preset, setPreset] = useState<Preset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const orders = useLiveQuery(() => db.orders.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.payments.toArray(), []) ?? []
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? []
  const users = useLiveQuery(() => db.users.toArray(), []) ?? []
  const statusEvents = useLiveQuery(() => db.statusEvents.toArray(), []) ?? []

  const range = useMemo(() => {
    if (preset === 'today') return todayRange()
    if (preset === 'week') return weekRange()
    if (preset === 'month') return monthRange()
    return {
      from: customFrom ? startOfDay(new Date(customFrom)) : startOfDay(subDays(new Date(), 30)),
      to: customTo ? endOfDay(new Date(customTo)) : endOfDay(new Date()),
    }
  }, [preset, customFrom, customTo])

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

  // Daily income — last 30 days
  const dailyIncome = useMemo(() => {
    const days: Array<{ label: string; value: number }> = []
    for (let i = 29; i >= 0; i--) {
      const day = subDays(new Date(), i)
      const from = startOfDay(day)
      const to = endOfDay(day)
      const total = payments.filter((p) => inRange(p.receivedAt, from, to)).reduce((s, p) => s + p.amountCentavos, 0)
      days.push({ label: format(day, 'MMM d'), value: total })
    }
    return days
  }, [payments])

  // Income + kilos by service (range)
  const byService = useMemo(() => {
    const map = new Map<string, { income: number; kilos: number }>()
    for (const o of rangeOrders) {
      const cur = map.get(o.serviceNameSnapshot) ?? { income: 0, kilos: 0 }
      cur.income += o.totalCentavos
      cur.kilos += o.kilos
      map.set(o.serviceNameSnapshot, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].income - a[1].income)
  }, [rangeOrders])

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
  const maxDaily = Math.max(...dailyIncome.map((d) => d.value), 1)

  function exportAll() {
    const rows: Array<Array<string | number>> = []
    rows.push(['Income (range)', (incomeTotal / 100).toFixed(2)])
    rows.push([])
    rows.push(['Service', 'Income', 'Kilos'])
    for (const [name, v] of byService) rows.push([name, (v.income / 100).toFixed(2), v.kilos.toFixed(1)])
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

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {(['today', 'week', 'month', 'custom'] as const).map((p) => (
          <Chip key={p} selected={preset === p} onClick={() => setPreset(p)}>
            {t(`reports.preset.${p}` as 'reports.preset.today')}
          </Chip>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex gap-2">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      <Card>
        <div className="mb-1 text-xs font-medium text-ink-muted">{t('reports.income')}</div>
        <div className="font-mono text-xl font-medium text-accent-700">{formatCentavos(incomeTotal)}</div>
      </Card>

      {/* Daily bars, last 30 days */}
      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">
          {t('reports.income')} — {t('reports.daily')}
        </h2>
        <div className="flex h-32 items-end gap-[2px]">
          {dailyIncome.map((d, i) => (
            <div
              key={i}
              title={`${d.label}: ${formatCentavos(d.value)}`}
              className="flex-1 rounded-t-[3px]"
              style={{
                height: `${(d.value / maxDaily) * 100}%`,
                minHeight: d.value > 0 ? 3 : 1,
                backgroundColor: d.value > 0 ? 'var(--primary-500)' : 'var(--line)',
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-ink-muted">
          <span>{dailyIncome[0]?.label}</span>
          <span>{dailyIncome[dailyIncome.length - 1]?.label}</span>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('reports.byService')}</h2>
        {byService.length === 0 ? (
          <EmptyState>{t('reports.empty')}</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {byService.map(([name, v]) => (
              <Bar key={name} label={name} value={v.income} max={byService[0][1].income} display={formatCentavos(v.income)} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('reports.kilosByService')}</h2>
        <div className="flex flex-col gap-2">
          {byService.map(([name, v]) => (
            <Bar
              key={name}
              label={name}
              value={v.kilos}
              max={Math.max(...byService.map(([, x]) => x.kilos), 1)}
              display={`${v.kilos.toFixed(1)} kg`}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('reports.topCustomers')}</h2>
        <div className="flex flex-col gap-1.5">
          {topCustomers.map((c, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{c.name}</span>
              <span className="font-mono">{formatCentavos(c.spend)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('reports.withBalance')}</h2>
        <div className="flex flex-col gap-1.5">
          {withBalance.map((c, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{c.name}</span>
              <span className="font-mono text-danger-700">{formatCentavos(c.balance)}</span>
            </div>
          ))}
          {withBalance.length === 0 && <div className="text-sm text-ink-muted">{t('payments.allPaid')}</div>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('reports.staff')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-wash-deep text-left text-xs text-ink-muted">
                <th className="rounded-l-input px-2 py-1.5">{t('users.name')}</th>
                <th className="px-2 py-1.5 text-right">{t('reports.staffOrders')}</th>
                <th className="px-2 py-1.5 text-right">{t('reports.staffStatus')}</th>
                <th className="rounded-r-input px-2 py-1.5 text-right">{t('reports.staffPayments')}</th>
              </tr>
            </thead>
            <tbody>
              {staffActivity.map((s, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-2 py-1.5">
                    {s.name} <span className="text-xs text-ink-muted">({s.role})</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{s.orders}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{s.statusChanges}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{s.payments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
