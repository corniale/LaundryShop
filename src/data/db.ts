import Dexie, { type Table } from 'dexie'
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
  AuditEntry,
  BackupMeta,
  Snapshot,
  AppMeta,
  Draft,
} from './types'

export const SCHEMA_VERSION = 1

export class LaundryDB extends Dexie {
  shop!: Table<Shop, string>
  users!: Table<User, string>
  customers!: Table<Customer, string>
  services!: Table<Service, string>
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
  }
}

export const db = new LaundryDB()

/** Table names included in backups, in serialization order. */
export const BACKUP_TABLES = [
  'shop',
  'users',
  'customers',
  'services',
  'orders',
  'statusEvents',
  'payments',
  'inventoryItems',
  'inventoryMoves',
  'expectedUseRules',
  'auditEntries',
] as const

export type BackupTableName = (typeof BACKUP_TABLES)[number]
