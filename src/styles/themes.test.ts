// @vitest-environment node
/**
 * spec.md § Theming, rule 1 — enforced by the build rather than by memory.
 * If a literal colour appears anywhere but themes.css (and the one declared
 * brand-asset exception), this fails.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')

const ALLOWED = new Set([
  'src/styles/themes.css',
  // §5: the launcher icon is drawn by the OS, where no CSS variable reaches.
  'public/icons/icon.svg',
  // This file quotes the patterns it hunts for.
  'src/styles/themes.test.ts',
])

const SCANNED = ['.ts', '.tsx', '.css', '.html', '.svg']

/** #abc, #aabbcc, #aabbccdd */
const HEX = /#[0-9a-fA-F]{3,8}\b/g
/** rgb(…), rgba(…), hsl(…), hsla(…) with numeric channels */
const FUNC = /\b(?:rgba?|hsla?)\(\s*[\d.]/g
const NAMED =
  /\b(?:color|background|background-color|border-color|fill|stroke|outline-color)\s*[:=]\s*['"]?(?:white|black|red|green|blue|grey|gray|orange|pink|yellow|purple)\b/gi

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git' || name === 'fonts') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (SCANNED.some((e) => name.endsWith(e))) out.push(full)
  }
  return out
}

describe('one file holds every literal colour', () => {
  const files = [...walk(join(ROOT, 'src')), join(ROOT, 'index.html'), ...walk(join(ROOT, 'public'))]

  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it('finds no literal colour outside themes.css', () => {
    const offenders: string[] = []
    for (const file of files) {
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      if (ALLOWED.has(rel)) continue
      const text = readFileSync(file, 'utf8')
      for (const re of [HEX, FUNC, NAMED]) {
        const hits = text.match(re)
        if (hits) offenders.push(`${rel}: ${[...new Set(hits)].join(', ')}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('every theme defines every token in the contract', () => {
    const css = readFileSync(join(ROOT, 'src/styles/themes.css'), 'utf8')
    const contract = [
      '--bg',
      '--surface',
      '--line',
      '--text',
      '--text-muted',
      '--text-disabled',
      '--primary',
      '--primary-deep',
      '--primary-soft',
      '--on-primary',
      '--positive',
      '--positive-deep',
      '--positive-soft',
      '--attention',
      '--attention-deep',
      '--attention-soft',
    ]
    // Each theme block, keyed by its selector.
    const blocks = [...css.matchAll(/\[data-theme='([a-z-]+)'\][^{]*\{([^}]*)\}/g)]
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    for (const [, name, body] of blocks) {
      const missing = contract.filter((token) => !new RegExp(`${token}\\s*:`).test(body))
      expect({ theme: name, missing }).toEqual({ theme: name, missing: [] })
    }
  })
})
