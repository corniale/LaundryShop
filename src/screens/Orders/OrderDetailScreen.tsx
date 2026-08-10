/**
 * Order detail — timeline of status events and payments (who + when),
 * edit window rules, void with reason, reprint stub, take payment.
 * Status changes happen on the rail (see components/StatusRail).
 */
import { useMemo, useState } from 'react'
import { IconPencil } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { PaymentMethod } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos, parsePesosInput } from '../../domain/money'
import { orderItemCount } from '../../domain/orders'
import { paidCentavos, balanceCentavos, paymentStatus } from '../../domain/payments'
import {
  setOrderStatus,
  voidOrder,
  recordPayment,
  reversePayment,
  updateOrder,
} from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { statusLabel } from '../../components/WashLine'
import { StatusRail } from '../../components/StatusRail'
import { Card, Button, Sheet, Field, Input, Chip, TextArea } from '../../components/ui'
import { fmtDateTime, fmtDateFull } from '../../app/format'
import { StubActions, buildReadyMessage, sendReadyMessage } from '../../components/Stub'
import { payToneClass } from './OrdersScreen'
import { clientConfig } from '../../config/client.config'

const METHODS: PaymentMethod[] = ['cash', 'gcash', 'maya', 'bank', 'other']

export function OrderDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { currentUser, isOwner } = useAuth()

  const order = useLiveQuery(() => (id ? db.orders.get(id) : undefined), [id])
  const events = useLiveQuery(() => (id ? db.statusEvents.where('orderId').equals(id).sortBy('at') : []), [id]) ?? []
  const payments = useLiveQuery(() => (id ? db.payments.where('orderId').equals(id).sortBy('receivedAt') : []), [id]) ?? []
  const users = useLiveQuery(() => db.users.toArray(), []) ?? []
  const shop = useLiveQuery(() => db.shop.toArray(), [])?.[0]
  const customer = useLiveQuery(
    () => (order?.customerId ? db.customers.get(order.customerId) : undefined),
    [order?.customerId],
  )

  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [payReference, setPayReference] = useState('')
  const [confirmOverpay, setConfirmOverpay] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [reverseTarget, setReverseTarget] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editPromised, setEditPromised] = useState('')

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users])

  if (!order) return <div className="p-6 text-ink-muted">…</div>

  const paid = paidCentavos(payments)
  const balance = balanceCentavos(order.totalCentavos, payments)
  const pStatus = paymentStatus(order.totalCentavos, payments)
  const customerName = order.walkInName ?? customer?.name ?? '—'

  const canEdit =
    isOwner ||
    (currentUser?.id === order.createdBy &&
      Date.now() - new Date(order.receivedAt).getTime() < clientConfig.staffEditWindowMinutes * 60_000)

  // Optimistic: the rail renders the move at once and rolls back if the
  // write fails. A deleted order discards the write without an error.
  async function changeStatus(to: NonNullable<typeof order>['status']): Promise<boolean> {
    if (!currentUser || !order) return false
    try {
      await setOrderStatus(order.id, to, currentUser.id)
      toast({ message: t('orders.advanced', { code: order.code, status: statusLabel(to) }) })
      return true
    } catch {
      const stillThere = await db.orders.get(order.id)
      if (!stillThere) return true // order vanished mid-transition: drop it quietly
      return false
    }
  }

  async function submitPayment() {
    if (!currentUser || !order) return
    const amount = parsePesosInput(payAmount)
    if (!amount || amount <= 0) return
    if (amount > balance && !confirmOverpay) {
      setConfirmOverpay(true)
      return
    }
    await recordPayment(order.id, amount, payMethod, currentUser.id, payReference || undefined)
    toast({ message: t('payments.recorded', { amount: formatCentavos(amount) }) })
    setPayOpen(false)
    setPayAmount('')
    setConfirmOverpay(false)
  }

  async function messageCustomer() {
    if (!shop || !order) return
    await sendReadyMessage(buildReadyMessage(shop, order, payments, customerName), customer?.contact)
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="min-h-touch min-w-touch text-primary-deep" aria-label="Back">
          ←
        </button>
        <h1 className="font-mono text-lg font-medium">{order.code}</h1>
        {order.voidedAt && (
          <span className="rounded-pill bg-attention-soft px-2 py-0.5 text-xs font-bold text-attention-deep">
            {t('orders.voidedBadge')} — {order.voidReason}
          </span>
        )}
      </div>

      <Card>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-semibold">{customerName}</div>
            {/* One row per service, each with the price it was quoted at */}
            {order.lines.map((l, i) => (
              <div key={i} className="text-sm text-ink-muted">
                {l.serviceNameSnapshot} · {l.kilos} {t('orders.kg')} ·{' '}
                {formatCentavos(l.pricePerKgSnapshot)}
                {t('services.perKg')}
                {l.billedKilos > l.kilos && (
                  <span className="ml-1 text-xs">
                    ({t('orders.billedKilos', { n: l.billedKilos })})
                  </span>
                )}
                <span className="ml-2 font-mono text-ink">{formatCentavos(l.lineTotalCentavos)}</span>
              </div>
            ))}
            {orderItemCount(order) != null && (
              <div className="text-sm text-ink-muted">
                {orderItemCount(order)} {t('orders.pcs')} — {order.itemNotes}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="font-mono text-xl font-medium">{formatCentavos(order.totalCentavos)}</div>
            <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${payToneClass(pStatus)}`}>
              {t(`pay.${pStatus}` as 'pay.unpaid')}
            </span>
          </div>
        </div>

        {order.addOns.length > 0 && (
          <div className="mt-2 border-t border-line pt-2 text-sm">
            {order.addOns.map((a, i) => (
              <div key={i} className="flex justify-between text-ink-muted">
                <span>{a.label}</span>
                <span className="font-mono">{formatCentavos(a.amountCentavos)}</span>
              </div>
            ))}
          </div>
        )}
        {order.discountCentavos > 0 && (
          <div className="flex justify-between text-sm text-positive-deep">
            <span>
              {t('orders.discount')} {order.discountReason && `(${order.discountReason})`}
            </span>
            <span className="font-mono">−{formatCentavos(order.discountCentavos)}</span>
          </div>
        )}

        <div className="mt-2 border-t border-line pt-2">
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">{t('orders.paid')}</span>
            <span className="font-mono">{formatCentavos(paid)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>{t('orders.balance')}</span>
            <span className={`font-mono ${balance > 0 ? 'text-attention-deep' : 'text-positive-deep'}`}>
              {formatCentavos(balance)}
            </span>
          </div>
          {/* The date is its own edit affordance — no separate button. */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
            <span>{t('orders.readyBy')}:</span>
            {canEdit ? (
              <button
                onClick={() => {
                  setEditPromised(order.promisedAt.slice(0, 10))
                  setEditOpen(true)
                }}
                className="inline-flex min-h-touch items-center gap-1 font-medium text-primary-deep underline decoration-dotted underline-offset-4"
                aria-label={t('orders.editPickupDate')}
              >
                {fmtDateFull(order.promisedAt)}
                <IconPencil size={13} stroke={1.75} aria-hidden />
              </button>
            ) : (
              <span>{fmtDateFull(order.promisedAt)}</span>
            )}
          </div>
        </div>
      </Card>

      {!order.voidedAt && (
        <Card className="!p-4">
          <StatusRail status={order.status} onChange={changeStatus} />
        </Card>
      )}

      {!order.voidedAt && (
        <div className="grid grid-cols-2 gap-2">
          {balance > 0 && (
            <Button
              onClick={() => {
                setPayAmount((balance / 100).toFixed(2))
                setPayOpen(true)
              }}
            >
              {t('payments.record')}
            </Button>
          )}
          <Button variant="secondary" onClick={() => void messageCustomer()}>
            {t('orders.message')}
          </Button>
          {canEdit && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditNotes(order.notes ?? '')
                setNotesOpen(true)
              }}
            >
              {t('orders.notes')}
            </Button>
          )}
          {isOwner && (
            <Button variant="danger" onClick={() => setVoidOpen(true)}>
              {t('orders.void')}
            </Button>
          )}
        </div>
      )}

      {shop && (
        <Card>
          <h2 className="mb-2 font-display text-base font-semibold">{t('orders.reprint')}</h2>
          <StubActions shop={shop} order={order} payments={payments} customerName={customerName} />
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('orders.timeline')}</h2>
        <div className="flex flex-col gap-2">
          {[
            ...events.map((e) => ({
              at: e.at,
              text: `${e.from ? `${statusLabel(e.from)} → ` : ''}${statusLabel(e.to)}${e.reason ? ` · ${e.reason}` : ''}`,
              by: usersById.get(e.byUserId) ?? '—',
              tone: '',
            })),
            ...payments.map((p) => ({
              at: p.receivedAt,
              text: `${p.amountCentavos < 0 ? t('payments.reversedBadge') + ' ' : ''}${formatCentavos(p.amountCentavos)} (${t(`payments.method.${p.method}` as 'payments.method.cash')})${p.reference ? ` · ${p.reference}` : ''}${p.reason ? ` · ${p.reason}` : ''}`,
              by: usersById.get(p.byUserId) ?? '—',
              tone: p.amountCentavos < 0 ? 'text-attention-deep' : 'text-positive-deep',
            })),
          ]
            .sort((a, b) => a.at.localeCompare(b.at))
            .map((item, i) => (
              <div key={i} className="flex justify-between gap-2 text-sm">
                <span className={item.tone}>{item.text}</span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {item.by} · {fmtDateTime(item.at)}
                </span>
              </div>
            ))}
        </div>
        {isOwner &&
          payments.filter((p) => !p.reversedByPaymentId && !p.reversalOfPaymentId && p.amountCentavos > 0).length > 0 && (
            <div className="mt-3 border-t border-line pt-2">
              {payments
                .filter((p) => !p.reversedByPaymentId && !p.reversalOfPaymentId && p.amountCentavos > 0)
                .map((p) => (
                  <button
                    key={p.id}
                    className="min-h-touch text-sm font-medium text-attention-deep"
                    onClick={() => setReverseTarget(p.id)}
                  >
                    {t('payments.reverse')}: {formatCentavos(p.amountCentavos)}
                  </button>
                ))}
            </div>
          )}
      </Card>

      {/* Take payment sheet */}
      <Sheet open={payOpen} onClose={() => setPayOpen(false)} title={t('payments.record')}>
        <div className="flex flex-col gap-3">
          <Field label={t('payments.amount')}>
            <Input
              inputMode="decimal"
              className="font-mono !text-xl"
              value={payAmount}
              onChange={(e) => {
                setPayAmount(e.target.value)
                setConfirmOverpay(false)
              }}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <Chip key={m} selected={payMethod === m} onClick={() => setPayMethod(m)}>
                {t(`payments.method.${m}` as 'payments.method.cash')}
              </Chip>
            ))}
          </div>
          {(payMethod === 'gcash' || payMethod === 'maya') && (
            <Input placeholder={t('payments.reference')} value={payReference} onChange={(e) => setPayReference(e.target.value)} />
          )}
          {confirmOverpay && (
            <p className="rounded-input bg-attention-soft p-3 text-sm text-attention-deep">
              {t('payments.overpay', { balance: formatCentavos(balance) })}
            </p>
          )}
          <Button onClick={() => void submitPayment()}>{t('payments.record')}</Button>
        </div>
      </Sheet>

      {/* Void sheet */}
      <Sheet open={voidOpen} onClose={() => setVoidOpen(false)} title={t('orders.void')}>
        <div className="flex flex-col gap-3">
          <Field label={t('orders.voidReason')}>
            <TextArea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          </Field>
          <Button
            variant="danger"
            disabled={!voidReason.trim()}
            onClick={async () => {
              if (!currentUser) return
              await voidOrder(order.id, voidReason.trim(), currentUser.id)
              toast({ message: t('orders.voided') })
              setVoidOpen(false)
            }}
          >
            {t('orders.void')}
          </Button>
        </div>
      </Sheet>

      {/* Reverse payment sheet */}
      <Sheet open={reverseTarget !== null} onClose={() => setReverseTarget(null)} title={t('payments.reverse')}>
        <div className="flex flex-col gap-3">
          <Field label={t('payments.reverseReason')}>
            <TextArea value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} />
          </Field>
          <Button
            variant="danger"
            disabled={!reverseReason.trim()}
            onClick={async () => {
              if (!currentUser || !reverseTarget) return
              await reversePayment(reverseTarget, reverseReason.trim(), currentUser.id)
              toast({ message: t('payments.reversed') })
              setReverseTarget(null)
              setReverseReason('')
            }}
          >
            {t('payments.reverse')}
          </Button>
        </div>
      </Sheet>

      {/* Pick-up date — opened from the date itself */}
      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title={t('orders.readyBy')}>
        <div className="flex flex-col gap-3">
          <Field label={t('orders.readyBy')}>
            <Input type="date" value={editPromised} onChange={(e) => setEditPromised(e.target.value)} />
          </Field>
          <Button
            disabled={!editPromised}
            onClick={async () => {
              if (!currentUser) return
              await updateOrder(
                order.id,
                { promisedAt: new Date(`${editPromised}T18:00:00`).toISOString() },
                currentUser.id,
              )
              toast({ message: t('orders.pickupDateSaved') })
              setEditOpen(false)
            }}
          >
            {t('common.save')}
          </Button>
        </div>
      </Sheet>

      {/* Notes */}
      <Sheet open={notesOpen} onClose={() => setNotesOpen(false)} title={t('orders.notes')}>
        <div className="flex flex-col gap-3">
          <Field label={t('orders.notes')}>
            <TextArea rows={4} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </Field>
          <Button
            onClick={async () => {
              if (!currentUser) return
              await updateOrder(order.id, { notes: editNotes.trim() || undefined }, currentUser.id)
              setNotesOpen(false)
            }}
          >
            {t('common.save')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
