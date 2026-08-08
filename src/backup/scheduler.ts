/**
 * Backup scheduling + on-device snapshots.
 * - Daily silent write when a folder handle exists (first open of the day).
 * - Last 7 daily + 4 weekly snapshots inside IndexedDB, so a bad day can be
 *   rolled back with no file at all.
 * - Prompt policy: >3 days → dismissible sheet once a day; >7 days → modal.
 */
import { ulid } from 'ulid'
import { db } from '../data/db'
import { buildBackup, backupToJson } from './serialize'
import { getAppMeta, updateAppMeta } from '../data/repository'
import { getBackupFolder, runBackup } from './destinations'

const DAY_MS = 86_400_000

export function daysSince(iso: string | undefined, now = new Date()): number | null {
  if (!iso) return null
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS)
}

export type BackupHealth = 'ok' | 'stale' | 'never'

export function backupHealth(lastBackupAt: string | undefined, now = new Date()): {
  health: BackupHealth
  days: number | null
} {
  const days = daysSince(lastBackupAt, now)
  if (days === null) return { health: 'never', days: null }
  return { health: days < 1 ? 'ok' : 'stale', days }
}

export type PromptLevel = 'none' | 'sheet' | 'modal'

export function promptLevel(
  lastBackupAt: string | undefined,
  lastPromptAt: string | undefined,
  now = new Date(),
): PromptLevel {
  const days = daysSince(lastBackupAt, now)
  const stale = days === null ? Infinity : days
  if (stale > 7) return 'modal'
  if (stale > 3) {
    const promptedToday =
      lastPromptAt !== undefined &&
      new Date(lastPromptAt).toDateString() === now.toDateString()
    return promptedToday ? 'none' : 'sheet'
  }
  return 'none'
}

/** Take an in-IndexedDB snapshot, pruning to 7 daily + 4 weekly. */
export async function takeSnapshot(kind: 'daily' | 'weekly' | 'pre-restore'): Promise<string> {
  const backup = await buildBackup()
  const id = ulid()
  await db.snapshots.add({ id, at: backup.createdAt, kind, json: backupToJson(backup) })

  if (kind !== 'pre-restore') {
    const all = await db.snapshots.where('kind').equals(kind).sortBy('at')
    const keep = kind === 'daily' ? 7 : 4
    const excess = all.length - keep
    for (let i = 0; i < excess; i++) await db.snapshots.delete(all[i].id)
  } else {
    // keep only the 3 most recent pre-restore snapshots
    const all = await db.snapshots.where('kind').equals('pre-restore').sortBy('at')
    const excess = all.length - 3
    for (let i = 0; i < excess; i++) await db.snapshots.delete(all[i].id)
  }
  return id
}

/**
 * Called once on every app open. Silent, never throws.
 * - Takes the daily/weekly snapshot if none exists today/this week.
 * - If a folder handle exists and no folder backup ran today, writes one.
 */
export async function runDailyMaintenance(): Promise<void> {
  try {
    const now = new Date()
    const today = now.toDateString()

    const dailies = await db.snapshots.where('kind').equals('daily').sortBy('at')
    const lastDaily = dailies[dailies.length - 1]
    if (!lastDaily || new Date(lastDaily.at).toDateString() !== today) {
      await takeSnapshot('daily')
    }

    const weeklies = await db.snapshots.where('kind').equals('weekly').sortBy('at')
    const lastWeekly = weeklies[weeklies.length - 1]
    if (!lastWeekly || now.getTime() - new Date(lastWeekly.at).getTime() > 7 * DAY_MS) {
      await takeSnapshot('weekly')
    }

    const meta = await getAppMeta()
    if (meta?.backupStrategy === 'folder') {
      const last = daysSince(meta.lastBackupAt, now)
      if (last === null || last >= 1) {
        const handle = await getBackupFolder()
        if (handle) await runBackup('auto', 'folder')
      }
    }
  } catch {
    // maintenance must never break app startup
  }
}

export async function markPrompted(): Promise<void> {
  await updateAppMeta({ lastBackupPromptAt: new Date().toISOString() })
}

/** Storage quota check — warn at 80%. */
export async function storageUsage(): Promise<{ usedPct: number | null; usage: number; quota: number }> {
  try {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate()
      return { usedPct: quota > 0 ? (usage / quota) * 100 : null, usage, quota }
    }
  } catch {
    // ignore
  }
  return { usedPct: null, usage: 0, quota: 0 }
}
