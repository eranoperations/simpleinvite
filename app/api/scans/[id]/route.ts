import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import mongoose from 'mongoose'
import { authOptions } from '@/auth'
import { connectDB } from '@/lib/mongodb'
import { Scan } from '@/models/Scan'
import { cancelScan } from '@/lib/scanner/runner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function loadOwnedScan(id: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  await connectDB()
  // Scoping the query by userId is what stops one user reading another's report.
  return Scan.findOne({ _id: id, userId }).lean()
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { id } = await params
  const scan = await loadOwnedScan(id, session.user.id)
  if (!scan) return NextResponse.json({ error: 'Scan not found.' }, { status: 404 })

  return NextResponse.json({
    scan: {
      id: String(scan._id),
      targetUrl: scan.targetUrl,
      hostname: scan.hostname,
      depth: scan.depth,
      status: scan.status,
      progress: scan.progress,
      summary: scan.summary,
      score: scan.score,
      findings: scan.findings,
      pages: scan.pages,
      stats: scan.stats,
      aiModel: scan.aiModel,
      aiProvider: scan.aiProvider,
      error: scan.error,
      createdAt: scan.createdAt,
      startedAt: scan.startedAt,
      finishedAt: scan.finishedAt,
    },
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { id } = await params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 })
  }

  await connectDB()
  const scan = await Scan.findOne({ _id: id, userId: session.user.id }).select('status')
  if (!scan) return NextResponse.json({ error: 'Scan not found.' }, { status: 404 })

  // Stop the worker before removing the row it writes progress into.
  cancelScan(id)
  await Scan.deleteOne({ _id: id, userId: session.user.id })

  return NextResponse.json({ deleted: true })
}
