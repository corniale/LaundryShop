/**
 * Line icons in the poster style: thick rounded strokes in currentColor
 * with a soft duotone fill, so active/inactive nav states tint them.
 */
import type { SVGProps } from 'react'

export type IconName =
  | 'today'
  | 'orders'
  | 'customers'
  | 'payments'
  | 'more'
  | 'reports'
  | 'services'
  | 'inventory'
  | 'users'
  | 'backup'
  | 'settings'
  | 'help'

const paths: Record<IconName, React.ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.18" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2 17 7M7 17l-1.8 1.8" />
    </>
  ),
  orders: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M4 8h16" />
      <circle cx="7.5" cy="5.5" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="5.5" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="5.5" r="1.1" />
      <circle cx="12" cy="14.5" r="4" fill="currentColor" fillOpacity="0.18" />
      <path d="M9.6 14.5c.8-.7 1.6.7 2.4 0s1.6.7 2.4 0" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3.2" fill="currentColor" fillOpacity="0.18" />
      <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="16.8" cy="9" r="2.4" />
      <path d="M16.6 14.7c2.2.4 3.6 1.9 4 4.3" />
    </>
  ),
  payments: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.18" />
      <path d="M6 9.5v.01M18 14.5v.01" />
    </>
  ),
  more: <path d="M4 7h16M4 12h16M4 17h16" />,
  reports: (
    <>
      <path d="M3 20.5h18" />
      <path d="M6 20.5v-6M12 20.5v-11M18 20.5v-15" />
    </>
  ),
  services: (
    <>
      <path d="M10 3h4M12 3v2.5M9 5.5h6" />
      <rect x="7.5" y="8" width="9" height="13" rx="2.5" fill="currentColor" fillOpacity="0.18" />
      <path d="M9.5 13h5" />
    </>
  ),
  inventory: (
    <>
      <path d="M3.5 8 12 3.5 20.5 8v9L12 21.5 3.5 17V8Z" fill="currentColor" fillOpacity="0.12" />
      <path d="M3.5 8 12 12.5 20.5 8M12 12.5v9" />
    </>
  ),
  users: (
    <>
      <circle cx="8" cy="12" r="4" fill="currentColor" fillOpacity="0.18" />
      <path d="M12 12h9.5M18 12v3M21.5 12v2.2" />
    </>
  ),
  backup: (
    <>
      <path d="M12 3.5V13M8.5 9.8l3.5 3.7 3.5-3.7" />
      <path d="M4 15v3a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18v-3" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7.5h16M4 12h16M4 16.5h16" />
      <circle cx="9" cy="7.5" r="1.9" fill="currentColor" fillOpacity="0.18" />
      <circle cx="15" cy="12" r="1.9" fill="currentColor" fillOpacity="0.18" />
      <circle cx="7" cy="16.5" r="1.9" fill="currentColor" fillOpacity="0.18" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.1" />
      <path d="M9.6 9.7a2.5 2.5 0 1 1 3.3 2.4c-.7.3-.9.8-.9 1.6" />
      <circle cx="12" cy="16.8" r="0.4" fill="currentColor" stroke="none" />
    </>
  ),
}

export function Icon({
  name,
  size = 24,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
