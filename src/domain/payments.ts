/**
 * Payment derivation — paid amount, balance, and status are NEVER stored;
 * they are always derived from the ledger so the badge can never disagree
 * with the entries. Pure, no React, no Dexie.
 */
import type { Payment, PaymentStatus } from '../data/types'

/** Net amount paid: reversals are counter-entries that cancel originals. */
export function paidCentavos(payments: Payment[]): number {
  return payments.reduce((sum, p) => sum + p.amountCentavos, 0)
}

export function balanceCentavos(totalCentavos: number, payments: Payment[]): number {
  return totalCentavos - paidCentavos(payments)
}

export function paymentStatus(totalCentavos: number, payments: Payment[]): PaymentStatus {
  const paid = paidCentavos(payments)
  if (paid <= 0) return 'unpaid'
  if (paid >= totalCentavos) return 'paid'
  return 'partial'
}

/** Build the counter-entry that reverses a payment. Never deletes. */
export function buildReversal(
  original: Payment,
  id: string,
  byUserId: string,
  at: string,
  reason: string,
): Payment {
  return {
    id,
    orderId: original.orderId,
    amountCentavos: -original.amountCentavos,
    method: original.method,
    reference: original.reference,
    receivedAt: at,
    byUserId,
    reversalOfPaymentId: original.id,
    reason,
    updatedAt: at,
  }
}

/**
 * When money last actually moved in for this order — what a partial payment
 * should show so the day's collections can be matched against the till.
 * Reversals, and the entries they cancel, are excluded: a reversed payment
 * left no cash behind, so dating the order by it would be a lie.
 * Returns null when nothing has been collected yet.
 */
export function lastPaymentAt(payments: Payment[]): string | null {
  let latest: string | null = null
  for (const p of payments) {
    if (p.reversalOfPaymentId || p.reversedByPaymentId) continue
    if (p.amountCentavos <= 0) continue
    if (latest === null || new Date(p.receivedAt) > new Date(latest)) latest = p.receivedAt
  }
  return latest
}

export type AgingBucket = '0-7' | '8-30' | '31+'

export function agingBucket(receivedAt: string, now: Date): AgingBucket {
  const days = Math.floor((now.getTime() - new Date(receivedAt).getTime()) / 86_400_000)
  if (days <= 7) return '0-7'
  if (days <= 30) return '8-30'
  return '31+'
}
