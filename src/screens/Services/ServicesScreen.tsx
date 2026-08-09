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
import { Button, Sheet, Field, Input } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'

/**
 * The list order is what a new order's service picker follows, so it is a
 * property of the service, not of this table's sort. The arrows only make
 * sense while the table is showing that order — under any other sort a row
 * would not move where you pushed it, so they step aside and say why.
 */
function OrderCell({
  index,
  count,
  live,
  onMove,
}: {
  index: number
  count: number
  live: boolean
  onMove: (dir: -1 | 1) => void
}) {
  if (!live) {
    return (
      <span className="font-mono text-xs text-ink-muted" title={t('services.reorderHint')}>
        #{index + 1}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="mr-1 font-mono text-xs text-ink-muted">#{index + 1}</span>
      <button
        aria-label={t('services.moveUp')}
        title={t('services.moveUp')}
        className="min-h-touch w-7 text-ink-muted disabled:opacity-30"
        disabled={index === 0}
        onClick={(e) => {
          e.stopPropagation()
          onMove(-1)
        }}
      >
        ↑
      </button>
      <button
        aria-label={t('services.moveDown')}
        title={t('services.moveDown')}
        className="min-h-touch w-7 text-ink-muted disabled:opacity-30"
        disabled={index === count - 1}
        onClick={(e) => {
          e.stopPropagation()
          onMove(1)
        }}
      >
        ↓
      </button>
    </span>
  )
}

function ActiveSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={t('services.active')}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`h-7 w-12 rounded-pill p-1 transition-colors ${on ? 'bg-positive' : 'bg-line'}`}
    >
      <span className={`block h-5 w-5 rounded-pill bg-surface transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export function ServicesScreen() {
  const toast = useToast()
  const { currentUser } = useAuth()
  const services = useLiveQuery(() => db.services.orderBy('sortOrder').toArray(), []) ?? []
  const [editing, setEditing] = useState<Service | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ name: '', price: '', days: '1', minKg: '' })

  const byOrder = [...services].sort((a, b) => a.sortOrder - b.sortOrder)
  const rankOf = (s: Service) => byOrder.findIndex((x) => x.id === s.id)

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
    const i = rankOf(s)
    const j = i + dir
    if (i < 0 || j < 0 || j >= byOrder.length) return
    await saveService({ ...byOrder[i], sortOrder: byOrder[j].sortOrder }, currentUser.id)
    await saveService({ ...byOrder[j], sortOrder: byOrder[i].sortOrder }, currentUser.id)
  }

  async function toggleActive(s: Service) {
    if (!currentUser) return
    await saveService({ ...s, active: !s.active }, currentUser.id)
  }

  const columns: Array<Column<Service>> = [
    {
      key: 'name',
      header: t('services.name'),
      sortValue: (s) => s.name.toLowerCase(),
      defaultDesc: false,
      render: (s) => <span className={`font-medium ${s.active ? '' : 'text-ink-muted'}`}>{s.name}</span>,
    },
    {
      key: 'price',
      header: t('services.price'),
      align: 'right',
      sortValue: (s) => s.pricePerKgCentavos,
      render: (s) => (
        <span className="whitespace-nowrap font-mono">
          {formatCentavos(s.pricePerKgCentavos)}
          <span className="text-ink-muted">{t('services.perKg')}</span>
        </span>
      ),
    },
    {
      key: 'turnaround',
      header: t('services.turnaround'),
      align: 'right',
      sortValue: (s) => s.turnaroundDays,
      defaultDesc: false,
      render: (s) => (
        <span className="whitespace-nowrap font-mono">{t('services.dayCount', { n: s.turnaroundDays })}</span>
      ),
    },
    {
      key: 'minKg',
      header: t('services.minKg'),
      align: 'right',
      sortValue: (s) => s.minimumKg ?? 0,
      render: (s) =>
        s.minimumKg ? (
          <span className="whitespace-nowrap font-mono">{s.minimumKg} kg</span>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        ),
    },
    {
      key: 'order',
      header: t('services.displayOrder'),
      sortValue: (s) => s.sortOrder,
      defaultDesc: false,
      render: (s, sort) => (
        <OrderCell
          index={rankOf(s)}
          count={byOrder.length}
          live={sort.sortKey === 'order' && !sort.sortDesc}
          onMove={(dir) => void move(s, dir)}
        />
      ),
    },
    {
      key: 'active',
      header: t('services.active'),
      align: 'right',
      sortValue: (s) => (s.active ? 1 : 0),
      render: (s) => <ActiveSwitch on={s.active} onToggle={() => void toggleActive(s)} />,
    },
  ]

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold">{t('services.title')}</h1>
        <Button className="!py-2" onClick={openAdd}>
          + {t('services.add')}
        </Button>
      </div>

      <DataTable
        rows={services}
        columns={columns}
        getRowKey={(s) => s.id}
        initialSortKey="order"
        initialSortDesc={false}
        onRowClick={openEdit}
        emptyText={t('services.empty')}
        renderCard={(s) => (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className={`font-medium ${s.active ? '' : 'text-ink-muted'}`}>{s.name}</span>
              <span className="whitespace-nowrap font-mono text-sm">
                {formatCentavos(s.pricePerKgCentavos)}
                <span className="text-ink-muted">{t('services.perKg')}</span>
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-xs text-ink-muted">
                {t('services.dayCount', { n: s.turnaroundDays })}
                {s.minimumKg ? ` · min ${s.minimumKg} kg` : ''}
              </span>
              <span className="flex items-center gap-1">
                <OrderCell
                  index={rankOf(s)}
                  count={byOrder.length}
                  live
                  onMove={(dir) => void move(s, dir)}
                />
                <ActiveSwitch on={s.active} onToggle={() => void toggleActive(s)} />
              </span>
            </div>
          </>
        )}
      />
      <p className="text-xs text-ink-muted">{t('services.orderFormNote')}</p>

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
          {editing && <p className="rounded-input bg-primary-soft p-3 text-sm text-primary-deep">{t('services.priceNote')}</p>}
          <Button disabled={!form.name.trim() || parsePesosInput(form.price) === null} onClick={() => void save()}>
            {t('services.save')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
