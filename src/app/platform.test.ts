// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isIOS, isNonSafariIOSBrowser, needsSafariInstall, type PlatformFacts } from './platform'

const facts = (over: Partial<PlatformFacts> = {}): PlatformFacts => ({
  userAgent: '',
  platform: '',
  maxTouchPoints: 0,
  standalone: false,
  ...over,
})

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1'
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
const DESKTOP_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

describe('isIOS', () => {
  it('recognises iPhones whatever browser is wrapping WebKit', () => {
    expect(isIOS(facts({ userAgent: IPHONE_SAFARI }))).toBe(true)
    expect(isIOS(facts({ userAgent: IPHONE_CHROME }))).toBe(true)
  })

  it('recognises an iPad that claims to be a Mac', () => {
    expect(isIOS(facts({ userAgent: DESKTOP_MAC, platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true)
  })

  it('leaves real desktops and Android alone', () => {
    expect(isIOS(facts({ userAgent: DESKTOP_MAC, platform: 'MacIntel', maxTouchPoints: 0 }))).toBe(false)
    expect(isIOS(facts({ userAgent: ANDROID_CHROME }))).toBe(false)
  })
})

describe('needsSafariInstall', () => {
  it('warns in Chrome and Firefox on iOS', () => {
    expect(needsSafariInstall(facts({ userAgent: IPHONE_CHROME }))).toBe(true)
    expect(needsSafariInstall(facts({ userAgent: IPHONE_FIREFOX }))).toBe(true)
  })

  it('stays quiet in Safari on iOS — the generic install strip covers that', () => {
    expect(isNonSafariIOSBrowser(facts({ userAgent: IPHONE_SAFARI }))).toBe(false)
    expect(needsSafariInstall(facts({ userAgent: IPHONE_SAFARI }))).toBe(false)
  })

  it('stays quiet once it is running from the home screen', () => {
    expect(needsSafariInstall(facts({ userAgent: IPHONE_CHROME, standalone: true }))).toBe(false)
  })

  it('never fires on Android, where Chrome is Chrome', () => {
    expect(needsSafariInstall(facts({ userAgent: ANDROID_CHROME }))).toBe(false)
  })
})
