import fs from 'node:fs'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

export const DESKTOP_VIEWPORT = { width: 1280, height: 800 }

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 AISCentry/1.0 (+site mapper)'

const LAUNCH_ARGS = ['--no-sandbox', '--disable-dev-shm-usage']

/**
 * Prebuilt images commonly ship one Chromium build while the installed
 * Playwright expects another, and the mismatch only surfaces at launch. Rather
 * than fail, look through PLAYWRIGHT_BROWSERS_PATH for a Chromium that is
 * actually on disk. Set CHROMIUM_EXECUTABLE_PATH to skip the search entirely.
 */
function findInstalledChromium(): string | null {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (!root || !fs.existsSync(root)) return null

  const candidates = fs
    .readdirSync(root)
    .filter((entry) => entry.startsWith('chromium'))
    // Highest build number first — it is the closest to what Playwright wants.
    .sort((a, b) => (Number(b.split('-')[1]) || 0) - (Number(a.split('-')[1]) || 0))
    .flatMap((entry) => [
      path.join(root, entry, 'chrome-linux', 'chrome'),
      path.join(root, entry, 'chrome-linux', 'headless_shell'),
      path.join(root, entry, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
    ])

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

export async function launchBrowser(): Promise<Browser> {
  const configured = process.env.CHROMIUM_EXECUTABLE_PATH
  if (configured) {
    return chromium.launch({ headless: true, executablePath: configured, args: LAUNCH_ARGS })
  }

  try {
    return await chromium.launch({ headless: true, args: LAUNCH_ARGS })
  } catch (err) {
    const fallback = findInstalledChromium()
    if (!fallback) throw err
    console.warn(`[browser] bundled Chromium unavailable, using ${fallback}`)
    return chromium.launch({ headless: true, executablePath: fallback, args: LAUNCH_ARGS })
  }
}

export async function newContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: DESKTOP_VIEWPORT,
    userAgent: USER_AGENT,
    serviceWorkers: 'block',
  })
  context.setDefaultTimeout(15_000)
  context.setDefaultNavigationTimeout(30_000)
  return context
}

/**
 * Playwright evaluates a string argument as an expression, so an arrow-function
 * source returns the function itself (which serializes to undefined) instead of
 * calling it. Wrapping it as an IIFE is what actually runs the body.
 */
export function evalInPage<T>(page: Page, source: string): Promise<T> {
  return page.evaluate(`(${source})()`) as Promise<T>
}
