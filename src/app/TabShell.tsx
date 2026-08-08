/**
 * Navigation shell — bottom tab bar on phones (<768px), left nav rail on
 * tablet/desktop. 48px targets, safe-area aware.
 */
import { NavLink, Outlet } from 'react-router-dom'
import { t } from '../i18n/strings'

const tabs = [
  { to: '/today', key: 'tab.today', icon: '☀️' },
  { to: '/orders', key: 'tab.orders', icon: '🧺' },
  { to: '/customers', key: 'tab.customers', icon: '👥' },
  { to: '/payments', key: 'tab.payments', icon: '💵' },
  { to: '/more', key: 'tab.more', icon: '☰' },
] as const

function TabItem({ to, label, icon, rail }: { to: string; label: string; icon: string; rail?: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-touch items-center justify-center gap-1 rounded-input font-medium ${
          rail ? 'w-full flex-row justify-start gap-3 px-4 py-3' : 'flex-1 flex-col py-1.5 text-xs'
        } ${isActive ? 'text-primary-600' : 'text-ink-muted'}`
      }
    >
      <span aria-hidden className={rail ? 'text-md' : 'text-base leading-none'}>
        {icon}
      </span>
      <span>{label}</span>
    </NavLink>
  )
}

export function TabShell() {
  return (
    <div className="flex min-h-dvh w-full">
      {/* Left rail — tablet and desktop */}
      <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface p-3 pt-safe md:flex">
        <div className="px-4 py-4 font-display text-md font-bold text-primary-800">Laundry Shop OS</div>
        {tabs.map((tab) => (
          <TabItem key={tab.to} to={tab.to} label={t(tab.key)} icon={tab.icon} rail />
        ))}
      </nav>

      {/* Content, capped at 1200px on desktop */}
      <main className="mx-auto w-full max-w-[1200px] flex-1 pb-20 md:pb-4">
        <Outlet />
      </main>

      {/* Bottom tab bar — phones */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-safe md:hidden">
        {tabs.map((tab) => (
          <TabItem key={tab.to} to={tab.to} label={t(tab.key)} icon={tab.icon} />
        ))}
      </nav>
    </div>
  )
}
