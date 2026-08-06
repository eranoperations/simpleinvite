import { complete, parseJsonResponse } from './client'
import type { CrawlResult, CrawledPage } from '@/lib/scanner/crawler'
import type { ScanProfile } from '@/lib/scanner/profiles'
import { CATEGORIES, SEVERITIES, type Category, type IFinding, type Severity } from '@/models/Scan'

const SYSTEM_PROMPT = `You are a senior web auditor reviewing a website on behalf of its owner. You combine the perspectives of an application security engineer, a product designer, and a QA lead.

You will receive structured evidence collected by an automated crawler: page metadata, DOM facts, console output, failed network requests, form structure, and the results of clicking interactive elements.

Your job is to report what the evidence actually supports.

Rules:
- Ground every finding in the supplied evidence. Quote the specific console error, URL, header, or element that led to it.
- Do not invent problems to fill space. A clean site with three findings is a correct answer.
- Do not report a missing security header as a finding — deterministic scanners already cover those and they will be merged in separately. Focus on what requires judgement: broken flows, confusing interactions, dead controls, error-prone forms, information architecture, content problems, and security issues visible in behaviour rather than headers.
- Severity reflects real user or business impact, not how easy the fix is.
- Recommendations must be concrete and actionable. "Improve accessibility" is useless; "add a visible <label> to the email input on /signup, which currently relies on placeholder text alone" is useful.
- Write for a developer who has to fix it. Plain language, no filler, no marketing tone.

Reply with JSON only, matching this shape:
{
  "summary": "3-5 sentence plain-language assessment of the site's overall state",
  "score": 0-100 integer where 100 is flawless,
  "findings": [
    {
      "category": "security" | "ux" | "bug" | "accessibility" | "performance" | "seo",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "title": "short specific headline",
      "description": "what is wrong and why it matters",
      "evidence": "the specific observation from the data that supports this",
      "recommendation": "what to change",
      "affectedUrls": ["..."]
    }
  ]
}`

/** Compact page evidence so a large crawl still fits in a single request. */
function describePage(page: CrawledPage, verbose: boolean): string {
  const a = page.audit
  const lines: string[] = []

  lines.push(`URL: ${page.url}`)
  lines.push(`HTTP ${page.statusCode} · loaded in ${page.loadTimeMs}ms · crawl depth ${page.depth}`)
  if (page.redirectedTo) lines.push(`Redirected to: ${page.redirectedTo}`)
  if (page.loadError) lines.push(`PAGE FAILED TO LOAD: ${page.loadError}`)
  if (!a) return lines.join('\n')

  lines.push(`Title: ${a.title || '(none)'}`)
  if (!a.metaDescription) lines.push('Meta description: MISSING')
  if (!a.lang) lines.push('html lang attribute: MISSING')
  if (!a.viewportMeta) lines.push('Viewport meta tag: MISSING')
  lines.push(`Headings: h1×${a.h1Count}${a.headings.length ? ` · outline: ${a.headings.slice(0, 12).map((h) => `h${h.level}:${h.text.slice(0, 45)}`).join(' | ')}` : ''}`)
  lines.push(`Body: ${a.wordCount} words · ${a.links.length} links · ${a.images.total} images`)

  if (a.images.missingAlt) lines.push(`Images missing alt text: ${a.images.missingAlt}/${a.images.total}`)
  if (a.images.oversized.length) lines.push(`Images served far larger than displayed: ${a.images.oversized.length}`)
  if (a.inputsWithoutLabels) lines.push(`Form inputs with no accessible label: ${a.inputsWithoutLabels}`)
  if (a.duplicateIds.length) lines.push(`Duplicate DOM ids: ${a.duplicateIds.join(', ')}`)
  if (a.emptyLinks) lines.push(`Links with no text or image content: ${a.emptyLinks}`)
  if (a.smallTapTargets) lines.push(`Controls smaller than 24px (hard to tap): ${a.smallTapTargets}`)
  if (a.horizontalOverflow) lines.push(`Desktop horizontal overflow: document ${a.documentWidth}px vs viewport ${a.viewportWidth}px`)
  if (page.mobile?.horizontalOverflow) {
    lines.push(`MOBILE horizontal overflow at 390px: document is ${page.mobile.documentWidth}px wide (content is cut off or forces sideways scrolling)`)
  }
  if (a.mixedContent.length) lines.push(`Insecure http:// subresources on an https page: ${a.mixedContent.slice(0, 5).join(', ')}`)
  if (a.links.some((l) => l.unsafeRel)) {
    lines.push(`target="_blank" links without rel="noopener": ${a.links.filter((l) => l.unsafeRel).length}`)
  }
  if (a.thirdPartyScripts.length) lines.push(`Third-party script origins: ${a.thirdPartyScripts.join(', ')}`)
  if (a.detectedTech.length) lines.push(`Detected stack: ${a.detectedTech.join(', ')}`)

  for (const form of a.forms.slice(0, 6)) {
    const fields = form.inputs.map((i) => `${i.name || '(unnamed)'}:${i.type}${i.required ? '*' : ''}${i.labelled ? '' : ' [NO LABEL]'}`).join(', ')
    lines.push(
      `Form → ${form.method.toUpperCase()} ${form.action}${form.insecureAction ? ' [INSECURE http:// ACTION]' : ''}` +
        `${form.hasPasswordField ? ' [has password field]' : ''}` +
        `${form.hasPasswordField && !form.hasHiddenTokenField ? ' [no hidden CSRF-token-like field]' : ''}` +
        ` · fields: ${fields}`,
    )
  }

  if (page.consoleErrors.length) {
    lines.push(`Console errors (${page.consoleErrors.length}):`)
    for (const e of page.consoleErrors.slice(0, verbose ? 12 : 5)) lines.push(`  ! ${e}`)
  }
  if (page.pageErrors.length) {
    lines.push(`Uncaught exceptions:`)
    for (const e of page.pageErrors.slice(0, 6)) lines.push(`  !! ${e}`)
  }
  if (page.failedRequests.length) {
    lines.push(`Failed / error responses (${page.failedRequests.length}):`)
    for (const r of page.failedRequests.slice(0, verbose ? 12 : 6)) lines.push(`  x ${r}`)
  }

  if (page.interactions.length) {
    const broken = page.interactions.filter((i) => i.outcome === 'error' || i.outcome === 'no-effect' || i.consoleErrors.length)
    lines.push(`Interactive elements clicked: ${page.interactions.length} (${broken.length} suspicious)`)
    for (const i of broken.slice(0, verbose ? 15 : 8)) {
      lines.push(`  · "${i.label}" (${i.selector}) → ${i.outcome}${i.detail ? `: ${i.detail}` : ''}${i.consoleErrors.length ? ` · console: ${i.consoleErrors[0]}` : ''}`)
    }
  }

  if (verbose && a.textSample) {
    lines.push(`Visible text sample: ${a.textSample.slice(0, 1200)}`)
  } else if (a.textSample) {
    lines.push(`Visible text sample: ${a.textSample.slice(0, 400)}`)
  }

  return lines.join('\n')
}

