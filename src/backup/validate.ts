/**
 * Backup validation — every restore is checked before a single record is
 * written: shape (zod), checksum (SHA-256), and schema version direction.
 */
import { backupFileSchema, type BackupFile } from '../data/schemas'
import { SCHEMA_VERSION } from '../data/db'
import { sha256Hex } from './serialize'

export type ValidationResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; reason: 'not-backup' | 'checksum' | 'newer-schema'; detail?: string }

export async function validateBackupJson(text: string): Promise<ValidationResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'not-backup', detail: 'Not valid JSON' }
  }

  const result = backupFileSchema.safeParse(parsed)
  if (!result.success) {
    return { ok: false, reason: 'not-backup', detail: result.error.issues[0]?.message }
  }
  const backup = result.data

  if (backup.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, reason: 'newer-schema' }
  }

  const expected = `sha256:${await sha256Hex(JSON.stringify(backup.data))}`
  if (expected !== backup.checksum) {
    return { ok: false, reason: 'checksum' }
  }

  return { ok: true, backup }
}

/**
 * Migrate an older backup's data forward to the current schema.
 * Each case moves one version forward; see README on bumping schemaVersion.
 */
export function migrateBackup(backup: BackupFile): { backup: BackupFile; notes: string[] } {
  const notes: string[] = []
  let version = backup.schemaVersion
  while (version < SCHEMA_VERSION) {
    switch (version) {
      case 1: {
        // v1 rules were per kilo and nothing else, so that is what they stay.
        let touched = 0
        for (const rule of backup.data.expectedUseRules) {
          if (rule.qtyPer !== undefined) continue
          rule.qtyPer = rule.qtyPerKg ?? 0
          rule.basis = 'kg'
          delete rule.qtyPerKg
          touched++
        }
        if (touched > 0) notes.push(`Expected-use rules read as per kilo (${touched})`)
        break
      }
      case 2: {
        // v2 orders held one service; each becomes a single line.
        let touched = 0
        for (const order of backup.data.orders) {
          if (Array.isArray(order.lines)) continue
          const kilos = order.kilos ?? 0
          const price = order.pricePerKgSnapshot ?? 0
          order.lines = [
            {
              serviceId: order.serviceId ?? '',
              serviceNameSnapshot: order.serviceNameSnapshot ?? '',
              pricePerKgSnapshot: price,
              kilos,
              itemCount: order.itemCount,
              billedKilos: kilos,
              lineTotalCentavos: Math.round(kilos * price),
            },
          ]
          delete order.serviceId
          delete order.serviceNameSnapshot
          delete order.pricePerKgSnapshot
          delete order.kilos
          delete order.itemCount
          touched++
        }
        if (touched > 0) notes.push(`Orders now hold one line per service (${touched})`)
        break
      }
      default:
        break
    }
    version++
  }
  return { backup: { ...backup, schemaVersion: SCHEMA_VERSION }, notes }
}
