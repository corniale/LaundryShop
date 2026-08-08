import { describe, it, expect } from 'vitest'
import { priceOrder, formatCentavos, parsePesosInput } from './money'

describe('priceOrder', () => {
  it('8.5 kg at ₱40/kg with ₱20 add-on and ₱50 discount = ₱310.00 exactly (acceptance #1)', () => {
    const result = priceOrder({
      kilos: 8.5,
      pricePerKgCentavos: 4000,
      addOns: [{ amountCentavos: 2000 }],
      discountCentavos: 5000,
    })
    expect(result.baseCentavos).toBe(34000)
    expect(result.subtotalCentavos).toBe(36000)
    expect(result.totalCentavos).toBe(31000)
    expect(formatCentavos(result.totalCentavos)).toBe('₱310.00')
  })

  it('has no float drift on awkward kilos', () => {
    // 0.1 + 0.2 style traps: 3.3 kg * ₱36.50
    const result = priceOrder({ kilos: 3.3, pricePerKgCentavos: 3650, addOns: [], discountCentavos: 0 })
    expect(result.totalCentavos).toBe(12045)
    expect(Number.isInteger(result.totalCentavos)).toBe(true)
  })

  it('applies a service minimum by bumping billed kilos', () => {
    const result = priceOrder({ kilos: 2, pricePerKgCentavos: 3500, minimumKg: 4, addOns: [], discountCentavos: 0 })
    expect(result.billedKilos).toBe(4)
    expect(result.totalCentavos).toBe(14000)
  })

  it('never goes below zero on an oversized discount', () => {
    const result = priceOrder({ kilos: 1, pricePerKgCentavos: 3500, addOns: [], discountCentavos: 99999 })
    expect(result.totalCentavos).toBe(0)
  })
})

describe('formatCentavos', () => {
  it('formats with grouping and two decimals', () => {
    expect(formatCentavos(123456789)).toBe('₱1,234,567.89')
    expect(formatCentavos(5)).toBe('₱0.05')
    expect(formatCentavos(-2500)).toBe('-₱25.00')
  })
})

describe('parsePesosInput', () => {
  it('parses user input safely', () => {
    expect(parsePesosInput('1,234.5')).toBe(123450)
    expect(parsePesosInput('₱120')).toBe(12000)
    expect(parsePesosInput('abc')).toBeNull()
    expect(parsePesosInput('-5')).toBeNull()
    expect(parsePesosInput('')).toBeNull()
  })
})
