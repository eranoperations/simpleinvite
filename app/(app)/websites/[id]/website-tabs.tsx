'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function WebsiteTabs({ websiteId }: { websiteId: string }) {
  const pathname = usePathname()
  const base = `/websites/${websiteId}`

  const tabs = [
    { href: base, label: 'Map' },
    { href: `${base}/scenarios`, label: 'Scenarios' },
    { href: `${base}/test-users`, label: 'Test users' },
    { href: `${base}/settings`, label: 'Settings' },
  ]

  return (
    <nav className="mt-6 flex gap-1 border-b border-slate-800">
      {tabs.map((tab) => {
        // The Map tab's href equals `base` itself, so it must match exactly —
        // otherwise it would stay "active" on every nested tab too.
        const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              active
                ? 'border-sky-500 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
