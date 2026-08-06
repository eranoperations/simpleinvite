import type { IFinding } from '@/models/Scan'
import type { CrawledPage, CrawlResult } from './crawler'

/**
 * Deterministic checks derived from response headers, cookies and DOM facts.
 * These run without the model so a report always contains verifiable findings
 * even if the AI pass degrades or the provider is down.
 */

interface HeaderRule {
  header: string
  title: string
  severity: IFinding['severity']
  description: string
  recommendation: string
  /** Optional extra validation when the header is present. */
  validate?: (value: string) => string | null
}

const HEADER_RULES: HeaderRule[] = [
  {
    header: 'content-security-policy',
    title: 'No Content-Security-Policy header',
    severity: 'high',
    description:
      'Without a CSP the browser will execute any script that ends up in the page, so a single injection flaw becomes full script execution in your users’ sessions.',
    recommendation:
      "Start in report-only mode (`Content-Security-Policy-Report-Only`) with a policy like `default-src 'self'`, review the violation reports, then enforce it.",
    validate: (v) =>
      v.includes("'unsafe-inline'") || v.includes("'unsafe-eval'")
        ? "The policy allows 'unsafe-inline' or 'unsafe-eval', which removes most of the protection a CSP provides. Move to nonces or hashes for inline scripts."
        : null,
  },
  {
    header: 'strict-transport-security',
    title: 'No HSTS header',
    severity: 'medium',
    description:
      'Browsers will still try plain HTTP for this host, which leaves the first request of a session open to interception and downgrade.',
    recommendation:
      'Send `Strict-Transport-Security: max-age=31536000; includeSubDomains` on HTTPS responses once you are confident every subdomain serves TLS.',
    validate: (v) => {
      const m = v.match(/max-age=(\d+)/i)
      if (!m || Number(m[1]) < 15_552_000) {
        return 'max-age is below the recommended six months (15552000 seconds).'
      }
      return null
    },
  },
  {
    header: 'x-content-type-options',
    title: 'No X-Content-Type-Options header',
    severity: 'low',
    description:
      'Without `nosniff`, browsers may guess a response’s type and execute an upload or text file as script.',
    recommendation: 'Add `X-Content-Type-Options: nosniff` to all responses.',
  },
  {
    header: 'referrer-policy',
    title: 'No Referrer-Policy header',
    severity: 'low',
    description:
      'Full URLs — including anything sensitive in the path or query string — leak to third-party sites in the Referer header.',
    recommendation: 'Add `Referrer-Policy: strict-origin-when-cross-origin`.',
  },
]

function frameProtection(headers: Record<string, string>): boolean {
  const csp = headers['content-security-policy'] ?? ''
  return Boolean(headers['x-frame-options']) || csp.includes('frame-ancestors')
}

