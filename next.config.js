/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright must not be bundled by Next's server compiler — it needs to
  // resolve its own browser binaries at runtime.
  serverExternalPackages: ['playwright', 'mongoose', 'bcryptjs'],
}

module.exports = nextConfig
