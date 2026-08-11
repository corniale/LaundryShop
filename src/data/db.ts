import Dexie, { type Table } from 'dexie'
import { ulid } from 'ulid'
import { deriveAddOnTypes } from '../domain/addOns'
import type {
  Shop,
  User,
  Customer,
  Service,
  AddOnType,
  Order,
  OrderAddOn,
  StatusEvent,
  Payment,
  InventoryItem,
  InventoryMove,
  ExpectedUseRule,
  AuditEntry,
  BackupMeta,
  Snapshot,
  AppMeta,
  Draft,
} from './types'

export const SCHEMA_VERSION = 4

export class LaundryDB extends Dexie {
  shop!: Table<Shop, string>
  users!: Table<User, string>
  customers!: Table<Customer, string>
  services!: Table<Service, string>
  addOnTypes!: Table<AddOnType, string>
  orders!: Table<Order, string>
  statusEvents!: Table<StatusEvent, string>
  payments!: Table<Payment, string>
  inventoryItems!: Table<InventoryItem, string>
  inventoryMoves!: Table<InventoryMove, string>
  expectedUseRules!: Table<ExpectedUseRule, string>
  auditEntries!: Table<AuditEntry, string>
  backupMeta!: Table<BackupMeta, string>
  snapshots!: Table<Snapshot, string>
  appMeta!: Table<AppMeta, string>
  drafts!: Table<Draft, string>

  constructor() {
    super('laundry-shop-os')
    this.version(1).stores({
      shop: 'id',
      users: 'id, name, role, active',
      customers: 'id, name, contact, archivedAt, updatedAt',
      services: 'id, active, sortOrder',
      orders: 'id, code, customerId, serviceId, status, receivedAt, promisedAt, updatedAt, [status+promisedAt]',
      statusEvents: 'id, orderId, at, byUserId',
      payments: 'id, orderId, receivedAt, byUserId, method',
      inventoryItems: 'id, name, active',
      inventoryMoves: 'id, itemId, at, type',
      expectedUseRules: 'id, serviceId, itemId',
      auditEntries: 'id, at, byUserId, entity, action',
      backupMeta: 'id, at',
      snapshots: 'id, at, kind',
      appMeta: 'id',
      drafts: 'id, kind, updatedAt',
    })

    // v2: an expected-use rule can be measured per kilo, per piece, or per
    // order, so the per-kilo-only field becomes a quantity plus a basis.
    this.version(2)
      .stores({ expectedUseRules: 'id, serviceId, itemId' })
      .upgrade(async (tx) => {
        await tx
          .table('expectedUseRules')
          .toCollection()
          .modify((r: { qtyPer?: number; qtyPerKg?: number; basis?: string }) => {
            if (r.qtyPer !== undefined) return
            r.qtyPer = r.qtyPerKg ?? 0
            r.basis = 'kg'
            delete r.qtyPerKg
          })
      })

    // v3: an order can hold more than one service, so the service, its
    // price and its kilos move onto a line. The serviceId index goes with
    // them — nothing queried by it, and it cannot describe a list.
    this.version(3)
      .stores({
        orders: 'id, code, customerId, status, receivedAt, promisedAt, updatedAt, [status+promisedAt]',
      })
      .upgrade(async (tx) => {
        await tx
          .table('orders')
          .toCollection()
          .modify((o: Record<string, unknown>) => {
            if (Array.isArray(o.lines)) return
            const kilos = (o.kilos as number) ?? 0
            const price = (o.pricePerKgSnapshot as number) ?? 0
            o.lines = [
              {
                serviceId: o.serviceId,
                serviceNameSnapshot: o.serviceNameSnapshot,
                pricePerKgSnapshot: price,
                kilos,
                itemCount: o.itemCount,
                billedKilos: kilos,
                lineTotalCentavos: Math.round(kilos * price),
              },
            ]
            delete o.serviceId
            delete o.serviceNameSnapshot
            delete o.pricePerKgSnapshot
            delete o.kilos
            delete o.itemCount
          })
      })

    // v4: add-ons get a catalogue, so the counter picks a bag rather than
    // spelling one. Existing orders keep their typed labels — those are
    // snapshots — but they seed the catalogue, so a shop that has been open
    // for months does not start this list from nothing.
    this.version(4)
      .stores({ addOnTypes: 'id, active, sortOrder' })
      .upgrade(async (tx) => {
        const orders = (await tx.table('orders').toArray()) as Array<{ addOns?: OrderAddOn[] }>
        const derived = deriveAddOnTypes(
          orders.map((o) => ({ addOns: o.addOns ?? [] })),
          ulid,
          new Date().toISOString(),
        )
        if (derived.length > 0) await tx.table('addOnTypes').bulkAdd(derived)
      })
  }
}

export const db = new LaundryDB()

/** Table names included in backups, in serialization order. */
export const BACKUP_TABLES = [
  'shop',
  'users',
  'customers',
  'services',
  'addOnTypes',
  'orders',
  'statusEvents',
  'payments',
  'inventoryItems',
  'inventoryMoves',
  'expectedUseRules',
  'auditEntries',
] as const

export type BackupTableName = (typeof BACKUP_TABLES)[number]
