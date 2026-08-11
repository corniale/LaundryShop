// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { orderCsvRows, ORDER_CSV_HEADER } from './ordersCsv'
import type { Order, OrderLine, Payment } from '../data/types'

const at = '2026-08-08T09:00:00.000Z'

function line(name: string, kilos: number, total: number, extra: Partial<OrderLine> = {}): OrderLine {
  return {
    serviceId: name,
    serviceNameSnapshot: name,
    pricePerKgSnapshot: 3500,
    kilos,
    billedKilos: kilos,
    lineTotalCentavos: total,
    ...extra,
  }
}

function order(over: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    code: 'ORD-1001',
    lines: [line('Wash & Fold', 5, 17500)],
    addOns: [],
    discountCentavos: 0,
    subtotalCentavos: 17500,
    totalCentavos: 17500,
    status: 'received',
    receivedAt: at,
    promisedAt: '2026-08-09T10:00:00.000Z',
    createdBy: 'u1',
    updatedAt: at,
    ...over,
  }
}

const col = (row: Array<string | number>, name: string) => row[ORDER_CSV_HEADER.indexOf(name)]

describe('orderCsvRows', () => {
  it('gives a two-service order one row per service', () => {
    const rows = orderCsvRows([
      {
        order: order({
          lines: [line('Wash & Fold', 5, 17500), line('Dry Clean', 2, 24000)],
          subtotalCentavos: 41500,
          totalCentavos: 41500,
        }),
        customerName: 'Maria Santos',
        payments: [],
      },
    ])
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => col(r, 'Service'))).toEqual(['Wash & Fold', 'Dry Clean'])
    // Both rows name the same order, so the code still groups them.
    expect(rows.every((r) => col(r, 'Order') === 'ORD-1001')).toBe(true)
    expect(rows.map((r) => col(r, 'Line total'))).toEqual(['175.00', '240.00'])
  })

  it('writes order-level money on the first row only, so a column sums once', () => {
    const rows = orderCsvRows([
      {
        order: order({
          lines: [line('Wash & Fold', 5, 17500), line('Dry Clean', 2, 24000)],
          addOns: [{ label: 'Plastic bag', amountCentavos: 1000 }],
          discountCentavos: 2000,
          totalCentavos: 40500,
        }),
        customerName: 'Maria Santos',
        payments: [],
      },
    ])
    expect(col(rows[0], 'Order total')).toBe('405.00')
    expect(col(rows[1], 'Order total')).toBe('')
    expect(col(rows[1], 'Add-ons')).toBe('')
    expect(col(rows[1], 'Discount')).toBe('')

    // Line totals + add-ons − discount = order total, as the header promises.
    const lineSum = rows.reduce((s, r) => s + Number(col(r, 'Line total') || 0), 0)
    expect(lineSum + Number(col(rows[0], 'Add-ons')) - Number(col(rows[0], 'Discount'))).toBeCloseTo(405)
  })

  it('carries payment state and lists the add-ons that were charged', () => {
    const payments: Payment[] = [
      { id: 'p1', orderId: 'o1', amountCentavos: 10000, method: 'cash', receivedAt: at, byUserId: 'u1', updatedAt: at },
    ]
    const rows = orderCsvRows([
      {
        order: order({
          addOns: [
            { addOnTypeId: 'a1', label: 'Plastic bag', amountCentavos: 1000 },
            { label: 'Delivery', amountCentavos: 4000 },
          ],
          totalCentavos: 22500,
        }),
        customerName: 'Maria Santos',
        payments,
      },
    ])
    expect(col(rows[0], 'Paid')).toBe('100.00')
    expect(col(rows[0], 'Balance')).toBe('125.00')
    expect(col(rows[0], 'Add-on detail')).toBe('Plastic bag 10.00; Delivery 40.00')
  })

  it('marks a voided order and keeps dates spreadsheet-readable', () => {
    const rows = orderCsvRows([
      { order: order({ voidedAt: at, voidReason: 'Duplicate' }), customerName: 'Walk-in', payments: [] },
    ])
    expect(col(rows[0], 'Status')).toBe('void')
    expect(col(rows[0], 'Received')).toBe('2026-08-08')
    expect(col(rows[0], 'Promised')).toBe('2026-08-09')
  })

  it('still emits a row for an order with no lines', () => {
    const rows = orderCsvRows([{ order: order({ lines: [] }), customerName: 'Walk-in', payments: [] }])
    expect(rows).toHaveLength(1)
    expect(col(rows[0], 'Service')).toBe('')
    expect(col(rows[0], 'Order total')).toBe('175.00')
  })
})