export function buildEvidence(
  targetUrl: string,
  crawl: CrawlResult,
  profile: ScanProfile,
): string {
  // Deep scans get a richer per-page dump; shallow ones stay terse.
  const verbose = profile.id === 'deep'
  const parts: string[] = [
    `TARGET: ${targetUrl}`,
    `SCAN DEPTH: ${profile.label} (${profile.id})`,
    `PAGES CRAWLED: ${crawl.pages.length}`,
    `CRAWL DURATION: ${Math.round(crawl.durationMs / 1000)}s`,
    '',
    `COOKIES SET (${crawl.cookies.length}): ${
      crawl.cookies.length
        ? crawl.cookies
            .map((c) => `${c.name}[${[c.secure && 'Secure', c.httpOnly && 'HttpOnly', `SameSite=${c.sameSite}`].filter(Boolean).join(',')}]`)
            .join(' ')
        : 'none'
    }`,
    '',
    '=== PAGES ===',
  ]

  for (const page of crawl.pages) {
    parts.push('', `--- PAGE ${crawl.pages.indexOf(page) + 1} ---`, describePage(page, verbose))
  }

  const evidence = parts.join('\n')
  // Hard ceiling so a huge crawl cannot blow past the model's context window.
  const limit = verbose ? 220_000 : 90_000
  return evidence.length > limit
    ? `${evidence.slice(0, limit)}\n\n[evidence truncated at ${limit} characters]`
    : evidence
}

interface RawAnalysis {
  summary?: string
  score?: number
  findings?: Partial<IFinding>[]
}

function coerceFindings(raw: Partial<IFinding>[]): IFinding[] {
  const findings: IFinding[] = []

  for (const f of raw) {
    if (!f?.title || !f?.description) continue

    const category = (CATEGORIES as string[]).includes(String(f.category))
      ? (f.category as Category)
      : 'ux'
    const severity = (SEVERITIES as string[]).includes(String(f.severity))
      ? (f.severity as Severity)
      : 'medium'

    findings.push({
      category,
      severity,
      title: String(f.title).slice(0, 200),
      description: String(f.description).slice(0, 2000),
      evidence: f.evidence ? String(f.evidence).slice(0, 1500) : undefined,
      recommendation: String(f.recommendation ?? 'No recommendation supplied.').slice(0, 2000),
      affectedUrls: Array.isArray(f.affectedUrls)
        ? f.affectedUrls.filter((u) => typeof u === 'string').slice(0, 10)
        : [],
      source: 'ai',
    })
  }

  return findings
}

