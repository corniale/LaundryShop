/** Services at Presyo — Owner-only. Price edits never change past orders. */
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { Service } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos, parsePesosInput } from '../../domain/money'
import { saveService } from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { Card, Button, Sheet, Field, Input } from '../../components/ui'

export function ServicesScreen() {
  const toast = useToast()
  const { currentUser } = useAuth()
  const services = useLiveQuery(() => db.services.orderBy('sortOrder').toArray(), []) ?? []
  const [editing, setEditing] = useState<Service | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ name: '', price: '', days: '1', minKg: '' })

  function openAdd() {
    setEditing(null)
    setForm({ name: '', price: '', days: '1', minKg: '' })
    setFormOpen(true)
  }

  function openEdit(s: Service) {
    setEditing(s)
    setForm({
      name: s.name,
      price: (s.pricePerKgCentavos / 100).toFixed(2),
      days: String(s.turnaroundDays),
      minKg: s.minimumKg ? String(s.minimumKg) : '',
    })
    setFormOpen(true)
  }

  async function save() {
    if (!currentUser) return
    const price = parsePesosInput(form.price)
    if (!form.name.trim() || price === null) return
    await saveService(
      {
        id: editing?.id,
        name: form.name.trim(),
        pricePerKgCentavos: price,
        turnaroundDays: Number(form.days) || 1,
        minimumKg: form.minKg ? Number(form.minKg) : undefined,
        active: editing?.active ?? true,
        sortOrder: editing?.sortOrder ?? services.length,
      },
      currentUser.id,
    )
    toast({ message: t('services.saved') })
    setFormOpen(false)
  }

  async function move(s: Service, dir: -1 | 1) {
    if (!currentUser) return
    const sorted = [...services].sort((a, b) => a.sortOrder - b.sortOrder)
    const i = sorted.findIndex((x) => x.id === s.id)
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    await saveService({ ...sorted[i], sortOrder: sorted[j].sortOrder }, currentUser.id)
    await saveService({ ...sorted[j], sortOrder: sorted[i].sortOrder }, currentUser.id)
  }

  async function toggleActive(s: Service) {
    if (!currentUser) return
    await saveService({ ...s, active: !s.active }, currentUser.id)
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold">{t('services.title')}</h1>
        <Button className="!py-2" onClick={openAdd}>
          + {t('services.add')}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {services.map((s, i) => (
          <Card key={s.id} className={s.active ? '' : 'opacity-50'}>
            <div className="flex items-center justify-between gap-2">
              <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(s)}>
                <div className="font-semibold">{s.name}</div>
                <div className="font-mono text-sm text-ink-muted">
                  {formatCentavos(s.pricePerKgCentavos)}
                  {t('services.perKg')} · {s.turnaroundDays} {t('services.days')}
                  {s.minimumKg ? ` · min ${s.minimumKg} kg` : ''}
                </div>
              </button>
              <div className="flex items-center gap-1">
                <button aria-label="Up" className="min-h-touch min-w-touch text-ink-muted disabled:opacity-30" disabled={i === 0} onClick={() => void move(s, -1)}>
                  ↑
                </button>
                <button aria-label="Down" className="min-h-touch min-w-touch text-ink-muted disabled:opacity-30" disabled={i === services.length - 1} onClick={() => void move(s, 1)}>
                  ↓
                </button>
                <button
                  role="switch"
                  aria-checked={s.active}
                  aria-label={t('services.active')}
                  onClick={() => void toggleActive(s)}
                  className={`h-8 w-14 rounded-pill p-1 transition-colors ${s.active ? 'bg-accent-500' : 'bg-line'}`}
                >
                  <span className={`block h-6 w-6 rounded-pill bg-surface transition-transform ${s.active ? 'translate-x-6' : ''}`} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? t('orders.edit') : t('services.add')}>
        <div className="flex flex-col gap-3">
          <Field label={t('services.name')}>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label={t('services.price')}>
            <Input inputMode="decimal" className="font-mono" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('services.turnaround')}>
              <Input inputMode="numeric" type="number" min="0" value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} />
            </Field>
            <Field label={t('services.minKg')}>
              <Input inputMode="decimal" type="number" min="0" step="0.5" value={form.minKg} onChange={(e) => setForm((f) => ({ ...f, minKg: e.target.value }))} />
            </Field>
          </div>
          {editing && <p className="rounded-input bg-primary-100 p-3 text-sm text-primary-800">{t('services.priceNote')}</p>}
          <Button disabled={!form.name.trim() || parsePesosInput(form.price) === null} onClick={() => void save()}>
            {t('services.save')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
