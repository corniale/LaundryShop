/**
 * Add-ons: the flat charges that ride along with a visit. Free text was
 * enough to put a number on a receipt, but "Plastic bag", "plastic bag" and
 * "Plastik" are three rows in a report and one thing in the shop, so an
 * add-on may now point at a catalogue entry. Everything here is pure.
 */
import type { AddOnType, OrderAddOn } from '../data/types'

/**
 * How two add-ons are judged to be the same thing. A catalogue entry is
 * itself; anything typed by hand falls back to its label, folded so that
 * capitals and stray spaces do not split a row in two.
 */
export function addOnKey(addOn: OrderAddOn): string {
  return addOn.addOnTypeId ?? `label:${addOn.label.trim().toLowerCase()}`
}

export interface AddOnTotal {
  key: string
  name: string
  count: number
  incomeCentavos: number
}

/** What each add-on earned across a set of orders, biggest earner first. */
export function addOnTotals(
  orders: Array<{ addOns: OrderAddOn[] }>,
  types: AddOnType[] = [],
): AddOnTotal[] {
  const nameById = new Map(types.map((t) => [t.id, t.name]))
  const map = new Map<string, AddOnTotal>()
  for (const order of orders) {
    for (const addOn of order.addOns) {
      const key = addOnKey(addOn)
      const cur =
        map.get(key) ??
        // A renamed catalogue entry wins over the label frozen into the
        // order: the report is about the shop today, not about last month.
        { key, name: nameById.get(addOn.addOnTypeId ?? '') ?? addOn.label.trim(), count: 0, incomeCentavos: 0 }
      cur.count += 1
      cur.incomeCentavos += addOn.amountCentavos
      map.set(key, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.incomeCentavos - a.incomeCentavos || a.name.localeCompare(b.name))
}

/**
 * Build a starting catalogue out of add-ons a shop has already been typing.
 * Run by both the v4 database upgrade and the restore of an older backup, so
 * a shop that has been open for months arrives with its own chips already in
 * place instead of an empty list and an invitation to start over.
 *
 * One entry per distinct label, priced at whatever that label was charged
 * most often, ordered by how often it was used.
 */
export function deriveAddOnTypes(
  orders: Array<{ addOns: OrderAddOn[] }>,
  makeId: () => string,
  at: string,
): AddOnType[] {
  const groups = new Map<string, { label: string; count: number; amounts: Map<number, number> }>()
  for (const order of orders) {
    for (const addOn of order.addOns) {
      const label = addOn.label.trim()
      if (!label) continue
      const key = label.toLowerCase()
      const group = groups.get(key) ?? { label, count: 0, amounts: new Map<number, number>() }
      group.count += 1
      group.amounts.set(addOn.amountCentavos, (group.amounts.get(addOn.amountCentavos) ?? 0) + 1)
      groups.set(key, group)
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((group, i) => ({
      id: makeId(),
      name: group.label,
      // The commonest price wins; ties go to the higher one, which is the
      // safer thing to have prefilled — too high gets noticed at the counter.
      defaultAmountCentavos: [...group.amounts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0],
      active: true,
      sortOrder: i,
      updatedAt: at,
    }))
}
