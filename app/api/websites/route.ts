import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, newId, now } from '@/lib/db'
import type { WebsiteRow } from '@/lib/db/types'
import { requireUser } from '@/lib/auth/require'
import { validateTarget, TargetNotAllowedError } from '@/lib/crawl/url-guard'
import { websiteDto } from '@/lib/api/serialize'

export const runtime = 'nodejs'

const Body = z.object({
  name: z.string().min(1, 'Give the website a name.').max(120),
  url: z.string().min(1, 'Enter a website URL.').max(2000),
})

export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const rows = getDb()
    .prepare('SELECT * FROM websites WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(user.id) as WebsiteRow[]

  return NextResponse.json({ websites: rows.map(websiteDto) })
}

export async function POST(request: Request) {
  const { user, response } = await requireUser()
  if (response) return response

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid website.' },
      { status: 400 },
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

  const db = getDb()
  const id = newId()
  const mapId = newId()
  const timestamp = now()

  // A website is created with its one map already in place (empty, 'idle') so
  // "one map per website" never needs a null check anywhere downstream.
  db.transaction(() => {
    db.prepare(
      `INSERT INTO websites (id, user_id, name, target_url, hostname, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, user.id, parsed.data.name.trim(), target.url, target.hostname, timestamp, timestamp)

    db.prepare(
      `INSERT INTO maps
         (id, user_id, website_id, target_url, hostname, status, depth_profile,
          progress_total, progress_message, created_at)
       VALUES (?, ?, ?, ?, ?, 'idle', 'standard', 0, 'Not mapped yet', ?)`,
    ).run(mapId, user.id, id, target.url, target.hostname, timestamp)
  })()

  return NextResponse.json({ id }, { status: 201 })
}
