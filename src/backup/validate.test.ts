// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { validateBackupJson } from './validate'
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
    orders: [
      {
        id: 'o1', code: 'ORD-0001', serviceId: 'sv1', serviceNameSnapshot: 'Wash & Fold',
        pricePerKgSnapshot: 3500, kilos: 5, addOns: [], discountCentavos: 0,
        subtotalCentavos: 17500, totalCentavos: 17500, status: 'received' as const,
        receivedAt: now, promisedAt: now, createdBy: 'u1', updatedAt: now,
      },
    ],
    statusEvents: [],
    payments: [],
    inventoryItems: [],
    inventoryMoves: [],
    expectedUseRules: [],
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