export function runHeaderProbes(pages: CrawledPage[]): IFinding[] {
  const findings: IFinding[] = []
  const loaded = pages.filter((p) => p.statusCode > 0 && p.statusCode < 400)
  if (!loaded.length) return findings

  const entry = loaded[0]
  const headers = normalize(entry.headers)

  for (const rule of HEADER_RULES) {
    const missingOn = loaded.filter((p) => !normalize(p.headers)[rule.header])
    if (missingOn.length) {
      findings.push({
        category: 'security',
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        evidence: `Missing on ${missingOn.length} of ${loaded.length} pages checked, including ${missingOn[0].url}`,
        recommendation: rule.recommendation,
        affectedUrls: missingOn.slice(0, 5).map((p) => p.url),
        source: 'scanner',
      })
    } else if (rule.validate) {
      const problem = rule.validate(headers[rule.header])
      if (problem) {
        findings.push({
          category: 'security',
          severity: rule.severity === 'high' ? 'medium' : 'low',
          title: `Weak ${rule.header} configuration`,
          description: problem,
          evidence: `${rule.header}: ${headers[rule.header].slice(0, 200)}`,
          recommendation: rule.recommendation,
          affectedUrls: [entry.url],
          source: 'scanner',
        })
      }
    }
  }

  const unprotected = loaded.filter((p) => !frameProtection(normalize(p.headers)))
  if (unprotected.length) {
    findings.push({
      category: 'security',
      severity: 'medium',
      title: 'Pages can be framed by other sites',
      description:
        'Neither X-Frame-Options nor a CSP `frame-ancestors` directive is set, so an attacker can load these pages in an invisible iframe and trick users into clicking controls they cannot see (clickjacking).',
      evidence: `${unprotected.length} of ${loaded.length} pages lack frame protection.`,
      recommendation:
        "Add `Content-Security-Policy: frame-ancestors 'self'` (and `X-Frame-Options: SAMEORIGIN` for older browsers).",
      affectedUrls: unprotected.slice(0, 5).map((p) => p.url),
      source: 'scanner',
    })
  }

  // Version banners hand attackers a shortcut to known CVEs.
  const disclosing = loaded.filter((p) => {
    const h = normalize(p.headers)
    return /\d/.test(h['server'] ?? '') || Boolean(h['x-powered-by'])
  })
  if (disclosing.length) {
    const h = normalize(disclosing[0].headers)
    findings.push({
      category: 'security',
      severity: 'low',
      title: 'Server software and version disclosed in headers',
      description:
        'Response headers advertise the exact stack and version, which lets an attacker look up known vulnerabilities for it without probing.',
      evidence: [h['server'] && `server: ${h['server']}`, h['x-powered-by'] && `x-powered-by: ${h['x-powered-by']}`]
        .filter(Boolean)
        .join(' | '),
      recommendation: 'Strip or genericize `Server` and remove `X-Powered-By` at the proxy or framework level.',
      affectedUrls: disclosing.slice(0, 3).map((p) => p.url),
      source: 'scanner',
    })
  }

  return findings
}

export function runCookieProbes(cookies: CrawlResult['cookies'], isHttps: boolean): IFinding[] {
  const findings: IFinding[] = []
  if (!cookies.length) return findings

  const insecure = cookies.filter((c) => !c.secure)
  if (insecure.length && isHttps) {
    findings.push({
      category: 'security',
      severity: 'medium',
      title: 'Cookies set without the Secure flag',
      description:
        'These cookies will be sent over plain HTTP if a user is ever downgraded to an insecure connection, exposing them to network interception.',
      evidence: `Affected cookies: ${insecure.map((c) => c.name).slice(0, 8).join(', ')}`,
      recommendation: 'Set the `Secure` attribute on every cookie issued over HTTPS.',
      affectedUrls: [],
      source: 'scanner',
    })
  }

  // HttpOnly only matters for cookies a browser-side script has no business reading.
  const sessionish = cookies.filter((c) => /sess|auth|token|login|sid|jwt/i.test(c.name))
  const readable = sessionish.filter((c) => !c.httpOnly)
  if (readable.length) {
    findings.push({
      category: 'security',
      severity: 'high',
      title: 'Session cookies readable by JavaScript',
      description:
        'Cookies that look like session or auth tokens are missing the HttpOnly flag, so any cross-site scripting flaw on the site can read them and hijack a logged-in session.',
      evidence: `Affected cookies: ${readable.map((c) => c.name).join(', ')}`,
      recommendation: 'Add `HttpOnly` to all session and authentication cookies.',
      affectedUrls: [],
      source: 'scanner',
    })
  }

  const noSameSite = cookies.filter((c) => !c.sameSite || c.sameSite === 'None')
  if (noSameSite.length) {
    findings.push({
      category: 'security',
      severity: 'low',
      title: 'Cookies without a restrictive SameSite policy',
      description:
        'Cookies default to being sent on cross-site requests, which is the precondition for cross-site request forgery.',
      evidence: `Affected cookies: ${noSameSite.map((c) => c.name).slice(0, 8).join(', ')}`,
      recommendation: 'Set `SameSite=Lax` (or `Strict` for sensitive actions) unless a cookie is deliberately cross-site.',
      affectedUrls: [],
      source: 'scanner',
    })
  }

  return findings
}

