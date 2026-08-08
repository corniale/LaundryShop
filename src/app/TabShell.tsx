/**
 * Navigation shell — bottom tab bar on phones (<768px), left nav rail on
 * tablet/desktop.
 *
 * Design notes (signifiers over decoration):
 * - Rail items are left-anchored; the active item gets a filled pill —
 *   a visible state, not just a color change.
 * - Bottom-bar active state is a pill behind the icon, so the signal
 *   survives bright sunlight and color-vision differences.
 * - Everything transitions in 150ms; 48px targets throughout.
 */
import { NavLink, Outlet } from 'react-router-dom'
import { t } from '../i18n/strings'
import { Icon, type IconName } from '../components/Icons'

const tabs = [
  { to: '/today', key: 'tab.today', icon: 'today' },
  { to: '/orders', key: 'tab.orders', icon: 'orders' },
  { to: '/customers', key: 'tab.customers', icon: 'customers' },
  { to: '/payments', key: 'tab.payments', icon: 'payments' },
  { to: '/more', key: 'tab.more', icon: 'more' },
] as const

function RailItem({ to, label, icon }: { to: string; label: string; icon: IconName }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-touch w-full items-center gap-3 rounded-input px-4 py-3 font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-primary-100 font-semibold text-primary-800'
            : 'text-ink-muted hover:bg-wash hover:text-ink'
        }`
      }
    >
      <Icon name={icon} size={22} className="shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

function BarItem({ to, label, icon }: { to: string; label: string; icon: IconName }) {
  return (
    <NavLink
      to={to}
      className="flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium"
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex h-8 w-16 items-center justify-center rounded-pill transition-colors duration-150 ${
              isActive ? 'bg-primary-100 text-primary-800' : 'text-ink-muted'
            }`}
          >
            <Icon name={icon} size={22} />
          </span>
          <span className={isActive ? 'font-semibold text-primary-800' : 'text-ink-muted'}>{label}</span>
        </>
      )}
    </NavLink>
  )
}

export function TabShell() {
  return (
    <div className="flex min-h-dvh w-full">
      {/* Left rail — tablet and desktop */}
      <nav className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface p-3 pt-safe md:flex">
        <div className="mb-2 flex items-center gap-2.5 px-4 py-4">
          <Icon name="orders" size={26} className="shrink-0 text-primary-500" />
          <div className="font-display text-md font-semibold leading-tight text-ink">
            Laundry
            <br />
            Shop OS
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {tabs.map((tab) => (
            <RailItem key={tab.to} to={tab.to} label={t(tab.key)} icon={tab.icon} />
          ))}
        </div>
      </nav>

      {/* Content, capped at 1200px on desktop */}
      <main className="mx-auto w-full max-w-[1200px] flex-1 pb-20 md:pb-4">
        <Outlet />
      </main>

      {/* Bottom tab bar — phones */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-safe md:hidden">
        {tabs.map((tab) => (
          <BarItem key={tab.to} to={tab.to} label={t(tab.key)} icon={tab.icon} />
        ))}
      </nav>
    </div>
  )
}
