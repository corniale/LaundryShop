/**
 * PIN hashing — PBKDF2-SHA256, per-user salt, 250k iterations, via WebCrypto.
 * Plain PINs never touch storage. No React, no Dexie.
 */

const ITERATIONS = 250_000

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuf(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function generateSalt(): string {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  return bufToHex(salt.buffer)
}

export async function hashPin(pin: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBuf(saltHex),
      iterations: ITERATIONS,
    },
    key,
    256,
  )
  return bufToHex(bits)
}

export async function verifyPin(pin: string, saltHex: string, expectedHash: string): Promise<boolean> {
  const hash = await hashPin(pin, saltHex)
  // constant-time-ish compare
  if (hash.length !== expectedHash.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i)
  return diff === 0
}

/** Human-friendly recovery code: XXXX-XXXX-XXXX from an unambiguous alphabet. */
export function generateRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes).map((b) => alphabet[b % alphabet.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`
}

export function validPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin)
}
