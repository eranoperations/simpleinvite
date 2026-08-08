import { getDb } from '@/lib/db'
import type { MapEdgeRow, MapNodeRow, MapRow, RunRow, RunStepRow, ScenarioRow } from '@/lib/db/types'
import { displayPath } from '@/lib/crawl/url-guard'

/** Shapes returned to the browser. Nothing here is a raw row — screenshot paths
 *  become API URLs, and JSON columns are parsed once on the server. */

export interface MapSummaryDto {
  id: string
  targetUrl: string
  hostname: string
  label: string | null
  status: string
  depthProfile: string
  progress: { current: number; total: number; message: string }
  error: string | null
  stats: Record<string, number> | null
  createdAt: number
  finishedAt: number | null
  authenticated: boolean
}

export interface MapNodeDto {
  id: string
  url: string
  path: string
  title: string
  statusCode: number
  loadTimeMs: number
  depth: number
  kind: string
  screenshotUrl: string | null
  consoleErrors: string[]
  formCount: number
  error: string | null
}

export interface MapEdgeDto {
  id: string
  from: string
  to: string
  kind: string
  label: string
}

export function mapSummary(row: MapRow): MapSummaryDto {
  return {
    id: row.id,
    targetUrl: row.target_url,
    hostname: row.hostname,
    label: row.label,
    status: row.status,
    depthProfile: row.depth_profile,
    progress: {
      current: row.progress_current,
      total: row.progress_total,
      message: row.progress_message,
    },
    error: row.error,
    stats: parse<Record<string, number>>(row.stats_json),
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    authenticated: Boolean(row.login_scenario_id),
  }
}

export function mapGraph(mapId: string, origin: string) {
  const db = getDb()
  const nodes = db.prepare('SELECT * FROM map_nodes WHERE map_id = ?').all(mapId) as MapNodeRow[]
  const edges = db.prepare('SELECT * FROM map_edges WHERE map_id = ?').all(mapId) as MapEdgeRow[]

  return {
    nodes: nodes.map(
      (n): MapNodeDto => ({
        id: n.id,
        url: n.canonical_url,
        path: displayPath(n.canonical_url, origin),
        title: n.title,
        statusCode: n.status_code,
        loadTimeMs: n.load_time_ms,
        depth: n.depth,
        kind: n.kind,
        screenshotUrl: n.screenshot_path
          ? `/api/screenshots/maps/${mapId}/${n.screenshot_path}`
          : null,
        consoleErrors: parse<string[]>(n.console_errors_json) ?? [],
        formCount: (parse<unknown[]>(n.forms_json) ?? []).length,
        error: n.error,
      }),
    ),
    edges: edges.map(
      (e): MapEdgeDto => ({
        id: e.id,
        from: e.from_node_id,
        to: e.to_node_id,
        kind: e.kind,
        label: e.label,
      }),
    ),
  }
}

export interface ScenarioDto {
  id: string
  name: string
  targetUrl: string
  mapId: string | null
  sourceText: string
  steps: unknown[] | null
  compiledAt: number | null
  compileError: string | null
  createdAt: number
  updatedAt: number
}

export function scenarioDto(row: ScenarioRow): ScenarioDto {
  return {
    id: row.id,
    name: row.name,
    targetUrl: row.target_url,
    mapId: row.map_id,
    sourceText: row.source_text,
    steps: parse<unknown[]>(row.compiled_json),
    compiledAt: row.compiled_at,
    compileError: row.compile_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface RunDto {
  id: string
  scenarioId: string
  scenarioName: string
  status: string
  progress: { current: number; total: number; message: string }
  error: string | null
  aiRepairs: number
  durationMs: number
  createdAt: number
  finishedAt: number | null
  steps: {
    idx: number
    action: string
    description: string
    detail: string | null
    selectorUsed: string | null
    status: string
    url: string | null
    durationMs: number
    screenshotUrl: string | null
    consoleErrors: string[]
  }[]
}

export function runDto(row: RunRow, scenarioName: string): RunDto {
  const steps = getDb()
    .prepare('SELECT * FROM run_steps WHERE run_id = ? ORDER BY idx ASC')
    .all(row.id) as RunStepRow[]

  return {
    id: row.id,
    scenarioId: row.scenario_id,
    scenarioName,
    status: row.status,
    progress: {
      current: row.progress_current,
      total: row.progress_total,
      message: row.progress_message,
    },
    error: row.error,
    aiRepairs: row.ai_repairs,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    steps: steps.map((s) => ({
      idx: s.idx,
      action: s.action,
      description: s.description,
      detail: s.detail,
      selectorUsed: s.selector_used,
      status: s.status,
      url: s.url,
      durationMs: s.duration_ms,
      screenshotUrl: s.screenshot_path
        ? `/api/screenshots/runs/${row.id}/${s.screenshot_path}`
        : null,
      consoleErrors: parse<string[]>(s.console_errors_json) ?? [],
    })),
  }
}

function parse<T>(json: string | null): T | null {
  if (!json) return null
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
