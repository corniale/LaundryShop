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

export interface PricingInput {
  kilos: number
  pricePerKgCentavos: number
  minimumKg?: number
  addOns: Array<{ amountCentavos: number }>
  discountCentavos: number
}

export interface PricingResult {
  billedKilos: number
  baseCentavos: number
  addOnsCentavos: number
  subtotalCentavos: number
  totalCentavos: number
}

/**
 * Price an order. kilos * price/kg is computed in centavos and rounded
 * once — no float drift. A service minimum bumps the billed kilos.
 */
export function priceOrder(input: PricingInput): PricingResult {
  const billedKilos = Math.max(input.kilos, input.minimumKg ?? 0)
  const baseCentavos = Math.round(billedKilos * input.pricePerKgCentavos)
  const addOnsCentavos = input.addOns.reduce((sum, a) => sum + a.amountCentavos, 0)
  const subtotalCentavos = baseCentavos + addOnsCentavos
  const totalCentavos = Math.max(0, subtotalCentavos - input.discountCentavos)
  return { billedKilos, baseCentavos, addOnsCentavos, subtotalCentavos, totalCentavos }
}
