/**
 * Inventory — stock on hand, human-recorded moves only. Expected-use rules
 * are reporting only and NEVER touch quantities.
 */
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { InventoryItem, InventoryUnit } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos, parsePesosInput } from '../../domain/money'
import { runningBalances, compareUsage, isLowStock } from '../../domain/inventory'
import {
  saveInventoryItem,
  recordStockMove,
  recountStock,
  saveExpectedUseRule,
  deleteExpectedUseRule,
} from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { Card, Button, Sheet, Field, Input, Chip, EmptyState } from '../../components/ui'
import { fmtDateTime, monthRange, inRange } from '../../app/format'

const UNITS: InventoryUnit[] = ['kg', 'L', 'pc', 'pack']

export function InventoryScreen() {
  const toast = useToast()
  const { currentUser, isOwner } = useAuth()
  const items = useLiveQuery(() => db.inventoryItems.filter((i) => i.active).toArray(), []) ?? []
  const moves = useLiveQuery(() => db.inventoryMoves.toArray(), []) ?? []
  const orders = useLiveQuery(() => db.orders.toArray(), []) ?? []
  const services = useLiveQuery(() => db.services.toArray(), []) ?? []
  const rules = useLiveQuery(() => db.expectedUseRules.toArray(), []) ?? []

  const [detail, setDetail] = useState<InventoryItem | null>(null)
  const [moveOpen, setMoveOpen] = useState<'in' | 'out' | 'recount' | null>(null)
  const [moveForm, setMoveForm] = useState({ qty: '', cost: '', supplier: '', reason: '' })
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [itemForm, setItemForm] = useState({ name: '', unit: 'kg' as InventoryUnit, reorder: '', qty: '0' })
  const [ruleOpen, setRuleOpen] = useState(false)
  const [ruleForm, setRuleForm] = useState({ serviceId: '', itemId: '', qtyPerKg: '' })

  const detailLive = items.find((i) => i.id === detail?.id) ?? detail

  const detailMoves = useMemo(
    () => (detailLive ? moves.filter((m) => m.itemId === detailLive.id).sort((a, b) => a.at.localeCompare(b.at)) : []),
    [moves, detailLive],
  )
  const detailBalances = useMemo(() => runningBalances(detailMoves), [detailMoves])

  // ── Monthly usage report ──
  const { from, to } = monthRange()
  const usageReport = useMemo(() => {
    return items.map((item) => {
      const monthOut = moves
        .filter((m) => m.itemId === item.id && m.type === 'out' && inRange(m.at, from, to))
        .reduce((s, m) => s + m.qty, 0)
      const monthInCost = moves
        .filter((m) => m.itemId === item.id && m.type === 'in' && inRange(m.at, from, to))
        .reduce((s, m) => s + m.qty * (m.unitCostCentavos ?? 0), 0)
      // expected-use comparison — reporting only
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
      const comparison = expected !== null ? compareUsage(1, expected, monthOut) : null
      return { item, monthOut, monthInCost, expected, comparison }
    })
  }, [items, moves, rules, orders, from, to])

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

      {items.length === 0 ? (
        <EmptyState>{t('inventory.empty')}</EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const low = isLowStock(item.currentQty, item.reorderPoint)
            const pct = Math.min(100, (item.currentQty / Math.max(item.reorderPoint * 3, 1)) * 100)
            return (
              <Card key={item.id} onClick={() => setDetail(item)}>
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{item.name}</span>
                  <span className={`font-mono font-medium ${low ? 'text-danger-700' : ''}`}>
                    {item.currentQty} {item.unit}
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
                    style={{
                      width: `${pct}%`,
                      backgroundColor: low ? 'var(--danger-500)' : 'var(--accent-500)',
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-ink-muted">
                  {t('inventory.reorderPoint')}: {item.reorderPoint} {item.unit}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Usage & cost report */}
      {isOwner && items.length > 0 && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">{t('inventory.usageReport')}</h2>
            <Button variant="ghost" className="!py-1.5 text-sm" onClick={() => setRuleOpen(true)}>
              {t('inventory.rules')}
            </Button>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            {usageReport.map(({ item, monthOut, monthInCost, expected, comparison }) => (
              <div key={item.id} className="border-b border-line pb-2 last:border-0">
                <div className="flex justify-between">
                  <span className="font-medium">{item.name}</span>
                  <span className="font-mono">
                    {monthOut.toFixed(1)} {item.unit} · {formatCentavos(monthInCost)}
                  </span>
                </div>
                {expected !== null && comparison && (
                  <div className={`text-xs ${comparison.flagged ? 'font-semibold text-sun-700' : 'text-ink-muted'}`}>
                    {t('inventory.expected')}: ~{expected.toFixed(1)} {item.unit} · {t('inventory.actual')}: {monthOut.toFixed(1)}{' '}
                    {item.unit}
                    {comparison.variancePct !== null &&
                      ` (${comparison.variancePct >= 0 ? '+' : ''}${comparison.variancePct.toFixed(0)}%)`}
                    {comparison.flagged && ` — ${t('inventory.varianceFlag')}`}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">{t('inventory.expectedNote')}</p>
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
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-input bg-surface p-3 shadow-card">
              <span className="text-sm">
                {services.find((s) => s.id === r.serviceId)?.name} → {items.find((i) => i.id === r.itemId)?.name}
                <span className="ml-2 font-mono">{r.qtyPerKg}/kg</span>
              </span>
              <button
                className="min-h-touch min-w-touch text-danger-700"
                aria-label={t('common.delete')}
                onClick={() => currentUser && void deleteExpectedUseRule(r.id, currentUser.id)}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex flex-col gap-2 rounded-card bg-wash-deep p-3">
            <select
              className="min-h-touch rounded-input border border-line bg-surface px-3"
              value={ruleForm.serviceId}
              onChange={(e) => setRuleForm((f) => ({ ...f, serviceId: e.target.value }))}
            >
              <option value="">{t('orders.service')}…</option>
              {services.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="min-h-touch rounded-input border border-line bg-surface px-3"
              value={ruleForm.itemId}
              onChange={(e) => setRuleForm((f) => ({ ...f, itemId: e.target.value }))}
            >
              <option value="">{t('inventory.name')}…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
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
                setRuleForm({ serviceId: '', itemId: '', qtyPerKg: '' })
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
