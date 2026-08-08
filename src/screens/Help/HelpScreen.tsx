/** Help / Quick Guide — the printed handover sheet, in-app. Plain Taglish. */
import { t, getLocale } from '../../i18n/strings'
import { Card } from '../../components/ui'

const CONTENT = {
  tl: [
    {
      title: 'Ang araw-araw na gawain',
      body: `1. Buksan ang app, ilagay ang PIN mo.
2. Bagong customer? I-tap ang + Bagong Order sa Orders.
3. Timbangin ang labada, ilagay ang kilo — kusa nang magcocompute ang presyo.
4. Habang umuusad ang labada, i-tap ang susunod na stage sa wash line ng order.
5. Kapag Handa na, i-tap ang Message para sabihan ang customer.
6. Pagdating ng customer, tanggapin ang bayad at i-mark na Kuha na.
7. Bago umuwi: I-tap ang Isara ang araw sa Ngayon, tapos i-tap ang backup.`,
    },
    {
      title: 'Paano mag-backup',
      body: `Ang backup ay isang file na naglalaman ng LAHAT ng records mo. Kapag nawala ang phone, ang backup lang ang makakapagbalik ng data.

• Araw-araw, i-tap ang backup chip sa taas ng Ngayon screen.
• Kung naka-set ang backup folder (Android/Chrome), kusa itong nagse-save araw-araw.
• Sa iPhone: i-share ang file sa iCloud Drive o sa sarili mong Messenger chat — palaging PAREHONG lalagyan.
• May naka-tagong kopya rin sa loob ng app (huling 7 araw) — makikita sa Backup at Data.`,
    },
    {
      title: 'Paano mag-restore',
      body: `Iba pa → Backup at Data → I-restore mula sa file. Piliin ang backup file, suriin ang preview (ilang orders, anong petsa), tapos i-type ang RESTORE. Laging may snapshot bago mag-restore, kaya pwedeng ibalik kung nagkamali.`,
    },
    {
      title: 'Paglipat sa bagong phone',
      body: `1. Sa lumang phone: Iba pa → Backup at Data → Ilipat sa bagong phone. Ise-save nito ang backup file.
2. Sa bagong phone: buksan ang app URL, i-install sa home screen.
3. I-restore mula sa file.
4. Siguraduhing tugma ang bilang ng orders.
5. I-lock o burahin ang app sa lumang phone.`,
    },
    {
      title: 'Ano ang ginagawa (at HINDI ginagawa) ng PIN',
      body: `Ang PIN ay panlaban sa usiserong customer o dumadaan lang — hindi ito encryption at hindi nito mapoprotektahan ang ninakaw na phone. Ang tunay na proteksyon ay ang screen lock ng phone mo (PIN, fingerprint, o face) — siguraduhing naka-on ito.

Ang backup file ay may pangalan at number ng mga customer mo. Itago ito sa pribadong folder, hindi sa shared na lalagyan. Ikaw bilang may-ari ng shop ang may pananagutan sa data ng customer sa ilalim ng Data Privacy Act.

Nakalimutan ang Owner PIN? Gamitin ang recovery code na isinulat mo noong setup, o mag-reinstall at mag-restore mula sa backup.`,
    },
  ],
  en: [
    {
      title: 'The daily routine',
      body: `1. Open the app, enter your PIN.
2. New customer? Tap + New Order in Orders.
3. Weigh the laundry, enter kilos — the price computes automatically.
4. As the load progresses, tap the next stage on the order's wash line.
5. When Ready, tap Message to notify the customer.
6. On pickup, take payment and mark Claimed.
7. Before going home: tap Close the day on Today, then run the backup.`,
    },
    {
      title: 'How to back up',
      body: `A backup is one file containing ALL your records. If the phone is lost, only a backup can bring the data back.

• Every day, tap the backup chip at the top of the Today screen.
• If a backup folder is set (Android/Chrome), it saves silently every day.
• On iPhone: share the file to iCloud Drive or your own Messenger chat — always the SAME destination.
• The app also keeps hidden copies inside itself (last 7 days) — see Backup & Data.`,
    },
    {
      title: 'How to restore',
      body: `More → Backup & Data → Restore from file. Pick the backup file, check the preview (order count, dates), then type RESTORE. A snapshot is always taken first, so a wrong restore can be undone.`,
    },
    {
      title: 'Moving to a new phone',
      body: `1. Old phone: More → Backup & Data → Move to a new phone. This saves the backup file.
2. New phone: open the app URL, install to home screen.
3. Restore from file.
4. Check the order count matches.
5. Lock or wipe the app on the old phone.`,
    },
    {
      title: 'What the PIN does (and does NOT do)',
      body: `The PIN keeps a curious customer or walk-in out of the till figures — it is not encryption and does not protect a stolen phone. The real protection is your phone's screen lock (PIN, fingerprint, or face) — make sure it is on.

Backup files contain your customers' names and numbers. Keep them in a private folder, not a shared one. As the shop owner collecting the data, Data Privacy Act obligations sit with you.

Forgot the Owner PIN? Use the recovery code you wrote down during setup, or reinstall and restore from a backup.`,
    },
  ],
}

export function HelpScreen() {
  const sections = CONTENT[getLocale()]
  return (
    <div className="flex flex-col gap-3 p-4">
      <h1 className="font-display text-lg font-bold">{t('help.title')}</h1>
      {sections.map((s, i) => (
        <Card key={i}>
          <h2 className="mb-2 font-display text-base font-semibold">{s.title}</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{s.body}</p>
        </Card>
      ))}
    </div>
  )
}
