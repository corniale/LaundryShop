/**
 * Platform facts the app has to act on, kept pure and testable rather than
 * sprinkled through components as inline userAgent sniffing.
 *
 * The one that matters here: on iOS every browser is required to use
 * WebKit, so a non-Safari iOS browser has none of the extra capability its
 * desktop namesake has — and only Safari's Add to Home Screen produces the
 * standalone install that keeps IndexedDB from being evicted. An offline
 * app whose whole dataset is IndexedDB has to say so.
 */
export interface PlatformFacts {
  userAgent: string
  /** iPadOS 13+ reports itself as a Mac; touch points give it away. */
  platform: string
  maxTouchPoints: number
  standalone: boolean
}

export function readPlatform(): PlatformFacts {
  const nav = navigator as Navigator & { standalone?: boolean }
  return {
    userAgent: nav.userAgent,
    platform: nav.platform ?? '',
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone:
      nav.standalone === true ||
      (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches),
  }
}

export function isIOS(f: PlatformFacts): boolean {
  if (/iPad|iPhone|iPod/.test(f.userAgent)) return true
  return f.platform === 'MacIntel' && f.maxTouchPoints > 1
}

/** Chrome, Firefox, Edge, Opera and the Google app, all WebKit underneath. */
export function isNonSafariIOSBrowser(f: PlatformFacts): boolean {
  return isIOS(f) && /CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(f.userAgent)
}

/**
 * Should we tell them to move to Safari? Only when they are on iOS, in
 * another browser, and not already running from the home screen — there is
 * no point nagging someone who has already installed it.
 */
export function needsSafariInstall(f: PlatformFacts): boolean {
  return isNonSafariIOSBrowser(f) && !f.standalone
}
