/**
 * The order ledger as a spreadsheet. An order can hold several services, so
 * a row is a *line*, not an order: two services means two rows sharing one
 * order code. Order-level money — add-ons, discount, total, paid, balance —
 * is written on the first row of each order only, so a column of totals can
 * be summed without counting the same visit twice.
 *
 *   Line total summed over an order's rows + Add-ons − Discount = Order total
 *
 * Pure: no React, no Dexie, no locale. Dates are ISO so a spreadsheet reads
 * them as dates, and money is plain decimal so it reads as a number.
 */
import type { Order, Payment } from '../data/types'
import { paidCentavos, balanceCentavos } from './payments'

export interface OrderCsvInput {
  order: Order
  customerName: string
  payments: Payment[]
}

export const ORDER_CSV_HEADER = [
  'Order',
  'Received',
  'Promised',
  'Customer',
  'Status',
  'Service',
  'Kilos',
  'Billed kilos',
  'Pieces',
  'Line total',
  'Add-ons',
  'Discount',
  'Order total',
  'Paid',
  'Balance',
  'Add-on detail',
  'Notes',
]

const pesos = (centavos: number) => (centavos / 100).toFixed(2)
const day = (iso: string) => iso.slice(0, 10)

export function orderCsvRows(inputs: OrderCsvInput[]): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = []
  for (const { order, customerName, payments } of inputs) {
    const addOnsCentavos = order.addOns.reduce((sum, a) => sum + a.amountCentavos, 0)
    const addOnDetail = order.addOns.map((a) => `${a.label} ${pesos(a.amountCentavos)}`).join('; ')
    const paid = paidCentavos(payments)
    const status = order.voidedAt ? 'void' : order.status
    // A blank line list should not happen, but it must not swallow the order.
    const lines = order.lines.length > 0 ? order.lines : [null]

    lines.forEach((line, i) => {
      const first = i === 0
      rows.push([
        order.code,
        day(order.receivedAt),
        day(order.promisedAt),
        customerName,
        status,
        line?.serviceNameSnapshot ?? '',
        line?.kilos ?? '',
        line?.billedKilos ?? '',
        line?.itemCount ?? '',
        line ? pesos(line.lineTotalCentavos) : '',
        first ? pesos(addOnsCentavos) : '',
        first ? pesos(order.discountCentavos) : '',
        first ? pesos(order.totalCentavos) : '',
        first ? pesos(paid) : '',
        first ? pesos(balanceCentavos(order.totalCentavos, payments)) : '',
        first ? addOnDetail : '',
        first ? order.itemNotes ?? '' : '',
      ])
    })
  }
  return rows
}
