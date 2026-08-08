/**
 * zod schemas — every backup restore and form input is validated.
 */
import { z } from 'zod'

const iso = z.string().min(1)
const centavos = z.number().int()
const nonNegCentavos = z.number().int().min(0)

export const shopSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  ownerName: z.string(),
  address: z.string(),
  contact: z.string(),
  currency: z.literal('PHP'),
  logoDataUrl: z.string().optional(),
  orderCodePrefix: z.string().min(1),
  nextOrderNumber: z.number().int().min(1),
  locale: z.enum(['tl', 'en']),
  receiptFooter: z.string().optional(),
  readyMessageTemplate: z.string().optional(),
  createdAt: iso,
  schemaVersion: z.number().int(),
  updatedAt: iso,
})

export const userSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: z.enum(['owner', 'staff']),
  pinHash: z.string(),
  pinSalt: z.string(),
  recoveryHash: z.string().optional(),
  recoverySalt: z.string().optional(),
  active: z.boolean(),
  createdAt: iso,
  lastLoginAt: iso.optional(),
  demo: z.boolean().optional(),
  updatedAt: iso,
})

export const customerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  contact: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  createdAt: iso,
  archivedAt: iso.optional(),
  demo: z.boolean().optional(),
  updatedAt: iso,
})

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  pricePerKgCentavos: nonNegCentavos,
  turnaroundDays: z.number().int().min(0),
  minimumKg: z.number().min(0).optional(),
  active: z.boolean(),
  sortOrder: z.number(),
  demo: z.boolean().optional(),
  updatedAt: iso,
})

export const orderStatusSchema = z.enum(['received', 'washing', 'drying', 'ready', 'claimed'])

export const orderSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  customerId: z.string().optional(),
  walkInName: z.string().optional(),
  serviceId: z.string(),
  serviceNameSnapshot: z.string(),
  pricePerKgSnapshot: nonNegCentavos,
  kilos: z.number().min(0),
  itemCount: z.number().int().min(0).optional(),
  itemNotes: z.string().optional(),
  addOns: z.array(z.object({ label: z.string(), amountCentavos: centavos })),
  discountCentavos: nonNegCentavos,
  discountReason: z.string().optional(),
  subtotalCentavos: centavos,
  totalCentavos: centavos,
  status: orderStatusSchema,
  receivedAt: iso,
  promisedAt: iso,
  readyAt: iso.optional(),
  claimedAt: iso.optional(),
  claimedByName: z.string().optional(),
  notes: z.string().optional(),
  voidedAt: iso.optional(),
  voidReason: z.string().optional(),
  createdBy: z.string(),
  demo: z.boolean().optional(),
  updatedAt: iso,
})

export const statusEventSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  from: orderStatusSchema.nullable(),
  to: orderStatusSchema,
  at: iso,
  byUserId: z.string(),
  reason: z.string().optional(),
  demo: z.boolean().optional(),
})

export const paymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  amountCentavos: centavos,
  method: z.enum(['cash', 'gcash', 'maya', 'bank', 'other']),
  reference: z.string().optional(),
  receivedAt: iso,
  byUserId: z.string(),
  reversedByPaymentId: z.string().optional(),
  reversalOfPaymentId: z.string().optional(),
  reason: z.string().optional(),
  demo: z.boolean().optional(),
  updatedAt: iso,
})

export const inventoryItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  unit: z.enum(['kg', 'L', 'pc', 'pack']),
  currentQty: z.number(),
  reorderPoint: z.number().min(0),
  costPerUnitCentavos: nonNegCentavos.optional(),
  supplier: z.string().optional(),
  active: z.boolean(),
  demo: z.boolean().optional(),
  updatedAt: iso,
})

export const inventoryMoveSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  type: z.enum(['in', 'out', 'adjust', 'auto']),
  qty: z.number(),
  reason: z.string().optional(),
  orderId: z.string().optional(),
  at: iso,
  byUserId: z.string(),
  unitCostCentavos: nonNegCentavos.optional(),
  demo: z.boolean().optional(),
})

export const expectedUseRuleSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  itemId: z.string(),
  qtyPerKg: z.number().min(0),
  demo: z.boolean().optional(),
  updatedAt: iso,
})

export const auditEntrySchema = z.object({
  id: z.string(),
  at: iso,
  byUserId: z.string(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  summary: z.string(),
  demo: z.boolean().optional(),
})

/** The full backup file. */
export const backupFileSchema = z.object({
  app: z.literal('laundry-shop-os'),
  schemaVersion: z.number().int().min(1),
  shopId: z.string(),
  shopName: z.string(),
  createdAt: iso,
  counts: z.record(z.number()),
  checksum: z.string(),
  data: z.object({
    shop: z.array(shopSchema),
    users: z.array(userSchema),
    customers: z.array(customerSchema),
    services: z.array(serviceSchema),
    orders: z.array(orderSchema),
    statusEvents: z.array(statusEventSchema),
    payments: z.array(paymentSchema),
    inventoryItems: z.array(inventoryItemSchema),
    inventoryMoves: z.array(inventoryMoveSchema),
    expectedUseRules: z.array(expectedUseRuleSchema),
    auditEntries: z.array(auditEntrySchema),
  }),
})

export type BackupFile = z.infer<typeof backupFileSchema>
