/**
 * Per-buyer configuration. One copy of this file per client produces a
 * branded build — nothing buyer-specific may be hardcoded anywhere else.
 */
export interface ClientConfig {
  appName: string
  defaultShopName: string
  defaultLocale: 'tl' | 'en'
  orderCodePrefix: string
  currency: 'PHP'
  /** Default services offered in the setup wizard (prices in centavos). */
  defaultServices: Array<{
    name: string
    pricePerKgCentavos: number
    turnaroundDays: number
  }>
  /** Days of daily snapshots kept in the backup folder. */
  folderBackupKeep: number
  /** Idle minutes before the lock screen re-engages. */
  lockTimeoutMinutes: number
  /** Minutes staff may edit their own order after creation. */
  staffEditWindowMinutes: number
}

export const clientConfig: ClientConfig = {
  appName: 'Laundry Shop OS',
  defaultShopName: 'Bubbles Laundry Shop',
  defaultLocale: 'tl',
  orderCodePrefix: 'ORD',
  currency: 'PHP',
  defaultServices: [
    { name: 'Wash & Fold', pricePerKgCentavos: 3500, turnaroundDays: 1 },
    { name: 'Wash, Dry & Fold', pricePerKgCentavos: 4500, turnaroundDays: 1 },
    { name: 'Dry Clean', pricePerKgCentavos: 12000, turnaroundDays: 2 },
    { name: 'Comforter / Bedding', pricePerKgCentavos: 8000, turnaroundDays: 2 },
    { name: 'Press / Plantsa Only', pricePerKgCentavos: 2500, turnaroundDays: 1 },
  ],
  folderBackupKeep: 14,
  lockTimeoutMinutes: 15,
  staffEditWindowMinutes: 30,
}
