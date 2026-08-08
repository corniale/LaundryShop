/**
 * Setup wizard — "Simulan ang totoong shop". Seven steps; the last one
 * runs the first backup and the wizard cannot finish until it succeeds.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ulid } from 'ulid'
import { db } from '../../data/db'
import { t } from '../../i18n/strings'
import { clientConfig } from '../../config/client.config'
import { formatCentavos, parsePesosInput } from '../../domain/money'
import { hashPin, generateSalt, generateRecoveryCode, validPinFormat } from '../../domain/pin'
import { wipeDemoData, wipeAllData, updateAppMeta } from '../../data/repository'
import { runBackup, detectCapabilities, pickBackupFolder } from '../../backup/destinations'
import { useAuth } from '../../app/AuthContext'
import { Button, Field, Input, Card } from '../../components/ui'

type ServiceRow = { name: string; price: string; days: string }

export function SetupWizard() {
  const navigate = useNavigate()
  const { lock } = useAuth()
  const [step, setStep] = useState(1)
  const [confirmText, setConfirmText] = useState('')
  const [shopForm, setShopForm] = useState({ name: '', ownerName: '', contact: '', address: '' })
  const [services, setServices] = useState<ServiceRow[]>(
    clientConfig.defaultServices.map((s) => ({
      name: s.name,
      price: (s.pricePerKgCentavos / 100).toFixed(2),
      days: String(s.turnaroundDays),
    })),
  )
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [recoveryCode] = useState(generateRecoveryCode)
  const [recoveryAck, setRecoveryAck] = useState(false)
  const [installAck, setInstallAck] = useState(false)
  const [shareDestName, setShareDestName] = useState('')
  const [folderPicked, setFolderPicked] = useState(false)
  const [backupState, setBackupState] = useState<'idle' | 'running' | 'ok' | 'fail'>('idle')
  const [busy, setBusy] = useState(false)

  const caps = useMemo(() => detectCapabilities(), [])
  const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent), [])

  async function wipeAndContinue(full: boolean) {
    if (busy) return
    setBusy(true)
    try {
      if (full) await wipeAllData()
      else await wipeDemoData()
      setStep(2)
    } finally {
      setBusy(false)
    }
  }

  async function commitShopAndUsers() {
    if (busy) return
    setBusy(true)
    try {
      const now = new Date().toISOString()
      // replace demo shop with the real one; order numbering restarts at 1
      await db.shop.clear()
      await db.shop.put({
        id: ulid(),
        name: shopForm.name.trim() || clientConfig.defaultShopName,
        ownerName: shopForm.ownerName.trim(),
        address: shopForm.address.trim(),
        contact: shopForm.contact.trim(),
        currency: 'PHP',
        orderCodePrefix: clientConfig.orderCodePrefix,
        nextOrderNumber: 1,
        locale: clientConfig.defaultLocale,
        receiptFooter: t('stub.footerDefault'),
        createdAt: now,
        schemaVersion: 1,
        updatedAt: now,
      })
      for (const [i, row] of services.entries()) {
        const price = parsePesosInput(row.price)
        if (!row.name.trim() || price === null) continue
        await db.services.add({
          id: ulid(),
          name: row.name.trim(),
          pricePerKgCentavos: price,
          turnaroundDays: Number(row.days) || 1,
          active: true,
          sortOrder: i,
          updatedAt: now,
        })
      }
      const salt = generateSalt()
      const recoverySalt = generateSalt()
      await db.users.add({
        id: ulid(),
        name: shopForm.ownerName.trim() || 'Owner',
        role: 'owner',
        pinHash: await hashPin(pin, salt),
        pinSalt: salt,
        recoveryHash: await hashPin(recoveryCode, recoverySalt),
        recoverySalt,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      setStep(5)
    } finally {
      setBusy(false)
    }
  }

  async function runFirstBackup() {
    setBackupState('running')
    const result = await runBackup('manual')
    setBackupState(result.ok ? 'ok' : 'fail')
    if (result.ok) {
      await updateAppMeta({
        demoMode: false,
        setupComplete: true,
        backupStrategy: folderPicked ? 'folder' : caps.share ? 'share' : 'download',
        shareDestinationName: shareDestName.trim() || undefined,
      })
    }
  }

  const steps: Record<number, React.ReactNode> = {
    // 1 · typed confirmation, wipes demo
    1: (
      <>
        <p className="text-ink-muted">{t('wizard.step1.body')}</p>
        <Input
          className="font-mono uppercase"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="SIMULAN"
        />
        <Button disabled={confirmText.trim().toUpperCase() !== 'SIMULAN' || busy} onClick={() => void wipeAndContinue(false)}>
          {t('wizard.next')}
        </Button>
      </>
    ),
    // 2 · shop info
    2: (
      <>
        <Field label={t('settings.shopName')}>
          <Input value={shopForm.name} onChange={(e) => setShopForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label={t('settings.ownerName')}>
          <Input value={shopForm.ownerName} onChange={(e) => setShopForm((f) => ({ ...f, ownerName: e.target.value }))} />
        </Field>
        <Field label={t('settings.contact')}>
          <Input inputMode="tel" value={shopForm.contact} onChange={(e) => setShopForm((f) => ({ ...f, contact: e.target.value }))} />
        </Field>
        <Field label={t('settings.address')}>
          <Input value={shopForm.address} onChange={(e) => setShopForm((f) => ({ ...f, address: e.target.value }))} />
        </Field>
        <Button disabled={!shopForm.name.trim() || !shopForm.ownerName.trim()} onClick={() => setStep(3)}>
          {t('wizard.next')}
        </Button>
      </>
    ),
    // 3 · services
    3: (
      <>
        <p className="text-sm text-ink-muted">{t('wizard.step3.body')}</p>
        {services.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={row.name} onChange={(e) => setServices((s) => s.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input
              className="w-24 font-mono"
              inputMode="decimal"
              value={row.price}
              onChange={(e) => setServices((s) => s.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
            />
            <Input
              className="w-16 font-mono"
              inputMode="numeric"
              value={row.days}
              onChange={(e) => setServices((s) => s.map((x, j) => (j === i ? { ...x, days: e.target.value } : x)))}
            />
            <button
              aria-label={t('common.delete')}
              className="min-h-touch min-w-touch shrink-0 text-ink-muted"
              onClick={() => setServices((s) => s.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <Button variant="ghost" onClick={() => setServices((s) => [...s, { name: '', price: '', days: '1' }])}>
          + {t('common.add')}
        </Button>
        <Button disabled={services.filter((s) => s.name.trim()).length === 0} onClick={() => setStep(4)}>
          {t('wizard.next')}
        </Button>
      </>
    ),
    // 4 · owner PIN + recovery code
    4: (
      <>
        <Field label={t('users.pin')}>
          <Input type="password" inputMode="numeric" className="font-mono" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        </Field>
        <Field label={t('users.pinConfirm')}>
          <Input type="password" inputMode="numeric" className="font-mono" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        </Field>
        {pin && pin2 && pin !== pin2 && <p className="text-sm text-danger-700">{t('users.pinMismatch')}</p>}
        <Card className="!bg-primary-100 text-center">
          <div className="text-sm font-medium text-primary-800">{t('users.recoveryTitle')}</div>
          <div className="my-2 font-mono text-lg font-medium tracking-wider">{recoveryCode}</div>
          <p className="text-xs text-ink-muted">{t('users.recoveryBody')}</p>
        </Card>
        <label className="flex min-h-touch items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={recoveryAck} onChange={(e) => setRecoveryAck(e.target.checked)} />
          {t('users.recoveryDone')}
        </label>
        <p className="text-xs text-ink-muted">{t('wizard.screenLock')}</p>
        <Button
          disabled={!validPinFormat(pin) || pin !== pin2 || !recoveryAck || busy}
          onClick={() => void commitShopAndUsers()}
        >
          {t('wizard.next')}
        </Button>
      </>
    ),
    // 5 · add to home screen (mandatory checkbox, per platform)
    5: (
      <>
        <p className="text-ink-muted">{isIOS ? t('wizard.step5.ios') : t('wizard.step5.android')}</p>
        <div className="rounded-card bg-wash-deep p-6 text-center text-4xl" aria-hidden>
          {isIOS ? '⬆️ → ➕' : '⋮ → ➕'}
        </div>
        <label className="flex min-h-touch items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={installAck} onChange={(e) => setInstallAck(e.target.checked)} />
          {t('wizard.step5.confirm')}
        </label>
        <Button disabled={!installAck} onClick={() => setStep(6)}>
          {t('wizard.next')}
        </Button>
      </>
    ),
    // 6 · backup destination
    6: (
      <>
        {caps.folder ? (
          <>
            <p className="text-ink-muted">{t('wizard.step6.folder')}</p>
            <Button
              variant={folderPicked ? 'secondary' : 'primary'}
              onClick={async () => {
                const ok = await pickBackupFolder()
                setFolderPicked(ok)
              }}
            >
              {folderPicked ? '✓ ' : ''}
              {t('backupData.pickFolder')}
            </Button>
            <Button variant={folderPicked ? 'primary' : 'ghost'} onClick={() => setStep(7)}>
              {t('wizard.next')}
            </Button>
          </>
        ) : (
          <>
            <p className="text-ink-muted">{t('wizard.step6.share')}</p>
            <Field label={t('wizard.step6.destName')}>
              <Input value={shareDestName} onChange={(e) => setShareDestName(e.target.value)} placeholder="iCloud Drive › Laundry Backup" />
            </Field>
            <Button disabled={!shareDestName.trim()} onClick={() => setStep(7)}>
              {t('wizard.next')}
            </Button>
          </>
        )}
      </>
    ),
    // 7 · first backup must succeed
    7: (
      <>
        <p className="text-ink-muted">{t('wizard.step7.body')}</p>
        {backupState !== 'ok' && (
          <Button disabled={backupState === 'running'} onClick={() => void runFirstBackup()}>
            {backupState === 'fail' ? `${t('backup.failed')} — ${t('backup.prompt.action')}` : t('backup.prompt.action')}
          </Button>
        )}
        {backupState === 'ok' && (
          <>
            <p className="rounded-card bg-accent-400/30 p-4 text-center font-medium text-accent-700">{t('wizard.done')}</p>
            <Button
              onClick={() => {
                lock()
                navigate('/today')
              }}
            >
              {t('wizard.finish')}
            </Button>
          </>
        )}
      </>
    ),
  }

  const titles: Record<number, string> = {
    1: t('wizard.step1.title'),
    2: t('wizard.step2.title'),
    3: t('wizard.step3.title'),
    4: t('wizard.step4.title'),
    5: t('wizard.step5.title'),
    6: t('wizard.step6.title'),
    7: t('wizard.step7.title'),
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-5 pb-safe">
      <div>
        <div className="text-sm text-ink-muted">
          {t('wizard.title')} · {step}/7
        </div>
        <h1 className="font-display text-lg font-bold">{titles[step]}</h1>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-pill ${s <= step ? 'bg-primary-500' : 'bg-line'}`} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">{steps[step]}</div>
      {step > 1 && step < 7 && step !== 5 && (
        <button className="min-h-touch text-sm text-ink-muted" onClick={() => setStep((s) => s - 1)}>
          ← {t('wizard.back')}
        </button>
      )}
    </div>
  )
}
