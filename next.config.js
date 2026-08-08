/** @type {import('next').NextConfig} */
const nextConfig = {
  // Both resolve binary assets at runtime — Playwright its browser bundles,
  // better-sqlite3 its native .node addon. Bundling either one breaks them.
  serverExternalPackages: ['playwright', 'better-sqlite3'],
}

module.exports = nextConfig
