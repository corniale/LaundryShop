import { describe, it, expect } from 'vitest'
import {
  orderKilos,
  orderBilledKilos,
  orderItemCount,
  orderServiceLabel,
  orderHasService,
  kilosForService,
  itemCountForService,
  serviceIncomeCentavos,
} from './orders'
import type { OrderLine } from '../data/types'

const line = (over: Partial<OrderLine> = {}): OrderLine => ({
  serviceId: 'wdf',
  serviceNameSnapshot: 'Wash, Dry & Fold',
  pricePerKgSnapshot: 4500,
  kilos: 6,
  billedKilos: 6,
  lineTotalCentavos: 27000,
  ...over,
})

const dryClean = line({
  serviceId: 'dc',
  serviceNameSnapshot: 'Dry Clean',
  pricePerKgSnapshot: 12000,
  kilos: 2,
  billedKilos: 2,
  lineTotalCentavos: 24000,
})

describe('order totals across services', () => {
  it('sums kilos over every line', () => {
    expect(orderKilos({ lines: [line(), dryClean] })).toBe(8)
  })

  it('does not let decimal kilos drift', () => {
    const o = { lines: [line({ kilos: 0.1 }), line({ kilos: 0.2 })] }
    expect(orderKilos(o)).toBe(0.3)
  })

  it('separates dropped-off kilos from billed kilos', () => {
    const o = { lines: [line({ kilos: 1, billedKilos: 4 }), dryClean] }
    expect(orderKilos(o)).toBe(3)
    expect(orderBilledKilos(o)).toBe(6)
  })

  it('counts pieces only when someone counted them', () => {
    expect(orderItemCount({ lines: [line(), dryClean] })).toBeUndefined()
    expect(orderItemCount({ lines: [line({ itemCount: 12 }), dryClean] })).toBe(12)
    expect(orderItemCount({ lines: [line({ itemCount: 12 }), { ...dryClean, itemCount: 3 }] })).toBe(15)
  })
})

describe('naming the services in a list', () => {
  it('reads as itself for one service and joins two', () => {
    expect(orderServiceLabel({ lines: [line()] })).toBe('Wash, Dry & Fold')
    expect(orderServiceLabel({ lines: [line(), dryClean] })).toBe('Wash, Dry & Fold + Dry Clean')
  })

  it('turns a long tail into a count rather than a wall of names', () => {
    const third = line({ serviceId: 'p', serviceNameSnapshot: 'Press Only' })
    expect(orderServiceLabel({ lines: [line(), dryClean, third] })).toBe('Wash, Dry & Fold +2')
  })

  it('says something for an order with no lines at all', () => {
    expect(orderServiceLabel({ lines: [] })).toBe('—')
  })
})

describe('attributing an order to one of its services', () => {
  const both = { lines: [line({ itemCount: 12 }), { ...dryClean, itemCount: 3 }] }

  it('knows which services an order contains', () => {
    expect(orderHasService(both, 'dc')).toBe(true)
    expect(orderHasService(both, 'nope')).toBe(false)
  })

  it('splits kilos, pieces and money by service', () => {
    expect(kilosForService(both, 'wdf')).toBe(6)
    expect(kilosForService(both, 'dc')).toBe(2)
    expect(itemCountForService(both, 'dc')).toBe(3)
    expect(serviceIncomeCentavos(both, 'wdf')).toBe(27000)
    expect(serviceIncomeCentavos(both, 'dc')).toBe(24000)
  })

  it('returns nothing for a service the order does not contain', () => {
    expect(kilosForService(both, 'nope')).toBe(0)
    expect(serviceIncomeCentavos(both, 'nope')).toBe(0)
  })
})
