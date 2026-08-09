import type { Config } from 'tailwindcss'

/**
 * All colour values live in src/styles/themes.css as CSS custom properties.
 * Components reference them through these Tailwind aliases only — no literal
 * colour may appear in any component (spec.md § Theming, rule 1).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Thin aliases onto the token contract in src/styles/themes.css.
        // The neutral keys keep their editorial names; every semantic key
        // is named exactly as the contract names it.
        ink: 'var(--text)',
        'ink-muted': 'var(--text-muted)',
        'ink-disabled': 'var(--text-disabled)',
        line: 'var(--line)',
        surface: 'var(--surface)',
        wash: 'var(--bg)',
        primary: 'var(--primary)',
        'primary-deep': 'var(--primary-deep)',
        'primary-soft': 'var(--primary-soft)',
        'on-primary': 'var(--on-primary)',
        positive: 'var(--positive)',
        'positive-deep': 'var(--positive-deep)',
        'positive-soft': 'var(--positive-soft)',
        attention: 'var(--attention)',
        'attention-deep': 'var(--attention-deep)',
        'attention-soft': 'var(--attention-soft)',
        scrim: 'var(--scrim)',
        paper: 'var(--paper)',
        'paper-ink': 'var(--paper-ink)',
      },
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        body: ['"Public Sans"', 'system-ui', 'sans-serif'],
        // "Mono" is semantic here, not literal: money, codes, and kilos
        // set in the body face with tabular figures (see .font-mono).
        mono: ['"Public Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.45' }],
        sm: ['0.875rem', { lineHeight: '1.45' }],
        base: ['1rem', { lineHeight: '1.45' }],
        md: ['1.125rem', { lineHeight: '1.45' }],
        lg: ['1.375rem', { lineHeight: '1.15' }],
        xl: ['1.75rem', { lineHeight: '1.15' }],
        '2xl': ['2.5rem', { lineHeight: '1.15' }],
      },
      borderRadius: {
        card: '4px',
        input: '2px',
        pill: '999px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      spacing: {
        '4.5': '1.125rem',
      },
      minHeight: {
        touch: '48px',
      },
      minWidth: {
        touch: '48px',
      },
    },
  },
  plugins: [],
} satisfies Config
