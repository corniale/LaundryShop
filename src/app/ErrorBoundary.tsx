/**
 * Global error boundary — a crash must still let the owner rescue their
 * data. Plain-language screen + Download backup button.
 */
import { Component, type ReactNode } from 'react'
import { t } from '../i18n/strings'
import { emergencyDownload } from '../backup/destinations'

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-wash p-6 text-center">
        <h1 className="font-display text-xl font-bold text-ink">{t('common.crash.title')}</h1>
        <p className="max-w-sm text-ink-muted">{t('common.crash.body')}</p>
        <button
          className="min-h-touch rounded-input bg-primary-deep px-6 py-3 font-semibold text-surface"
          onClick={() => void emergencyDownload()}
        >
          {t('common.crash.download')}
        </button>
        <button
          className="min-h-touch rounded-input px-6 py-3 font-semibold text-primary-deep"
          onClick={() => window.location.reload()}
        >
          {t('common.crash.reload')}
        </button>
      </div>
    )
  }
}
