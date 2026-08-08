/**
 * Sync seam — defined, not implemented. Every record carries updatedAt and
 * a ULID, so a later cloud adapter is purely additive. v1 ships the null
 * adapter only.
 */

export type ISODate = string

export interface ChangeSet {
  since: ISODate
  tables: Record<string, unknown[]>
}

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'error'

export interface SyncAdapter {
  push(changes: ChangeSet): Promise<void>
  pull(since: ISODate): Promise<ChangeSet>
  status(): SyncStatus
}

export class NullSyncAdapter implements SyncAdapter {
  async push(_changes: ChangeSet): Promise<void> {
    // no-op: local-only build
  }
  async pull(_since: ISODate): Promise<ChangeSet> {
    return { since: new Date(0).toISOString(), tables: {} }
  }
  status(): SyncStatus {
    return 'disabled'
  }
}

export const syncAdapter: SyncAdapter = new NullSyncAdapter()
