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
 * v1 is the first schema, so this is currently the identity — the switch
 * is the pattern later versions extend (see README: bumping schemaVersion).
 */
export function migrateBackup(backup: BackupFile): { backup: BackupFile; notes: string[] } {
  const notes: string[] = []
  let version = backup.schemaVersion
  while (version < SCHEMA_VERSION) {
    switch (version) {
      // case 1:  // v1 → v2 example:
      //   backup.data.orders.forEach(o => { o.newField = defaultValue })
      //   notes.push('Added newField to orders')
      //   break
      default:
        break
    }
    version++
  }
  return { backup: { ...backup, schemaVersion: SCHEMA_VERSION }, notes }
}
