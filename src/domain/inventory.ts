/**
 * Inventory logic. Stock only ever changes through a human-recorded move.
 * ExpectedUseRule is REPORTING ONLY and never touches quantities.
 * Pure, no React, no Dexie.
 */
import type { InventoryMove, InventoryMoveType, UseBasis } from '../data/types'

/** Signed effect of a move on stock. */
export function moveDelta(type: InventoryMoveType, qty: number): number {
  switch (type) {
    case 'in':
      return qty
    case 'out':
      return -qty
    case 'adjust':
    case 'auto':
      return qty // adjust stores the signed delta directly
  }
}

/** A recount writes a single adjust move equal to counted − recorded. */
export function recountDelta(recordedQty: number, countedQty: number): number {
  return countedQty - recordedQty
}

/** Replay moves to a running balance (for the history view). */
export function runningBalances(moves: InventoryMove[], startQty = 0): number[] {
  const balances: number[] = []
  let qty = startQty
  for (const m of moves) {
    qty += moveDelta(m.type, m.qty)
    balances.push(qty)
  }
  return balances
}

export function isLowStock(currentQty: number, reorderPoint: number): boolean {
  return currentQty <= reorderPoint
}

/**
 * The price the shop last paid for this item. Used to put a peso figure on
 * what was consumed — a shop buys at whatever today's price is, so the most
 * recent purchase is the honest basis. Null when nothing was ever bought
 * with a recorded cost.
 */
export function latestUnitCostCentavos(moves: InventoryMove[]): number | null {
  let latest: InventoryMove | null = null
  for (const m of moves) {
    if (m.type !== 'in' || m.unitCostCentavos === undefined) continue
    if (latest === null || new Date(m.at) > new Date(latest.at)) latest = m
  }
  return latest?.unitCostCentavos ?? null
}

/** What the consumed stock was worth. Null when the item has no known price. */
export function usageCostCentavos(usedQty: number, unitCostCentavos: number | null): number | null {
  if (unitCostCentavos === null) return null
  return Math.round(usedQty * unitCostCentavos)
}

/**
 * How much of the basis one order carries. A piece rule can only count
 * orders where someone entered a piece count; one with none contributes
 * nothing rather than guessing a number.
 */
export function basisUnits(order: { kilos: number; itemCount?: number }, basis: UseBasis): number {
  switch (basis) {
    case 'kg':
      return order.kilos
    case 'piece':
      return order.itemCount ?? 0
    case 'order':
      return 1
  }
}

/** Expected consumption for one rule across a set of orders. Reporting only. */
export function expectedQty(
  orders: Array<{ kilos: number; itemCount?: number }>,
  basis: UseBasis,
  qtyPer: number,
): number {
  return orders.reduce((sum, o) => sum + basisUnits(o, basis) * qtyPer, 0)
}

export interface UsageComparison {
  expectedQty: number
  actualQty: number
  variancePct: number | null
  flagged: boolean
}

/**
 * Expected vs actual usage for the report. `kilosWashed` comes from orders,
 * `actualQty` from human-recorded 'out' moves. Never writes anything.
 */
export function compareUsage(
  kilosWashed: number,
  qtyPerKg: number,
  actualQty: number,
  flagThresholdPct = 25,
): UsageComparison {
  const expectedQty = kilosWashed * qtyPerKg
  const variancePct =
    expectedQty > 0 ? ((actualQty - expectedQty) / expectedQty) * 100 : null
  const flagged = variancePct !== null && Math.abs(variancePct) > flagThresholdPct
  return { expectedQty, actualQty, variancePct, flagged }
}
