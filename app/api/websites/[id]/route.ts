import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb, now } from '@/lib/db'
import type { WebsiteRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { validateTarget, TargetNotAllowedError } from '@/lib/crawl/url-guard'
import { websiteDto } from '@/lib/api/serialize'
import { cancel } from '@/lib/jobs/registry'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  url: z.string().min(1).max(2000).optional(),
})

function owned(id: string, userId: string): WebsiteRow | undefined {
  return getDb().prepare('SELECT * FROM websites WHERE id = ? AND user_id = ?').get(id, userId) as
    | WebsiteRow
    | undefined
}

export async function GET(_request: Request, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const website = owned(id, user.id)
  if (!website) return notFound('Website not found.')

  return NextResponse.json({ website: websiteDto(website) })
}

export async function PATCH(request: Request, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const website = owned(id, user.id)
  if (!website) return notFound('Website not found.')

  const parsed = Patch.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid update.' }, { status: 400 })

  const db = getDb()
  const name = parsed.data.name?.trim() ?? website.name
  let targetUrl = website.target_url
  let hostname = website.hostname

  if (parsed.data.url !== undefined) {
    try {
      const target = await validateTarget(parsed.data.url)
      targetUrl = target.url
      hostname = target.hostname
    } catch (err) {
      if (err instanceof TargetNotAllowedError) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      throw err
    }
  }

  db.transaction(() => {
    db.prepare(
      'UPDATE websites SET name = ?, target_url = ?, hostname = ?, updated_at = ? WHERE id = ?',
    ).run(name, targetUrl, hostname, now(), id)

    // The map and every scenario belong to this website's URL — a rename that
    // changed the URL would otherwise leave them crawling/running against a
    // site the website no longer points at.
    if (targetUrl !== website.target_url) {
      db.prepare('UPDATE maps SET target_url = ?, hostname = ? WHERE website_id = ?').run(
        targetUrl,
        hostname,
        id,
      )
      db.prepare('UPDATE scenarios SET target_url = ? WHERE website_id = ?').run(targetUrl, id)
    }
  })()

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  if (!owned(id, user.id)) return notFound('Website not found.')

  const db = getDb()
  const map = db.prepare('SELECT id FROM maps WHERE website_id = ?').get(id) as
    | { id: string }
    | undefined
  if (map) cancel(map.id)

  // Everything else (maps, scenarios, test users, and in turn runs/nodes/edges)
  // cascades from the foreign keys.
  db.prepare('DELETE FROM websites WHERE id = ?').run(id)

  return NextResponse.json({ ok: true })
}
