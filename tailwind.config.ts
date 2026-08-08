import type { Config } from 'tailwindcss'

/**
 * All color values live in src/styles/tokens.css as CSS custom properties.
 * Components reference them through these Tailwind aliases only —
 * no raw hex values may appear in any component.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        'ink-muted': 'var(--ink-muted)',
        line: 'var(--line)',
        surface: 'var(--surface)',
        wash: 'var(--wash)',
        'wash-deep': 'var(--wash-deep)',
        primary: {
          100: 'var(--primary-100)',
          300: 'var(--primary-300)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          800: 'var(--primary-800)',
        },
        accent: {
          400: 'var(--accent-400)',
          500: 'var(--accent-500)',
          700: 'var(--accent-700)',
        },
        sun: {
          500: 'var(--sun-500)',
          700: 'var(--sun-700)',
        },
        danger: {
          500: 'var(--danger-500)',
          700: 'var(--danger-700)',
        },
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
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
        card: '14px',
        input: '10px',
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
