/**
 * Repository — every read and write goes through here, never straight to
 * Dexie from a screen. This is the seam a future SyncAdapter plugs into.
 * All multi-record writes are transactions.
 */
import { ulid } from 'ulid'
import { db } from './db'
import type {
  Shop,
  User,
  Customer,
  Service,
  Order,
  StatusEvent,
  Payment,
  InventoryItem,
  InventoryMove,
  ExpectedUseRule,
  AppMeta,
  OrderStatus,
  PaymentMethod,
  InventoryUnit,
} from './types'
import { canTransition, isBackward, statusIndex, STATUS_ORDER } from '../domain/status'
import { buildReversal } from '../domain/payments'
import { recountDelta } from '../domain/inventory'

const now = () => new Date().toISOString()

// ── Audit ─────────────────────────────────────────────────────────

async function audit(
  byUserId: string,
  action: string,
  entity: string,
  entityId: string,
  summary: string,
  demo = false,
) {
  await db.auditEntries.add({
    id: ulid(),
    at: now(),
    byUserId,
    action,
    entity,
    entityId,
    summary,
    ...(demo ? { demo } : {}),
  })
}

// ── App meta ──────────────────────────────────────────────────────

export async function getAppMeta(): Promise<AppMeta | undefined> {
  return db.appMeta.get('app')
}

export async function updateAppMeta(patch: Partial<AppMeta>): Promise<void> {
  const existing = await db.appMeta.get('app')
  if (existing) {
    await db.appMeta.put({ ...existing, ...patch })
  } else {
    await db.appMeta.put({
      id: 'app',
      schemaVersion: 1,
      demoMode: false,
      installedAt: now(),
      storagePersisted: false,
      setupComplete: false,
      ...patch,
    })
  }
}

// ── Shop ──────────────────────────────────────────────────────────

export async function getShop(): Promise<Shop | undefined> {
  return (await db.shop.toArray())[0]
}

export async function updateShop(patch: Partial<Shop>, byUserId: string): Promise<void> {
  const shop = await getShop()
  if (!shop) return
  await db.shop.put({ ...shop, ...patch, updatedAt: now() })
  await audit(byUserId, 'update', 'shop', shop.id, 'Updated shop settings')
}

// ── Users ─────────────────────────────────────────────────────────

export async function listUsers(): Promise<User[]> {
  return db.users.toArray()
}

export async function addUser(
  user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>,
  byUserId: string,
): Promise<User> {
  const record: User = { ...user, id: ulid(), createdAt: now(), updatedAt: now() }
  await db.users.add(record)
  await audit(byUserId, 'create', 'user', record.id, `Added ${record.role} ${record.name}`)
  return record
}

export async function updateUser(id: string, patch: Partial<User>, byUserId: string): Promise<void> {
  await db.users.update(id, { ...patch, updatedAt: now() })
  const u = await db.users.get(id)
  await audit(byUserId, 'update', 'user', id, `Updated user ${u?.name ?? id}`)
}

export async function touchLastLogin(id: string): Promise<void> {
  await db.users.update(id, { lastLoginAt: now() })
}

// ── Customers ─────────────────────────────────────────────────────

export async function listCustomers(includeArchived = false): Promise<Customer[]> {
  const all = await db.customers.toArray()
  return includeArchived ? all : all.filter((c) => !c.archivedAt)
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  return db.customers.get(id)
}

export async function findCustomerByContact(contact: string): Promise<Customer | undefined> {
  if (!contact.trim()) return undefined
  return db.customers.where('contact').equals(contact.trim()).first()
}

