/** Iba pa — the owner's weekly/monthly tools, one level down. */
import { useNavigate } from 'react-router-dom'
import { t } from '../../i18n/strings'
import { useAuth } from '../../app/AuthContext'
import { Button } from '../../components/ui'
import { Icon, type IconName } from '../../components/Icons'

export function MoreScreen() {
  const navigate = useNavigate()
  const { isOwner, lock, currentUser } = useAuth()

  const items: ReadonlyArray<{ to: string; key: Parameters<typeof t>[0]; icon: IconName; ownerOnly: boolean }> = [
    { to: '/more/reports', key: 'more.reports', icon: 'reports', ownerOnly: true },
    { to: '/more/services', key: 'more.services', icon: 'services', ownerOnly: true },
    { to: '/more/inventory', key: 'more.inventory', icon: 'inventory', ownerOnly: false },
    { to: '/more/users', key: 'more.users', icon: 'users', ownerOnly: true },
    { to: '/more/backup', key: 'more.backup', icon: 'backup', ownerOnly: false },
    { to: '/more/settings', key: 'more.settings', icon: 'settings', ownerOnly: true },
    { to: '/more/help', key: 'more.help', icon: 'help', ownerOnly: false },
  ]

  return (
    <div className="flex flex-col gap-2 p-4">
      <h1 className="mb-1 font-display text-lg font-bold">{t('tab.more')}</h1>
      {items
        .filter((i) => !i.ownerOnly || isOwner)
        .map((item) => (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className="flex min-h-touch items-center gap-3 rounded-card bg-surface px-4 py-3.5 text-left font-medium shadow-card"
          >
            <Icon name={item.icon} size={22} className="shrink-0 text-primary-600" />
            {t(item.key)}
            <span className="ml-auto text-ink-muted">›</span>
          </button>
        ))}
      <div className="mt-4 border-t border-line pt-4">
        <div className="mb-2 text-sm text-ink-muted">{currentUser?.name} · {currentUser?.role}</div>
        <Button variant="secondary" onClick={lock} className="w-full">
          {t('common.logout')}
        </Button>
      </div>
    </div>
  )
}
