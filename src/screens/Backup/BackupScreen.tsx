/**
 * Backup & Data — manual backup, folder pickup, restore with preview,
 * on-device snapshot rollback, handover flow.
 */
import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { t } from '../../i18n/strings'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { Card, Button, Sheet, Input } from '../../components/ui'
import { fmtDateTime, fmtDateFull, fmtDate } from '../../app/format'
import { runBackup, pickBackupFolderAndSeed, detectCapabilities } from '../../backup/destinations'
import { prepareRestore, executeRestore, restoreSnapshot, type RestorePreview } from '../../backup/restore'
import { storageUsage } from '../../backup/scheduler'
import { useEffect } from 'react'

export function BackupScreen() {
  const toast = useToast()
  const { isOwner } = useAuth()
  const appMeta = useLiveQuery(() => db.appMeta.get('app'), [])
  const backups = useLiveQuery(() => db.backupMeta.orderBy('at').reverse().limit(10).toArray(), []) ?? []
  const snapshots = useLiveQuery(() => db.snapshots.orderBy('at').reverse().toArray(), []) ?? []
  const orderCount = useLiveQuery(() => db.orders.count(), []) ?? 0

  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [usage, setUsage] = useState<{ usedPct: number | null; usage: number } | null>(null)

  const caps = detectCapabilities()

  useEffect(() => {
    void storageUsage().then(setUsage)
  }, [])

  async function backupNow() {
    const result = await runBackup('manual')
    toast({ message: result.ok ? t('backup.done') : t('backup.failed') })
  }

  async function onFileChosen(file: File) {
    setRestoreError(null)
    const text = await file.text()
    const result = await prepareRestore(text)
    if (!result.ok) {
      setRestoreError(
        result.reason === 'newer-schema'
          ? t('backupData.newerSchema')
          : result.reason === 'checksum'
            ? t('backupData.checksumFail')
            : t('backupData.invalidFile'),
      )
      return
    }
    setPreview(result.preview)
    setConfirmText('')
  }

  async function doRestore(mode: 'replace' | 'merge') {
    if (!preview || restoring) return
    setRestoring(true)
    try {
      await executeRestore(preview.backup, mode)
      toast({ message: t('backupData.restored') })
      setPreview(null)
    } finally {
      setRestoring(false)
    }
  }

  async function handover() {
    const result = await runBackup('handover')
    if (result.ok) setHandoverOpen(true)
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <h1 className="font-display text-lg font-bold">{t('backupData.title')}</h1>

      <Card>
        <div className="text-sm text-ink-muted">{t('backupData.lastBackup')}</div>
        <div className="font-mono font-medium">
          {appMeta?.lastBackupAt ? fmtDateTime(appMeta.lastBackupAt) : t('backupData.never')}
        </div>
        {usage?.usedPct !== null && usage !== null && (
          <div className="mt-1 text-xs text-ink-muted">
            {t('backupData.storageUsed')}: {(usage.usage / 1_048_576).toFixed(1)} MB ({usage.usedPct!.toFixed(0)}%)
          </div>
        )}
        <div className="mt-3 flex flex-col gap-2">
          <Button onClick={() => void backupNow()}>{t('backupData.backupNow')}</Button>
          {caps.folder && (
            <>
              <Button
                variant="secondary"
                onClick={async () => {
                  // Seeds the folder with one backup, same as Today's offer.
                  const { picked, wrote } = await pickBackupFolderAndSeed()
                  if (picked) toast({ message: wrote ? t('backupData.folderSet') : t('backup.failed') })
                }}
              >
                {t('backupData.pickFolder')}
              </Button>
              <p className="-mt-1 text-xs text-ink-muted">{t('backup.cloudHint')}</p>
            </>
          )}
          <Button variant="secondary" onClick={() => void runBackup('manual', 'download')}>
            {t('backupData.download')}
          </Button>
          <Button variant="secondary" onClick={() => void handover()}>
            {t('backupData.handover')}
          </Button>
        </div>
      </Card>

      {isOwner && (
        <Card>
          <h2 className="mb-2 font-display text-base font-semibold">{t('backupData.restore')}</h2>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFileChosen(f)
              e.target.value = ''
            }}
          />
          <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
            {t('backupData.restore')}
          </Button>
          {restoreError && <p className="mt-2 rounded-input bg-attention-soft p-3 text-sm text-attention-deep">{restoreError}</p>}
        </Card>
      )}

      {isOwner && snapshots.length > 0 && (
        <Card>
          <h2 className="mb-2 font-display text-base font-semibold">{t('backupData.snapshots')}</h2>
          <div className="flex flex-col gap-1">
            {snapshots.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b border-line py-1.5 text-sm last:border-0">
                <span>
                  {fmtDateTime(s.at)} <span className="text-xs text-ink-muted">({s.kind})</span>
                </span>
                <Button
                  variant="ghost"
                  className="!py-1.5 text-sm"
                  onClick={async () => {
                    const ok = await restoreSnapshot(s.id)
                    toast({ message: ok ? t('backupData.restored') : t('backupData.invalidFile') })
                  }}
                >
                  {t('backupData.rollback', { date: fmtDate(s.at) })}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('backupData.lastBackup')}</h2>
        <div className="flex flex-col gap-1 text-sm">
          {backups.map((b) => (
            <div key={b.id} className="flex justify-between border-b border-line py-1.5 last:border-0">
              <span>
                {fmtDateTime(b.at)} <span className="text-xs text-ink-muted">({b.kind} · {b.destination})</span>
              </span>
              <span className="font-mono text-xs text-ink-muted">{(b.sizeBytes / 1024).toFixed(0)} KB</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Restore preview */}
      <Sheet open={preview !== null} onClose={() => setPreview(null)} title={t('backupData.restore')}>
        {preview && (
          <div className="flex flex-col gap-3">
            <p>
              <span className="font-semibold">{preview.shopName}</span> · {fmtDateFull(preview.createdAt)}
            </p>
            <p className="text-sm text-ink-muted">
              {t('backupData.restorePreview', {
                n: preview.counts.orders ?? 0,
                from: preview.orderDateRange.from ? fmtDateFull(preview.orderDateRange.from) : '—',
                to: preview.orderDateRange.to ? fmtDateFull(preview.orderDateRange.to) : '—',
                current: t('customers.orderCount', { n: preview.currentOrderCount }),
              })}
            </p>
            {preview.migrationNotes.length > 0 && (
              <ul className="rounded-input bg-primary-soft p-3 text-sm">
                {preview.migrationNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-ink-muted">{t('backupData.preRestoreNote')}</p>
            <div className="rounded-card bg-wash p-3">
              <p className="mb-2 text-sm font-medium">{t('backupData.typeToConfirm', { word: 'RESTORE' })}</p>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="font-mono uppercase" />
            </div>
            <Button variant="danger" disabled={confirmText.trim().toUpperCase() !== 'RESTORE' || restoring} onClick={() => void doRestore('replace')}>
              {t('backupData.replaceAll')}
            </Button>
            <Button variant="secondary" disabled={restoring} onClick={() => void doRestore('merge')}>
              {t('backupData.merge')}
            </Button>
          </div>
        )}
      </Sheet>

      {/* Handover checklist */}
      <Sheet open={handoverOpen} onClose={() => setHandoverOpen(false)} title={t('backupData.handover')}>
        <div className="flex flex-col gap-3">
          <pre className="whitespace-pre-wrap rounded-card bg-wash p-4 font-body text-sm">
            {t('backupData.handoverSteps', { count: orderCount })}
          </pre>
          <Button onClick={() => setHandoverOpen(false)}>{t('common.done')}</Button>
        </div>
      </Sheet>
    </div>
  )
}
