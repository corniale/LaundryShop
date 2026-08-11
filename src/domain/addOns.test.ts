// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addOnKey, addOnTotals, deriveAddOnTypes } from './addOns'

let counter = 0
const nextId = () => `id${++counter}`
const at = '2026-08-08T09:00:00.000Z'

describe('addOnKey', () => {
  it('folds hand-typed labels together and keeps catalogue entries apart', () => {
    expect(addOnKey({ label: ' Plastic Bag ', amountCentavos: 1000 })).toBe(
      addOnKey({ label: 'plastic bag', amountCentavos: 1500 }),
    )
    expect(addOnKey({ addOnTypeId: 'a1', label: 'Bag', amountCentavos: 1000 })).not.toBe(
      addOnKey({ addOnTypeId: 'a2', label: 'Bag', amountCentavos: 1000 }),
    )
  })
})

describe('addOnTotals', () => {
  it('counts and sums by add-on, biggest earner first', () => {
    const totals = addOnTotals([
      { addOns: [{ addOnTypeId: 'a1', label: 'Plastic bag', amountCentavos: 1000 }] },
      { addOns: [{ addOnTypeId: 'a1', label: 'Plastic bag', amountCentavos: 1000 }] },
      { addOns: [{ label: 'Rush', amountCentavos: 5000 }] },
    ])
    expect(totals.map((x) => [x.name, x.count, x.incomeCentavos])).toEqual([
      ['Rush', 1, 5000],
      ['Plastic bag', 2, 2000],
    ])
  })

  it('reports a renamed catalogue entry under its current name', () => {
    const totals = addOnTotals(
      [{ addOns: [{ addOnTypeId: 'a1', label: 'Plastik', amountCentavos: 1000 }] }],
      [{ id: 'a1', name: 'Plastic bag', defaultAmountCentavos: 1000, active: true, sortOrder: 0, updatedAt: at }],
    )
    expect(totals[0].name).toBe('Plastic bag')
  })
})

describe('deriveAddOnTypes', () => {
  it('builds one entry per label, at the commonest price, commonest first', () => {
    counter = 0
    const types = deriveAddOnTypes(
      [
        { addOns: [{ label: 'Plastic bag', amountCentavos: 1000 }] },
        { addOns: [{ label: 'plastic bag', amountCentavos: 1000 }] },
        { addOns: [{ label: 'Plastic bag', amountCentavos: 1500 }] },
        { addOns: [{ label: 'Delivery', amountCentavos: 4000 }] },
      ],
      nextId,
      at,
    )
    expect(types.map((x) => [x.name, x.defaultAmountCentavos, x.sortOrder])).toEqual([
      ['Plastic bag', 1000, 0],
      ['Delivery', 4000, 1],
    ])
    expect(types.every((x) => x.active)).toBe(true)
  })

  it('breaks a price tie towards the higher amount', () => {
    counter = 0
    const types = deriveAddOnTypes(
      [
        { addOns: [{ label: 'Rush', amountCentavos: 5000 }] },
        { addOns: [{ label: 'Rush', amountCentavos: 7500 }] },
      ],
      nextId,
      at,
    )
    expect(types[0].defaultAmountCentavos).toBe(7500)
  })

  it('ignores blank labels and returns nothing for a shop that never used add-ons', () => {
    counter = 0
    expect(deriveAddOnTypes([{ addOns: [] }, { addOns: [{ label: '  ', amountCentavos: 0 }] }], nextId, at)).toEqual([])
  })
})
