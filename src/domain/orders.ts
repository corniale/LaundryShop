/**
 * Everything an order's lines add up to. An order holds one line per
 * service, so the figures screens used to read straight off the order —
 * kilos, the service name, the piece count — are now derivations, and they
 * live here rather than being re-summed slightly differently in each screen.
 * Pure: no React, no Dexie.
 */
import type { Order, OrderLine } from '../data/types'

/** Kilos actually dropped off, across every service in the order. */
export function orderKilos(order: { lines: OrderLine[] }): number {
  // Rounded to 3 dp: summing 0.1-style decimals otherwise shows 4.300000001.
  return Math.round(order.lines.reduce((sum, l) => sum + l.kilos, 0) * 1000) / 1000
}

/** Kilos charged for, which is higher than the above when a minimum applied. */
export function orderBilledKilos(order: { lines: OrderLine[] }): number {
  return Math.round(order.lines.reduce((sum, l) => sum + l.billedKilos, 0) * 1000) / 1000
}

/** Total pieces, or undefined when nobody counted any. */
export function orderItemCount(order: { lines: OrderLine[] }): number | undefined {
  const counted = order.lines.filter((l) => l.itemCount !== undefined)
  if (counted.length === 0) return undefined
  return counted.reduce((sum, l) => sum + (l.itemCount ?? 0), 0)
}

/**
 * What to call the order's services in a list. One service reads as itself;
 * two fit side by side; beyond that the tail becomes a count, because a
 * table column is not the place to enumerate five names.
 */
export function orderServiceLabel(order: { lines: OrderLine[] }): string {
  const names = order.lines.map((l) => l.serviceNameSnapshot)
  if (names.length === 0) return '—'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} + ${names[1]}`
  return `${names[0]} +${names.length - 1}`
}

/** Sort key for a service column: the first name, then the rest. */
export function orderServiceSortKey(order: { lines: OrderLine[] }): string {
  return order.lines
    .map((l) => l.serviceNameSnapshot.toLowerCase())
    .join(' ')
}

export function orderHasService(order: { lines: OrderLine[] }, serviceId: string): boolean {
  return order.lines.some((l) => l.serviceId === serviceId)
}

/** Kilos of one service inside an order — what an expected-use rule bills against. */
export function kilosForService(order: { lines: OrderLine[] }, serviceId: string): number {
  return order.lines.filter((l) => l.serviceId === serviceId).reduce((sum, l) => sum + l.kilos, 0)
}

/** Pieces of one service inside an order. Zero when nobody counted. */
export function itemCountForService(order: { lines: OrderLine[] }, serviceId: string): number {
  return order.lines
    .filter((l) => l.serviceId === serviceId)
    .reduce((sum, l) => sum + (l.itemCount ?? 0), 0)
}

/** Income attributable to one service: the line's own money, not the order's. */
export function serviceIncomeCentavos(order: { lines: OrderLine[] }, serviceId: string): number {
  return order.lines
    .filter((l) => l.serviceId === serviceId)
    .reduce((sum, l) => sum + l.lineTotalCentavos, 0)
}

/** Every line across a set of orders, tagged with the order it came from. */
export function allLines(orders: Order[]): Array<{ order: Order; line: OrderLine }> {
  return orders.flatMap((order) => order.lines.map((line) => ({ order, line })))
}
