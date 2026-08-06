import mongoose, { Schema, type Model } from 'mongoose'
import type { ScanDepth } from '@/lib/scanner/profiles'

export type ScanStatus = 'queued' | 'crawling' | 'analyzing' | 'complete' | 'failed'
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type Category = 'security' | 'ux' | 'bug' | 'accessibility' | 'performance' | 'seo'

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info']
export const CATEGORIES: Category[] = [
  'security',
  'ux',
  'bug',
  'accessibility',
  'performance',
  'seo',
]

export interface IFinding {
  category: Category
  severity: Severity
  title: string
  description: string
  evidence?: string
  recommendation: string
  affectedUrls: string[]
  /** Set when a deterministic probe produced the finding rather than the model. */
  source: 'scanner' | 'ai'
}

export interface IPageRecord {
  url: string
  title: string
  statusCode: number
  loadTimeMs: number
  depth: number
  consoleErrors: string[]
  failedRequests: string[]
  interactionsTried: number
  interactionErrors: string[]
  notes: string[]
}

export interface IScan {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  targetUrl: string
  hostname: string
  depth: ScanDepth
  status: ScanStatus
  progress: { current: number; total: number; message: string }
  summary?: string
  score?: number
  findings: IFinding[]
  pages: IPageRecord[]
  stats: {
    pagesCrawled: number
    interactionsTried: number
    consoleErrors: number
    failedRequests: number
    durationMs: number
  }
  /** Named aiModel, not model — `model` is taken by Mongoose's Document API. */
  aiModel?: string
  aiProvider?: string
  error?: string
  startedAt?: Date
  finishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const FindingSchema = new Schema<IFinding>(
  {
    category: { type: String, enum: CATEGORIES, required: true },
    severity: { type: String, enum: SEVERITIES, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    evidence: String,
    recommendation: { type: String, required: true },
    affectedUrls: { type: [String], default: [] },
    source: { type: String, enum: ['scanner', 'ai'], default: 'ai' },
  },
  { _id: false },
)

const PageSchema = new Schema<IPageRecord>(
  {
    url: { type: String, required: true },
    title: { type: String, default: '' },
    statusCode: { type: Number, default: 0 },
    loadTimeMs: { type: Number, default: 0 },
    depth: { type: Number, default: 0 },
    consoleErrors: { type: [String], default: [] },
    failedRequests: { type: [String], default: [] },
    interactionsTried: { type: Number, default: 0 },
    interactionErrors: { type: [String], default: [] },
    notes: { type: [String], default: [] },
  },
  { _id: false },
)

const ScanSchema = new Schema<IScan>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetUrl: { type: String, required: true },
    hostname: { type: String, required: true },
    depth: { type: String, enum: ['quick', 'medium', 'deep'], required: true },
    status: {
      type: String,
      enum: ['queued', 'crawling', 'analyzing', 'complete', 'failed'],
      default: 'queued',
      index: true,
    },
    progress: {
      current: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      message: { type: String, default: 'Queued' },
    },
    summary: String,
    score: Number,
    findings: { type: [FindingSchema], default: [] },
    pages: { type: [PageSchema], default: [] },
    stats: {
      pagesCrawled: { type: Number, default: 0 },
      interactionsTried: { type: Number, default: 0 },
      consoleErrors: { type: Number, default: 0 },
      failedRequests: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
    },
    aiModel: String,
    aiProvider: String,
    error: String,
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true },
)

ScanSchema.index({ userId: 1, createdAt: -1 })

export const Scan: Model<IScan> =
  (mongoose.models.Scan as Model<IScan>) ||
  mongoose.model<IScan>('Scan', ScanSchema)
