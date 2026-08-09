import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { seedDemoData } from '../seed/demoData'
import { updateAppMeta } from '../data/repository'
import { runDailyMaintenance } from '../backup/scheduler'
import { setLocale } from '../i18n/strings'
import { AuthProvider, useAuth } from './AuthContext'
import { ToastProvider } from '../components/Toast'
import { ErrorBoundary } from './ErrorBoundary'
import { TabShell } from './TabShell'
import { LockScreen } from './LockScreen'
import { TodayScreen } from '../screens/Today/TodayScreen'
import { OrdersScreen } from '../screens/Orders/OrdersScreen'
import { OrderDetailScreen } from '../screens/Orders/OrderDetailScreen'
import { CustomersScreen } from '../screens/Customers/CustomersScreen'
import { PaymentsScreen } from '../screens/Payments/PaymentsScreen'
import { MoreScreen } from '../screens/More/MoreScreen'
import { ReportsScreen } from '../screens/Reports/ReportsScreen'
import { ServicesScreen } from '../screens/Services/ServicesScreen'
import { InventoryScreen } from '../screens/Inventory/InventoryScreen'
import { UsersScreen } from '../screens/Users/UsersScreen'
import { BackupScreen } from '../screens/Backup/BackupScreen'
import { SettingsScreen } from '../screens/Settings/SettingsScreen'
import { HelpScreen } from '../screens/Help/HelpScreen'
import { SetupWizard } from '../screens/Wizard/SetupWizard'
import { t } from '../i18n/strings'

function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { isOwner } = useAuth()
  if (!isOwner) {
    return (
      <div className="p-6 text-center text-ink-muted">
        <p>{t('common.ownerOnly')}</p>
      </div>
    )
  }
  return <>{children}</>
}

function Shell() {
  const { locked } = useAuth()
  if (locked) return <LockScreen />
  return (
    <Routes>
      <Route path="/wizard" element={<SetupWizard />} />
      <Route element={<TabShell />}>
        <Route path="/today" element={<TodayScreen />} />
        <Route path="/orders" element={<OrdersScreen />} />
        <Route path="/orders/:id" element={<OrderDetailScreen />} />
        <Route path="/customers" element={<CustomersScreen />} />
        <Route path="/customers/:id" element={<CustomersScreen />} />
        <Route path="/payments" element={<PaymentsScreen />} />
        <Route path="/more" element={<MoreScreen />} />
        <Route path="/more/reports" element={<OwnerOnly><ReportsScreen /></OwnerOnly>} />
        <Route path="/more/services" element={<OwnerOnly><ServicesScreen /></OwnerOnly>} />
        <Route path="/more/inventory" element={<InventoryScreen />} />
        <Route path="/more/users" element={<OwnerOnly><UsersScreen /></OwnerOnly>} />
        <Route path="/more/backup" element={<BackupScreen />} />
        <Route path="/more/settings" element={<OwnerOnly><SettingsScreen /></OwnerOnly>} />
        <Route path="/more/help" element={<HelpScreen />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const meta = await db.appMeta.get('app')
      if (!meta) {
        await seedDemoData()
      }
      // storage persistence — record result; Today shows a strip when false
      try {
        if (navigator.storage?.persist) {
          const persisted = await navigator.storage.persist()
          await updateAppMeta({ storagePersisted: persisted })
        }
      } catch {
        // unsupported browsers keep storagePersisted: false
      }
      await runDailyMaintenance()
      if (!cancelled) setBooted(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const shop = useLiveQuery(() => db.shop.toArray(), [])
  useEffect(() => {
    if (shop?.[0]) setLocale(shop[0].locale)
  }, [shop])

  if (!booted) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-wash">
        <div className="font-display text-md font-semibold text-primary-deep">…</div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <Shell />
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
