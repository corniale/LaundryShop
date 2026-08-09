import { describe, it, expect } from 'vitest'
import { paidCentavos, balanceCentavos, paymentStatus, buildReversal, agingBucket, lastPaymentAt } from './payments'
import type { Payment } from '../data/types'

const pay = (amount: number, extra: Partial<Payment> = {}): Payment => ({
  id: Math.random().toString(36).slice(2),
  orderId: 'o1',
  amountCentavos: amount,
  method: 'cash',
  receivedAt: '2026-08-01T10:00:00.000Z',
  byUserId: 'u1',
  updatedAt: '2026-08-01T10:00:00.000Z',
  ...extra,
})

describe('payment derivation', () => {
  it('₱200 against a ₱480 order → partial, ₱280 balance (acceptance #3)', () => {
    const payments = [pay(20000)]
    expect(paidCentavos(payments)).toBe(20000)
    expect(balanceCentavos(48000, payments)).toBe(28000)
    expect(paymentStatus(48000, payments)).toBe('partial')
  })

  it('reversal restores unpaid and keeps both ledger entries (acceptance #4)', () => {
    const original = pay(20000)
    const reversal = buildReversal(original, 'r1', 'owner', '2026-08-02T10:00:00.000Z', 'Mali')
    const payments = [original, reversal]
    expect(payments).toHaveLength(2) // never deleted
    expect(paidCentavos(payments)).toBe(0)
    expect(paymentStatus(48000, payments)).toBe('unpaid')
    expect(balanceCentavos(48000, payments)).toBe(48000)
    expect(reversal.amountCentavos).toBe(-20000)
    expect(reversal.reversalOfPaymentId).toBe(original.id)
  })

  it('derives paid when payments cover the total', () => {
    expect(paymentStatus(48000, [pay(48000)])).toBe('paid')
    expect(paymentStatus(48000, [pay(20000), pay(28000)])).toBe('paid')
    expect(paymentStatus(48000, [pay(50000)])).toBe('paid') // overpayment still paid
  })

  it('zero payments → unpaid', () => {
    expect(paymentStatus(48000, [])).toBe('unpaid')
  })
})

describe('lastPaymentAt', () => {
  it('is null when nothing has been collected', () => {
    expect(lastPaymentAt([])).toBeNull()
  })

  it('takes the most recent entry, whatever order the ledger is in', () => {
    const early = pay(10000, { receivedAt: '2026-08-01T10:00:00.000Z' })
    const late = pay(5000, { receivedAt: '2026-08-06T16:30:00.000Z' })
    expect(lastPaymentAt([early, late])).toBe(late.receivedAt)
    expect(lastPaymentAt([late, early])).toBe(late.receivedAt)
  })

  it('ignores a reversal and the payment it cancels', () => {
    const kept = pay(10000, { receivedAt: '2026-08-01T10:00:00.000Z' })
    const undone = pay(20000, { id: 'p2', receivedAt: '2026-08-04T09:00:00.000Z', reversedByPaymentId: 'r1' })
    const reversal = buildReversal(undone, 'r1', 'owner', '2026-08-05T09:00:00.000Z', 'Mali')
    expect(lastPaymentAt([kept, undone, reversal])).toBe(kept.receivedAt)
  })

  it('is null when every payment has been reversed', () => {
    const undone = pay(20000, { id: 'p1', reversedByPaymentId: 'r1' })
    const reversal = buildReversal(undone, 'r1', 'owner', '2026-08-02T10:00:00.000Z', 'Mali')
    expect(lastPaymentAt([undone, reversal])).toBeNull()
  })
})

describe('agingBucket', () => {
  const now = new Date('2026-08-08T12:00:00.000Z')
  it('buckets 0–7, 8–30, 31+', () => {
    expect(agingBucket('2026-08-05T00:00:00.000Z', now)).toBe('0-7')
    expect(agingBucket('2026-07-20T00:00:00.000Z', now)).toBe('8-30')
    expect(agingBucket('2026-06-01T00:00:00.000Z', now)).toBe('31+')
  })
})
