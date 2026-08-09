/**
 * Backup destinations, chosen by capability detection at runtime:
 *  1. folder  — File System Access API (Chrome Android/desktop). Silent daily writes.
 *  2. share   — Web Share API with file (iOS/iPadOS primary route).
 *  3. download — universal fallback.
 * Detect once, store the strategy in AppMeta, never show a dead button.
 */
import { db } from '../data/db'
import { ulid } from 'ulid'
import type { BackupKind } from '../data/types'
import { buildBackup, backupFilename, backupToJson } from './serialize'
import { updateAppMeta } from '../data/repository'
import { clientConfig } from '../config/client.config'

// FileSystemDirectoryHandle is not in all TS lib targets; use loose types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DirHandle = any

const HANDLE_KEY = 'backup-folder-handle'

export type BackupStrategy = 'folder' | 'share' | 'download'

export function detectCapabilities(): { folder: boolean; share: boolean } {
  const folder = typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  let share = false
  try {
    share =
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] })
  } catch {
    share = false
  }
  return { folder, share }
}

export function bestStrategy(): BackupStrategy {
  const caps = detectCapabilities()
  if (caps.folder) return 'folder'
  if (caps.share) return 'share'
  return 'download'
}

// ── Folder handle persistence (stored in its own Dexie table via snapshots…
//    no — a dedicated key-value slot in appMeta is cleaner; handles are
//    structured-cloneable so we keep them in a tiny side table) ──

import Dexie from 'dexie'

class HandleDB extends Dexie {
  handles!: Dexie.Table<{ id: string; handle: DirHandle }, string>
  constructor() {
    super('laundry-shop-os-handles')
    this.version(1).stores({ handles: 'id' })
  }
}
const handleDb = new HandleDB()

export async function pickBackupFolder(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle: DirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
    await handleDb.handles.put({ id: HANDLE_KEY, handle })
    await updateAppMeta({ backupStrategy: 'folder' })
    return true
  } catch {
    return false
  }
}

export async function getBackupFolder(): Promise<DirHandle | null> {
  const row = await handleDb.handles.get(HANDLE_KEY)
  if (!row) return null
  const handle = row.handle
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') return handle
    const req = await handle.requestPermission({ mode: 'readwrite' })
    return req === 'granted' ? handle : null
  } catch {
    return null
  }
}

/**
 * Has a folder already been chosen? Only queries — never calls
 * requestPermission, so this is safe to run on load without throwing a
 * permission prompt at someone who was just opening the app.
 */
export async function hasBackupFolder(): Promise<boolean> {
  const row = await handleDb.handles.get(HANDLE_KEY)
  if (!row) return false
  try {
    return (await row.handle.queryPermission({ mode: 'readwrite' })) !== 'denied'
  } catch {
    return false
  }
}

/** Write to folder, prune to the newest N backup files. */
async function writeToFolder(handle: DirHandle, filename: string, json: string): Promise<void> {
  const file = await handle.getFileHandle(filename, { create: true })
  const writable = await file.createWritable()
  await writable.write(json)
  await writable.close()

  // prune old snapshots
  const backups: string[] = []
  for await (const [name] of handle.entries()) {
    if (/-backup-\d{4}-\d{2}-\d{2}\.json$/.test(name)) backups.push(name)
  }
  backups.sort()
  const excess = backups.length - clientConfig.folderBackupKeep
  for (let i = 0; i < excess; i++) {
    try {
      await handle.removeEntry(backups[i])
    } catch {
      // ignore prune failures — old files are harmless
    }
  }
}

function triggerDownload(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

async function shareFile(filename: string, json: string): Promise<boolean> {
  const file = new File([json], filename, { type: 'application/json' })
  try {
    await navigator.share({ files: [file], title: filename })
    return true
  } catch (e) {
    // AbortError = user cancelled the sheet
    return false
  }
}

export interface BackupRunResult {
  ok: boolean
  destination: 'folder' | 'share' | 'download'
  filename: string
  error?: string
}

/**
 * Run a backup through the best available destination (or an explicit one).
 * Records BackupMeta and stamps AppMeta.lastBackupAt on success.
 */
export async function runBackup(
  kind: BackupKind = 'manual',
  forceStrategy?: BackupStrategy,
): Promise<BackupRunResult> {
  const backup = await buildBackup()
  const json = backupToJson(backup)
  const filename = backupFilename(backup.shopName, new Date(backup.createdAt))
  const strategy = forceStrategy ?? bestStrategy()

  let destination: BackupRunResult['destination'] = strategy
  let ok = false
  let error: string | undefined

  if (strategy === 'folder') {
    const handle = await getBackupFolder()
    if (handle) {
      try {
        await writeToFolder(handle, filename, json)
        ok = true
      } catch (e) {
        error = String(e)
      }
    }
    if (!ok) {
      // fall through to share/download rather than silently failing
      const caps = detectCapabilities()
      if (caps.share) {
        destination = 'share'
        ok = await shareFile(filename, json)
      } else {
        destination = 'download'
        triggerDownload(filename, json)
        ok = true
      }
    }
  } else if (strategy === 'share') {
    ok = await shareFile(filename, json)
    if (!ok && !error) error = 'share-cancelled'
  } else {
    triggerDownload(filename, json)
    ok = true
  }

  if (ok) {
    await db.backupMeta.add({
      id: ulid(),
      at: backup.createdAt,
      kind,
      counts: backup.counts,
      sizeBytes: json.length,
      checksum: backup.checksum,
      destination,
    })
    await updateAppMeta({ lastBackupAt: backup.createdAt })
  }
  return { ok, destination, filename, error }
}

/** Emergency path for the error boundary — plain download, no Dexie writes. */
export async function emergencyDownload(): Promise<void> {
  const backup = await buildBackup()
  triggerDownload(backupFilename(backup.shopName), backupToJson(backup))
}
