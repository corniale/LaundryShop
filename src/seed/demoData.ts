/**
 * Demo seed — a realistic month of shop life. Every record carries
 * demo: true so the setup wizard can wipe it in one action.
 * Demo PINs: Owner 1234 · Staff 5678 (stated on the lock screen in demo mode).
 */
import { ulid } from 'ulid'
import { db } from '../data/db'
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
  OrderStatus,
  PaymentMethod,
} from '../data/types'
import { clientConfig } from '../config/client.config'
import { priceOrder } from '../domain/money'
import { hashPin, generateSalt } from '../domain/pin'
import { STATUS_ORDER } from '../domain/status'

const DAY = 86_400_000

// Deterministic pseudo-random so the demo always looks the same.
let seedState = 42
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) % 2 ** 31
  return seedState / 2 ** 31
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

const iso = (d: Date) => d.toISOString()

export async function isSeeded(): Promise<boolean> {
  return (await db.appMeta.get('app')) !== undefined
}

export async function seedDemoData(): Promise<void> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0)

  // ── Shop ──
  const shop: Shop = {
    id: ulid(),
    name: 'Bubbles Laundry Shop',
    ownerName: 'Admin',
    address: 'Purok 4, Brgy. San Isidro, Quezon City',
    contact: '0917 555 1234',
    currency: 'PHP',
    orderCodePrefix: 'ORD',
    nextOrderNumber: 1046,
    locale: clientConfig.defaultLocale,
    receiptFooter: 'Salamat po! Dalhin ang stub kapag kukunin.',
    createdAt: iso(new Date(today.getTime() - 35 * DAY)),
    schemaVersion: 1,
    updatedAt: iso(today),
  }

  // ── Users ──
  const ownerSalt = generateSalt()
  const staffSalt = generateSalt()
  const owner: User = {
    id: ulid(),
    name: 'Admin',
    role: 'owner',
    pinHash: await hashPin('1234', ownerSalt),
    pinSalt: ownerSalt,
    active: true,
    createdAt: shop.createdAt,
    demo: true,
    updatedAt: shop.createdAt,
  }
  const staff: User = {
    id: ulid(),
    name: 'Jenny',
    role: 'staff',
    pinHash: await hashPin('5678', staffSalt),
    pinSalt: staffSalt,
    active: true,
    createdAt: shop.createdAt,
    demo: true,
    updatedAt: shop.createdAt,
  }

  // ── Services ──
  const serviceDefs: Array<[string, number, number]> = [
    ['Wash & Fold', 3500, 1],
    ['Wash, Dry & Fold', 4500, 1],
    ['Dry Clean', 12000, 2],
    ['Comforter / Bedding', 8000, 2],
    ['Press / Plantsa Only', 2500, 1],
  ]
  const services: Service[] = serviceDefs.map(([name, price, days], i) => ({
    id: ulid(),
    name,
    pricePerKgCentavos: price,
    turnaroundDays: days,
    active: true,
    sortOrder: i,
    demo: true,
    updatedAt: shop.createdAt,
  }))

  // ── Customers ──
  const customerDefs: Array<[string, string, string]> = [
    ['Maria Santos', '0917 123 4567', 'Purok 2, Brgy. San Isidro'],
    ['Juan Dela Cruz', '0918 234 5678', 'Purok 5, Brgy. Malaya'],
    ['Rosario Bautista', '0919 345 6789', 'Purok 1, Brgy. San Isidro'],
    ['Antonio Reyes', '0920 456 7890', 'Brgy. Maligaya, Blk 3 Lot 12'],
    ['Lourdes Garcia', '0921 567 8901', 'Purok 7, Brgy. San Roque'],
    ['Pedro Mendoza', '0928 678 9012', 'Purok 3, Brgy. Malaya'],
    ['Carmen Villanueva', '0917 789 0123', 'Brgy. San Isidro, Sitio Ilaya'],
    ['Ricardo Aquino', '0939 890 1234', 'Purok 6, Brgy. Maligaya'],
    ['Teresita Ramos', '0945 901 2345', 'Purok 2, Brgy. San Roque'],
    ['Eduardo Flores', '0916 012 3456', 'Brgy. Malaya, Phase 2'],
    ['Gloria Navarro', '0927 111 2233', 'Purok 4, Brgy. San Isidro'],
    ['Roberto Castillo', '0935 222 3344', 'Purok 8, Brgy. Maligaya'],
    ['Imelda Torres', '0908 333 4455', 'Brgy. San Roque, Sitio Baba'],
    ['Ernesto Ocampo', '0949 444 5566', 'Purok 1, Brgy. Malaya'],
  ]
  const customers: Customer[] = customerDefs.map(([name, contact, address], i) => ({
    id: ulid(),
    name,
    contact,
    address,
    createdAt: iso(new Date(today.getTime() - (34 - i) * DAY)),
    demo: true,
    updatedAt: iso(new Date(today.getTime() - (34 - i) * DAY)),
  }))
  // 3 repeat customers with 4+ orders: Maria (0), Juan (1), Rosario (2)

  // ── Orders ──
  const orders: Order[] = []
  const statusEvents: StatusEvent[] = []
  const payments: Payment[] = []
  let orderNum = 1000

  const washFold = services[0]
  const users = [owner, staff]

  function addStatusChain(order: Order, upTo: OrderStatus, base: Date, byUserId: string) {
    const chain = STATUS_ORDER.slice(0, STATUS_ORDER.indexOf(upTo) + 1)
    let prev: OrderStatus | null = null
    chain.forEach((st, i) => {
      statusEvents.push({
        id: ulid(),
        orderId: order.id,
        from: prev,
        to: st,
        at: iso(new Date(base.getTime() + i * 3 * 3600_000)),
        byUserId,
        demo: true,
      })
      prev = st
    })
  }

  function makeOrder(opts: {
    daysAgo: number
    customerIdx?: number
    walkInName?: string
    service?: Service
    kilos: number
    /** A second service in the same drop-off, as real customers do. */
    also?: { service: Service; kilos: number }
    status: OrderStatus
    payment: 'full' | 'partial' | 'none'
    method?: PaymentMethod
    overdueDays?: number
    voided?: boolean
    byUser?: User
  }): Order {
    const svc = opts.service ?? washFold
    const by = opts.byUser ?? pick(users)
    const receivedAt = new Date(
      today.getTime() - opts.daysAgo * DAY + Math.floor(rand() * 8) * 3600_000,
    )
    const addOns =
      rand() < 0.25 ? [{ label: 'Plastic bag', amountCentavos: 1000 }] : []
    const discount = rand() < 0.1 ? 2000 : 0
    const parts = [{ service: svc, kilos: opts.kilos }, ...(opts.also ? [opts.also] : [])]
    const pricing = priceOrder({
      lines: parts.map((p) => ({
        kilos: p.kilos,
        pricePerKgCentavos: p.service.pricePerKgCentavos,
        minimumKg: p.service.minimumKg,
      })),
      addOns,
      discountCentavos: discount,
    })
    orderNum += 1
    const promised = new Date(
      receivedAt.getTime() + (svc.turnaroundDays + (opts.overdueDays ?? 0) * -1) * DAY,
    )
    const promisedAt =
      opts.overdueDays && opts.overdueDays > 0
        ? new Date(today.getTime() - opts.overdueDays * DAY)
        : promised

    const order: Order = {
      id: ulid(),
      code: `ORD-${orderNum}`,
      customerId: opts.customerIdx !== undefined ? customers[opts.customerIdx].id : undefined,
      walkInName: opts.walkInName,
      lines: parts.map((p, i) => ({
        serviceId: p.service.id,
        serviceNameSnapshot: p.service.name,
        pricePerKgSnapshot: p.service.pricePerKgCentavos,
        minimumKgSnapshot: p.service.minimumKg,
        kilos: p.kilos,
        itemCount: Math.round(p.kilos * 3),
        billedKilos: pricing.lines[i].billedKilos,
        lineTotalCentavos: pricing.lines[i].lineTotalCentavos,
      })),
      itemNotes: pick(['T-shirts, pantalon', 'Damit pambahay', 'Uniforms, bedsheet', 'Mixed na damit', 'Kumot at unan']),
      addOns,
      discountCentavos: discount,
      discountReason: discount ? 'Suki discount' : undefined,
      subtotalCentavos: pricing.subtotalCentavos,
      totalCentavos: pricing.totalCentavos,
      status: opts.status,
      receivedAt: iso(receivedAt),
      promisedAt: iso(promisedAt),
      readyAt:
        STATUS_ORDER.indexOf(opts.status) >= 3
          ? iso(new Date(receivedAt.getTime() + DAY))
          : undefined,
      claimedAt: opts.status === 'claimed' ? iso(new Date(receivedAt.getTime() + DAY + 6 * 3600_000)) : undefined,
      voidedAt: opts.voided ? iso(new Date(receivedAt.getTime() + 3600_000)) : undefined,
      voidReason: opts.voided ? 'Nadoble ang entry' : undefined,
      createdBy: by.id,
      demo: true,
      updatedAt: iso(receivedAt),
    }
    orders.push(order)
    addStatusChain(order, opts.status, receivedAt, by.id)

    if (!opts.voided && opts.payment !== 'none') {
      const amount =
        opts.payment === 'full'
          ? order.totalCentavos
          : Math.round(order.totalCentavos * 0.4 / 100) * 100
      payments.push({
        id: ulid(),
        orderId: order.id,
        amountCentavos: amount,
        method: opts.method ?? pick<PaymentMethod>(['cash', 'cash', 'cash', 'gcash', 'maya']),
        receivedAt: order.claimedAt ?? iso(new Date(receivedAt.getTime() + 2 * 3600_000)),
        byUserId: by.id,
        demo: true,
        updatedAt: iso(receivedAt),
      })
    }
    return order
  }

  // Historic claimed orders across the last 30 days (weekend peaks)
  for (let d = 30; d >= 2; d--) {
    const date = new Date(today.getTime() - d * DAY)
    const dow = date.getDay()
    const count = dow === 0 || dow === 6 ? 2 : rand() < 0.55 ? 1 : rand() < 0.5 ? 2 : 0
    for (let i = 0; i < count; i++) {
      // ~55% Wash & Fold
      const svc = rand() < 0.55 ? services[0] : pick(services.slice(1))
      const repeatIdx = [0, 1, 2][Math.floor(rand() * 3)]
      const custIdx = rand() < 0.4 ? repeatIdx : Math.floor(rand() * customers.length)
      makeOrder({
        daysAgo: d,
        customerIdx: custIdx,
        service: svc,
        kilos: Math.round((3 + rand() * 9) * 10) / 10,
        status: 'claimed',
        payment: 'full',
      })
    }
  }

  // 3 overdue in ready (promised 3–6 days ago)
  makeOrder({ daysAgo: 6, customerIdx: 3, kilos: 7.5, status: 'ready', payment: 'none', overdueDays: 5 })
  makeOrder({ daysAgo: 5, customerIdx: 4, kilos: 4.0, status: 'ready', payment: 'partial', overdueDays: 4 })
  makeOrder({ daysAgo: 4, customerIdx: 5, kilos: 9.0, status: 'ready', payment: 'none', overdueDays: 3 })

  // Today: at least 2 in each of the five statuses
  makeOrder({ daysAgo: 0, customerIdx: 0, kilos: 12.0, service: services[1], status: 'received', payment: 'none', byUser: staff })
  makeOrder({ daysAgo: 0, walkInName: 'Aling Nena', kilos: 5.0, status: 'received', payment: 'partial', byUser: staff })
  makeOrder({
    daysAgo: 0, customerIdx: 1, kilos: 8.0, also: { service: services[2], kilos: 2.0 },
    status: 'washing', payment: 'none', byUser: staff,
  })
  makeOrder({ daysAgo: 0, customerIdx: 6, kilos: 6.5, service: services[1], status: 'washing', payment: 'full', byUser: owner })
  makeOrder({ daysAgo: 0, customerIdx: 2, kilos: 10.0, status: 'drying', payment: 'none', byUser: staff })
  makeOrder({ daysAgo: 0, customerIdx: 7, kilos: 4.5, service: services[4], status: 'drying', payment: 'full', byUser: staff })
  makeOrder({
    daysAgo: 1, customerIdx: 8, kilos: 7.0, also: { service: services[3], kilos: 3.5 },
    status: 'ready', payment: 'full', byUser: owner,
  })
  makeOrder({ daysAgo: 1, customerIdx: 9, kilos: 5.5, service: services[3], status: 'ready', payment: 'none', byUser: staff })
  makeOrder({ daysAgo: 1, customerIdx: 10, kilos: 6.0, status: 'claimed', payment: 'full', byUser: staff })
  makeOrder({ daysAgo: 1, customerIdx: 11, kilos: 3.5, status: 'claimed', payment: 'full', byUser: owner })

  // Ensure repeat customers reach 4+ orders
  for (const idx of [0, 1, 2]) {
    const have = orders.filter((o) => o.customerId === customers[idx].id).length
    for (let i = have; i < 4; i++) {
      makeOrder({
        daysAgo: 8 + i * 4,
        customerIdx: idx,
        kilos: Math.round((4 + rand() * 6) * 10) / 10,
        status: 'claimed',
        payment: 'full',
      })
    }
  }

  // 1 voided
  makeOrder({ daysAgo: 3, customerIdx: 12, kilos: 5.0, status: 'received', payment: 'none', voided: true, byUser: staff })

  // One reversed payment: pay a claimed order twice by mistake, reverse one.
  const victim = orders.find((o) => o.status === 'claimed' && !o.voidedAt)!
  const dupPayment: Payment = {
    id: ulid(),
    orderId: victim.id,
    amountCentavos: victim.totalCentavos,
    method: 'cash',
    receivedAt: iso(new Date(today.getTime() - 2 * DAY)),
    byUserId: staff.id,
    demo: true,
    updatedAt: iso(new Date(today.getTime() - 2 * DAY)),
  }
  const reversal: Payment = {
    id: ulid(),
    orderId: victim.id,
    amountCentavos: -victim.totalCentavos,
    method: 'cash',
    receivedAt: iso(new Date(today.getTime() - 2 * DAY + 3600_000)),
    byUserId: owner.id,
    reversalOfPaymentId: dupPayment.id,
    reason: 'Nadobleng bayad',
    demo: true,
    updatedAt: iso(new Date(today.getTime() - 2 * DAY + 3600_000)),
  }
  dupPayment.reversedByPaymentId = reversal.id
  payments.push(dupPayment, reversal)

  shop.nextOrderNumber = orderNum + 1

  // ── Inventory ──
  const invDefs: Array<[string, InventoryItem['unit'], number, number, number]> = [
    // name, unit, currentQty, reorderPoint, costPerUnit
    ['Detergent', 'kg', 14.5, 5, 18000],
    ['Fabric conditioner', 'L', 8.0, 3, 22000],
    ['Bleach', 'L', 5.5, 2, 9000],
    ['Plastic bag', 'pc', 40, 50, 150], // below reorder point
    ['Hanger', 'pc', 120, 30, 500],
  ]
  const inventoryItems: InventoryItem[] = invDefs.map(([name, unit, qty, reorder, cost]) => ({
    id: ulid(),
    name,
    unit,
    currentQty: qty,
    reorderPoint: reorder,
    costPerUnitCentavos: cost,
    supplier: 'JB Trading',
    active: true,
    demo: true,
    updatedAt: iso(today),
  }))

  const inventoryMoves: InventoryMove[] = []
  for (const item of inventoryItems) {
    let running = 0
    // 3 months of monthly deliveries + weekly usage
    for (let m = 3; m >= 1; m--) {
      const inQty = item.unit === 'pc' ? 100 : 10
      running += inQty
      inventoryMoves.push({
        id: ulid(),
        itemId: item.id,
        type: 'in',
        qty: inQty,
        reason: 'Delivery',
        at: iso(new Date(today.getTime() - m * 30 * DAY)),
        byUserId: owner.id,
        unitCostCentavos: item.costPerUnitCentavos,
        demo: true,
      })
      for (let w = 3; w >= 0; w--) {
        const outQty = item.unit === 'pc' ? Math.floor(15 + rand() * 10) : Math.round((1.5 + rand() * 1.5) * 10) / 10
        running -= outQty
        inventoryMoves.push({
          id: ulid(),
          itemId: item.id,
          type: 'out',
          qty: outQty,
          reason: 'Nagamit sa linggo',
          at: iso(new Date(today.getTime() - (m * 30 - w * 7 - 3) * DAY)),
          byUserId: staff.id,
          demo: true,
        })
      }
    }
    // reconcile with a recount so history matches currentQty
    const delta = Math.round((item.currentQty - running) * 1000) / 1000
    if (delta !== 0) {
      inventoryMoves.push({
        id: ulid(),
        itemId: item.id,
        type: 'adjust',
        qty: delta,
        reason: 'Recount',
        at: iso(new Date(today.getTime() - DAY)),
        byUserId: owner.id,
        demo: true,
      })
    }
  }

  // ── Write everything ──
  await db.transaction(
    'rw',
    [
      db.shop, db.users, db.customers, db.services, db.orders, db.statusEvents,
      db.payments, db.inventoryItems, db.inventoryMoves, db.auditEntries,
      db.backupMeta, db.appMeta,
    ],
    async () => {
      await db.shop.put(shop)
      await db.users.bulkPut([owner, staff])
      await db.customers.bulkPut(customers)
      await db.services.bulkPut(services)
      await db.orders.bulkPut(orders)
      await db.statusEvents.bulkPut(statusEvents)
      await db.payments.bulkPut(payments)
      await db.inventoryItems.bulkPut(inventoryItems)
      await db.inventoryMoves.bulkPut(inventoryMoves)
      await db.auditEntries.bulkPut([
        {
          id: ulid(), at: iso(new Date(today.getTime() - 2 * DAY)), byUserId: owner.id,
          action: 'update', entity: 'service', entityId: services[0].id,
          summary: 'Updated service Wash & Fold (₱35.00/kg)', demo: true,
        },
        {
          id: ulid(), at: iso(new Date(today.getTime() - DAY)), byUserId: staff.id,
          action: 'create', entity: 'customer', entityId: customers[13].id,
          summary: 'Added customer Ernesto Ocampo', demo: true,
        },
      ])
      // Backup from yesterday → amber health chip in the demo
      const yesterday = iso(new Date(today.getTime() - DAY - 2 * 3600_000))
      await db.backupMeta.put({
        id: ulid(),
        at: yesterday,
        kind: 'manual',
        counts: { orders: orders.length, customers: customers.length },
        sizeBytes: 250_000,
        checksum: 'sha256:demo',
        destination: 'download',
      })
      await db.appMeta.put({
        id: 'app',
        schemaVersion: 1,
        demoMode: true,
        installedAt: iso(today),
        lastBackupAt: yesterday,
        storagePersisted: false,
        setupComplete: true,
      })
    },
  )
}
