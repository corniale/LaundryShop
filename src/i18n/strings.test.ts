import { describe, it, expect, afterEach } from 'vitest'
import { t, setLocale } from './strings'

afterEach(() => setLocale('en'))

describe('pluralisation', () => {
  it('uses the singular form for exactly one', () => {
    setLocale('en')
    expect(t('today.lowStockCount', { n: 1 })).toBe('1 item')
    expect(t('customers.orderCount', { n: 1 })).toBe('1 order')
    expect(t('backup.chip.daysAgo', { n: 1 })).toBe('! Last backup: 1 day ago')
    expect(t('lock.cooldown', { n: 1 })).toBe('5 wrong attempts. Wait 1 second.')
  })

  it('uses the plural form for every other count, including zero', () => {
    setLocale('en')
    expect(t('today.lowStockCount', { n: 0 })).toBe('0 items')
    expect(t('today.lowStockCount', { n: 2 })).toBe('2 items')
    expect(t('customers.orderCount', { n: 12 })).toBe('12 orders')
    expect(t('backup.chip.daysAgo', { n: 3 })).toBe('! Last backup: 3 days ago')
  })

  it('keeps the single Taglish form, where a numeral does not inflect the noun', () => {
    setLocale('tl')
    expect(t('today.lowStockCount', { n: 1 })).toBe('1 item')
    expect(t('today.lowStockCount', { n: 5 })).toBe('5 item')
  })

  it('still substitutes other placeholders alongside the count', () => {
    setLocale('en')
    expect(t('backupData.restorePreview', { n: 1, from: 'Jan 3', to: 'Aug 8', current: '38 orders' })).toBe(
      'This has 1 order from Jan 3 to Aug 8. Currently on this phone: 38 orders.',
    )
  })

  it('leaves non-plural strings untouched', () => {
    setLocale('en')
    expect(t('orders.title')).toBe('Orders')
    expect(t('orders.saved', { code: 'ORD-1042' })).toBe('Order ORD-1042 saved.')
  })
})
