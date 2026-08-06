import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'SiteSentry — AI website validation',
  description:
    'Point SiteSentry at a website and it crawls every page, clicks every button, and returns a prioritized report on security, UX, bugs, accessibility, performance and SEO.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-ink-200 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
