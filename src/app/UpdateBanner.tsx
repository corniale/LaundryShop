/**
 * "A new version is ready."
 *
 * An installed PWA is opened, used and left; it is rarely closed the way a
 * browser tab is. A silently-updating service worker therefore sits waiting
 * for a relaunch that might be days away, and the shop has no way of knowing
 * it is running an old build — which is exactly the state that makes a
 * support call unanswerable. So the update is announced and taken on a tap.
 *
 * Taking it reloads the app, which means the lock screen comes back; the
 * banner says so rather than surprising someone mid-shift. Dismissing hides
 * it for this run — the update stays waiting and the offer returns next time.
 */
import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { t } from '../i18n/strings'
import { Button } from '../components/ui'

/** How often to ask the server whether a newer build exists. */
const CHECK_EVERY_MS = 60 * 60 * 1000

export function UpdateBanner() {
  const [dismissed, setDismissed] = useState(false)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Register as soon as this mounts. The default waits for window 'load',
    // which has usually already fired by the time React gets here — and a
    // listener added after the event never runs, so nothing would register.
    immediate: true,
    onRegisteredSW(_url, registration) {
      // Without this an app left open for a week never looks for a new build:
      // the browser only checks on navigation, and there is no navigation.
      if (registration) setInterval(() => void registration.update(), CHECK_EVERY_MS)
    },
  })

  if (!needRefresh || dismissed) return null

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-primary-soft px-4 py-2.5 text-primary-deep">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{t('update.ready')}</div>
        <div className="text-xs opacity-80">{t('update.willReopen')}</div>
      </div>
      <Button className="!py-2 text-sm" onClick={() => void updateServiceWorker(true)}>
        {t('update.action')}
      </Button>
      <button
        aria-label={t('update.later')}
        className="min-h-touch min-w-touch text-primary-deep"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  )
}
