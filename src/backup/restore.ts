/**
 * Restore — validate, preview, pre-restore snapshot, then replace or merge.
 * Nothing is written until validation passes.
 */
import { db, BACKUP_TABLES } from '../data/db'
import type { BackupFile } from '../data/schemas'
import { validateBackupJson, migrateBackup, type ValidationResult } from './validate'
import { takeSnapshot } from './scheduler'

export interface RestorePreview {
  shopName: string
  createdAt: string
  counts: Record<string, number>
  orderDateRange: { from: string | null; to: string | null }
  currentOrderCount: number
  migrationNotes: string[]
  backup: BackupFile
}

export async function prepareRestore(text: string): Promise<
  | { ok: true; preview: RestorePreview }
  | { ok: false; reason: Exclude<ValidationResult, { ok: true }>['reason'] }
> {
  const result = await validateBackupJson(text)
  if (!result.ok) return { ok: false, reason: result.reason }

  const { backup, notes } = migrateBackup(result.backup)
  const orders = backup.data.orders
  const dates = orders.map((o) => o.receivedAt).sort()
  const currentOrderCount = await db.orders.count()

  return {
    ok: true,
    preview: {
      shopName: backup.shopName,
      createdAt: backup.createdAt,
      counts: backup.counts,
      orderDateRange: { from: dates[0] ?? null, to: dates[dates.length - 1] ?? null },
      currentOrderCount,
      migrationNotes: notes,
      backup,
    },
  }
}

export type RestoreMode = 'replace' | 'merge'

export async function executeRestore(backup: BackupFile, mode: RestoreMode): Promise<void> {
  // Always undoable: snapshot current state first.
  await takeSnapshot('pre-restore')

  const tables = BACKUP_TABLES.map((t) => db.table(t))
  await db.transaction('rw', tables, async () => {
    for (const name of BACKUP_TABLES) {
      // ?? [] covers a table a migration left absent — every restore runs
      // through migrateBackup first, but a missing table must not throw.
      const incoming = (backup.data[name] ?? []) as Array<{ id: string; updatedAt?: string }>
      const table = db.table(name)
      if (mode === 'replace') {
        await table.clear()
        await table.bulkPut(incoming)
      } else {
        // Merge: add records that don't exist; never overwrite a newer record.
        for (const record of incoming) {
          const existing = (await table.get(record.id)) as { updatedAt?: string } | undefined
          if (!existing) {
            await table.put(record)
          } else if (
            record.updatedAt &&
            existing.updatedAt &&
            new Date(record.updatedAt) > new Date(existing.updatedAt)
          ) {
            await table.put(record)
          }
          // otherwise keep the existing (newer or same) record
        }
      }
    }
  })
}

/** Roll back to an on-device snapshot. */
export async function restoreSnapshot(snapshotId: string): Promise<boolean> {
  const snap = await db.snapshots.get(snapshotId)
  if (!snap) return false
  const result = await validateBackupJson(snap.json)
  if (!result.ok) return false
  await executeRestore(result.backup, 'replace')
  return true
}
