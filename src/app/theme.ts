/**
 * Theme selection. See spec.md § Theming and design tokens.
 *
 * The theme is a per-install preference, not a record — it is the one
 * setting that legitimately lives in localStorage rather than IndexedDB,
 * because the blocking script in index.html has to read it synchronously
 * before first paint and IndexedDB cannot answer in time. It is deliberately
 * outside the backup: a device's colour scheme is not the shop's data.
 *
 * Components never ask which theme is active. They read tokens, and the
 * tokens change under them.
 */
import { useSyncExternalStore } from 'react'

export const THEMES = ['coldwash', 'bubblegum'] as const
export type ThemeName = (typeof THEMES)[number]

export const DEFAULT_THEME: ThemeName = 'coldwash'
const STORAGE_KEY = 'theme'

function isTheme(value: string | null): value is ThemeName {
  return value !== null && (THEMES as readonly string[]).includes(value)
}

export function readTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/** Keeps the browser chrome in step with the page it frames. */
function syncBrowserChrome(): void {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (!bg) return
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = bg
}

const listeners = new Set<() => void>()

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // A locked-down browser can refuse storage; the theme still applies for
    // this session rather than failing the tap.
  }
  syncBrowserChrome()
  for (const l of listeners) l()
}

/** Re-assert on boot: the inline script set the attribute, this squares the meta tag. */
export function initTheme(): void {
  const theme = readTheme()
  if (document.documentElement.dataset.theme !== theme) {
    document.documentElement.dataset.theme = theme
  }
  syncBrowserChrome()
}

export function useTheme(): ThemeName {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    readTheme,
    () => DEFAULT_THEME,
  )
}