export interface AnalysisResult {
  summary: string
  score: number
  findings: IFinding[]
}

export async function analyzeSite(
  targetUrl: string,
  crawl: CrawlResult,
  profile: ScanProfile,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const evidence = buildEvidence(targetUrl, crawl, profile)

  const instruction =
    profile.id === 'deep'
      ? 'Perform an exhaustive review. Work through every page in the evidence and report everything the data supports, including lower-severity polish items. Aim for thorough coverage across all six categories.'
      : profile.id === 'medium'
        ? 'Perform a standard review covering the significant issues across all categories.'
        : 'Perform a fast triage. Report only the issues that matter most — the ones worth fixing this week.'

  const raw = await complete(
    [
      {
        role: 'user',
        content: `${instruction}\n\nHere is the crawl evidence:\n\n${evidence}`,
      },
    ],
    { system: SYSTEM_PROMPT, json: true, temperature: 0.2, signal },
  )

  const parsed = parseJsonResponse<RawAnalysis>(raw)
  const findings = coerceFindings(parsed.findings ?? [])

  const score =
    typeof parsed.score === 'number' && parsed.score >= 0 && parsed.score <= 100
      ? Math.round(parsed.score)
      : scoreFromFindings(findings)

  return {
    summary: parsed.summary?.trim() || 'The model did not return a summary for this scan.',
    score,
    findings,
  }
}

/**
 * Deep scans get a second pass over the pages with the most raw signal, which
 * surfaces page-specific detail the site-wide pass tends to summarize away.
 */
export async function analyzePagesInDetail(
  crawl: CrawlResult,
  profile: ScanProfile,
  signal?: AbortSignal,
): Promise<IFinding[]> {
  const noisy = [...crawl.pages]
    .map((p) => ({
      page: p,
      signal:
        p.consoleErrors.length * 3 +
        p.pageErrors.length * 4 +
        p.failedRequests.length * 2 +
        p.interactions.filter((i) => i.outcome === 'error' || i.outcome === 'no-effect').length * 3 +
        (p.loadError ? 10 : 0) +
        (p.mobile?.horizontalOverflow ? 3 : 0),
    }))
    .filter((x) => x.signal > 0)
    .sort((a, b) => b.signal - a.signal)
    .slice(0, 5)

  if (!noisy.length) return []

  const findings: IFinding[] = []

  for (const { page } of noisy) {
    if (signal?.aborted) break
    try {
      const raw = await complete(
        [
          {
            role: 'user',
            content:
              'This single page showed more errors than the rest of the site. Diagnose what is going wrong on it specifically. ' +
              'Report only findings that are specific to this page — skip anything site-wide.\n\n' +
              describePage(page, true),
          },
        ],
        { system: SYSTEM_PROMPT, json: true, temperature: 0.2, maxTokens: 3000, signal },
      )
      const parsed = parseJsonResponse<RawAnalysis>(raw)
      findings.push(...coerceFindings(parsed.findings ?? []))
    } catch (err) {
      // One bad page pass must not sink an otherwise complete report.
      console.error(`[analyze] per-page pass failed for ${page.url}:`, (err as Error).message)
    }
  }

  return findings
}

const SEVERITY_COST: Record<Severity, number> = {
  critical: 25,
  high: 12,
  medium: 5,
  low: 2,
  info: 0,
}

export function scoreFromFindings(findings: IFinding[]): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_COST[f.severity], 0)
  return Math.max(0, Math.min(100, 100 - penalty))
}

/** Near-identical titles across passes would otherwise show up twice. */
export function dedupeFindings(findings: IFinding[]): IFinding[] {
  const seen = new Map<string, IFinding>()

  for (const f of findings) {
    const key = `${f.category}:${f.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, f)
      continue
    }
    // Keep the scanner's version — it is verifiable — but merge the URL lists.
    const winner = existing.source === 'scanner' ? existing : f
    const loser = winner === existing ? f : existing
    winner.affectedUrls = [...new Set([...winner.affectedUrls, ...loser.affectedUrls])].slice(0, 10)
    seen.set(key, winner)
  }

  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
  return [...seen.values()].sort((a, b) => order[a.severity] - order[b.severity])
}
