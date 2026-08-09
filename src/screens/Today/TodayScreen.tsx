/** Ngayon — answers "what's happening right now" in under three seconds. */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { Order, OrderStatus } from '../../data/types'
import { t } from '../../i18n/strings'
import { formatCentavos } from '../../domain/money'
import { paidCentavos, balanceCentavos } from '../../domain/payments'
import { ShopRail } from '../../components/WashLine'
import { Card, Stat, Button, Sheet } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import { backupHealth, promptLevel, markPrompted, storageUsage } from '../../backup/scheduler'
import { runBackup } from '../../backup/destinations'
import { useToast } from '../../components/Toast'
import { fmtDate, todayRange, inRange } from '../../app/format'
import { buildReadyMessage, sendReadyMessage } from '../../components/Stub'
import { STATUS_ORDER } from '../../domain/status'

export function TodayScreen() {
  const navigate = useNavigate()
  const toast = useToast()
  const [closeDayOpen, setCloseDayOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState<'sheet' | 'modal' | null>(null)
  const [storagePct, setStoragePct] = useState<number | null>(null)

  const shop = useLiveQuery(() => db.shop.toArray(), [])?.[0]
  const appMeta = useLiveQuery(() => db.appMeta.get('app'), [])
  const orders = useLiveQuery(() => db.orders.toArray(), []) ?? []
  const payments = useLiveQuery(() => db.payments.toArray(), []) ?? []
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? []
  const inventory = useLiveQuery(() => db.inventoryItems.filter((i) => i.active).toArray(), []) ?? []

  const { from, to } = todayRange()
  const live = orders.filter((o) => !o.voidedAt)
  const todayOrders = live.filter((o) => inRange(o.receivedAt, from, to))

  const paymentsByOrder = useMemo(() => {
    const map = new Map<string, typeof payments>()
    for (const p of payments) {
      const list = map.get(p.orderId) ?? []
      list.push(p)
      map.set(p.orderId, list)
    }
    return map
  }, [payments])

  const railCounts = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<OrderStatus, number>
    // "today's whole load": active orders in progress + today's received/claimed
    for (const o of live) {
      if (o.status === 'claimed') {
        if (inRange(o.claimedAt ?? o.receivedAt, from, to)) counts.claimed++
      } else if (o.status === 'received') {
        if (inRange(o.receivedAt, from, to)) counts.received++
      } else {
        counts[o.status]++
      }
    }
    return counts
  }, [live, from, to])

  const now = new Date()
  const readyOrders = live
    .filter((o) => o.status === 'ready')
    .sort((a, b) => a.promisedAt.localeCompare(b.promisedAt))
  const dueOut = live.filter(
    (o) => o.status === 'ready' || (o.status !== 'claimed' && new Date(o.promisedAt) < now),
  )
  const collectedToday = payments
    .filter((p) => inRange(p.receivedAt, from, to))
    .reduce((sum, p) => sum + p.amountCentavos, 0)
  const outstanding = live.reduce(
    (sum, o) => sum + Math.max(0, balanceCentavos(o.totalCentavos, paymentsByOrder.get(o.id) ?? [])),
    0,
  )
  const lowStock = inventory.filter((i) => i.currentQty <= i.reorderPoint)
  const inProgress = live.filter((o) => o.status === 'washing' || o.status === 'drying').length
  const todayKey = new Date().toISOString().slice(0, 10)

  const health = backupHealth(appMeta?.lastBackupAt)

  useEffect(() => {
    if (!appMeta) return
    const level = promptLevel(appMeta.lastBackupAt, appMeta.lastBackupPromptAt)
    if (level !== 'none') {
      setPromptOpen(level)
      void markPrompted()
    }
    void storageUsage().then((u) => {
      if (u.usedPct !== null && u.usedPct >= 80) setStoragePct(u.usedPct)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMeta?.id])

  async function backupNow() {
    const result = await runBackup('manual')
    toast({ message: result.ok ? t('backup.done') : t('backup.failed') })
    if (result.ok) setPromptOpen(null)
  }

  function customerName(o: Order): string {
    if (o.walkInName) return o.walkInName
    return customers.find((c) => c.id === o.customerId)?.name ?? '—'
  }

  async function messageCustomer(o: Order) {
    if (!shop) return
    const msg = buildReadyMessage(shop, o, paymentsByOrder.get(o.id) ?? [], customerName(o))
    const contact = customers.find((c) => c.id === o.customerId)?.contact
    await sendReadyMessage(msg, contact)
  }

  const chipClass =
    health.health === 'ok'
      ? 'bg-accent-400/30 text-accent-700'
      : health.health === 'stale'
        ? 'bg-sun-500/15 text-sun-700'
        : 'bg-danger-500/10 text-danger-700'
  const chipText =
    health.health === 'ok'
      ? t('backup.chip.today')
      : health.health === 'stale'
        ? t('backup.chip.daysAgo', { n: health.days ?? 0 })
        : t('backup.chip.never')

  const methodTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const p of payments.filter((p) => inRange(p.receivedAt, from, to))) {
      totals.set(p.method, (totals.get(p.method) ?? 0) + p.amountCentavos)
    }
    return [...totals.entries()]
  }, [payments, from, to])

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Backup health chip — always visible, tap runs a backup */}
      <button
        onClick={() => void backupNow()}
        className={`min-h-touch self-start rounded-pill px-4 py-2 text-sm font-semibold ${chipClass}`}
      >
        {chipText}
      </button>

      {appMeta?.demoMode && (
        <Card className="flex items-center justify-between gap-3 !bg-primary-100">
          <p className="text-sm">{t('today.demoStrip')}</p>
          <Button variant="primary" className="shrink-0 !py-2 text-sm" onClick={() => navigate('/wizard')}>
            {t('today.demoStart')}
          </Button>
        </Card>
      )}

      {appMeta && !appMeta.storagePersisted && !appMeta.demoMode && (
        <div className="rounded-card bg-sun-500/15 px-4 py-3 text-sm text-sun-700">
          {t('today.persistWarning')}
        </div>
      )}

      {storagePct !== null && (
        <div className="rounded-card bg-danger-500/10 px-4 py-3 text-sm text-danger-700">
          {t('backupData.storageWarning')} ({Math.round(storagePct)}%)
        </div>
      )}

      {/* Shop rail */}
      <Card>
        <ShopRail
          counts={railCounts}
          onSelect={(s) => navigate(`/orders?status=${s}`)}
        />
      </Card>

      {/* Six figures, 3 x 2. Every tile opens the view it summarises. */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Stat
          label={t('today.ordersToday')}
          value={String(todayOrders.length)}
          onClick={() => navigate(`/orders?status=all&from=${todayKey}&to=${todayKey}`)}
        />
        <Stat
          label={t('today.inProgress')}
          value={String(inProgress)}
          onClick={() => navigate('/orders?status=inprogress')}
        />
        <Stat
          label={t('today.needsRelease')}
          value={String(dueOut.length)}
          tone={dueOut.length ? 'sun' : undefined}
          onClick={() => navigate('/orders?status=ready')}
        />
        <Stat
          label={t('today.incomeToday')}
          value={formatCentavos(collectedToday)}
          tone="accent"
          onClick={() => navigate('/payments?tab=all')}
        />
        <Stat
          label={t('today.outstanding')}
          value={formatCentavos(outstanding)}
          tone={outstanding > 0 ? 'danger' : undefined}
          onClick={() => navigate('/payments?tab=unpaid')}
        />
        <Stat
          label={t('today.lowStock')}
          value={
            lowStock.length > 0 ? t('today.lowStockCount', { n: lowStock.length }) : t('today.allStocked')
          }
          hint={lowStock.length > 0 ? lowStock.map((i) => i.name).join(', ') : undefined}
          tone={lowStock.length > 0 ? 'sun' : undefined}
          onClick={() => navigate('/more/inventory')}
        />
      </div>

      {/* Not yet claimed */}
      <section>
        <h2 className="mb-2 font-display text-md font-semibold">{t('today.notClaimed')}</h2>
        <DataTable
          rows={readyOrders}
          getRowKey={(o) => o.id}
          onRowClick={(o) => navigate(`/orders/${o.id}`)}
          initialSortKey="promised"
          initialSortDesc={false}
          emptyText={t('today.emptyOrders')}
          columns={[
            {
              key: 'code',
              header: t('stub.orderCode'),
              sortValue: (o) => o.code,
              defaultDesc: false,
              render: (o) => <span className="whitespace-nowrap font-mono font-medium">{o.code}</span>,
            },
            {
              key: 'customer',
              header: t('orders.customer'),
              sortValue: (o) => customerName(o).toLowerCase(),
              defaultDesc: false,
              render: (o) => customerName(o),
            },
            {
              key: 'promised',
              header: t('orders.readyBy'),
              sortValue: (o) => o.promisedAt,
              defaultDesc: false,
              render: (o) => {
                const days = Math.floor((now.getTime() - new Date(o.promisedAt).getTime()) / 86_400_000)
                return (
                  <span className={`whitespace-nowrap text-xs ${days >= 3 ? 'font-semibold text-danger-700' : 'text-ink-muted'}`}>
                    {fmtDate(o.promisedAt)}
                    {days >= 3 ? ` · ${t('today.overdue')} ${days}d` : ''}
                  </span>
                )
              },
            },
            {
              key: 'total',
              header: t('orders.total'),
              align: 'right',
              sortValue: (o) => o.totalCentavos,
              render: (o) => <span className="font-mono">{formatCentavos(o.totalCentavos)}</span>,
            },
            {
              key: 'action',
              header: t('orders.message'),
              align: 'right',
              render: (o) => (
                <Button
                  variant="secondary"
                  className="!py-1.5 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    void messageCustomer(o)
                  }}
                >
                  {t('orders.message')}
                </Button>
              ),
            },
          ]}
          renderCard={(o) => {
            const days = Math.floor((now.getTime() - new Date(o.promisedAt).getTime()) / 86_400_000)
            return (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-medium">{o.code}</span>
                  <span className="font-mono text-sm font-medium">{formatCentavos(o.totalCentavos)}</span>
                </div>
                <div className="truncate text-sm">{customerName(o)}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className={`text-xs ${days >= 3 ? 'font-semibold text-danger-700' : 'text-ink-muted'}`}>
                    {t('orders.readyBy')}: {fmtDate(o.promisedAt)}
                    {days >= 3 ? ` · ${t('today.overdue')} ${days}d` : ''}
                  </span>
                  <Button
                    variant="secondary"
                    className="!py-1.5 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      void messageCustomer(o)
                    }}
                  >
                    {t('orders.message')}
                  </Button>
                </div>
              </>
            )
          }}
        />
      </section>

      <Button variant="secondary" onClick={() => setCloseDayOpen(true)}>
        {t('today.closeDay')}
      </Button>

      {/* Close-the-day sheet: review ritual + backup in the same flow */}
      <Sheet open={closeDayOpen} onClose={() => setCloseDayOpen(false)} title={t('today.closeDaySummary')}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('today.ordersToday')} value={String(todayOrders.length)} />
            <Stat
              label={t('today.kilosToday')}
              value={`${todayOrders.reduce((s, o) => s + o.kilos, 0).toFixed(1)} kg`}
            />
            <Stat label={t('today.incomeToday')} value={formatCentavos(collectedToday)} tone="accent" />
            <Stat label={t('today.outstanding')} value={formatCentavos(outstanding)} tone="danger" />
          </div>
          <div className="rounded-card bg-surface p-3 shadow-card">
            <div className="mb-1 text-xs font-medium text-ink-muted">{t('today.collectionsByMethod')}</div>
            {methodTotals.length === 0 ? (
              <div className="text-sm text-ink-muted">—</div>
            ) : (
              methodTotals.map(([method, total]) => (
                <div key={method} className="flex justify-between font-mono text-sm">
                  <span>{t(`payments.method.${method}` as 'payments.method.cash')}</span>
                  <span>{formatCentavos(total)}</span>
                </div>
              ))
            )}
          </div>
          <Button onClick={() => void backupNow().then(() => setCloseDayOpen(false))}>
            {t('backup.prompt.action')}
          </Button>
        </div>
      </Sheet>

      {/* Stale-backup prompt (sheet >3d, modal >7d) */}
      <Sheet
        open={promptOpen !== null}
        onClose={() => {
          if (promptOpen === 'sheet') setPromptOpen(null)
        }}
        title={t('backup.prompt.title')}
      >
        <div className="flex flex-col gap-3">
          <p className="text-ink-muted">
            {t('backup.prompt.body', {
              when: appMeta?.lastBackupAt ? fmtDate(appMeta.lastBackupAt) : t('backupData.never'),
            })}
          </p>
          {appMeta?.backupStrategy === 'share' && appMeta.shareDestinationName && (
            <p className="text-sm font-medium text-primary-800">
              I-save sa {appMeta.shareDestinationName}
            </p>
          )}
          <Button onClick={() => void backupNow()}>{t('backup.prompt.action')}</Button>
          {promptOpen === 'sheet' && (
            <Button variant="ghost" onClick={() => setPromptOpen(null)}>
              {t('backup.prompt.later')}
            </Button>
          )}
          {promptOpen === 'modal' && (
            <Button variant="ghost" onClick={() => setPromptOpen(null)}>
              {t('backup.prompt.later')}
            </Button>
          )}
        </div>
      </Sheet>
    </div>
  )
}
