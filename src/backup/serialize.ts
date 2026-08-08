/**
 * Backup serialization — one JSON file containing every table plus a header
 * with counts and a SHA-256 checksum over the data payload.
 */
import { db, BACKUP_TABLES, SCHEMA_VERSION } from '../data/db'
import type { BackupFile } from '../data/schemas'

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function buildBackup(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {}
  await db.transaction('r', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const name of BACKUP_TABLES) {
      data[name] = await db.table(name).toArray()
    }
  })
  const shop = (data.shop as Array<{ id: string; name: string }>)[0]
  const counts: Record<string, number> = {}
  for (const name of BACKUP_TABLES) counts[name] = data[name].length

  const checksum = `sha256:${await sha256Hex(JSON.stringify(data))}`
  return {
    app: 'laundry-shop-os',
    schemaVersion: SCHEMA_VERSION,
    shopId: shop?.id ?? '',
    shopName: shop?.name ?? '',
    createdAt: new Date().toISOString(),
    counts,
    checksum,
    data,
  } as BackupFile
}

export function backupFilename(shopName: string, date = new Date()): string {
  const slug = (shopName || 'laundry-shop')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const iso = date.toISOString().slice(0, 10)
  return `${slug}-backup-${iso}.json`
}

export function backupToJson(backup: BackupFile): string {
  return JSON.stringify(backup)
}
