/**
 * Intake form, in the physical counter sequence: customer → service →
 * kilos → items → add-ons/discount → live total → promised date → payment.
 * Drafts persist so a killed app loses nothing.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, format } from 'date-fns'
import { db } from '../../data/db'
import type { Customer, PaymentMethod } from '../../data/types'
import { t } from '../../i18n/strings'
import { priceOrder, formatCentavos, parsePesosInput } from '../../domain/money'
import {
  addCustomer,
  createOrder,
  findCustomerByContact,
  saveDraft,
  loadDraft,
  clearDraft,
  type NewOrderInput,
} from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { Button, Field, Input, TextArea, Chip, ActionBar } from '../../components/ui'

const METHODS: PaymentMethod[] = ['cash', 'gcash', 'maya', 'bank', 'other']

interface DraftState {
  customerId?: string
  walkInName: string
  customerMode: 'existing' | 'walkin'
  serviceId?: string
  kilos: string
  itemCount: string
  itemNotes: string
  addOns: Array<{ label: string; amount: string }>
  discount: string
  discountReason: string
  promisedAt: string
  payMode: 'none' | 'partial' | 'full'
  payAmount: string
  payMethod: PaymentMethod
  payReference: string
}

const emptyDraft: DraftState = {
  walkInName: '',
  customerMode: 'existing',
  kilos: '',
  itemCount: '',
  itemNotes: '',
  addOns: [],
  discount: '',
  discountReason: '',
  promisedAt: '',
  payMode: 'none',
  payAmount: '',
  payMethod: 'cash',
  payReference: '',
}

export function OrderIntake({ onSaved, onClose }: { onSaved: (orderId: string, code: string) => void; onClose: () => void }) {
  const { currentUser } = useAuth()
  const toast = useToast()
  const services = useLiveQuery(() => db.services.filter((s) => s.active).sortBy('sortOrder'), []) ?? []
  const customers = useLiveQuery(() => db.customers.filter((c) => !c.archivedAt).toArray(), []) ?? []

  const [draft, setDraft] = useState<DraftState>(emptyDraft)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCust, setNewCust] = useState({ name: '', contact: '', address: '' })
  const [dupCustomer, setDupCustomer] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)
  const loaded = useRef(false)

  // Restore a persisted draft (form survives being killed mid-entry)
  useEffect(() => {
    void loadDraft('order').then((json) => {
      if (json && !loaded.current) {
        try {
          setDraft({ ...emptyDraft, ...JSON.parse(json) })
        } catch {
          // corrupt draft — start clean
        }
      }
      loaded.current = true
    })
  }, [])

  useEffect(() => {
    if (!loaded.current) return
    const id = setTimeout(() => void saveDraft('order', JSON.stringify(draft)), 400)
    return () => clearTimeout(id)
  }, [draft])

  const service = services.find((s) => s.id === draft.serviceId)

  // Promised date auto-fills from service turnaround, stays editable
  useEffect(() => {
    if (service && !draft.promisedAt) {
      setDraft((d) => ({
        ...d,
        promisedAt: format(addDays(new Date(), service.turnaroundDays), 'yyyy-MM-dd'),
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.id])

  const kilos = Number(draft.kilos) || 0
  const pricing = useMemo(() => {
    if (!service || kilos <= 0) return null
    return priceOrder({
      kilos,
      pricePerKgCentavos: service.pricePerKgCentavos,
      minimumKg: service.minimumKg,
      addOns: draft.addOns.map((a) => ({ amountCentavos: parsePesosInput(a.amount) ?? 0 })),
      discountCentavos: parsePesosInput(draft.discount) ?? 0,
    })
  }, [service, kilos, draft.addOns, draft.discount])

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return customers.slice(0, 6)
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.contact?.includes(q))
      .slice(0, 6)
  }, [customers, customerSearch])

  const selectedCustomer = customers.find((c) => c.id === draft.customerId)

  async function handleAddCustomer() {
    if (!currentUser || !newCust.name.trim()) return
    // duplicate detection on contact number
    if (newCust.contact.trim() && !dupCustomer) {
      const existing = await findCustomerByContact(newCust.contact)
      if (existing) {
        setDupCustomer(existing)
        return
      }
    }
    const c = await addCustomer(
      { name: newCust.name.trim(), contact: newCust.contact.trim() || undefined, address: newCust.address.trim() || undefined, notes: undefined },
      currentUser.id,
    )
    setDraft((d) => ({ ...d, customerId: c.id, customerMode: 'existing' }))
    setShowNewCustomer(false)
    setDupCustomer(null)
    setNewCust({ name: '', contact: '', address: '' })
  }

  const canSave =
    !!currentUser &&
    !!service &&
    kilos > 0 &&
    pricing !== null &&
    (draft.customerMode === 'walkin' ? draft.walkInName.trim().length > 0 : !!draft.customerId) &&
    ((parsePesosInput(draft.discount) ?? 0) === 0 || draft.discountReason.trim().length > 0)

  async function handleSave() {
    if (!canSave || !pricing || !service || !currentUser || saving) return
    setSaving(true)
    try {
      const payAmount =
        draft.payMode === 'full'
          ? pricing.totalCentavos
          : draft.payMode === 'partial'
            ? (parsePesosInput(draft.payAmount) ?? 0)
            : 0
      const input: NewOrderInput = {
        customerId: draft.customerMode === 'existing' ? draft.customerId : undefined,
        walkInName: draft.customerMode === 'walkin' ? draft.walkInName.trim() : undefined,
        serviceId: service.id,
        kilos,
        itemCount: draft.itemCount ? Number(draft.itemCount) : undefined,
        itemNotes: draft.itemNotes.trim() || undefined,
        addOns: draft.addOns
          .filter((a) => a.label.trim() && (parsePesosInput(a.amount) ?? 0) > 0)
          .map((a) => ({ label: a.label.trim(), amountCentavos: parsePesosInput(a.amount) ?? 0 })),
        discountCentavos: parsePesosInput(draft.discount) ?? 0,
        discountReason: draft.discountReason.trim() || undefined,
        subtotalCentavos: pricing.subtotalCentavos,
        totalCentavos: pricing.totalCentavos,
        promisedAt: new Date(`${draft.promisedAt}T18:00:00`).toISOString(),
        initialPayment:
          payAmount > 0
            ? { amountCentavos: payAmount, method: draft.payMethod, reference: draft.payReference.trim() || undefined }
            : undefined,
      }
      const order = await createOrder(input, currentUser.id)
      await clearDraft('order')
      onSaved(order.id, order.code)
    } catch {
      toast({ message: t('common.error.save') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1 · Customer */}
      <section>
        <div className="mb-2 flex gap-2">
          <Chip selected={draft.customerMode === 'existing'} onClick={() => setDraft((d) => ({ ...d, customerMode: 'existing' }))}>
            {t('orders.customer')}
          </Chip>
          <Chip selected={draft.customerMode === 'walkin'} onClick={() => setDraft((d) => ({ ...d, customerMode: 'walkin' }))}>
            {t('orders.walkIn')}
          </Chip>
        </div>

        {draft.customerMode === 'walkin' ? (
          <Input
            placeholder={t('orders.walkInName')}
            value={draft.walkInName}
            onChange={(e) => setDraft((d) => ({ ...d, walkInName: e.target.value }))}
          />
        ) : selectedCustomer ? (
          <div className="flex items-center justify-between rounded-input border border-primary-300 bg-primary-100 px-3 py-2.5">
            <div>
              <div className="font-medium">{selectedCustomer.name}</div>
              <div className="text-xs text-ink-muted">{selectedCustomer.contact}</div>
            </div>
            <button className="min-h-touch px-2 text-sm text-primary-600" onClick={() => setDraft((d) => ({ ...d, customerId: undefined }))}>
              ✕
            </button>
          </div>
        ) : (
          <div>
            <Input
              placeholder={t('customers.search')}
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            <div className="mt-2 flex flex-col gap-1">
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  className="min-h-touch rounded-input bg-surface px-3 py-2 text-left shadow-card"
                  onClick={() => setDraft((d) => ({ ...d, customerId: c.id }))}
                >
                  <span className="font-medium">{c.name}</span>{' '}
                  <span className="text-sm text-ink-muted">{c.contact}</span>
                </button>
              ))}
              {!showNewCustomer && (
                <button className="min-h-touch rounded-input px-3 py-2 text-left font-semibold text-primary-600" onClick={() => setShowNewCustomer(true)}>
                  {t('orders.newCustomer')}
                </button>
              )}
            </div>
            {showNewCustomer && (
              <div className="mt-2 flex flex-col gap-2 rounded-card bg-wash-deep p-3">
                <Input placeholder={t('customers.name')} value={newCust.name} onChange={(e) => setNewCust((n) => ({ ...n, name: e.target.value }))} />
                <Input
                  placeholder={t('customers.contact')}
                  inputMode="tel"
                  value={newCust.contact}
                  onChange={(e) => {
                    setNewCust((n) => ({ ...n, contact: e.target.value }))
                    setDupCustomer(null)
                  }}
                />
                <Input placeholder={t('customers.address')} value={newCust.address} onChange={(e) => setNewCust((n) => ({ ...n, address: e.target.value }))} />
                {dupCustomer && (
                  <div className="rounded-input bg-sun-500/15 p-3 text-sm text-sun-700">
                    {t('customers.duplicate', { name: dupCustomer.name })}
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="secondary"
                        className="!py-2 text-sm"
                        onClick={() => {
                          setDraft((d) => ({ ...d, customerId: dupCustomer.id }))
                          setShowNewCustomer(false)
                          setDupCustomer(null)
                        }}
                      >
                        {t('customers.useExisting')}
                      </Button>
                      <Button variant="ghost" className="!py-2 text-sm" onClick={() => void handleAddCustomer()}>
                        {t('customers.createAnyway')}
                      </Button>
                    </div>
                  </div>
                )}
                {!dupCustomer && (
                  <Button variant="secondary" onClick={() => void handleAddCustomer()} disabled={!newCust.name.trim()}>
                    {t('customers.save')}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2 · Service */}
      <section>
        <div className="mb-1 text-sm font-medium text-ink-muted">{t('orders.service')}</div>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <Chip
              key={s.id}
              selected={draft.serviceId === s.id}
              onClick={() => setDraft((d) => ({ ...d, serviceId: s.id, promisedAt: '' }))}
            >
              {s.name} · {formatCentavos(s.pricePerKgCentavos)}
              {t('services.perKg')}
            </Chip>
          ))}
        </div>
      </section>

      {/* 3 · Kilos — large, keypad friendly */}
      <Field label={t('orders.kilos')}>
        <Input
          inputMode="decimal"
          step="0.1"
          type="number"
          min="0"
          className="font-mono !text-xl"
          value={draft.kilos}
          onChange={(e) => setDraft((d) => ({ ...d, kilos: e.target.value }))}
        />
      </Field>

      {/* 4 · Item count + notes */}
      <div className="grid grid-cols-[110px_1fr] gap-2">
        <Field label={t('orders.itemCount')}>
          <Input
            inputMode="numeric"
            type="number"
            min="0"
            className="font-mono"
            value={draft.itemCount}
            onChange={(e) => setDraft((d) => ({ ...d, itemCount: e.target.value }))}
          />
        </Field>
        <Field label={t('orders.itemNotes')} hint={t('orders.itemPrompt')}>
          <Input value={draft.itemNotes} onChange={(e) => setDraft((d) => ({ ...d, itemNotes: e.target.value }))} />
        </Field>
      </div>

      {/* 5 · Add-ons + discount */}
      <section>
        <div className="mb-1 text-sm font-medium text-ink-muted">{t('orders.addons')}</div>
        {draft.addOns.map((a, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <Input
              placeholder={t('orders.addonLabel')}
              value={a.label}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  addOns: d.addOns.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                }))
              }
            />
            <Input
              placeholder="₱"
              inputMode="decimal"
              className="w-28 font-mono"
              value={a.amount}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  addOns: d.addOns.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)),
                }))
              }
            />
            <button
              aria-label={t('common.delete')}
              className="min-h-touch min-w-touch text-ink-muted"
              onClick={() => setDraft((d) => ({ ...d, addOns: d.addOns.filter((_, j) => j !== i) }))}
            >
              ✕
            </button>
          </div>
        ))}
        <Button variant="ghost" className="!py-2 text-sm" onClick={() => setDraft((d) => ({ ...d, addOns: [...d.addOns, { label: '', amount: '' }] }))}>
          + {t('common.add')}
        </Button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label={t('orders.discount')}>
            <Input
              inputMode="decimal"
              className="font-mono"
              value={draft.discount}
              onChange={(e) => setDraft((d) => ({ ...d, discount: e.target.value }))}
            />
          </Field>
          {(parsePesosInput(draft.discount) ?? 0) > 0 && (
            <Field label={t('orders.discountReason')}>
              <Input value={draft.discountReason} onChange={(e) => setDraft((d) => ({ ...d, discountReason: e.target.value }))} />
            </Field>
          )}
        </div>
      </section>

      {/* 6 · Live total */}
      <div className="rounded-card bg-wash-deep p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-muted">{t('orders.subtotal')}</span>
          <span className="font-mono">{pricing ? formatCentavos(pricing.subtotalCentavos) : '—'}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-display text-md font-semibold">{t('orders.total')}</span>
          <span className="font-mono text-2xl font-medium">
            {pricing ? formatCentavos(pricing.totalCentavos) : '—'}
          </span>
        </div>
      </div>

      {/* 7 · Promised date */}
      <Field label={t('orders.promised')}>
        <Input
          type="date"
          value={draft.promisedAt}
          onChange={(e) => setDraft((d) => ({ ...d, promisedAt: e.target.value }))}
        />
      </Field>

      {/* 8 · Payment now */}
      <section>
        <div className="mb-1 text-sm font-medium text-ink-muted">{t('orders.payNow')}</div>
        <div className="flex gap-2">
          {(['none', 'partial', 'full'] as const).map((mode) => (
            <Chip key={mode} selected={draft.payMode === mode} onClick={() => setDraft((d) => ({ ...d, payMode: mode }))}>
              {t(mode === 'none' ? 'orders.payNone' : mode === 'partial' ? 'orders.payPartial' : 'orders.payFull')}
            </Chip>
          ))}
        </div>
        {draft.payMode !== 'none' && (
          <div className="mt-2 flex flex-col gap-2">
            {draft.payMode === 'partial' && (
              <Field label={t('payments.amount')}>
                <Input
                  inputMode="decimal"
                  className="font-mono"
                  value={draft.payAmount}
                  onChange={(e) => setDraft((d) => ({ ...d, payAmount: e.target.value }))}
                />
              </Field>
            )}
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <Chip key={m} selected={draft.payMethod === m} onClick={() => setDraft((d) => ({ ...d, payMethod: m }))}>
                  {t(`payments.method.${m}` as 'payments.method.cash')}
                </Chip>
              ))}
            </div>
            {(draft.payMethod === 'gcash' || draft.payMethod === 'maya') && (
              <Input
                placeholder={t('payments.reference')}
                value={draft.payReference}
                onChange={(e) => setDraft((d) => ({ ...d, payReference: e.target.value }))}
              />
            )}
          </div>
        )}
      </section>

      <ActionBar>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-none" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1" disabled={!canSave || saving} onClick={() => void handleSave()}>
            {t('orders.save')}
          </Button>
        </div>
      </ActionBar>
    </div>
  )
}
