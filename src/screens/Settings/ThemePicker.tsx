/**
 * Settings → Itsura. The only place a theme is chosen (spec.md § Theming 7):
 * no picker, no hex field, no per-element override — the shop takes one of
 * the themes that were contrast-checked by hand, or leaves it alone.
 *
 * Each card is a live sample order row rendered inside a `data-theme`
 * scope, so it is drawn with that theme's real tokens rather than a
 * screenshot that can drift away from the app.
 */
import { IconCheck } from '@tabler/icons-react'
import { t } from '../../i18n/strings'
import { THEMES, applyTheme, useTheme, type ThemeName } from '../../app/theme'

/** A stripped-down order row: ground, card, hairline, type, pill, primary. */
function Sample() {
  return (
    <div className="rounded-card bg-wash p-3">
      <div className="rounded-card border border-line bg-surface px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-sm font-medium text-ink">ORD-1042</span>
          <span className="font-mono text-sm font-medium text-ink">₱310.00</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs text-ink-muted">Maria Santos · 4.2 kg</span>
          <span className="rounded-pill bg-attention-soft px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-attention-deep">
            {t('pay.unpaid')}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-pill bg-primary px-3 py-1 text-xs font-semibold text-on-primary">
            {t('status.washing')}
          </span>
          <span className="rounded-pill bg-positive-soft px-3 py-1 text-xs font-semibold text-positive-deep">
            {t('pay.paid')}
          </span>
        </div>
      </div>
    </div>
  )
}

export function ThemePicker() {
  const active = useTheme()
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {THEMES.map((name: ThemeName) => {
        const selected = active === name
        return (
          <button
            key={name}
            onClick={() => applyTheme(name)}
            aria-pressed={selected}
            className={`rounded-card border bg-surface p-2 text-left transition-colors duration-150 ${
              selected ? 'border-primary' : 'border-line'
            }`}
          >
            <div className="flex items-center justify-between gap-2 px-1 pb-2">
              <span className="font-display text-base font-semibold">
                {t(`settings.theme.${name}` as 'settings.theme.coldwash')}
              </span>
              {selected && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-deep">
                  <IconCheck size={16} stroke={2.5} aria-hidden />
                  {t('settings.themeSelected')}
                </span>
              )}
            </div>
            {/* The sample renders in its own theme scope, whichever is active */}
            <div data-theme={name}>
              <Sample />
            </div>
          </button>
        )
      })}
    </div>
  )
}
