import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { describeAiConfig } from '@/lib/ai/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const ai = describeAiConfig()

  let database: 'ok' | 'error' = 'ok'
  let databaseError: string | undefined
  try {
    await connectDB()
  } catch (err) {
    database = 'error'
    databaseError = (err as Error).message
  }

  const healthy = database === 'ok' && ai.configured

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      database,
      databaseError,
      // Provider, model and base URL are safe to surface; the key never is.
      ai,
    },
    { status: healthy ? 200 : 503 },
  )
}
