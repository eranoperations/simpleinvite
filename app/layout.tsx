import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AISCentry — map a website, then test it in plain English',
  description:
    'Crawl any site into a visual map of its pages and the links and buttons connecting them, ' +
    'then write test scenarios in plain English and watch them execute.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