const SENSITIVE_PATHS = [
  '/.env',
  '/.git/HEAD',
  '/.git/config',
  '/config.json',
  '/.DS_Store',
  '/backup.sql',
  '/dump.sql',
  '/.aws/credentials',
  '/wp-config.php.bak',
  '/phpinfo.php',
  '/server-status',
  '/.svn/entries',
  '/composer.lock',
  '/docker-compose.yml',
  '/.npmrc',
]

/**
 * GET-only requests for files that should never be publicly readable. No
 * payloads, no fuzzing, no writes — this is a "did you leave the door open"
 * check against a site the user has asserted they own.
 */
export async function runExposureProbes(origin: string): Promise<IFinding[]> {
  const exposed: { path: string; hint: string }[] = []

  await Promise.all(
    SENSITIVE_PATHS.map(async (path) => {
      try {
        const res = await fetch(new URL(path, origin).toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(8000),
          headers: { 'user-agent': 'SiteSentry/1.0 (+website audit bot)' },
        })
        if (res.status !== 200) return

        const body = (await res.text()).slice(0, 2000)
        const type = res.headers.get('content-type') ?? ''

        // Catch-all SPA routes return 200 with HTML for everything.
        if (type.includes('text/html') && !path.endsWith('.php')) return
        if (!body.trim()) return

        exposed.push({ path, hint: body.slice(0, 120).replace(/\s+/g, ' ') })
      } catch {
        // Unreachable path is the expected, healthy case.
      }
    }),
  )

  if (!exposed.length) return []

  return [
    {
      category: 'security',
      severity: 'critical',
      title: 'Sensitive files are publicly readable',
      description:
        'Files that normally hold credentials, source history, or infrastructure detail responded with content to an anonymous request. Anyone on the internet can fetch them.',
      evidence: exposed.map((e) => `${e.path} → ${e.hint}`).join('\n').slice(0, 800),
      recommendation:
        'Block these paths at the web server or CDN immediately, then rotate every credential that appeared in them — assume they are already compromised.',
      affectedUrls: exposed.map((e) => new URL(e.path, origin).toString()),
      source: 'scanner',
    },
  ]
}

export async function runTransportProbes(origin: string): Promise<IFinding[]> {
  const findings: IFinding[] = []
  const url = new URL(origin)

  if (url.protocol === 'http:') {
    findings.push({
      category: 'security',
      severity: 'critical',
      title: 'Site is served over plain HTTP',
      description:
        'All traffic, including anything typed into a form, travels unencrypted and can be read or modified by anyone on the network path.',
      recommendation:
        'Obtain a TLS certificate (Let’s Encrypt is free), serve everything over HTTPS, and permanently redirect HTTP to HTTPS.',
      affectedUrls: [origin],
      source: 'scanner',
    })
    return findings
  }

  // An HTTPS site should not leave its HTTP door open without a redirect.
  try {
    const httpUrl = new URL(origin)
    httpUrl.protocol = 'http:'
    const res = await fetch(httpUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'SiteSentry/1.0 (+website audit bot)' },
    })

    const location = res.headers.get('location') ?? ''
    const redirectsToHttps = res.status >= 300 && res.status < 400 && location.startsWith('https://')

    if (!redirectsToHttps && res.status < 400) {
      findings.push({
        category: 'security',
        severity: 'high',
        title: 'HTTP does not redirect to HTTPS',
        description:
          `Requesting the site over plain HTTP returned ${res.status} instead of redirecting to HTTPS, so users who type the bare domain can end up on an unencrypted version of the site.`,
        recommendation: 'Return a 301 redirect from all HTTP URLs to their HTTPS equivalent.',
        affectedUrls: [httpUrl.toString()],
        source: 'scanner',
      })
    }
  } catch {
    // Connection refused on port 80 is a perfectly good answer.
  }

  return findings
}

function normalize(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) out[k.toLowerCase()] = v
  return out
}
