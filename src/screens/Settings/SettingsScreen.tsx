/** Shop Settings — Owner-only. Danger zone forces a backup before reset. */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { t, setLocale } from '../../i18n/strings'
import { updateShop, wipeAllData, updateAppMeta } from '../../data/repository'
import { runBackup } from '../../backup/destinations'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { Card, Button, Field, Input, TextArea, Chip, Sheet } from '../../components/ui'

export function SettingsScreen() {
  const navigate = useNavigate()
  const toast = useToast()
  const { currentUser, lock } = useAuth()
  const shop = useLiveQuery(() => db.shop.toArray(), [])?.[0]

  const [form, setForm] = useState({
    name: '',
    ownerName: '',
    address: '',
    contact: '',
    receiptFooter: '',
    orderCodePrefix: 'ORD',
    readyMessageTemplate: '',
    locale: 'tl' as 'tl' | 'en',
  })
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetText, setResetText] = useState('')

  useEffect(() => {
    if (shop && shop.id !== loadedId) {
      setForm({
        name: shop.name,
        ownerName: shop.ownerName,
        address: shop.address,
        contact: shop.contact,
        receiptFooter: shop.receiptFooter ?? '',
        orderCodePrefix: shop.orderCodePrefix,
        readyMessageTemplate: shop.readyMessageTemplate ?? t('message.readyTemplate'),
        locale: shop.locale,
      })
      setLoadedId(shop.id)
    }
  }, [shop, loadedId])

  async function save() {
    if (!currentUser || !shop) return
    await updateShop(
      {
        name: form.name.trim(),
        ownerName: form.ownerName.trim(),
        address: form.address.trim(),
        contact: form.contact.trim(),
        receiptFooter: form.receiptFooter.trim(),
        orderCodePrefix: form.orderCodePrefix.trim() || 'ORD',
        readyMessageTemplate: form.readyMessageTemplate.trim(),
        locale: form.locale,
      },
      currentUser.id,
    )
    setLocale(form.locale)
    toast({ message: t('settings.saved') })
  }

  async function onLogo(file: File) {
    if (!currentUser) return
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      const size = 128
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      const min = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size)
      await updateShop({ logoDataUrl: canvas.toDataURL('image/png') }, currentUser.id)
      URL.revokeObjectURL(url)
      toast({ message: t('settings.saved') })
    }
    img.src = url
  }

  async function resetAll() {
    // forces a backup first
    const result = await runBackup('manual')
    if (!result.ok) {
      toast({ message: t('backup.failed') })
      return
    }
    await wipeAllData()
    await updateAppMeta({ demoMode: false, setupComplete: false, lastBackupAt: undefined })
    toast({ message: t('settings.resetDone') })
    setResetOpen(false)
    lock()
    navigate('/wizard')
  }

  if (!shop) return null

  return (
    <div className="flex flex-col gap-3 p-4">
      <h1 className="font-display text-lg font-bold">{t('settings.title')}</h1>

      <Card className="flex flex-col gap-3">
        <Field label={t('settings.shopName')}>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label={t('settings.ownerName')}>
          <Input value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} />
        </Field>
        <Field label={t('settings.address')}>
          <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </Field>
        <Field label={t('settings.contact')}>
          <Input inputMode="tel" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
        </Field>
        <Field label={t('settings.logo')}>
          <div className="flex items-center gap-3">
            {shop.logoDataUrl && <img src={shop.logoDataUrl} alt="" className="h-12 w-12 rounded-input" />}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onLogo(f)
              }}
            />
          </div>
        </Field>
        <Field label={t('settings.orderPrefix')}>
          <Input className="font-mono uppercase" value={form.orderCodePrefix} onChange={(e) => setForm((f) => ({ ...f, orderCodePrefix: e.target.value.toUpperCase() }))} />
        </Field>
        <Field label={t('settings.receiptFooter')}>
          <TextArea value={form.receiptFooter} onChange={(e) => setForm((f) => ({ ...f, receiptFooter: e.target.value }))} />
        </Field>
        <Field label={t('settings.messageTemplate')} hint="{name} {code} {total} {balance} {shop}">
          <TextArea value={form.readyMessageTemplate} onChange={(e) => setForm((f) => ({ ...f, readyMessageTemplate: e.target.value }))} />
        </Field>
        <Field label={t('settings.language')}>
          <div className="flex gap-2">
            <Chip selected={form.locale === 'tl'} onClick={() => setForm((f) => ({ ...f, locale: 'tl' }))}>
              Taglish
            </Chip>
            <Chip selected={form.locale === 'en'} onClick={() => setForm((f) => ({ ...f, locale: 'en' }))}>
              English
            </Chip>
          </div>
        </Field>
        <Button onClick={() => void save()}>{t('settings.save')}</Button>
      </Card>

      <Button variant="secondary" onClick={() => navigate('/more/backup')}>
        {t('more.backup')} ›
      </Button>

      <Card className="border border-danger-500/40">
        <h2 className="mb-2 font-display text-base font-semibold text-danger-700">{t('settings.dangerZone')}</h2>
        <p className="mb-3 text-sm text-ink-muted">{t('settings.resetWarning')}</p>
        <Button variant="danger" className="w-full" onClick={() => setResetOpen(true)}>
          {t('settings.resetAll')}
        </Button>
      </Card>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title={t('settings.resetAll')}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-danger-700">{t('settings.resetWarning')}</p>
          <p className="text-sm font-medium">{t('backupData.typeToConfirm', { word: 'BURAHIN' })}</p>
          <Input value={resetText} onChange={(e) => setResetText(e.target.value)} className="font-mono uppercase" />
          <Button variant="danger" disabled={resetText.trim().toUpperCase() !== 'BURAHIN'} onClick={() => void resetAll()}>
            {t('settings.resetAll')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
