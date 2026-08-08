/**
 * Order status machine — the wash line. Pure, no React, no Dexie.
 * Stages encode the physical process: received → washing → drying → ready → claimed.
 */
import type { OrderStatus } from '../data/types'

export const STATUS_ORDER: OrderStatus[] = ['received', 'washing', 'drying', 'ready', 'claimed']

export function statusIndex(status: OrderStatus): number {
  return STATUS_ORDER.indexOf(status)
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = statusIndex(status)
  return i >= 0 && i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null
}

export function prevStatus(status: OrderStatus): OrderStatus | null {
  const i = statusIndex(status)
  return i > 0 ? STATUS_ORDER[i - 1] : null
}

/** Forward moves are one-tap; backward moves require a reason (enforced by caller UI). */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const fi = statusIndex(from)
  const ti = statusIndex(to)
  if (fi < 0 || ti < 0 || fi === ti) return false
  // one step forward, or any step backward (logged with reason)
  return ti === fi + 1 || ti < fi
}

export function isBackward(from: OrderStatus, to: OrderStatus): boolean {
  return statusIndex(to) < statusIndex(from)
}
