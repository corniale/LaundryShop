/**
 * Inventory — stock on hand, human-recorded moves only. Expected-use rules
 * are reporting only and NEVER touch quantities.
 *
 * Stock and usage share one table because they describe the same thing: what
 * is left, what left the shelf over the chosen period, and what that cost.
 * Splitting them into two stacked lists of the same items made the reader
 * match up names by eye.
 */
import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { db } from '../../data/db'
import type { ExpectedUseRule, InventoryItem, InventoryUnit, Service, UseBasis } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos, parsePesosInput } from '../../domain/money'
import {
  runningBalances,
  compareUsage,
  isLowStock,
  latestUnitCostCentavos,
  usageCostCentavos,
  expectedQty,
} from '../../domain/inventory'
import {
  saveInventoryItem,
  recordStockMove,
  recountStock,
  saveExpectedUseRule,
  deleteExpectedUseRule,
} from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { Card, Button, Sheet, Field, Input, Select, Chip } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { fmtDateTime, todayRange, weekRange, monthRange, inRange } from '../../app/format'

const UNITS: InventoryUnit[] = ['kg', 'g', 'L', 'mL', 'pc', 'pack']
const BASES: UseBasis[] = ['kg', 'piece', 'order']
type Preset = 'today' | 'week' | 'month' | 'custom'

// Native spinners crowd a cell this small, and the keyboard still steps the value.
const CELL =
  'h-9 w-20 rounded-input border border-line bg-surface px-2 text-right font-mono text-sm text-ink ' +
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

/**
 * Expected use, as a grid: every service is a row, every item a column, and
 * a cell is how much of that item the service uses per unit of its basis.
 * A form that asked for one service, one item and one number at a time made
 * the reader hold the whole matrix in their head; here it is on the page.
 *
 * The basis belongs to the service — a service sold by the kilo consumes by
 * the kilo — so it is one control per row rather than one per cell, which
 * would put a dropdown in every square.
 */
