/**
 * Every user-facing string, keyed by id, with tl (default) and en variants.
 * Components never contain literal copy.
 */
export type Locale = 'tl' | 'en'

type Entry = { tl: string; en: string }

const strings = {
  // ── Tabs / navigation ──────────────────────────────────────────
  'tab.today': { tl: 'Ngayon', en: 'Today' },
  'tab.orders': { tl: 'Orders', en: 'Orders' },
  'tab.customers': { tl: 'Suki', en: 'Customers' },
  'tab.payments': { tl: 'Bayad', en: 'Payments' },
  'tab.more': { tl: 'Iba pa', en: 'More' },

  'more.reports': { tl: 'Reports', en: 'Reports' },
  'more.services': { tl: 'Services at Presyo', en: 'Services & Prices' },
  'more.inventory': { tl: 'Inventory', en: 'Inventory' },
  'more.users': { tl: 'Users at Access', en: 'Users & Access' },
  'more.backup': { tl: 'Backup at Data', en: 'Backup & Data' },
  'more.settings': { tl: 'Shop Settings', en: 'Shop Settings' },
  'more.help': { tl: 'Help / Quick Guide', en: 'Help / Quick Guide' },

  // ── Statuses ───────────────────────────────────────────────────
  'status.received': { tl: 'Tanggap', en: 'Received' },
  'status.washing': { tl: 'Labada', en: 'Washing' },
  'status.drying': { tl: 'Tuyo', en: 'Drying' },
  'status.ready': { tl: 'Handa', en: 'Ready' },
  'status.claimed': { tl: 'Kuha na', en: 'Claimed' },

  'pay.unpaid': { tl: 'Hindi pa bayad', en: 'Unpaid' },
  'pay.partial': { tl: 'May balanse', en: 'Partial' },
  'pay.paid': { tl: 'Bayad na', en: 'Paid' },

  // ── Today ──────────────────────────────────────────────────────
  'today.title': { tl: 'Ngayon', en: 'Today' },
  'today.ordersToday': { tl: 'Orders ngayon', en: 'Orders today' },
  'today.needsRelease': { tl: 'Kailangan ilabas', en: 'Due out' },
  'today.incomeToday': { tl: 'Kita ngayon', en: 'Collected today' },
  'today.outstanding': { tl: 'Hindi pa bayad', en: 'Outstanding' },
  'today.notClaimed': { tl: 'Hindi pa nakukuha', en: 'Not yet claimed' },
  'today.overdue': { tl: 'Lagpas na', en: 'Overdue' },
  'today.lowStock': { tl: 'Paubos na', en: 'Low stock' },
  'today.closeDay': { tl: 'Isara ang araw', en: 'Close the day' },
  'today.closeDaySummary': { tl: 'Buod ng araw', en: 'Day summary' },
  'today.emptyOrders': {
    tl: 'Wala pang order ngayong araw. I-tap ang + para magsimula.',
    en: 'No orders yet today. Tap + to start.',
  },
  'today.kilosToday': { tl: 'Kilo ngayon', en: 'Kilos today' },
  'today.collectionsByMethod': { tl: 'Koleksyon kada paraan', en: 'Collections by method' },
  'today.runBackupNow': { tl: 'Mag-backup ngayon', en: 'Back up now' },
  'today.persistWarning': {
    tl: 'Hindi pa protektado ang data sa phone na ito. I-install ang app sa home screen.',
    en: 'Data on this phone is not yet protected. Install the app to the home screen.',
  },
  'today.demoStrip': {
    tl: 'Demo data ito. Kapag handa ka na, i-tap ang Simulan ang totoong shop.',
    en: 'This is demo data. When ready, tap Start your real shop.',
  },
  'today.demoStart': { tl: 'Simulan ang totoong shop', en: 'Start your real shop' },

  // ── Backup health chip ─────────────────────────────────────────
  'backup.chip.today': { tl: '✓ Naka-backup ngayong araw', en: '✓ Backed up today' },
  'backup.chip.daysAgo': { tl: '! Huling backup: {n} araw na', en: '! Last backup: {n} days ago' },
  'backup.chip.never': { tl: '!! Wala pang backup', en: '!! No backup yet' },
  'backup.prompt.title': { tl: 'Oras na para mag-backup', en: 'Time to back up' },
  'backup.prompt.body': {
    tl: 'Huling backup: {when}. Isang tap lang para protektado ang records mo.',
    en: 'Last backup: {when}. One tap keeps your records safe.',
  },
  'backup.prompt.action': { tl: 'I-backup ngayon', en: 'Back up now' },
  'backup.prompt.later': { tl: 'Mamaya na', en: 'Later' },
  'backup.done': { tl: 'Na-backup na ang data.', en: 'Backup saved.' },
  'backup.failed': { tl: 'Hindi natapos ang backup. Subukan ulit.', en: 'Backup failed. Try again.' },

  // ── Orders ─────────────────────────────────────────────────────
  'orders.title': { tl: 'Orders', en: 'Orders' },
  'orders.new': { tl: 'Bagong Order', en: 'New Order' },
  'orders.search': { tl: 'Hanapin: code, pangalan, number…', en: 'Search: code, name, contact…' },
  'orders.empty': {
    tl: 'Walang order na tugma. Baguhin ang filter o mag-search ulit.',
    en: 'No matching orders. Change the filter or search again.',
  },
  'orders.all': { tl: 'Lahat', en: 'All' },
  'orders.active': { tl: 'Hindi pa tapos', en: 'Active' },
  'orders.dateFrom': { tl: 'Mula', en: 'From' },
  'orders.dateTo': { tl: 'Hanggang', en: 'To' },
  'orders.dateClear': { tl: 'I-clear', en: 'Clear' },
  'orders.paymentStatus': { tl: 'Bayad', en: 'Payment status' },
  'orders.readyBy': { tl: 'Handa sa', en: 'Ready for pick-up by' },
  'orders.customer': { tl: 'Suki', en: 'Customer' },
  'orders.walkIn': { tl: 'Walk-in', en: 'Walk-in' },
  'orders.walkInName': { tl: 'Pangalan ng walk-in', en: 'Walk-in name' },
  'orders.newCustomer': { tl: '+ Bagong suki', en: '+ New customer' },
  'orders.service': { tl: 'Serbisyo', en: 'Service' },
  'orders.kilos': { tl: 'Kilo', en: 'Kilos' },
  'orders.itemCount': { tl: 'Ilang piraso?', en: 'Item count' },
  'orders.itemNotes': { tl: 'Anong meron? (hal. 3 pantalon, 1 kumot)', en: 'What is inside? (e.g. 3 pants, 1 blanket)' },
  'orders.itemPrompt': { tl: 'Ilang piraso? Anong meron?', en: 'How many pieces? What is inside?' },
  'orders.addons': { tl: 'Mga dagdag', en: 'Add-ons' },
  'orders.addonLabel': { tl: 'Dagdag (hal. plastik, plantsa)', en: 'Add-on (e.g. bag, press)' },
  'orders.discount': { tl: 'Diskwento', en: 'Discount' },
  'orders.discountReason': { tl: 'Dahilan ng diskwento', en: 'Discount reason' },
  'orders.total': { tl: 'Kabuuan', en: 'Total' },
  'orders.subtotal': { tl: 'Subtotal', en: 'Subtotal' },
  'orders.promised': { tl: 'Handa sa', en: 'Ready by' },
  'orders.payNow': { tl: 'Bayad ngayon', en: 'Payment now' },
  'orders.payNone': { tl: 'Wala muna', en: 'None' },
  'orders.payPartial': { tl: 'Partial', en: 'Partial' },
  'orders.payFull': { tl: 'Buo', en: 'Full' },
  'orders.save': { tl: 'I-save ang order', en: 'Save order' },
  'orders.saved': { tl: 'Na-save ang order {code}.', en: 'Order {code} saved.' },
  'orders.undo': { tl: 'I-undo', en: 'Undo' },
  'orders.advance': { tl: 'Markahan bilang {status}', en: 'Mark as {status}' },
  'orders.advanced': { tl: 'Na-mark ang {code} bilang {status}.', en: '{code} marked as {status}.' },
  'orders.timeline': { tl: 'Kasaysayan', en: 'Timeline' },
  'orders.void': { tl: 'I-void ang order', en: 'Void order' },
  'orders.voidReason': { tl: 'Dahilan ng pag-void', en: 'Void reason' },
  'orders.voided': { tl: 'Na-void ang order.', en: 'Order voided.' },
  'orders.voidedBadge': { tl: 'VOID', en: 'VOID' },
  'orders.reprint': { tl: 'I-print ulit ang stub', en: 'Reprint stub' },
  'orders.edit': { tl: 'I-edit', en: 'Edit' },
  'orders.moveBack': { tl: 'Ibalik sa nakaraang stage', en: 'Move back a stage' },
  'orders.moveBackReason': { tl: 'Dahilan ng pagbalik', en: 'Reason for moving back' },
  'orders.balance': { tl: 'Balanse', en: 'Balance' },
  'orders.paid': { tl: 'Nabayaran', en: 'Paid' },
  'orders.kg': { tl: 'kg', en: 'kg' },
  'orders.pcs': { tl: 'pcs', en: 'pcs' },
  'orders.notes': { tl: 'Notes', en: 'Notes' },
  'orders.dateRange': { tl: 'Petsa', en: 'Dates' },
  'orders.viewList': { tl: 'Talaan', en: 'Table' },
  'orders.stage': { tl: 'Yugto', en: 'Stage' },
  'orders.nextStage': { tl: 'Susunod', en: 'Next' },
  'orders.viewBoard': { tl: 'Board', en: 'Board' },
  'orders.message': { tl: 'I-message', en: 'Message' },

  // ── Customers ──────────────────────────────────────────────────
  'customers.title': { tl: 'Suki', en: 'Customers' },
  'customers.search': { tl: 'Hanapin ang suki…', en: 'Search customers…' },
  'customers.add': { tl: 'Bagong suki', en: 'New customer' },
  'customers.name': { tl: 'Pangalan', en: 'Name' },
  'customers.contact': { tl: 'Contact number', en: 'Contact number' },
  'customers.address': { tl: 'Address', en: 'Address' },
  'customers.notes': { tl: 'Notes', en: 'Notes' },
  'customers.orders': { tl: 'orders', en: 'orders' },
  'customers.totalSpend': { tl: 'Kabuuang gastos', en: 'Total spend' },
  'customers.balance': { tl: 'Balanse', en: 'Balance' },
  'customers.archive': { tl: 'I-archive', en: 'Archive' },
  'customers.archived': { tl: 'Na-archive ang suki.', en: 'Customer archived.' },
  'customers.save': { tl: 'I-save ang suki', en: 'Save customer' },
  'customers.saved': { tl: 'Na-save ang suki.', en: 'Customer saved.' },
  'customers.duplicate': {
    tl: 'May suki nang may ganitong number: {name}. Ito ba siya?',
    en: 'A customer already has this number: {name}. Is this the same person?',
  },
  'customers.useExisting': { tl: 'Oo, siya iyon', en: 'Yes, same person' },
  'customers.createAnyway': { tl: 'Hindi, iba iyon', en: 'No, different person' },
  'customers.empty': {
    tl: 'Wala pang suki. Idagdag sila sa unang order nila.',
    en: 'No customers yet. Add them with their first order.',
  },
  'customers.exportCsv': { tl: 'I-export ang CSV', en: 'Export CSV' },
  'customers.lastActivity': { tl: 'Huling galaw', en: 'Last activity' },
  'customers.noMatch': { tl: 'Walang tugmang suki.', en: 'No matching customer.' },
  'customers.sort.recent': { tl: 'Pinakabago', en: 'Recent' },
  'customers.sort.name': { tl: 'Pangalan', en: 'Name' },
  'customers.sort.balance': { tl: 'Balanse', en: 'Balance' },
  'customers.sort.spend': { tl: 'Gastos', en: 'Spend' },

  // ── Services ───────────────────────────────────────────────────
  'services.title': { tl: 'Services at Presyo', en: 'Services & Prices' },
  'services.add': { tl: 'Bagong serbisyo', en: 'New service' },
  'services.name': { tl: 'Pangalan', en: 'Name' },
  'services.price': { tl: 'Presyo kada kilo', en: 'Price per kilo' },
  'services.turnaround': { tl: 'Ilang araw', en: 'Turnaround days' },
  'services.minKg': { tl: 'Minimum na kilo', en: 'Minimum kilos' },
  'services.active': { tl: 'Aktibo', en: 'Active' },
  'services.save': { tl: 'I-save ang serbisyo', en: 'Save service' },
  'services.saved': { tl: 'Na-save ang serbisyo.', en: 'Service saved.' },
  'services.priceNote': {
    tl: 'Hindi magbabago ang mga lumang order — naka-snapshot ang presyo nila.',
    en: 'Past orders will not change — their price is snapshotted.',
  },
  'services.perKg': { tl: '/kg', en: '/kg' },
  'services.days': { tl: 'araw', en: 'days' },

  // ── Payments ───────────────────────────────────────────────────
  'payments.title': { tl: 'Bayad', en: 'Payments' },
  'payments.collectedToday': { tl: 'Nakolekta ngayon', en: 'Collected today' },
  'payments.collectedMonth': { tl: 'Ngayong buwan', en: 'This month' },
  'payments.outstanding': { tl: 'Hindi pa bayad', en: 'Outstanding' },
  'payments.unpaidCount': { tl: 'Orders na may balanse', en: 'Orders with balance' },
  'payments.tabUnpaid': { tl: 'Hindi pa bayad', en: 'Unpaid' },
  'payments.tabAll': { tl: 'Lahat', en: 'All' },
  'payments.record': { tl: 'Tanggapin ang bayad', en: 'Take payment' },
  'payments.recorded': { tl: 'Natanggap ang bayad na {amount}.', en: 'Payment of {amount} received.' },
  'payments.amount': { tl: 'Halaga', en: 'Amount' },
  'payments.method': { tl: 'Paraan', en: 'Method' },
  'payments.reference': { tl: 'Reference (para sa GCash/Maya)', en: 'Reference (for GCash/Maya)' },
  'payments.method.cash': { tl: 'Cash', en: 'Cash' },
  'payments.method.gcash': { tl: 'GCash', en: 'GCash' },
  'payments.method.maya': { tl: 'Maya', en: 'Maya' },
  'payments.method.bank': { tl: 'Bank', en: 'Bank' },
  'payments.method.other': { tl: 'Iba pa', en: 'Other' },
  'payments.overpay': {
    tl: 'Sobra ito sa balanse na {balance}. Ituloy pa rin?',
    en: 'This exceeds the balance of {balance}. Continue anyway?',
  },
  'payments.reverse': { tl: 'I-reverse ang bayad', en: 'Reverse payment' },
  'payments.reverseReason': { tl: 'Dahilan ng pag-reverse', en: 'Reversal reason' },
  'payments.reversed': { tl: 'Na-reverse ang bayad.', en: 'Payment reversed.' },
  'payments.reversedBadge': { tl: 'REVERSED', en: 'REVERSED' },
  'payments.aging': { tl: 'Tagal ng balanse', en: 'Aging' },
  'payments.aging.0-7': { tl: '0–7 araw', en: '0–7 days' },
  'payments.aging.8-30': { tl: '8–30 araw', en: '8–30 days' },
  'payments.aging.31+': { tl: '31+ araw', en: '31+ days' },
  'payments.empty': { tl: 'Walang bayad na naitala.', en: 'No payments recorded.' },
  'payments.allPaid': { tl: 'Lahat bayad na. 🎉', en: 'Everything is paid. 🎉' },

  // ── Inventory ──────────────────────────────────────────────────
  'inventory.title': { tl: 'Inventory', en: 'Inventory' },
  'inventory.add': { tl: 'Bagong item', en: 'New item' },
  'inventory.stockIn': { tl: 'Pasok', en: 'Stock in' },
  'inventory.stockOut': { tl: 'Labas', en: 'Stock out' },
  'inventory.recount': { tl: 'Bilang', en: 'Recount' },
  'inventory.qty': { tl: 'Dami', en: 'Quantity' },
  'inventory.countedQty': { tl: 'Nabilang na dami', en: 'Counted quantity' },
  'inventory.unitCost': { tl: 'Halaga kada unit', en: 'Cost per unit' },
  'inventory.supplier': { tl: 'Supplier', en: 'Supplier' },
  'inventory.reason': { tl: 'Dahilan', en: 'Reason' },
  'inventory.reorderPoint': { tl: 'Reorder point', en: 'Reorder point' },
  'inventory.history': { tl: 'Kasaysayan', en: 'History' },
  'inventory.lowStock': { tl: 'Paubos na', en: 'Low' },
  'inventory.saved': { tl: 'Naitala.', en: 'Recorded.' },
  'inventory.name': { tl: 'Pangalan', en: 'Name' },
  'inventory.unit': { tl: 'Unit', en: 'Unit' },
  'inventory.usageReport': { tl: 'Gamit at gastos', en: 'Usage & cost' },
  'inventory.expected': { tl: 'Inaasahang gamit', en: 'Expected use' },
  'inventory.actual': { tl: 'Aktwal', en: 'Actual' },
  'inventory.varianceFlag': { tl: 'Suriin — malayo sa inaasahan', en: 'Check — far from expected' },
  'inventory.expectedNote': {
    tl: 'Hindi kailanman binabawasan ng app ang stock nang kusa. Ikaw lang ang nagbabago ng bilang.',
    en: 'The app never deducts stock on its own. Only you change the count.',
  },
  'inventory.rules': { tl: 'Expected use kada serbisyo', en: 'Expected use per service' },
  'inventory.qtyPerKg': { tl: 'Dami kada kilo', en: 'Qty per kg' },
  'inventory.empty': { tl: 'Wala pang item. Idagdag ang mga supplies mo.', en: 'No items yet. Add your supplies.' },

  // ── Reports ────────────────────────────────────────────────────
  'reports.title': { tl: 'Reports', en: 'Reports' },
  'reports.income': { tl: 'Kita', en: 'Income' },
  'reports.daily': { tl: 'Araw-araw', en: 'Daily' },
  'reports.weekly': { tl: 'Lingguhan', en: 'Weekly' },
  'reports.monthly': { tl: 'Buwanan', en: 'Monthly' },
  'reports.byService': { tl: 'Kita kada serbisyo', en: 'Income by service' },
  'reports.kilosByService': { tl: 'Kilo kada serbisyo', en: 'Kilos by service' },
  'reports.topCustomers': { tl: 'Top na suki', en: 'Top customers' },
  'reports.withBalance': { tl: 'May balanse', en: 'With balance' },
  'reports.staff': { tl: 'Galaw ng staff', en: 'Staff activity' },
  'reports.staffOrders': { tl: 'Orders na ginawa', en: 'Orders created' },
  'reports.staffStatus': { tl: 'Status changes', en: 'Status changes' },
  'reports.staffPayments': { tl: 'Bayad na naitala', en: 'Payments recorded' },
  'reports.preset.today': { tl: 'Ngayon', en: 'Today' },
  'reports.preset.week': { tl: 'Linggong ito', en: 'This week' },
  'reports.preset.month': { tl: 'Buwang ito', en: 'This month' },
  'reports.preset.custom': { tl: 'Custom', en: 'Custom' },
  'reports.exportCsv': { tl: 'I-export ang CSV', en: 'Export CSV' },
  'reports.empty': { tl: 'Walang data sa napiling petsa.', en: 'No data for the chosen dates.' },

  // ── Users & Access ─────────────────────────────────────────────
  'users.title': { tl: 'Users at Access', en: 'Users & Access' },
  'users.add': { tl: 'Bagong user', en: 'New user' },
  'users.name': { tl: 'Pangalan', en: 'Name' },
  'users.role': { tl: 'Tungkulin', en: 'Role' },
  'users.role.owner': { tl: 'Owner', en: 'Owner' },
  'users.role.staff': { tl: 'Staff', en: 'Staff' },
  'users.pin': { tl: 'PIN (4–6 digits)', en: 'PIN (4–6 digits)' },
  'users.pinConfirm': { tl: 'Ulitin ang PIN', en: 'Repeat PIN' },
  'users.pinMismatch': { tl: 'Hindi magkapareho ang PIN.', en: 'PINs do not match.' },
  'users.save': { tl: 'I-save ang user', en: 'Save user' },
  'users.saved': { tl: 'Na-save ang user.', en: 'User saved.' },
  'users.deactivate': { tl: 'I-deactivate', en: 'Deactivate' },
  'users.activate': { tl: 'I-activate', en: 'Activate' },
  'users.changePin': { tl: 'Palitan ang PIN', en: 'Change PIN' },
  'users.audit': { tl: 'Audit log', en: 'Audit log' },
  'users.recoveryTitle': { tl: 'Recovery code mo', en: 'Your recovery code' },
  'users.recoveryBody': {
    tl: 'Isulat ito sa printed na quick guide. Isang beses lang ito ipapakita. Ito ang susi kapag nakalimutan mo ang PIN.',
    en: 'Write this on the printed quick guide. It is shown only once. It unlocks the app if you forget your PIN.',
  },
  'users.recoveryDone': { tl: 'Naisulat ko na', en: 'I have written it down' },

  // ── Lock screen ────────────────────────────────────────────────
  'lock.title': { tl: 'Ilagay ang PIN', en: 'Enter PIN' },
  'lock.who': { tl: 'Sino ka?', en: 'Who are you?' },
  'lock.wrong': { tl: 'Maling PIN.', en: 'Wrong PIN.' },
  'lock.cooldown': {
    tl: '5 maling subok. Maghintay ng {s} segundo.',
    en: '5 wrong attempts. Wait {s} seconds.',
  },
  'lock.forgot': { tl: 'Nakalimutan ang PIN?', en: 'Forgot PIN?' },
  'lock.recovery': { tl: 'Ilagay ang recovery code', en: 'Enter recovery code' },
  'lock.recoveryWrong': { tl: 'Maling recovery code.', en: 'Wrong recovery code.' },
  'lock.newPin': { tl: 'Bagong PIN', en: 'New PIN' },
  'lock.locked': { tl: 'Naka-lock', en: 'Locked' },

  // ── Backup & Data screen ───────────────────────────────────────
  'backupData.title': { tl: 'Backup at Data', en: 'Backup & Data' },
  'backupData.backupNow': { tl: 'Mag-backup ngayon', en: 'Back up now' },
  'backupData.download': { tl: 'I-download ang backup', en: 'Download backup' },
  'backupData.share': { tl: 'I-share ang backup', en: 'Share backup' },
  'backupData.pickFolder': { tl: 'Pumili ng backup folder', en: 'Choose backup folder' },
  'backupData.folderSet': { tl: 'Nakatakda ang folder. Araw-araw nang magse-save dito.', en: 'Folder set. Daily backups will be saved here.' },
  'backupData.restore': { tl: 'I-restore mula sa file', en: 'Restore from file' },
  'backupData.snapshots': { tl: 'Mga snapshot sa phone', en: 'On-device snapshots' },
  'backupData.rollback': { tl: 'Ibalik ang data noong {date}', en: 'Roll back to {date}' },
  'backupData.handover': { tl: 'Ilipat sa bagong phone', en: 'Move to a new phone' },
  'backupData.lastBackup': { tl: 'Huling backup', en: 'Last backup' },
  'backupData.never': { tl: 'Wala pa', en: 'Never' },
  'backupData.restorePreview': {
    tl: 'Ito ay {orders} orders mula {from} hanggang {to}. Ang nasa phone ngayon: {current} orders.',
    en: 'This has {orders} orders from {from} to {to}. Currently on this phone: {current} orders.',
  },
  'backupData.replaceAll': { tl: 'Palitan lahat', en: 'Replace everything' },
  'backupData.merge': { tl: 'I-merge', en: 'Merge' },
  'backupData.typeToConfirm': { tl: 'I-type ang {word} para tumuloy', en: 'Type {word} to continue' },
  'backupData.restored': { tl: 'Na-restore ang data.', en: 'Data restored.' },
  'backupData.invalidFile': {
    tl: 'Hindi ito backup file ng app na ito, o sira ang file. Walang binago sa data mo.',
    en: 'This is not a backup file for this app, or the file is damaged. Your data was not changed.',
  },
  'backupData.newerSchema': {
    tl: 'Galing ang backup na ito sa mas bagong bersyon ng app. I-update muna ang app bago mag-restore.',
    en: 'This backup is from a newer version of the app. Update the app first, then restore.',
  },
  'backupData.checksumFail': {
    tl: 'Sira ang backup file (hindi tugma ang checksum). Walang binago sa data mo.',
    en: 'The backup file is corrupted (checksum mismatch). Your data was not changed.',
  },
  'backupData.preRestoreNote': {
    tl: 'Kumuha muna kami ng snapshot bago mag-restore, para maibalik kung mali.',
    en: 'A snapshot was taken before restoring, so a wrong restore can be undone.',
  },
  'backupData.handoverSteps': {
    tl: '1. Buksan ang app URL sa bagong phone\n2. I-install sa home screen\n3. I-tap ang Restore from file at piliin ang backup\n4. Siguraduhing tugma ang bilang ng orders: {count}\n5. I-lock ang app sa lumang phone',
    en: '1. Open the app URL on the new phone\n2. Install to home screen\n3. Tap Restore from file and choose the backup\n4. Check the order count matches: {count}\n5. Lock the app on the old phone',
  },
  'backupData.storageUsed': { tl: 'Storage na gamit', en: 'Storage used' },
  'backupData.storageWarning': {
    tl: 'Malapit nang mapuno ang storage. Mag-download ng backup, tapos i-clear ang ibang app.',
    en: 'Storage is nearly full. Download a backup, then clear other apps.',
  },

  // ── Shop Settings ──────────────────────────────────────────────
  'settings.title': { tl: 'Shop Settings', en: 'Shop Settings' },
  'settings.shopName': { tl: 'Pangalan ng shop', en: 'Shop name' },
  'settings.ownerName': { tl: 'Pangalan ng may-ari', en: 'Owner name' },
  'settings.address': { tl: 'Address', en: 'Address' },
  'settings.contact': { tl: 'Contact', en: 'Contact' },
  'settings.logo': { tl: 'Logo', en: 'Logo' },
  'settings.language': { tl: 'Wika', en: 'Language' },
  'settings.receiptFooter': { tl: 'Mensahe sa resibo', en: 'Receipt footer' },
  'settings.orderPrefix': { tl: 'Order code prefix', en: 'Order code prefix' },
  'settings.messageTemplate': { tl: 'Template ng "handa na" message', en: '"Ready" message template' },
  'settings.save': { tl: 'I-save ang settings', en: 'Save settings' },
  'settings.saved': { tl: 'Na-save ang settings.', en: 'Settings saved.' },
  'settings.dangerZone': { tl: 'Delikadong bahagi', en: 'Danger zone' },
  'settings.resetAll': { tl: 'Burahin lahat ng data', en: 'Reset all data' },
  'settings.resetWarning': {
    tl: 'Buburahin nito ang LAHAT ng records. Magba-backup muna kami bago ito ituloy.',
    en: 'This deletes ALL records. A backup will be taken first before continuing.',
  },
  'settings.resetDone': { tl: 'Nabura ang lahat ng data.', en: 'All data has been reset.' },

  // ── Setup wizard ───────────────────────────────────────────────
  'wizard.title': { tl: 'Simulan ang totoong shop', en: 'Start your real shop' },
  'wizard.step1.title': { tl: 'Burahin ang demo data', en: 'Clear demo data' },
  'wizard.step1.body': {
    tl: 'Buburahin ang lahat ng demo records para makapagsimula ka nang malinis. I-type ang SIMULAN para tumuloy.',
    en: 'All demo records will be deleted so you start clean. Type SIMULAN to continue.',
  },
  'wizard.step2.title': { tl: 'Tungkol sa shop mo', en: 'About your shop' },
  'wizard.step3.title': { tl: 'Services at presyo', en: 'Services & prices' },
  'wizard.step3.body': {
    tl: 'Naka-handa na ang karaniwang mga serbisyo. Baguhin ang presyo, magtanggal, o magdagdag.',
    en: 'Common services are pre-filled. Edit prices, remove, or add.',
  },
  'wizard.step4.title': { tl: 'Owner PIN', en: 'Owner PIN' },
  'wizard.step5.title': { tl: 'I-install sa home screen', en: 'Install to home screen' },
  'wizard.step5.ios': {
    tl: 'Sa Safari: i-tap ang Share button (parisukat na may arrow), tapos "Add to Home Screen". Mahalaga ito — mas ligtas ang data kapag naka-install.',
    en: 'In Safari: tap the Share button (square with arrow), then "Add to Home Screen". This matters — installed apps keep data safer.',
  },
  'wizard.step5.android': {
    tl: 'Sa Chrome: i-tap ang ⋮ menu, tapos "Add to Home screen" o "Install app".',
    en: 'In Chrome: tap the ⋮ menu, then "Add to Home screen" or "Install app".',
  },
  'wizard.step5.confirm': { tl: 'Na-install ko na sa home screen', en: 'I have installed it to the home screen' },
  'wizard.step6.title': { tl: 'Saan itatago ang backup?', en: 'Where will backups go?' },
  'wizard.step6.folder': {
    tl: 'Pumili ng folder na naka-sync sa Google Drive o OneDrive. Araw-araw kaming magse-save doon nang kusa.',
    en: 'Pick a folder synced by Google Drive or OneDrive. A backup is saved there automatically every day.',
  },
  'wizard.step6.share': {
    tl: 'Sa phone na ito, ang backup ay ibabahagi gamit ang share sheet. Pumili ng isang lalagyan — halimbawa iCloud Drive o sarili mong Messenger chat — at doon palagi mag-save.',
    en: 'On this phone, backups go through the share sheet. Choose one destination — e.g. iCloud Drive or your own Messenger chat — and always save there.',
  },
  'wizard.step6.destName': { tl: 'Saan mo ise-save? (hal. iCloud Drive › Laundry Backup)', en: 'Where will you save it? (e.g. iCloud Drive › Laundry Backup)' },
  'wizard.step7.title': { tl: 'Unang backup', en: 'First backup' },
  'wizard.step7.body': {
    tl: 'Tatakbo ngayon ang unang backup. Hindi matatapos ang setup hangga\'t hindi ito successful.',
    en: 'The first backup runs now. Setup will not finish until it succeeds.',
  },
  'wizard.next': { tl: 'Susunod', en: 'Next' },
  'wizard.back': { tl: 'Bumalik', en: 'Back' },
  'wizard.finish': { tl: 'Tapusin ang setup', en: 'Finish setup' },
  'wizard.done': { tl: 'Handa na ang shop mo. Magandang negosyo!', en: 'Your shop is ready. Good business!' },
  'wizard.screenLock': {
    tl: 'Paalala: buksan ang screen lock ng phone (PIN o fingerprint). Iyon ang tunay na proteksyon ng data mo.',
    en: 'Reminder: turn on your phone screen lock (PIN or fingerprint). That is the real protection for your data.',
  },

  // ── Receipt / stub ─────────────────────────────────────────────
  'stub.print': { tl: 'I-print', en: 'Print' },
  'stub.shareImage': { tl: 'I-share bilang larawan', en: 'Share as image' },
  'stub.copyText': { tl: 'Kopyahin bilang text', en: 'Copy as text' },
  'stub.copied': { tl: 'Nakopya na.', en: 'Copied.' },
  'stub.orderCode': { tl: 'Order', en: 'Order' },
  'stub.footerDefault': { tl: 'Salamat po! Dalhin ang stub kapag kukunin.', en: 'Thank you! Bring this stub at pickup.' },

  // ── Ready message ──────────────────────────────────────────────
  'message.readyTemplate': {
    tl: 'Hi {name}! Handa na ang labada mo ({code}). Kabuuan: {total}. Balanse: {balance}. Salamat! — {shop}',
    en: 'Hi {name}! Your laundry ({code}) is ready. Total: {total}. Balance: {balance}. Thank you! — {shop}',
  },
  'message.send': { tl: 'I-send ang message', en: 'Send message' },

  // ── Help ───────────────────────────────────────────────────────
  'help.title': { tl: 'Help / Quick Guide', en: 'Help / Quick Guide' },

  // ── Common ─────────────────────────────────────────────────────
  'common.cancel': { tl: 'Kanselahin', en: 'Cancel' },
  'common.confirm': { tl: 'Ituloy', en: 'Continue' },
  'common.close': { tl: 'Isara', en: 'Close' },
  'common.save': { tl: 'I-save', en: 'Save' },
  'common.delete': { tl: 'Tanggalin', en: 'Remove' },
  'common.add': { tl: 'Idagdag', en: 'Add' },
  'common.done': { tl: 'Tapos', en: 'Done' },
  'common.today': { tl: 'Ngayon', en: 'Today' },
  'common.yesterday': { tl: 'Kahapon', en: 'Yesterday' },
  'common.required': { tl: 'Kailangan ito.', en: 'This is required.' },
  'common.logout': { tl: 'I-lock ang app', en: 'Lock the app' },
  'common.back': { tl: 'Bumalik', en: 'Back' },
  'common.error.save': {
    tl: 'Hindi na-save. Puno ang storage ng phone. Mag-download ng backup, tapos i-clear ang ibang app.',
    en: 'Could not save. Phone storage is full. Download a backup, then clear other apps.',
  },
  'common.crash.title': { tl: 'May nasira sa app', en: 'Something broke' },
  'common.crash.body': {
    tl: 'Ligtas ang data mo. I-download ang backup para sigurado, tapos i-refresh ang app.',
    en: 'Your data is safe. Download a backup to be sure, then refresh the app.',
  },
  'common.crash.download': { tl: 'I-download ang backup', en: 'Download backup' },
  'common.crash.reload': { tl: 'I-refresh ang app', en: 'Refresh the app' },
  'common.ownerOnly': { tl: 'Para sa Owner lang ito.', en: 'Owner only.' },
} satisfies Record<string, Entry>

export type StringKey = keyof typeof strings

import { clientConfig } from '../config/client.config'

let currentLocale: Locale = clientConfig.defaultLocale

export function setLocale(locale: Locale) {
  currentLocale = locale
}

export function getLocale(): Locale {
  return currentLocale
}

/** Translate a key, substituting {placeholders} from params. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  const entry = strings[key]
  let text: string = entry ? entry[currentLocale] : key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.split(`{${k}}`).join(String(v))
    }
  }
  return text
}
