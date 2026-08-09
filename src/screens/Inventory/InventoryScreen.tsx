/**
 * Inventory — stock on hand, human-recorded moves only. Expected-use rules
 * are reporting only and NEVER touch quantities.
 *
 * Stock and usage share one table because they describe the same thing: what
 * is left, what left the shelf over the chosen period, and what that cost.
 * Splitting them into two stacked lists of the same items made the reader
 * match up names by eye.
 */
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { db } from '../../data/db'
import type { InventoryItem, InventoryUnit } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos, parsePesosInput } from '../../domain/money'
import {
  runningBalances,
  compareUsage,
  isLowStock,
  latestUnitCostCentavos,
  usageCostCentavos,
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

const UNITS: InventoryUnit[] = ['kg', 'L', 'pc', 'pack']
type Preset = 'today' | 'week' | 'month' | 'custom'

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
  const items = useLiveQuery(() => db.inventoryItems.filter((i) => i.active).toArray(), []) ?? []
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
  const [ruleOpen, setRuleOpen] = useState(false)
  const [ruleForm, setRuleForm] = useState({ serviceId: '', itemId: '', qtyPerKg: '' })

  const detailLive = items.find((i) => i.id === detail?.id) ?? detail

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
          const kilos = orders
            .filter((o) => !o.voidedAt && o.serviceId === rule.serviceId && inRange(o.receivedAt, from, to))
            .reduce((s, o) => s + o.kilos, 0)
          expected += kilos * rule.qtyPerKg
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

  function openRulesFor(itemId: string) {
    setRuleForm({ serviceId: '', itemId, qtyPerKg: '' })
    setRuleOpen(true)
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
              openRulesFor(r.item.id)
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
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">{t('inventory.usageReport')}</h2>
            <Button variant="ghost" className="!py-1.5 text-sm" onClick={() => setRuleOpen(true)}>
              {t('inventory.rules')}
            </Button>
          </div>
          <p className="text-xs text-ink-muted">{t('inventory.usageIntro')}</p>
          <p className="mt-1 text-xs text-ink-muted">{t('inventory.costBasis')}</p>
        </Card>
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

      {/* Expected-use rules sheet */}
      <Sheet open={ruleOpen} onClose={() => setRuleOpen(false)} title={t('inventory.rules')}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">{t('inventory.expectedNote')}</p>

          <div>
            <div className="label-caps mb-1">{t('inventory.ruleExisting')}</div>
            {rules.length === 0 ? (
              <p className="text-sm text-ink-muted">{t('inventory.ruleNone')}</p>
            ) : (
              <div className="flex flex-col gap-1">
                {rules.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 border-b border-line py-1.5 last:border-0">
                    <span className="min-w-0 text-sm">
                      {services.find((s) => s.id === r.serviceId)?.name} → {items.find((i) => i.id === r.itemId)?.name}
                      <span className="ml-2 font-mono">{r.qtyPerKg}/kg</span>
                    </span>
                    <button
                      className="min-h-touch min-w-touch shrink-0 text-danger-700"
                      aria-label={t('common.delete')}
                      onClick={() => currentUser && void deleteExpectedUseRule(r.id, currentUser.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-card bg-wash-deep p-3">
            <div className="label-caps">{t('inventory.ruleAdd')}</div>
            <Field label={t('orders.service')}>
              <Select value={ruleForm.serviceId} onChange={(e) => setRuleForm((f) => ({ ...f, serviceId: e.target.value }))}>
                <option value="">—</option>
                {services
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t('inventory.item')}>
              <Select value={ruleForm.itemId} onChange={(e) => setRuleForm((f) => ({ ...f, itemId: e.target.value }))}>
                <option value="">—</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('inventory.qtyPerKg')}>
              <Input
                inputMode="decimal"
                type="number"
                min="0"
                step="0.001"
                className="font-mono"
                value={ruleForm.qtyPerKg}
                onChange={(e) => setRuleForm((f) => ({ ...f, qtyPerKg: e.target.value }))}
              />
            </Field>
            <Button
              variant="secondary"
              disabled={!ruleForm.serviceId || !ruleForm.itemId || !ruleForm.qtyPerKg}
              onClick={async () => {
                if (!currentUser) return
                await saveExpectedUseRule(
                  { serviceId: ruleForm.serviceId, itemId: ruleForm.itemId, qtyPerKg: Number(ruleForm.qtyPerKg) },
                  currentUser.id,
                )
                setRuleForm((f) => ({ serviceId: '', itemId: f.itemId, qtyPerKg: '' }))
              }}
            >
              {t('common.add')}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