function RulesMatrix({
  services,
  items,
  rules,
  onSave,
  onDelete,
}: {
  services: Service[]
  items: InventoryItem[]
  rules: ExpectedUseRule[]
  onSave: (rule: { id?: string; serviceId: string; itemId: string; qtyPer: number; basis: UseBasis }) => void
  onDelete: (id: string) => void
}) {
  const [basisDraft, setBasisDraft] = useState<Record<string, UseBasis>>({})
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({})

  const cellKey = (serviceId: string, itemId: string) => `${serviceId}:${itemId}`
  const ruleAt = (serviceId: string, itemId: string) =>
    rules.find((r) => r.serviceId === serviceId && r.itemId === itemId)
  const basisOf = (serviceId: string): UseBasis =>
    basisDraft[serviceId] ?? rules.find((r) => r.serviceId === serviceId)?.basis ?? 'kg'
  const shownQty = (serviceId: string, itemId: string) => {
    const draft = qtyDraft[cellKey(serviceId, itemId)]
    if (draft !== undefined) return draft
    const rule = ruleAt(serviceId, itemId)
    return rule ? String(rule.qtyPer) : ''
  }

  /** Blank or zero means "no rule", so the row is removed rather than stored as 0. */
  function commit(serviceId: string, itemId: string) {
    const key = cellKey(serviceId, itemId)
    const raw = qtyDraft[key]
    setQtyDraft((d) => {
      const next = { ...d }
      delete next[key]
      return next
    })
    if (raw === undefined) return
    const existing = ruleAt(serviceId, itemId)
    const qty = Number(raw)
    if (raw.trim() === '' || !Number.isFinite(qty) || qty <= 0) {
      if (existing) onDelete(existing.id)
      return
    }
    onSave({ id: existing?.id, serviceId, itemId, qtyPer: qty, basis: basisOf(serviceId) })
  }

  function changeBasis(serviceId: string, basis: UseBasis) {
    setBasisDraft((d) => ({ ...d, [serviceId]: basis }))
    for (const r of rules.filter((x) => x.serviceId === serviceId)) {
      onSave({ id: r.id, serviceId, itemId: r.itemId, qtyPer: r.qtyPer, basis })
    }
  }

  const basisSelect = (service: Service, className: string) => (
    <Select
      className={className}
      aria-label={`${t('inventory.basis')} — ${service.name}`}
      value={basisOf(service.id)}
      onChange={(e) => changeBasis(service.id, e.target.value as UseBasis)}
    >
      {BASES.map((b) => (
        <option key={b} value={b}>
          {t(`inventory.basis.${b}` as 'inventory.basis.kg')}
        </option>
      ))}
    </Select>
  )

  const qtyInput = (service: Service, item: InventoryItem, className: string) => (
    <input
      inputMode="decimal"
      type="number"
      min="0"
      step="0.001"
      placeholder="—"
      aria-label={`${service.name} — ${item.name}`}
      className={className}
      value={shownQty(service.id, item.id)}
      onChange={(e) => setQtyDraft((d) => ({ ...d, [cellKey(service.id, item.id)]: e.target.value }))}
      onBlur={() => commit(service.id, item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )

  const columns: Array<Column<Service>> = [
    {
      key: 'service',
      header: t('inventory.service'),
      sortValue: (s) => s.name.toLowerCase(),
      defaultDesc: false,
      render: (s) => <span className="whitespace-nowrap font-medium">{s.name}</span>,
    },
    {
      key: 'basis',
      header: t('inventory.basis'),
      render: (s) => basisSelect(s, '!min-h-0 h-9 !w-auto !py-0 !text-sm'),
    },
    ...items.map(
      (item): Column<Service> => ({
        key: item.id,
        header: `${item.name} (${item.unit})`,
        align: 'right',
        render: (s) => qtyInput(s, item, CELL),
      }),
    ),
  ]

  return (
    <DataTable
      rows={services}
      columns={columns}
      getRowKey={(s) => s.id}
      emptyText={t('inventory.rulesEmpty')}
      renderCard={(s) => (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{s.name}</span>
            {basisSelect(s, '!min-h-0 h-9 !w-auto !py-0 !text-sm')}
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm text-ink-muted">
                  {item.name} <span className="text-xs">({item.unit})</span>
                </span>
                {qtyInput(s, item, CELL)}
              </div>
            ))}
          </div>
        </>
      )}
    />
  )
}

interface UsageRow {
  item: InventoryItem
  used: number
  restocked: number
  spendCentavos: number
  costOfUseCentavos: number | null
  expected: number | null
  variancePct: number | null
  flagged: boolean
}

