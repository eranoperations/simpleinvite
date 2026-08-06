import dns from 'node:dns/promises'
import net from 'node:net'

/**
 * The scanner fetches whatever URL a user types, from inside our network. That
 * is a textbook SSRF sink, so a target must resolve to a public address before
 * any request is made. Blocks loopback, RFC1918, link-local (including the
 * 169.254.169.254 cloud metadata endpoint), CGNAT, and IPv6 equivalents.
 */

export class TargetNotAllowedError extends Error {}

function ipv4IsPrivate(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true
  }
  const [a, b] = p
  if (a === 0) return true // "this" network
  if (a === 10) return true // RFC1918
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true // RFC1918
  if (a === 192 && b === 168) return true // RFC1918
  if (a === 192 && b === 0) return true // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast + reserved
  return false
}

function ipv6IsPrivate(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0]
  if (addr === '::1' || addr === '::') return true
  if (addr.startsWith('fe80')) return true // link-local
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true // unique local
  if (addr.startsWith('ff')) return true // multicast
  // IPv4-mapped (::ffff:10.0.0.1) inherits the IPv4 rules.
  const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return ipv4IsPrivate(mapped[1])
  return false
}

export function isPrivateAddress(ip: string): boolean {
  const version = net.isIP(ip)
  if (version === 4) return ipv4IsPrivate(ip)
  if (version === 6) return ipv6IsPrivate(ip)
  return true
}

export interface ValidatedTarget {
  url: string
  hostname: string
  addresses: string[]
}

/**
 * Normalizes and vets a user-supplied target. Set ALLOW_PRIVATE_SCAN_TARGETS=true
 * only for local development against your own machine.
 */
export async function validateTarget(input: string): Promise<ValidatedTarget> {
  const raw = input.trim()
  if (!raw) throw new TargetNotAllowedError('Enter a website URL.')

  // Only supply a scheme when the input genuinely lacks one. Prefixing
  // "ftp://host" would turn it into "https://ftp://host" and smuggle it past
  // the protocol check below as a host named "ftp".
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw)
  const withScheme = hasScheme ? raw : `https://${raw}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new TargetNotAllowedError(`"${input}" is not a valid URL.`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TargetNotAllowedError('Only http:// and https:// URLs can be scanned.')
  }

  if (url.username || url.password) {
    throw new TargetNotAllowedError('Remove credentials from the URL before scanning.')
  }

  // URL keeps IPv6 literals bracketed ("[::1]"); strip them so net.isIP sees a
  // real address instead of falling through to a DNS lookup.
  const hostname = url.hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[(.+)\]$/, '$1')
  if (!hostname) throw new TargetNotAllowedError('The URL is missing a hostname.')

  if (process.env.ALLOW_PRIVATE_SCAN_TARGETS === 'true') {
    return { url: url.toString(), hostname, addresses: [] }
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) {
    throw new TargetNotAllowedError('Internal hostnames cannot be scanned.')
  }

  // A bare IP literal needs no lookup — check it directly.
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new TargetNotAllowedError(
        'That address is on a private or reserved range and cannot be scanned.',
      )
    }
    return { url: url.toString(), hostname, addresses: [hostname] }
  }

  let records: { address: string }[]
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new TargetNotAllowedError(`Could not resolve "${hostname}". Check the address.`)
  }

  if (!records.length) {
    throw new TargetNotAllowedError(`"${hostname}" did not resolve to any address.`)
  }

  // Every resolved address must be public — one private answer is enough to
  // make the target unsafe (DNS rebinding, round-robin split horizons).
  const addresses = records.map((r) => r.address)
  const offending = addresses.find(isPrivateAddress)
  if (offending) {
    throw new TargetNotAllowedError(
      `"${hostname}" resolves to a private address (${offending}) and cannot be scanned.`,
    )
  }

  return { url: url.toString(), hostname, addresses }
}

/** Keeps a crawl on the origin it started from. */
export function isSameSite(target: string, origin: string): boolean {
  try {
    const a = new URL(target)
    const b = new URL(origin)
    if (a.protocol !== 'http:' && a.protocol !== 'https:') return false
    const strip = (h: string) => h.toLowerCase().replace(/^www\./, '')
    return strip(a.hostname) === strip(b.hostname)
  } catch {
    return false
  }
}

/** Drops the fragment and normalizes so the frontier doesn't revisit pages. */
export function canonicalize(raw: string): string {
  try {
    const url = new URL(raw)
    url.hash = ''
    // Tracking params create infinite distinct URLs for identical pages.
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|msclkid|ref|mc_cid|mc_eid)/i.test(key)) {
        url.searchParams.delete(key)
      }
    }
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }
    return url.toString()
  } catch {
    return raw
  }
}

const SKIP_EXTENSIONS =
  /\.(pdf|zip|tar|gz|rar|7z|dmg|exe|msi|pkg|mp4|webm|mov|avi|mp3|wav|ogg|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|css|js|json|xml|rss|csv|xlsx?|docx?|pptx?)$/i

/** Non-HTML endpoints waste crawl budget. */
export function isCrawlable(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (SKIP_EXTENSIONS.test(url.pathname)) return false
    if (/^(mailto|tel|javascript|data|blob):/i.test(raw)) return false
    // Logout links end the session mid-crawl.
    if (/\/(logout|sign-?out|signout)(\/|$|\?)/i.test(url.pathname)) return false
    return true
  } catch {
    return false
  }
}
