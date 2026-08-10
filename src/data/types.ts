/** Record types. Money is ALWAYS integer centavos. IDs are ULIDs. */

export type OrderStatus = 'received' | 'washing' | 'drying' | 'ready' | 'claimed'
export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'bank' | 'other'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type Role = 'owner' | 'staff'
export type InventoryUnit = 'kg' | 'g' | 'L' | 'mL' | 'pc' | 'pack'

/** What an expected-use rule is measured against: kilos, pieces, or the order itself. */
export type UseBasis = 'kg' | 'piece' | 'order'
export type InventoryMoveType = 'in' | 'out' | 'adjust' | 'auto'
export type BackupKind = 'auto' | 'manual' | 'handover'
export type BackupDestination = 'folder' | 'share' | 'download' | 'snapshot'

export interface Shop {
  id: string
  name: string
  ownerName: string
  address: string
  contact: string
  currency: 'PHP'
  logoDataUrl?: string
  orderCodePrefix: string
  nextOrderNumber: number
  locale: 'tl' | 'en'
  receiptFooter?: string
  readyMessageTemplate?: string
  createdAt: string
  schemaVersion: number
  updatedAt: string
}

export interface User {
  id: string
  name: string
  role: Role
  pinHash: string
  pinSalt: string
  /** Owner only: PBKDF2 hash of the recovery code. */
  recoveryHash?: string
  recoverySalt?: string
  active: boolean
  createdAt: string
  lastLoginAt?: string
  demo?: boolean
  updatedAt: string
}

export interface Customer {
  id: string
  name: string
  contact?: string
  address?: string
  notes?: string
  createdAt: string
  archivedAt?: string
  demo?: boolean
  updatedAt: string
}

export interface Service {
  id: string
  name: string
  pricePerKgCentavos: number
  turnaroundDays: number
  minimumKg?: number
  active: boolean
  sortOrder: number
  demo?: boolean
  updatedAt: string
}

export interface OrderAddOn {
  label: string
  amountCentavos: number
}

/**
 * One service within an order. A customer can drop off wash-dry-fold and
 * dry cleaning in the same visit, so the service, its price and its kilos
 * belong to the line rather than to the order. Prices and minimums are
 * snapshotted here for the same reason they always were: editing a service
 * later must never restate a past order.
 */
export interface OrderLine {
  serviceId: string
  serviceNameSnapshot: string
  pricePerKgSnapshot: number
  minimumKgSnapshot?: number
  kilos: number
  itemCount?: number
  /** Kilos actually charged for, after the service minimum. */
  billedKilos: number
  lineTotalCentavos: number
}

export interface Order {
  id: string
  code: string
  customerId?: string
  walkInName?: string
  /** At least one. Derived totals live in src/domain/orders.ts. */
  lines: OrderLine[]
  itemNotes?: string
  addOns: OrderAddOn[]
  discountCentavos: number
  discountReason?: string
  subtotalCentavos: number
  totalCentavos: number
  status: OrderStatus
  receivedAt: string
  promisedAt: string
  readyAt?: string
  claimedAt?: string
  claimedByName?: string
  notes?: string
  voidedAt?: string
  voidReason?: string
  createdBy: string
  demo?: boolean
  updatedAt: string
}

/**
 * Append-only status history: one entry per transition, never deleted.
 * A backward move appends an entry with reverted: true rather than
 * removing the forward one, so "when did this first hit Ready?" stays
 * answerable months later.
 */
export interface StatusEvent {
  id: string
  orderId: string
  from: OrderStatus | null
  to: OrderStatus
  at: string
  byUserId: string
  reason?: string
  reverted?: boolean
  demo?: boolean
}

export interface Payment {
  id: string
  orderId: string
  amountCentavos: number
  method: PaymentMethod
  reference?: string
  receivedAt: string
  byUserId: string
  /** Set on the original when it has been reversed. */
  reversedByPaymentId?: string
  /** Set on the counter-entry pointing at the original. */
  reversalOfPaymentId?: string
  reason?: string
  demo?: boolean
  updatedAt: string
}

export interface InventoryItem {
  id: string
  name: string
  unit: InventoryUnit
  currentQty: number
  reorderPoint: number
  costPerUnitCentavos?: number
  supplier?: string
  active: boolean
  demo?: boolean
  updatedAt: string
}

export interface InventoryMove {
  id: string
  itemId: string
  type: InventoryMoveType
  qty: number
  reason?: string
  orderId?: string
  at: string
  byUserId: string
  unitCostCentavos?: number
  demo?: boolean
}

/** REPORTING ONLY — never mutates stock. */
export interface ExpectedUseRule {
  id: string
  serviceId: string
  itemId: string
  /** Quantity in the item's own unit, per one unit of the basis. */
  qtyPer: number
  basis: UseBasis
  /** v1 field, read only while migrating an old backup. */
  qtyPerKg?: number
  demo?: boolean
  updatedAt: string
}

export interface AuditEntry {
  id: string
  at: string
  byUserId: string
  action: string
  entity: string
  entityId: string
  summary: string
  demo?: boolean
}

export interface BackupMeta {
  id: string
  at: string
  kind: BackupKind
  counts: Record<string, number>
  sizeBytes: number
  checksum: string
  destination: BackupDestination
}

export interface Snapshot {
  id: string
  at: string
  kind: 'daily' | 'weekly' | 'pre-restore'
  json: string
}

export interface AppMeta {
  id: 'app'
  schemaVersion: number
  demoMode: boolean
  installedAt: string
  lastBackupAt?: string
  lastBackupPromptAt?: string
  storagePersisted: boolean
  backupStrategy?: 'folder' | 'share' | 'download'
  shareDestinationName?: string
  setupComplete: boolean
}

export interface Draft {
  id: string
  kind: 'order'
  json: string
  updatedAt: string
}