export function InventoryScreen() {
  const toast = useToast()
  const { currentUser, isOwner } = useAuth()
  // Sorted by name so the rules grid's columns keep a stable order.
  const items = useLiveQuery(() => db.inventoryItems.filter((i) => i.active).sortBy('name'), []) ?? []
  const moves = useLiveQuery(() => db.inventoryMoves.toArray(), []) ?? []
  const orders = useLiveQuery(() => db.orders.toArray(), []) ?? []
  const services = useLiveQuery(() => db.services.toArray(), []) ?? []
  const rules = useLiveQuery(() => db.expectedUseRules.toArray(), []) ?? []

  const [preset, setPreset] = useState<Preset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [detail, setDetail] = useState<InventoryItem | null>(null)
  const [moveOpen, setMoveOpen] = useState<'in' | 'out' | 'recount' | null>(null)
  const [moveForm, setMoveForm] = useState({ qty: '', cost: '', supplier: '', reason: '' })
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [itemForm, setItemForm] = useState({ name: '', unit: 'kg' as InventoryUnit, reorder: '', qty: '0' })
  const rulesRef = useRef<HTMLDivElement>(null)

  const detailLive = items.find((i) => i.id === detail?.id) ?? detail
  const servicesInOrder = useMemo(
    () => [...services].filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [services],
  )

  const range = useMemo(() => {
    if (preset === 'today') return todayRange()
    if (preset === 'week') return weekRange()
    if (preset === 'month') return monthRange()
    return {
      from: customFrom ? startOfDay(new Date(customFrom)) : startOfDay(subDays(new Date(), 30)),
      to: customTo ? endOfDay(new Date(customTo)) : endOfDay(new Date()),
    }
  }, [preset, customFrom, customTo])

  const detailMoves = useMemo(
    () => (detailLive ? moves.filter((m) => m.itemId === detailLive.id).sort((a, b) => a.at.localeCompare(b.at)) : []),
    [moves, detailLive],
  )
  const detailBalances = useMemo(() => runningBalances(detailMoves), [detailMoves])

  /**
   * Usage over the chosen period. `used` counts only the stock-outs a person
   * recorded; `expected` is derived from the kilos washed under each rule and
   * is never written anywhere. `costOfUse` prices the consumed stock at the
   * last amount paid for it.
   */
  const rows: UsageRow[] = useMemo(() => {
    const { from, to } = range
    return items.map((item) => {
      const mine = moves.filter((m) => m.itemId === item.id)
      const inRangeMoves = mine.filter((m) => inRange(m.at, from, to))
      const used = inRangeMoves.filter((m) => m.type === 'out').reduce((s, m) => s + m.qty, 0)
      const restocked = inRangeMoves.filter((m) => m.type === 'in').reduce((s, m) => s + m.qty, 0)
      const spendCentavos = inRangeMoves
        .filter((m) => m.type === 'in')
        .reduce((s, m) => s + m.qty * (m.unitCostCentavos ?? 0), 0)

      const itemRules = rules.filter((r) => r.itemId === item.id)
      let expected: number | null = null
      if (itemRules.length > 0) {
        expected = 0
        for (const rule of itemRules) {
          const forService = orders.filter(
            (o) => !o.voidedAt && o.serviceId === rule.serviceId && inRange(o.receivedAt, from, to),
          )
          expected += expectedQty(forService, rule.basis ?? 'kg', rule.qtyPer)
        }
      }
      // One bucket of expected quantity already summed, so the per-kilo rate is it.
      const comparison = expected !== null ? compareUsage(1, expected, used) : null

      return {
        item,
        used,
        restocked,
        spendCentavos: Math.round(spendCentavos),
        costOfUseCentavos: usageCostCentavos(used, latestUnitCostCentavos(mine) ?? item.costPerUnitCentavos ?? null),
        expected,
        variancePct: comparison?.variancePct ?? null,
        flagged: comparison?.flagged ?? false,
      }
    })
  }, [items, moves, rules, orders, range])

  async function submitMove() {
    if (!currentUser || !detailLive || !moveOpen) return
    const qty = Number(moveForm.qty)
    if (!Number.isFinite(qty) || qty < 0) return
    if (moveOpen === 'recount') {
      await recountStock(detailLive.id, qty, currentUser.id)
    } else {
      await recordStockMove(detailLive.id, moveOpen, qty, currentUser.id, {
        reason: moveForm.reason || undefined,
        unitCostCentavos: moveOpen === 'in' ? (parsePesosInput(moveForm.cost) ?? undefined) : undefined,
        supplier: moveOpen === 'in' ? moveForm.supplier || undefined : undefined,
      })
    }
    toast({ message: t('inventory.saved') })
    setMoveOpen(null)
    setMoveForm({ qty: '', cost: '', supplier: '', reason: '' })
  }

  async function submitItem() {
    if (!currentUser || !itemForm.name.trim()) return
    await saveInventoryItem(
      {
        id: editItem?.id,
        name: itemForm.name.trim(),
        unit: itemForm.unit,
        currentQty: editItem ? editItem.currentQty : Number(itemForm.qty) || 0,
        reorderPoint: Number(itemForm.reorder) || 0,
        costPerUnitCentavos: editItem?.costPerUnitCentavos,
        supplier: editItem?.supplier,
        active: true,
      },
      currentUser.id,
    )
    toast({ message: t('inventory.saved') })
    setItemFormOpen(false)
  }

  function showRules() {
    rulesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const stockColumns: Array<Column<UsageRow>> = [
    {
      key: 'name',
      header: t('inventory.item'),
      sortValue: (r) => r.item.name.toLowerCase(),
      defaultDesc: false,
      render: (r) => <span className="font-medium">{r.item.name}</span>,
    },
    {
      key: 'onHand',
      header: t('inventory.onHand'),
      align: 'right',
      // Low stock is about the gap to the reorder point, not the raw number,
      // so sorting here puts what needs buying at the top.
      sortValue: (r) => r.item.currentQty - r.item.reorderPoint,
      defaultDesc: false,
      render: (r) => {
        const low = isLowStock(r.item.currentQty, r.item.reorderPoint)
        return (
          <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
            {low && (
              <span className="rounded-pill bg-danger-500/10 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-danger-700">
                {t('inventory.lowStock')}
              </span>
            )}
            <span className={`font-mono font-medium ${low ? 'text-danger-700' : ''}`}>
              {r.item.currentQty} {r.item.unit}
            </span>
          </span>
        )
      },
    },
    {
      key: 'reorder',
      header: t('inventory.reorderPoint'),
      align: 'right',
      sortValue: (r) => r.item.reorderPoint,
      render: (r) => (
        <span className="whitespace-nowrap font-mono text-ink-muted">
          {r.item.reorderPoint} {r.item.unit}
        </span>
      ),
    },
  ]

  const usageColumns: Array<Column<UsageRow>> = [
    {
      key: 'used',
      header: t('inventory.used'),
      align: 'right',
      sortValue: (r) => r.used,
      render: (r) => (
        <span className="whitespace-nowrap font-mono">
          {r.used.toFixed(1)} {r.item.unit}
        </span>
      ),
    },
    {
      key: 'expected',
      header: t('inventory.expected'),
      align: 'right',
      sortValue: (r) => r.expected ?? -1,
      render: (r) =>
        r.expected === null ? (
          <button
            className="text-xs text-primary-600 underline underline-offset-2"
            onClick={(e) => {
              e.stopPropagation()
              showRules()
            }}
          >
            {t('inventory.noRule')}
          </button>
        ) : (
          <span className="whitespace-nowrap font-mono text-ink-muted">
            {r.expected.toFixed(1)} {r.item.unit}
          </span>
        ),
    },
    {
      key: 'variance',
      header: t('inventory.variance'),
      align: 'right',
      sortValue: (r) => (r.variancePct === null ? 0 : Math.abs(r.variancePct)),
      render: (r) =>
        r.variancePct === null ? (
          <span className="text-xs text-ink-muted">—</span>
        ) : (
          <span
            className={`whitespace-nowrap font-mono ${r.flagged ? 'font-semibold text-sun-700' : 'text-ink-muted'}`}
            title={r.flagged ? t('inventory.varianceFlag') : undefined}
          >
            {r.variancePct >= 0 ? '+' : ''}
            {r.variancePct.toFixed(0)}%
          </span>
        ),
    },
    {
      key: 'costOfUse',
      header: t('inventory.costOfUse'),
      align: 'right',
      sortValue: (r) => r.costOfUseCentavos ?? -1,
      render: (r) =>
        r.costOfUseCentavos === null ? (
          <span className="text-xs text-ink-muted">{t('inventory.noPrice')}</span>
        ) : (
          <span className="font-mono">{formatCentavos(r.costOfUseCentavos)}</span>
        ),
    },
    {
      key: 'spend',
      header: t('inventory.spend'),
      align: 'right',
      sortValue: (r) => r.spendCentavos,
      render: (r) => (
        <span className="font-mono text-ink-muted">
          {r.restocked > 0 || r.spendCentavos > 0 ? formatCentavos(r.spendCentavos) : '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold">{t('inventory.title')}</h1>
        {isOwner && (
          <Button
            className="!py-2"
            onClick={() => {
              setEditItem(null)
              setItemForm({ name: '', unit: 'kg', reorder: '', qty: '0' })
              setItemFormOpen(true)
            }}
          >
            + {t('inventory.add')}
          </Button>
        )}
      </div>

      {/* The period governs every usage figure in the table */}
      {isOwner && (
        <>
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
          <div className="font-mono text-xs text-ink-muted">
            {format(range.from, 'MMM d, yyyy')} – {format(range.to, 'MMM d, yyyy')}
          </div>
        </>
      )}

      <DataTable
        rows={rows}
        columns={isOwner ? [...stockColumns, ...usageColumns] : stockColumns}
        getRowKey={(r) => r.item.id}
        initialSortKey="onHand"
        initialSortDesc={false}
        onRowClick={(r) => setDetail(r.item)}
        emptyText={t('inventory.empty')}
        renderCard={(r) => {
          const low = isLowStock(r.item.currentQty, r.item.reorderPoint)
          const pct = Math.min(100, (r.item.currentQty / Math.max(r.item.reorderPoint * 3, 1)) * 100)
          return (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{r.item.name}</span>
                <span className={`whitespace-nowrap font-mono font-medium ${low ? 'text-danger-700' : ''}`}>
                  {r.item.currentQty} {r.item.unit}
                  {low && (
                    <span className="ml-2 rounded-pill bg-danger-500/10 px-2 py-0.5 text-xs font-semibold text-danger-700">
                      {t('inventory.lowStock')}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-pill bg-wash-deep">
                <div
                  className="h-full rounded-pill"
                  style={{ width: `${pct}%`, backgroundColor: low ? 'var(--danger-500)' : 'var(--accent-500)' }}
                />
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                {t('inventory.reorderPoint')}: {r.item.reorderPoint} {r.item.unit}
                {isOwner && (
                  <>
                    {' · '}
                    {t('inventory.used')} {r.used.toFixed(1)} {r.item.unit}
                    {r.costOfUseCentavos !== null ? ` · ${formatCentavos(r.costOfUseCentavos)}` : ''}
                    {r.flagged && r.variancePct !== null ? (
                      <span className="font-semibold text-sun-700">
                        {' · '}
                        {r.variancePct >= 0 ? '+' : ''}
                        {r.variancePct.toFixed(0)}%
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </>
          )
        }}
      />

      {isOwner && items.length > 0 && (
        <Card>
          <h2 className="mb-1 font-display text-base font-semibold">{t('inventory.usageReport')}</h2>
          <p className="text-xs text-ink-muted">{t('inventory.usageIntro')}</p>
          <p className="mt-1 text-xs text-ink-muted">{t('inventory.costBasis')}</p>
        </Card>
      )}

      {isOwner && (
        <div ref={rulesRef} className="flex flex-col gap-2 pt-1">
          <h2 className="font-display text-base font-semibold">{t('inventory.rules')}</h2>
          <p className="text-xs text-ink-muted">
            {t('inventory.rulesHelp')} {t('inventory.rulesPieceNote')}
          </p>
          <RulesMatrix
            services={servicesInOrder}
            items={items}
            rules={rules}
            onSave={(r) => currentUser && void saveExpectedUseRule(r, currentUser.id)}
            onDelete={(id) => currentUser && void deleteExpectedUseRule(id, currentUser.id)}
          />
        </div>
      )}

      {/* Item detail sheet */}
      <Sheet open={detailLive !== null} onClose={() => setDetail(null)} title={detailLive?.name ?? ''} wide>
        {detailLive && (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl font-medium">
                {detailLive.currentQty} {detailLive.unit}
              </span>
              {isOwner && (
                <Button
                  variant="ghost"
                  className="!py-1.5 text-sm"
                  onClick={() => {
                    setEditItem(detailLive)
                    setItemForm({
                      name: detailLive.name,
                      unit: detailLive.unit,
                      reorder: String(detailLive.reorderPoint),
                      qty: String(detailLive.currentQty),
                    })
                    setItemFormOpen(true)
                  }}
                >
                  {t('orders.edit')}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" onClick={() => setMoveOpen('in')}>
                {t('inventory.stockIn')}
              </Button>
              <Button variant="secondary" onClick={() => setMoveOpen('out')}>
                {t('inventory.stockOut')}
              </Button>
              <Button variant="secondary" onClick={() => setMoveOpen('recount')}>
                {t('inventory.recount')}
              </Button>
            </div>

            <h3 className="font-display text-base font-semibold">{t('inventory.history')}</h3>
            <div className="flex flex-col gap-1 text-sm">
              {[...detailMoves].reverse().map((m, ri) => {
                const i = detailMoves.length - 1 - ri
                return (
                  <div key={m.id} className="flex justify-between border-b border-line py-1.5 last:border-0">
                    <span>
                      <span
                        className={`mr-2 font-mono font-medium ${
                          m.type === 'in' ? 'text-accent-700' : m.type === 'out' ? 'text-danger-700' : 'text-sun-700'
                        }`}
                      >
                        {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '±'}
                        {Math.abs(m.qty)}
                      </span>
                      {m.reason ?? m.type}
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      = {detailBalances[i]?.toFixed(1)} · {fmtDateTime(m.at)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Sheet>

      {/* Move sheet */}
      <Sheet
        open={moveOpen !== null}
        onClose={() => setMoveOpen(null)}
        title={moveOpen === 'in' ? t('inventory.stockIn') : moveOpen === 'out' ? t('inventory.stockOut') : t('inventory.recount')}
      >
        <div className="flex flex-col gap-3">
          <Field label={moveOpen === 'recount' ? t('inventory.countedQty') : t('inventory.qty')}>
            <Input
              inputMode="decimal"
              type="number"
              min="0"
              step="0.1"
              className="font-mono !text-xl"
              value={moveForm.qty}
              onChange={(e) => setMoveForm((f) => ({ ...f, qty: e.target.value }))}
            />
          </Field>
          {moveOpen === 'in' && (
            <>
              <Field label={t('inventory.unitCost')}>
                <Input inputMode="decimal" className="font-mono" value={moveForm.cost} onChange={(e) => setMoveForm((f) => ({ ...f, cost: e.target.value }))} />
              </Field>
              <Field label={t('inventory.supplier')}>
                <Input value={moveForm.supplier} onChange={(e) => setMoveForm((f) => ({ ...f, supplier: e.target.value }))} />
              </Field>
            </>
          )}
          {moveOpen === 'out' && (
            <Field label={t('inventory.reason')}>
              <Input value={moveForm.reason} onChange={(e) => setMoveForm((f) => ({ ...f, reason: e.target.value }))} />
            </Field>
          )}
          <Button disabled={moveForm.qty === ''} onClick={() => void submitMove()}>
            {t('common.save')}
          </Button>
        </div>
      </Sheet>

      {/* Item add/edit sheet */}
      <Sheet open={itemFormOpen} onClose={() => setItemFormOpen(false)} title={editItem ? t('orders.edit') : t('inventory.add')}>
        <div className="flex flex-col gap-3">
          <Field label={t('inventory.name')}>
            <Input value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label={t('inventory.unit')}>
            <div className="flex gap-2">
              {UNITS.map((u) => (
                <Chip key={u} selected={itemForm.unit === u} onClick={() => setItemForm((f) => ({ ...f, unit: u }))}>
                  {u}
                </Chip>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {!editItem && (
              <Field label={t('inventory.qty')}>
                <Input inputMode="decimal" type="number" min="0" className="font-mono" value={itemForm.qty} onChange={(e) => setItemForm((f) => ({ ...f, qty: e.target.value }))} />
              </Field>
            )}
            <Field label={t('inventory.reorderPoint')}>
              <Input inputMode="decimal" type="number" min="0" className="font-mono" value={itemForm.reorder} onChange={(e) => setItemForm((f) => ({ ...f, reorder: e.target.value }))} />
            </Field>
          </div>
          <Button disabled={!itemForm.name.trim()} onClick={() => void submitItem()}>
            {t('common.save')}
          </Button>
        </div>
      </Sheet>

    </div>
  )
}
