import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import type { RunRow } from '@/lib/db/types'
import { notFound, requireUser } from '@/lib/auth/require'
import { runDto } from '@/lib/api/serialize'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const row = getDb()
    .prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?')
    .get(id, user.id) as RunRow | undefined
  if (!row) return notFound('Run not found.')

  const scenario = getDb()
    .prepare('SELECT name FROM scenarios WHERE id = ?')
    .get(row.scenario_id) as { name: string } | undefined

  return NextResponse.json({ run: runDto(row, scenario?.name ?? 'Scenario') })
}
