# Changelog

## Unreleased

- **Themes.** Every colour now comes from a sixteen-token contract defined in
  one file, `src/styles/themes.css`, and the shop picks between **Cold Wash**
  (default) and **Bubblegum** in Settings → Itsura. The theme is applied by a
  blocking script in `<head>` so a launch never flashes the wrong palette, and
  it changes instantly with no reload. `src/styles/themes.test.ts` fails the
  build if a literal colour appears anywhere else. See `spec.md`.
- Automatic dark mode was removed: it flipped the palette from the OS setting,
  bypassing the stored theme. A hand-tuned `coldwash-dark` entry can be added
  later through the checklist in `spec.md` § 8.
- Inventory: expected-use rules are a grid (service × item) instead of a
  dialog, and a rule can be measured per kilo, per piece, or per order.
  Schema version 2.
- **Close the day is gated on a backup.** The sheet finishes only once the
  backup lands, and reports the time it did.
- **Devices that can back up silently are asked to.** Where the File System
  Access API exists and no folder is set, Today offers to set one. Both
  entry points — that offer and Backup & Data's "Choose backup folder" —
  seed the folder with one backup immediately, so it is never empty until
  the next day's first open, and both recommend a cloud-synced folder.
- Help now states how often to back up, and that on-device snapshots are an
  undo history rather than a backup.

## 1.0.0 — 2026-08-08

Initial release. Schema version 1.

- Full counter flow: intake (customer/walk-in, service chips, kilos, items, add-ons, discount with reason, live total, promised date, payment now), wash-line one-tap advance, order detail with timeline, void with reason.
- Payments: partial payments, overpayment guard, owner-only reversals as counter-entries, aging buckets, CSV ledger export. Paid/balance/status always derived from the ledger, never stored.
- Customers: search, dedupe by contact number, archive, CSV export, per-customer history and balance.
- Services: price/turnaround/minimum, reorder, archive; price edits never touch past orders (snapshots).
- Inventory: stock in/out/recount with running-balance history, low-stock surfacing on Today, expected-vs-actual usage report (reporting only — never mutates stock).
- Reports (owner-only): daily/weekly/monthly income bars, by-service income and kilos, top customers, outstanding balances, staff activity. CSV export.
- Users & access: owner/staff roles, PBKDF2 PINs, recovery code, lock screen with cooldown, idle relock, audit log viewer.
- Data safety: Dexie/IndexedDB storage, storage persistence request, backup engine (folder handle / share sheet / download by capability), on-device daily+weekly snapshots, validated restore with preview + pre-restore snapshot, handover flow, backup health chip and prompts, close-the-day ritual.
- PWA: full offline precache, installable, safe-area aware, phone-first with tablet nav rail and master–detail.
- Demo seed with one-tap wipe via the 7-step setup wizard (finishes only after the first successful backup).
