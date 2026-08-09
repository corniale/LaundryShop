import { describe, it, expect } from 'vitest'
import {
  moveDelta,
  recountDelta,
  runningBalances,
  compareUsage,
  isLowStock,
  latestUnitCostCentavos,
  usageCostCentavos,
} from './inventory'
import type { InventoryMove } from '../data/types'

const move = (type: InventoryMove['type'], qty: number): InventoryMove => ({
  id: Math.random().toString(36).slice(2),
  itemId: 'i1',
  type,
  qty,
  at: '2026-08-01T00:00:00.000Z',
  byUserId: 'u1',
})

describe('inventory moves', () => {
  it('recount writes a single delta equal to counted − recorded (acceptance #20)', () => {
    expect(recountDelta(19.5, 14.0)).toBeCloseTo(-5.5)
    expect(recountDelta(10, 12)).toBe(2)
  })

  it('history reconciles to the balance after a recount', () => {
    const moves = [move('in', 10), move('out', 3), move('adjust', -2)]
    const balances = runningBalances(moves)
    expect(balances).toEqual([10, 7, 5])
  })

  it('signed deltas per type', () => {
    expect(moveDelta('in', 5)).toBe(5)
    expect(moveDelta('out', 5)).toBe(-5)
    expect(moveDelta('adjust', -2)).toBe(-2)
  })

  it('low stock at or below reorder point', () => {
    expect(isLowStock(40, 50)).toBe(true)
    expect(isLowStock(50, 50)).toBe(true)
    expect(isLowStock(51, 50)).toBe(false)
  })
})

describe('expected vs actual (reporting only, acceptance #21)', () => {
  it('shows expected/actual and flags variance beyond ±25%', () => {
    // 640 kg washed, 0.02 kg/kg detergent, 19.0 actual → +48%, flagged
    const c = compareUsage(640, 0.02, 19.0)
    expect(c.expectedQty).toBeCloseTo(12.8)
    expect(c.variancePct).toBeCloseTo(48.4, 0)
    expect(c.flagged).toBe(true)
  })

  it('does not flag inside the band', () => {
    const c = compareUsage(640, 0.02, 13.5)
    expect(c.flagged).toBe(false)
  })

  it('handles zero expected', () => {
    const c = compareUsage(0, 0.02, 5)
    expect(c.variancePct).toBeNull()
    expect(c.flagged).toBe(false)
  })
})

describe('costing what was used', () => {
  const buy = (at: string, unitCostCentavos?: number): InventoryMove => ({
    id: Math.random().toString(36).slice(2),
    itemId: 'i1',
    type: 'in',
    qty: 10,
    at,
    byUserId: 'u1',
    unitCostCentavos,
  })

  it('takes the most recent purchase price, whatever order the moves are in', () => {
    const moves = [buy('2026-07-01T00:00:00.000Z', 12000), buy('2026-08-01T00:00:00.000Z', 13500)]
    expect(latestUnitCostCentavos(moves)).toBe(13500)
    expect(latestUnitCostCentavos([...moves].reverse())).toBe(13500)
  })

  it('ignores purchases with no recorded cost, and every non-purchase move', () => {
    expect(latestUnitCostCentavos([buy('2026-08-05T00:00:00.000Z'), buy('2026-07-01T00:00:00.000Z', 12000)])).toBe(12000)
    expect(latestUnitCostCentavos([move('out', 5), move('adjust', -2)])).toBeNull()
    expect(latestUnitCostCentavos([])).toBeNull()
  })

  it('values usage at that price, in whole centavos', () => {
    expect(usageCostCentavos(12.5, 13500)).toBe(168750)
    expect(usageCostCentavos(0.333, 10000)).toBe(3330)
    expect(usageCostCentavos(12.5, null)).toBeNull()
  })
})
