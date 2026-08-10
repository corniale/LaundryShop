# Laundry Shop OS

An offline-first, phone-first counter app for a single laundry shop in the Philippines. Sold as a one-time purchase: **no server, no subscription, no account, no runtime network dependency**. All logic and data live in the browser (IndexedDB via Dexie), protected by a first-class backup engine.

## Stack

- React 18 + TypeScript, Vite, Tailwind (token layer — no hex values in components)
- Dexie (IndexedDB) for all records; zod validation on every restore and form
- date-fns, React Router (hash router — works from `file://` and any static host)
- vite-plugin-pwa (Workbox) — full offline precache, installable
- Self-hosted woff2 fonts (Archivo / Public Sans / IBM Plex Mono) — nothing fetched at runtime
- No chart library — reports use hand-built CSS bars

Current build: ~150 KB gzipped JS (budget 350 KB), ~180 KB fonts.

## Dev setup

```bash
npm install
npm run dev        # dev server
npm test           # Vitest — pure domain + backup validation tests
npm run build      # type-check + production build + PWA service worker
npm run preview    # serve the production build
```

First run seeds **demo data** (a realistic month of shop life). Demo PINs: Owner `Admin` / `1234`, Staff `Jenny` / `5678`. The demo strip on the Today screen opens the setup wizard (`Simulan ang totoong shop`), which wipes demo records and provisions the real shop.

## Repo layout

```
src/
  app/            routes, shell, auth/lock, error boundary
  screens/        one folder per screen (Section 7 of the spec)
  components/     ui primitives, WashLine, Stub, Toast
  data/           dexie db, repository, zod schemas, sync seam
  domain/         PURE logic (no React, no Dexie): pricing, status machine,
                  payment derivation, inventory, PIN hashing, csv
  backup/         serialize, validate, destinations, scheduler, restore
  seed/           demoData.ts
  i18n/           strings.ts (tl default + en)
  styles/         tokens.css (the only hex values in the app), print.css
  config/         client.config.ts  ← per-buyer branding & defaults
```

## Producing a client build

Everything buyer-specific lives in `src/config/client.config.ts` (app name, default services and prices, order-code prefix, lock timeout, staff edit window). Copy the file per buyer, adjust, and run `npm run build`. Deploy `dist/` to any static host — GitHub Pages, Netlify, a $2 shared host, anything. The app uses hash routing and relative asset paths, so no server config is needed.

Language: `tl` (Taglish) is the default; a buyer can be handed an English build by setting `defaultLocale: 'en'` (or toggling in Shop Settings). All copy lives in `src/i18n/strings.ts`.

## Data safety model (read before touching `src/backup/`)

- All records in IndexedDB; `localStorage` is never used for records.
- Backups are a single JSON file: header (app id, schema version, counts, SHA-256 checksum) + every table. Filename `<shop>-backup-YYYY-MM-DD.json`.
- Three destinations by capability detection: **folder handle** (File System Access API — silent daily writes, keeps last 14), **Web Share** (iOS/iPadOS primary), **download** (universal). The chosen strategy is stored in AppMeta; users never see a capability they don't have.
- On-device snapshots (last 7 daily + 4 weekly + pre-restore) live inside IndexedDB for file-free rollback.
- Restore validates shape (zod) → schema version direction → checksum before writing anything, always takes a pre-restore snapshot, and offers Replace (typed confirmation) or Merge (never overwrites a newer record).
- Backup health is surfaced on the Today screen chip; stale >3 days prompts once a day, >7 days prompts modally.
- **Close the day is gated on a backup**: the sheet's only primary action is "Back up and close the day", and it reports the day closed only once the backup lands. The X still lets someone out — a modal with no exit would trap them when a share sheet is cancelled — but there is no button that finishes the ritual without the file.
- **Automatic where the platform allows it.** A device with the File System Access API writes a backup silently on the first open of each day, once a folder is chosen; if the capability is present and no folder is set, Today offers to set one (dismissible, per device). Both that offer and Backup & Data's own button go through `pickBackupFolderAndSeed()`, which writes one backup straight after the pick so the folder is never empty until tomorrow, and both point the shop at a cloud-synced folder — which turns the daily write into the weekly off-device copy for free. iOS cannot do this — the share sheet requires a gesture — so those installs are tap-to-back-up, and the staleness prompts carry the weight.
- **Recommended cadence**: daily at closing, plus one copy a week to a physically different place. On-device snapshots are an undo history, not a backup — they are lost with the phone.

## Bumping the schema version

1. Increment `SCHEMA_VERSION` in `src/data/db.ts` and add a Dexie `this.version(n).stores(...).upgrade(...)` migration.
2. Add a `case` for the old version in `migrateBackup()` (`src/backup/validate.ts`) that transforms an older backup's `data` forward, pushing a human-readable note into `notes` — the restore preview shows these.
3. Restoring a *newer* backup into an older build is refused with a plain message; that behavior is already generic.
4. Add an acceptance test like the existing ones in `src/backup/validate.test.ts`.

## Ship checklist (before handing a build to a buyer)

- [ ] Demo data cleared through the wizard, or wizard flow verified on the target device
- [ ] Shop config set (name, contact, receipt footer, order prefix)
- [ ] Owner PIN set; recovery code written on the printed quick guide
- [ ] First backup created **and restored once on a second device** to prove the loop
- [ ] Home-screen install done (mandatory on iOS — uninstalled Safari storage is evictable)
- [ ] Phone screen lock on (the PIN is not encryption — see Help screen)
- [ ] Printed quick guide handed over (contents mirror the in-app Help screen)

Smoke-test matrix per release: Chrome on Android phone, Safari on iPhone, Safari on iPadOS, Chrome on desktop.

## Security posture (honest)

The PIN (PBKDF2-SHA256, 250k iterations, per-user salt) keeps walk-ins out of the till figures; it is not encryption and does not protect a stolen phone — the device screen lock does. Backup files contain customer names and numbers; keep them in a private folder. Data Privacy Act obligations sit with the shop owner collecting the data. This is stated plainly in the in-app Help.
