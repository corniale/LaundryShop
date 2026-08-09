/**
 * Suki — sortable table at ≥768px (scales to thousands of rows), compact
 * cards with sort chips on phones. Duplicate detection, archive not
 * delete, CSV export.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { Customer } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos } from '../../domain/money'
import { balanceCentavos, paymentStatus } from '../../domain/payments'
import { addCustomer, updateCustomer, archiveCustomer, findCustomerByContact } from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { Card, Button, Sheet, Field, Input, TextArea, EmptyState, Chip } from '../../components/ui'
import { fmtDate, downloadCsv } from '../../app/format'
import { toCsv } from '../../domain/csv'
import { useDebounced } from '../../app/useDebounced'
import { payToneClass } from '../Orders/OrdersScreen'

type SortKey = 'recent' | 'name' | 'contact' | 'orders' | 'spend' | 'balance'

export function CustomersScreen() {
  const { id: selectedId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { currentUser, isOwner } = useAuth()
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search, 250)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState({ name: '', contact: '', address: '', notes: '' })
  const [dup, setDup] = useState<Customer | null>(null)
  const [limit, setLimit] = useState(50)
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [sortDesc, setSortDesc] = useState(true)

  const customers = useLiveQuery(() => db.customers.filter((c) => !c.archivedAt).toArray(), []) ?? []
  const orders = useLiveQuery(() => db.orders.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.payments.toArray(), []) ?? []

  const paymentsByOrder = useMemo(() => {
    const map = new Map<string, typeof payments>()
    for (const p of payments) {
      const list = map.get(p.orderId) ?? []
      list.push(p)
      map.set(p.orderId, list)
    }
    return map
  }, [payments])

  const derived = useMemo(() => {
    const map = new Map<string, { orderCount: number; lifetime: number; balance: number; lastActivity: string }>()
    for (const c of customers) map.set(c.id, { orderCount: 0, lifetime: 0, balance: 0, lastActivity: c.createdAt })
    for (const o of orders) {
      if (!o.customerId || o.voidedAt) continue
      const d = map.get(o.customerId)
      if (!d) continue
      d.orderCount++
      d.lifetime += o.totalCentavos
      d.balance += Math.max(0, balanceCentavos(o.totalCentavos, paymentsByOrder.get(o.id) ?? []))
      if (o.receivedAt > d.lastActivity) d.lastActivity = o.receivedAt
    }
    return map
  }, [customers, orders, paymentsByOrder])

  const sorted = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    const rows = customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.contact?.includes(q))
    const dir = sortDesc ? -1 : 1
    const key = (c: Customer) => {
      const d = derived.get(c.id)
      switch (sortKey) {
        case 'name':
          return c.name.toLowerCase()
        case 'contact':
          return c.contact ?? ''
        case 'orders':
          return d?.orderCount ?? 0
        case 'spend':
          return d?.lifetime ?? 0
        case 'balance':
          return d?.balance ?? 0
        default:
          return d?.lastActivity ?? ''
      }
    }
    return rows.sort((a, b) => {
      const ka = key(a)
      const kb = key(b)
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir
    })
  }, [customers, debounced, derived, sortKey, sortDesc])

  const selected = customers.find((c) => c.id === selectedId)
  const selectedOrders = useMemo(
    () =>
      selected
        ? orders
            .filter((o) => o.customerId === selected.id)
            .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
        : [],
    [orders, selected],
  )

  function setSort(key: SortKey, defaultDesc = true) {
    if (sortKey === key) setSortDesc((d) => !d)
    else {
      setSortKey(key)
      setSortDesc(defaultDesc)
    }
  }

  function openAdd() {
    setEditing(null)
    setForm({ name: '', contact: '', address: '', notes: '' })
    setDup(null)
    setFormOpen(true)
  }

  function openEdit(c: Customer) {
    setEditing(c)
    setForm({ name: c.name, contact: c.contact ?? '', address: c.address ?? '', notes: c.notes ?? '' })
    setDup(null)
    setFormOpen(true)
  }

  async function save(force = false) {
    if (!currentUser || !form.name.trim()) return
    if (!editing && form.contact.trim() && !force) {
      const existing = await findCustomerByContact(form.contact)
      if (existing) {
        setDup(existing)
        return
      }
    }
    if (editing) {
      await updateCustomer(
        editing.id,
        { name: form.name.trim(), contact: form.contact.trim() || undefined, address: form.address.trim() || undefined, notes: form.notes.trim() || undefined },
        currentUser.id,
      )
    } else {
      await addCustomer(
        { name: form.name.trim(), contact: form.contact.trim() || undefined, address: form.address.trim() || undefined, notes: form.notes.trim() || undefined },
        currentUser.id,
      )
    }
    toast({ message: t('customers.saved') })
    setFormOpen(false)
  }

  function exportCsv() {
    const rows = sorted.map((c) => {
      const d = derived.get(c.id)
      return [c.name, c.contact ?? '', c.address ?? '', d?.orderCount ?? 0, ((d?.lifetime ?? 0) / 100).toFixed(2), ((d?.balance ?? 0) / 100).toFixed(2)]
    })
    downloadCsv('customers.csv', toCsv(['Name', 'Contact', 'Address', 'Orders', 'Lifetime', 'Balance'], rows))
  }

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDesc ? ' ↓' : ' ↑') : '')

  const headerCell = (key: SortKey, label: string, right = false, defaultDesc = true) => (
    <th className={right ? 'text-right' : 'text-left'}>
      <button
        onClick={() => setSort(key, defaultDesc)}
        className={`min-h-touch w-full px-3 text-[0.6875rem] font-semibold uppercase tracking-wider ${right ? 'text-right' : 'text-left'} ${
          sortKey === key ? 'text-primary-deep' : 'text-ink-muted'
        }`}
      >
        {label}
        {sortArrow(key)}
      </button>
    </th>
  )

  // ── Detail panel (shared by both breakpoints) ──
  const detail = selected && (
    <div className="flex flex-col gap-3">
      <button onClick={() => navigate('/customers')} className="min-h-touch self-start font-semibold text-primary-deep">
        ← {t('common.back')}
      </button>
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-md font-bold">{selected.name}</h2>
            <div className="text-sm text-ink-muted">{selected.contact}</div>
            <div className="text-sm text-ink-muted">{selected.address}</div>
            {selected.notes && <div className="mt-1 text-sm">{selected.notes}</div>}
          </div>
          <div className="flex flex-col gap-1">
            <Button variant="secondary" className="!py-2 text-sm" onClick={() => openEdit(selected)}>
              {t('orders.edit')}
            </Button>
            {isOwner && (
              <Button
                variant="ghost"
                className="!py-2 text-sm"
                onClick={async () => {
                  if (!currentUser) return
                  await archiveCustomer(selected.id, currentUser.id)
                  toast({ message: t('customers.archived') })
                  navigate('/customers')
                }}
              >
                {t('customers.archive')}
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
          <div>
            <div className="text-xs text-ink-muted">{t('customers.totalSpend')}</div>
            <div className="font-mono font-medium">{formatCentavos(derived.get(selected.id)?.lifetime ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">{t('customers.balance')}</div>
            <div className={`font-mono font-medium ${(derived.get(selected.id)?.balance ?? 0) > 0 ? 'text-attention-deep' : 'text-positive-deep'}`}>
              {formatCentavos(derived.get(selected.id)?.balance ?? 0)}
            </div>
          </div>
        </div>
      </Card>
      <div className="flex flex-col gap-2">
        {selectedOrders.map((o) => {
          const pStatus = paymentStatus(o.totalCentavos, paymentsByOrder.get(o.id) ?? [])
          return (
            <Card key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-sm">{o.code}</span>
                <span className="font-mono">{formatCentavos(o.totalCentavos)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                {fmtDate(o.receivedAt)} · {o.serviceNameSnapshot} · {o.kilos} kg
                <span className={`rounded-pill px-2 py-0.5 font-semibold ${payToneClass(pStatus)}`}>
                  {t(`pay.${pStatus}` as 'pay.unpaid')}
                </span>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )

  // Add/edit form — a centered floating dialog over a dimmed page.
  const formPanel = (
    <Sheet
      open={formOpen}
      onClose={() => setFormOpen(false)}
      title={editing ? t('orders.edit') : t('customers.add')}
    >
      <div className="flex flex-col gap-3">
        <Field label={t('customers.name')}>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label={t('customers.contact')}>
          <Input inputMode="tel" value={form.contact} onChange={(e) => { setForm((f) => ({ ...f, contact: e.target.value })); setDup(null) }} />
        </Field>
        <Field label={t('customers.address')}>
          <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </Field>
        <Field label={t('customers.notes')}>
          <TextArea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </Field>
        {dup && (
          <div className="rounded-input bg-attention-soft p-3 text-sm text-attention-deep">
            {t('customers.duplicate', { name: dup.name })}
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" className="!py-2 text-sm" onClick={() => { setFormOpen(false); navigate(`/customers/${dup.id}`) }}>
                {t('customers.useExisting')}
              </Button>
              <Button variant="ghost" className="!py-2 text-sm" onClick={() => void save(true)}>
                {t('customers.createAnyway')}
              </Button>
            </div>
          </div>
        )}
        <div className="flex gap-2 border-t border-line pt-3">
          <Button variant="ghost" className="flex-none" onClick={() => setFormOpen(false)}>
            {t('common.cancel')}
          </Button>
          {!dup && (
            <Button className="flex-1" disabled={!form.name.trim()} onClick={() => void save()}>
              {t('customers.save')}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-bold">{t('customers.title')}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" className="!py-2 text-sm" onClick={exportCsv}>
            {t('customers.exportCsv')}
          </Button>
          <Button className="!py-2" onClick={openAdd}>
            + {t('customers.add')}
          </Button>
        </div>
      </div>

      {selected ? (
        <>
          {formPanel}
          {detail}
        </>
      ) : (
        <>
          <Input placeholder={t('customers.search')} type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
          {formPanel}

          {/* Phone: sort chips + compact cards */}
          <div className="md:hidden">
            <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
              {(
                [
                  ['recent', t('customers.sort.recent')],
                  ['name', t('customers.sort.name')],
                  ['balance', t('customers.sort.balance')],
                  ['spend', t('customers.sort.spend')],
                ] as Array<[SortKey, string]>
              ).map(([key, label]) => (
                <Chip key={key} selected={sortKey === key} onClick={() => setSort(key, key !== 'name')}>
                  {label}
                  {sortArrow(key)}
                </Chip>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {sorted.slice(0, limit).map((c) => {
                const d = derived.get(c.id)
                return (
                  <Card key={c.id} onClick={() => navigate(`/customers/${c.id}`)}>
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold">{c.name}</span>
                      {(d?.balance ?? 0) > 0 && (
                        <span className="font-mono text-sm font-medium text-attention-deep">{formatCentavos(d!.balance)}</span>
                      )}
                    </div>
                    <div className="text-sm text-ink-muted">
                      {c.contact} · {t('customers.orderCount', { n: d?.orderCount ?? 0 })}
                    </div>
                  </Card>
                )
              })}
              {sorted.length > limit && (
                <Button variant="secondary" onClick={() => setLimit((l) => l + 50)}>
                  +{sorted.length - limit}
                </Button>
              )}
              {sorted.length === 0 && <EmptyState>{t('customers.empty')}</EmptyState>}
            </div>
          </div>

          {/* Tablet/desktop: sortable table */}
          <div className="hidden md:block">
            {sorted.length === 0 ? (
              <EmptyState>{t('customers.empty')}</EmptyState>
            ) : (
              <div className="overflow-x-auto rounded-card border border-line bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-wash">
                      {headerCell('name', t('customers.name'), false, false)}
                      {headerCell('contact', t('customers.contact'), false, false)}
                      {headerCell('orders', t('tab.orders'), true)}
                      {headerCell('spend', t('customers.totalSpend'), true)}
                      {headerCell('balance', t('customers.balance'), true)}
                      {headerCell('recent', t('customers.lastActivity'), true)}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.slice(0, limit).map((c) => {
                      const d = derived.get(c.id)
                      return (
                        <tr
                          key={c.id}
                          onClick={() => navigate(`/customers/${c.id}`)}
                          className="cursor-pointer border-b border-line last:border-0 hover:bg-wash"
                        >
                          <td className="px-3 py-2.5 font-medium">{c.name}</td>
                          <td className="px-3 py-2.5 text-ink-muted">{c.contact}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{d?.orderCount ?? 0}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{formatCentavos(d?.lifetime ?? 0)}</td>
                          <td className={`px-3 py-2.5 text-right font-mono ${(d?.balance ?? 0) > 0 ? 'font-medium text-attention-deep' : 'text-ink-muted'}`}>
                            {formatCentavos(d?.balance ?? 0)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-ink-muted">
                            {d?.lastActivity ? fmtDate(d.lastActivity) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {sorted.length > limit && (
                  <div className="p-2">
                    <Button variant="secondary" className="w-full" onClick={() => setLimit((l) => l + 50)}>
                      +{sorted.length - limit}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

    </div>
  )
}
