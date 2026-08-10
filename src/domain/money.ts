/**
 * Money — integer centavos everywhere. Pure functions, no React, no Dexie.
 */

export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * 100)
}

export function centavosToPesos(centavos: number): number {
  return centavos / 100
}

/** Format centavos as "₱1,234.50". */
export function formatCentavos(centavos: number, withSymbol = true): string {
  const sign = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  const pesos = Math.floor(abs / 100)
  const cents = String(abs % 100).padStart(2, '0')
  const grouped = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${withSymbol ? '₱' : ''}${grouped}.${cents}`
}

/** Parse a user-typed peso amount ("1,234.5", "₱120") to centavos. NaN-safe. */
export function parsePesosInput(input: string): number | null {
  const cleaned = input.replace(/[₱,\s]/g, '')
  if (cleaned === '' || cleaned === '.') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

export interface PricingLineInput {
  kilos: number
  pricePerKgCentavos: number
  minimumKg?: number
}

export interface PricedLine {
  billedKilos: number
  lineTotalCentavos: number
}

export interface PricingInput {
  /** One entry per service in the order. */
  lines: PricingLineInput[]
  addOns: Array<{ amountCentavos: number }>
  discountCentavos: number
}

export interface PricingResult {
  lines: PricedLine[]
  /** Summed across lines, after each line's own minimum. */
  billedKilos: number
  baseCentavos: number
  addOnsCentavos: number
  subtotalCentavos: number
  totalCentavos: number
}

/**
 * Price one service line. kilos * price/kg is computed in centavos and
 * rounded once — no float drift. A service minimum bumps the billed kilos.
 */
export function priceLine(input: PricingLineInput): PricedLine {
  const billedKilos = Math.max(input.kilos, input.minimumKg ?? 0)
  return { billedKilos, lineTotalCentavos: Math.round(billedKilos * input.pricePerKgCentavos) }
}

/**
 * Price a whole order. Each line carries its own price and minimum, because
 * a minimum belongs to the service and not to the visit; add-ons and the
 * discount sit at the order level, where a customer negotiates them.
 */
export function priceOrder(input: PricingInput): PricingResult {
  const lines = input.lines.map(priceLine)
  const billedKilos = lines.reduce((sum, l) => sum + l.billedKilos, 0)
  const baseCentavos = lines.reduce((sum, l) => sum + l.lineTotalCentavos, 0)
  const addOnsCentavos = input.addOns.reduce((sum, a) => sum + a.amountCentavos, 0)
  const subtotalCentavos = baseCentavos + addOnsCentavos
  const totalCentavos = Math.max(0, subtotalCentavos - input.discountCentavos)
  return { lines, billedKilos, baseCentavos, addOnsCentavos, subtotalCentavos, totalCentavos }
}
