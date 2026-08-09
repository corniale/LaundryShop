/** Shared UI primitives. No raw hex anywhere — tokens only. */
import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, forwardRef } from 'react'

// ── Button ────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary font-semibold active:bg-primary-deep',
  secondary: 'border border-line bg-surface text-ink font-semibold active:bg-wash',
  // §4: the one approved filled accent — --attention-deep clears 6.5:1 with
  // white text. --on-primary is the contract's white; there is no --on-attention.
  danger: 'bg-attention-deep text-on-primary font-semibold active:brightness-95',
  ghost: 'bg-transparent text-primary-deep font-semibold active:bg-primary-soft',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`min-h-touch rounded-input px-4 py-2.5 text-base transition-colors duration-150 disabled:opacity-40 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  )
}

// ── Card ──────────────────────────────────────────────────────────

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-card border border-line bg-surface p-3.5 ${onClick ? 'cursor-pointer transition-colors duration-150 hover:border-ink-muted/40' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

// ── Chip ──────────────────────────────────────────────────────────

export function Chip({
  children,
  selected = false,
  onClick,
  className = '',
}: {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-touch rounded-pill px-4 py-2 text-sm font-medium whitespace-nowrap border transition-colors duration-150 ${
        selected
          ? 'border-ink bg-ink text-wash'
          : 'border-line bg-surface text-ink-muted hover:text-ink'
      } ${className}`}
    >
      {children}
    </button>
  )
}

// ── Field / Input ─────────────────────────────────────────────────

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label-caps mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`min-h-touch w-full rounded-input border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-muted ${className}`}
        {...props}
      />
    )
  },
)

/** Same shell as Input, so a dropdown does not look like a foreign control. */
export function Select({ className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`min-h-touch w-full rounded-input border border-line bg-surface px-3 py-2.5 text-base text-ink ${className}`}
      {...props}
    />
  )
}

export function TextArea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-input border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-muted ${className}`}
      rows={2}
      {...props}
    />
  )
}

// ── Sheet (bottom on phones, right-side ≥768px) ───────────────────

/**
 * Sheet — a centered floating dialog. The scrim dims and blurs the page
 * behind it so the form owns the viewport's attention.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 pb-safe md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-scrim backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-card border border-line bg-wash ${
          wide ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-wash px-4 py-3">
          <h2 className="font-display text-md font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-touch min-w-touch rounded-input text-ink-muted"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card bg-wash px-6 py-10 text-center text-ink-muted">{children}</div>
  )
}

// ── Stat figure (mono, large) ─────────────────────────────────────

export function Stat({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'attention' | 'positive'
  /** Present = the tile is a control and gets a chevron. */
  onClick?: () => void
}) {
  const toneClass =
    tone === 'attention' ? 'text-attention-deep' : tone === 'positive' ? 'text-positive-deep' : 'text-ink'
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="label-caps">{label}</span>
        {onClick && <span className="text-ink-muted" aria-hidden>›</span>}
      </div>
      <div className={`mt-0.5 font-mono text-lg font-medium ${toneClass}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-ink-muted">{hint}</div>}
    </>
  )
  if (!onClick) {
    return <div className="rounded-card border border-line bg-surface p-3">{body}</div>
  }
  return (
    <button
      onClick={onClick}
      className="rounded-card border border-line bg-surface p-3 text-left transition-colors duration-150 hover:border-ink-muted/40"
    >
      {body}
    </button>
  )
}

// ── Sticky bottom action bar ──────────────────────────────────────

export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 border-t border-line bg-wash px-4 py-3 pb-safe">
      {children}
    </div>
  )
}
