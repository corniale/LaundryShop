// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { validateBackupJson, migrateBackup } from './validate'
import { sha256Hex } from './serialize'
import { SCHEMA_VERSION } from '../data/db'

async function makeBackup(schemaVersion = SCHEMA_VERSION) {
  const now = '2026-08-08T09:00:00.000Z'
  const data = {
    shop: [
      {
        id: 's1', name: 'Test Shop', ownerName: 'Owner', address: '', contact: '',
        currency: 'PHP' as const, orderCodePrefix: 'ORD', nextOrderNumber: 2,
        locale: 'tl' as const, createdAt: now, schemaVersion, updatedAt: now,
      },
    ],
    users: [],
    customers: [],
    services: [],
    // v1/v2 orders held one service inline; v3 holds a list of lines.
    orders: [
      schemaVersion < 3
        ? {
            id: 'o1', code: 'ORD-0001', serviceId: 'sv1', serviceNameSnapshot: 'Wash & Fold',
            pricePerKgSnapshot: 3500, kilos: 5, addOns: [], discountCentavos: 0,
            subtotalCentavos: 17500, totalCentavos: 17500, status: 'received' as const,
            receivedAt: now, promisedAt: now, createdBy: 'u1', updatedAt: now,
          }
        : {
            id: 'o1', code: 'ORD-0001',
            lines: [{
              serviceId: 'sv1', serviceNameSnapshot: 'Wash & Fold', pricePerKgSnapshot: 3500,
              kilos: 5, billedKilos: 5, lineTotalCentavos: 17500,
            }],
            addOns: [], discountCentavos: 0,
            subtotalCentavos: 17500, totalCentavos: 17500, status: 'received' as const,
            receivedAt: now, promisedAt: now, createdBy: 'u1', updatedAt: now,
          },
    ],
    statusEvents: [],
    payments: [],
    inventoryItems: [],
    inventoryMoves: [],
    // v1 stored a per-kilo rate and nothing else; v2 stores a quantity and a basis.
    expectedUseRules: [
      schemaVersion === 1
        ? { id: 'r1', serviceId: 'sv1', itemId: 'i1', qtyPerKg: 0.02, updatedAt: now }
        : { id: 'r1', serviceId: 'sv1', itemId: 'i1', qtyPer: 0.5, basis: 'piece' as const, updatedAt: now },
    ],
    auditEntries: [],
  }
  return {
    app: 'laundry-shop-os' as const,
    schemaVersion,
    shopId: 's1',
    shopName: 'Test Shop',
    createdAt: now,
    counts: { orders: 1 },
    checksum: `sha256:${await sha256Hex(JSON.stringify(data))}`,
    data,
  }
}

describe('backup validation', () => {
  it('accepts a valid backup', async () => {
    const backup = await makeBackup()
    const result = await validateBackupJson(JSON.stringify(backup))
    expect(result.ok).toBe(true)
  })

  it('refuses a corrupted backup with existing data untouched (acceptance #9)', async () => {
    const backup = await makeBackup()
    const json = JSON.stringify(backup)
    // corrupt one byte inside the data payload
    const corrupted = json.replace('"Wash & Fold"', '"Wash & Folt"')
    const result = await validateBackupJson(corrupted)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('checksum')
  })

  it('refuses a backup from a newer schema (acceptance #5.5)', async () => {
    const backup = await makeBackup(SCHEMA_VERSION + 1)
    const result = await validateBackupJson(JSON.stringify(backup))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('newer-schema')
  })

  it('rejects a file that is not a backup for this app', async () => {
    const result = await validateBackupJson(JSON.stringify({ hello: 'world' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not-backup')

    const notJson = await validateBackupJson('not json at all')
    expect(notJson.ok).toBe(false)
  })
})

describe('schema migration', () => {
  it('reads v1 expected-use rules as per kilo (v1 → v2)', async () => {
    const result = await validateBackupJson(JSON.stringify(await makeBackup(1)))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { backup, notes } = migrateBackup(result.backup)
    const rule = backup.data.expectedUseRules[0]
    expect(rule.qtyPer).toBe(0.02)
    expect(rule.basis).toBe('kg')
    expect(rule.qtyPerKg).toBeUndefined()
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION)
    expect(notes.join(' ')).toMatch(/per kilo/i)
  })

  it('leaves a current-version backup alone', async () => {
    const result = await validateBackupJson(JSON.stringify(await makeBackup()))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { backup, notes } = migrateBackup(result.backup)
    expect(notes).toEqual([])
    expect(backup.data.expectedUseRules[0].basis).toBe('piece')
  })

  it('turns a v2 order into a single-line order (v2 → v3)', async () => {
    const result = await validateBackupJson(JSON.stringify(await makeBackup(2)))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { backup, notes } = migrateBackup(result.backup)
    const order = backup.data.orders[0]
    expect(order.lines).toEqual([
      {
        serviceId: 'sv1',
        serviceNameSnapshot: 'Wash & Fold',
        pricePerKgSnapshot: 3500,
        kilos: 5,
        itemCount: undefined,
        billedKilos: 5,
        lineTotalCentavos: 17500,
      },
    ])
    expect(order.serviceId).toBeUndefined()
    expect(order.kilos).toBeUndefined()
    expect(notes.join(' ')).toMatch(/one line per service/i)
  })

  it('carries a v1 order all the way through both steps', async () => {
    const result = await validateBackupJson(JSON.stringify(await makeBackup(1)))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { backup, notes } = migrateBackup(result.backup)
    expect(backup.data.orders[0].lines).toHaveLength(1)
    expect(backup.data.expectedUseRules[0].basis).toBe('kg')
    expect(notes).toHaveLength(2)
  })
})
