import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { Scan } from '@/models/Scan'
import { DEPTHS, getProfile } from '@/lib/scanner/profiles'
import { TargetNotAllowedError, validateTarget } from '@/lib/scanner/url-guard'
import { launchScan, reapStaleScans } from '@/lib/scanner/runner'
import { isAiConfigured } from '@/lib/ai/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  url: z.string().min(1, 'Enter a website URL.').max(2000),
  depth: z.enum(DEPTHS as [string, ...string[]]),
  ownershipConfirmed: z.literal(true, {
    errorMap: () => ({ message: 'Confirm you are authorized to scan this site.' }),
  }),
})

/** One active scan at a time per user keeps browser memory bounded. */
const MAX_CONCURRENT_PER_USER = 1

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  await connectDB()
  await reapStaleScans().catch(() => {})

  const scans = await Scan.find({ userId: session.user.id })
    .select('targetUrl hostname depth status progress score summary stats createdAt finishedAt error findings')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  return NextResponse.json({
    scans: scans.map((s) => ({
      id: String(s._id),
      targetUrl: s.targetUrl,
      hostname: s.hostname,
      depth: s.depth,
      status: s.status,
      progress: s.progress,
      score: s.score,
      summary: s.summary,
      findingCount: s.findings?.length ?? 0,
      criticalCount: s.findings?.filter((f) => f.severity === 'critical' || f.severity === 'high').length ?? 0,
      pagesCrawled: s.stats?.pagesCrawled ?? 0,
      createdAt: s.createdAt,
      finishedAt: s.finishedAt,
      error: s.error,
    })),
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error:
          'The server has no AI provider configured. Set AI_API_BASE_URL, AI_API_KEY and AI_MODEL, then restart.',
      },
      { status: 503 },
    )
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request.' },
      { status: 400 },
    )
  }

  await connectDB()

  const active = await Scan.countDocuments({
    userId: session.user.id,
    status: { $in: ['queued', 'crawling', 'analyzing'] },
  })
  if (active >= MAX_CONCURRENT_PER_USER) {
    return NextResponse.json(
      { error: 'You already have a scan running. Wait for it to finish or cancel it.' },
      { status: 429 },
    )
  }

  let target
  try {
    target = await validateTarget(parsed.data.url)
  } catch (err) {
    if (err instanceof TargetNotAllowedError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const profile = getProfile(parsed.data.depth)

  const scan = await Scan.create({
    userId: session.user.id,
    targetUrl: target.url,
    hostname: target.hostname,
    depth: profile.id,
    status: 'queued',
    progress: { current: 0, total: profile.maxPages, message: 'Queued' },
  })

  launchScan(String(scan._id))

  return NextResponse.json({ id: String(scan._id), status: 'queued' }, { status: 201 })
}