export async function addCustomer(
  data: Pick<Customer, 'name' | 'contact' | 'address' | 'notes'>,
  byUserId: string,
): Promise<Customer> {
  const record: Customer = {
    id: ulid(),
    ...data,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.customers.add(record)
  await audit(byUserId, 'create', 'customer', record.id, `Added customer ${record.name}`)
  return record
}

export async function updateCustomer(
  id: string,
  patch: Partial<Customer>,
  byUserId: string,
): Promise<void> {
  await db.customers.update(id, { ...patch, updatedAt: now() })
  await audit(byUserId, 'update', 'customer', id, 'Updated customer')
}

export async function archiveCustomer(id: string, byUserId: string): Promise<void> {
  await db.customers.update(id, { archivedAt: now(), updatedAt: now() })
  const c = await db.customers.get(id)
  await audit(byUserId, 'archive', 'customer', id, `Archived customer ${c?.name ?? id}`)
}

// ── Services ──────────────────────────────────────────────────────

export async function listServices(includeInactive = false): Promise<Service[]> {
  const all = await db.services.orderBy('sortOrder').toArray()
  return includeInactive ? all : all.filter((s) => s.active)
}

export async function saveService(
  data: Omit<Service, 'id' | 'updatedAt'> & { id?: string },
  byUserId: string,
): Promise<Service> {
  if (data.id) {
    const record = { ...data, id: data.id, updatedAt: now() } as Service
    await db.services.put(record)
    await audit(
      byUserId,
      'update',
      'service',
      record.id,
      `Updated service ${record.name} (₱${(record.pricePerKgCentavos / 100).toFixed(2)}/kg)`,
    )
    return record
  }
  const record: Service = { ...data, id: ulid(), updatedAt: now() }
  await db.services.add(record)
  await audit(byUserId, 'create', 'service', record.id, `Added service ${record.name}`)
  return record
}

// ── Orders ────────────────────────────────────────────────────────

export interface NewOrderInput {
  customerId?: string
  walkInName?: string
  serviceId: string
  kilos: number
  itemCount?: number
  itemNotes?: string
  addOns: Array<{ label: string; amountCentavos: number }>
  discountCentavos: number
  discountReason?: string
  subtotalCentavos: number
  totalCentavos: number
  promisedAt: string
  notes?: string
  /** Optional payment taken at intake. */
  initialPayment?: { amountCentavos: number; method: PaymentMethod; reference?: string }
}

/** Allocate the next sequential human-facing order code. Never reused. */
export async function createOrder(input: NewOrderInput, byUserId: string): Promise<Order> {
  return db.transaction(
    'rw',
    [db.shop, db.services, db.orders, db.statusEvents, db.payments, db.auditEntries],
    async () => {
      const shop = (await db.shop.toArray())[0]
      if (!shop) throw new Error('No shop configured')
      const num = shop.nextOrderNumber
      const code = `${shop.orderCodePrefix}-${String(num).padStart(4, '0')}`
      await db.shop.put({ ...shop, nextOrderNumber: num + 1, updatedAt: now() })

      const service = await db.services.get(input.serviceId)
      if (!service) throw new Error('Service not found')

      const at = now()
      const order: Order = {
        id: ulid(),
        code,
        customerId: input.customerId,
        walkInName: input.walkInName,
        serviceId: service.id,
        serviceNameSnapshot: service.name,
        pricePerKgSnapshot: service.pricePerKgCentavos,
        kilos: input.kilos,
        itemCount: input.itemCount,
        itemNotes: input.itemNotes,
        addOns: input.addOns,
        discountCentavos: input.discountCentavos,
        discountReason: input.discountReason,
        subtotalCentavos: input.subtotalCentavos,
        totalCentavos: input.totalCentavos,
        status: 'received',
        receivedAt: at,
        promisedAt: input.promisedAt,
        notes: input.notes,
        createdBy: byUserId,
        updatedAt: at,
      }
      await db.orders.add(order)
      await db.statusEvents.add({
        id: ulid(),
        orderId: order.id,
        from: null,
        to: 'received',
        at,
        byUserId,
      })
      await audit(byUserId, 'create', 'order', order.id, `Created order ${code} (${input.kilos} kg)`)

      if (input.initialPayment && input.initialPayment.amountCentavos > 0) {
        const p: Payment = {
          id: ulid(),
          orderId: order.id,
          amountCentavos: input.initialPayment.amountCentavos,
          method: input.initialPayment.method,
          reference: input.initialPayment.reference,
          receivedAt: at,
          byUserId,
          updatedAt: at,
        }
        await db.payments.add(p)
        await audit(
          byUserId,
          'payment',
          'payment',
          p.id,
          `Payment ₱${(p.amountCentavos / 100).toFixed(2)} on ${code}`,
        )
      }
      return order
    },
  )
}

export async function getOrder(id: string): Promise<Order | undefined> {
  return db.orders.get(id)
}

export async function updateOrder(id: string, patch: Partial<Order>, byUserId: string): Promise<void> {
  await db.orders.update(id, { ...patch, updatedAt: now() })
  const o = await db.orders.get(id)
  await audit(byUserId, 'update', 'order', id, `Edited order ${o?.code ?? id}`)
}

/**
 * Move an order to any stage, writing complete history.
 *
 * Forward skips write one StatusEvent per intermediate stage (all with
 * the same timestamp) so reports never see a gap. Backward moves append
 * a single entry flagged `reverted` — forward entries are never deleted.
 * Nothing here ever advances on a timer; a human confirmed each move.
 */
export async function setOrderStatus(
  orderId: string,
  to: OrderStatus,
  byUserId: string,
  reason?: string,
): Promise<void> {
  await db.transaction('rw', [db.orders, db.statusEvents, db.auditEntries], async () => {
    const order = await db.orders.get(orderId)
    if (!order || order.voidedAt) throw new Error('Order not found or voided')
    const fromIndex = statusIndex(order.status)
    const toIndex = statusIndex(to)
    if (fromIndex === toIndex) return

    const at = now()
    const backward = toIndex < fromIndex
    const patch: Partial<Order> = { status: to, updatedAt: at }
    if (toIndex >= statusIndex('ready') && !order.readyAt) patch.readyAt = at
    if (to === 'claimed') patch.claimedAt = at
    if (backward) {
      if (to !== 'claimed') patch.claimedAt = undefined
      if (toIndex < statusIndex('ready')) patch.readyAt = undefined
    }
    await db.orders.update(orderId, patch)

    if (backward) {
      await db.statusEvents.add({
        id: ulid(),
        orderId,
        from: order.status,
        to,
        at,
        byUserId,
        reason,
        reverted: true,
      })
    } else {
      // one entry per stage crossed, so a skip leaves no hole in history
      for (let i = fromIndex + 1; i <= toIndex; i++) {
        await db.statusEvents.add({
          id: ulid(),
          orderId,
          from: STATUS_ORDER[i - 1],
          to: STATUS_ORDER[i],
          at,
          byUserId,
          reason,
        })
      }
    }
    await audit(
      byUserId,
      'status',
      'order',
      orderId,
      `${order.code}: ${order.status} → ${to}${backward ? ' (moved back)' : ''}${reason ? ` (${reason})` : ''}`,
    )
  })
}

/** One-step move used by the list and board; validates the transition. */
export async function advanceOrderStatus(
  orderId: string,
  to: OrderStatus,
  byUserId: string,
  reason?: string,
): Promise<void> {
  const order = await db.orders.get(orderId)
  if (!order) throw new Error('Order not found')
  if (!canTransition(order.status, to)) throw new Error(`Cannot move ${order.status} → ${to}`)
  if (isBackward(order.status, to) && !reason) throw new Error('Backward moves need a reason')
  await setOrderStatus(orderId, to, byUserId, reason)
}

export async function voidOrder(orderId: string, reason: string, byUserId: string): Promise<void> {
  await db.transaction('rw', [db.orders, db.auditEntries], async () => {
    const order = await db.orders.get(orderId)
    if (!order) throw new Error('Order not found')
    await db.orders.update(orderId, { voidedAt: now(), voidReason: reason, updatedAt: now() })
    await audit(byUserId, 'void', 'order', orderId, `Voided ${order.code}: ${reason}`)
  })
}

export async function listStatusEvents(orderId: string): Promise<StatusEvent[]> {
  return db.statusEvents.where('orderId').equals(orderId).sortBy('at')
}

// ── Payments ──────────────────────────────────────────────────────

export async function listPaymentsForOrder(orderId: string): Promise<Payment[]> {
  return db.payments.where('orderId').equals(orderId).sortBy('receivedAt')
}

export async function recordPayment(
  orderId: string,
  amountCentavos: number,
  method: PaymentMethod,
  byUserId: string,
  reference?: string,
): Promise<Payment> {
  return db.transaction('rw', [db.payments, db.orders, db.auditEntries], async () => {
    const order = await db.orders.get(orderId)
    if (!order || order.voidedAt) throw new Error('Order not found or voided')
    const at = now()
    const p: Payment = {
      id: ulid(),
      orderId,
      amountCentavos,
      method,
      reference,
      receivedAt: at,
      byUserId,
      updatedAt: at,
    }
    await db.payments.add(p)
    await audit(
      byUserId,
      'payment',
      'payment',
      p.id,
      `Payment ₱${(amountCentavos / 100).toFixed(2)} (${method}) on ${order.code}`,
    )
    return p
  })
}

export async function reversePayment(
  paymentId: string,
  reason: string,
  byUserId: string,
): Promise<void> {
  await db.transaction('rw', [db.payments, db.orders, db.auditEntries], async () => {
    const original = await db.payments.get(paymentId)
    if (!original) throw new Error('Payment not found')
    if (original.reversedByPaymentId) throw new Error('Already reversed')
    if (original.reversalOfPaymentId) throw new Error('Cannot reverse a reversal')
    const at = now()
    const reversal = buildReversal(original, ulid(), byUserId, at, reason)
    await db.payments.add(reversal)
    await db.payments.update(paymentId, { reversedByPaymentId: reversal.id, updatedAt: at })
    const order = await db.orders.get(original.orderId)
    await audit(
      byUserId,
      'reverse',
      'payment',
      paymentId,
      `Reversed ₱${(original.amountCentavos / 100).toFixed(2)} on ${order?.code ?? original.orderId}: ${reason}`,
    )
  })
}

// ── Inventory ─────────────────────────────────────────────────────

export async function listInventoryItems(): Promise<InventoryItem[]> {
  return (await db.inventoryItems.toArray()).filter((i) => i.active)
}

export async function saveInventoryItem(
  data: Omit<InventoryItem, 'id' | 'updatedAt'> & { id?: string },
  byUserId: string,
): Promise<InventoryItem> {
  if (data.id) {
    const record = { ...data, id: data.id, updatedAt: now() } as InventoryItem
    await db.inventoryItems.put(record)
    await audit(byUserId, 'update', 'inventoryItem', record.id, `Updated item ${record.name}`)
    return record
  }
  const record: InventoryItem = { ...data, id: ulid(), updatedAt: now() }
  await db.inventoryItems.add(record)
  await audit(byUserId, 'create', 'inventoryItem', record.id, `Added item ${record.name}`)
  return record
}

export async function recordStockMove(
  itemId: string,
  type: 'in' | 'out',
  qty: number,
  byUserId: string,
  opts: { reason?: string; unitCostCentavos?: number; supplier?: string } = {},
): Promise<void> {
  await db.transaction('rw', [db.inventoryItems, db.inventoryMoves, db.auditEntries], async () => {
    const item = await db.inventoryItems.get(itemId)
    if (!item) throw new Error('Item not found')
    const delta = type === 'in' ? qty : -qty
    await db.inventoryItems.update(itemId, {
      currentQty: Math.round((item.currentQty + delta) * 1000) / 1000,
      ...(opts.unitCostCentavos !== undefined ? { costPerUnitCentavos: opts.unitCostCentavos } : {}),
      ...(opts.supplier ? { supplier: opts.supplier } : {}),
      updatedAt: now(),
    })
    await db.inventoryMoves.add({
      id: ulid(),
      itemId,
      type,
      qty,
      reason: opts.reason,
      at: now(),
      byUserId,
      unitCostCentavos: opts.unitCostCentavos,
    })
    await audit(byUserId, type === 'in' ? 'stock-in' : 'stock-out', 'inventoryItem', itemId, `${item.name}: ${type} ${qty} ${item.unit}`)
  })
}

/** Recount: write one adjust move equal to counted − recorded. */
export async function recountStock(
  itemId: string,
  countedQty: number,
  byUserId: string,
): Promise<void> {
  await db.transaction('rw', [db.inventoryItems, db.inventoryMoves, db.auditEntries], async () => {
    const item = await db.inventoryItems.get(itemId)
    if (!item) throw new Error('Item not found')
    const delta = recountDelta(item.currentQty, countedQty)
    if (delta === 0) return
    await db.inventoryItems.update(itemId, { currentQty: countedQty, updatedAt: now() })
    await db.inventoryMoves.add({
      id: ulid(),
      itemId,
      type: 'adjust',
      qty: delta,
      reason: 'Recount',
      at: now(),
      byUserId,
    })
    await audit(byUserId, 'recount', 'inventoryItem', itemId, `${item.name}: recount to ${countedQty} ${item.unit} (${delta > 0 ? '+' : ''}${delta})`)
  })
}

export async function listInventoryMoves(itemId: string): Promise<InventoryMove[]> {
  return db.inventoryMoves.where('itemId').equals(itemId).sortBy('at')
}

export async function listExpectedUseRules(): Promise<ExpectedUseRule[]> {
  return db.expectedUseRules.toArray()
}

export async function saveExpectedUseRule(
  data: Omit<ExpectedUseRule, 'id' | 'updatedAt'> & { id?: string },
  byUserId: string,
): Promise<void> {
  if (data.id) {
    await db.expectedUseRules.put({ ...data, id: data.id, updatedAt: now() } as ExpectedUseRule)
  } else {
    await db.expectedUseRules.add({ ...data, id: ulid(), updatedAt: now() })
  }
  await audit(byUserId, 'update', 'expectedUseRule', data.id ?? 'new', 'Set expected-use rule')
}

export async function deleteExpectedUseRule(id: string, byUserId: string): Promise<void> {
  await db.expectedUseRules.delete(id)
  await audit(byUserId, 'delete', 'expectedUseRule', id, 'Removed expected-use rule')
}

// ── Drafts (form resilience) ──────────────────────────────────────

export async function saveDraft(kind: 'order', json: string): Promise<void> {
  await db.drafts.put({ id: kind, kind, json, updatedAt: now() })
}

export async function loadDraft(kind: 'order'): Promise<string | undefined> {
  return (await db.drafts.get(kind))?.json
}

export async function clearDraft(kind: 'order'): Promise<void> {
  await db.drafts.delete(kind)
}

// ── Wipes ─────────────────────────────────────────────────────────

/** Delete every record flagged demo: true. */
export async function wipeDemoData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.users,
      db.customers,
      db.services,
      db.orders,
      db.statusEvents,
      db.payments,
      db.inventoryItems,
      db.inventoryMoves,
      db.expectedUseRules,
      db.auditEntries,
    ],
    async () => {
      const tables = [
        db.users,
        db.customers,
        db.services,
        db.orders,
        db.statusEvents,
        db.payments,
        db.inventoryItems,
        db.inventoryMoves,
        db.expectedUseRules,
        db.auditEntries,
      ]
      for (const table of tables) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const demoKeys = await (table as any).filter((r: any) => r.demo === true).primaryKeys()
        await (table as any).bulkDelete(demoKeys)
      }
    },
  )
}

/** Full reset — everything except appMeta/snapshots (caller handles those). */
export async function wipeAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.shop,
      db.users,
      db.customers,
      db.services,
      db.orders,
      db.statusEvents,
      db.payments,
      db.inventoryItems,
      db.inventoryMoves,
      db.expectedUseRules,
      db.auditEntries,
      db.backupMeta,
      db.drafts,
    ],
    async () => {
      await Promise.all([
        db.shop.clear(),
        db.users.clear(),
        db.customers.clear(),
        db.services.clear(),
        db.orders.clear(),
        db.statusEvents.clear(),
        db.payments.clear(),
        db.inventoryItems.clear(),
        db.inventoryMoves.clear(),
        db.expectedUseRules.clear(),
        db.auditEntries.clear(),
        db.backupMeta.clear(),
        db.drafts.clear(),
      ])
    },
  )
}
