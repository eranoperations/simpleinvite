/** Row shapes exactly as better-sqlite3 hands them back (snake_case, no dates). */

/** 'idle' is a map-only state: created but never crawled, or just cleared. */
export type JobStatus = 'idle' | 'queued' | 'running' | 'complete' | 'failed' | 'cancelled'
export type NodeKind = 'page' | 'external' | 'unvisited'
export type EdgeKind = 'link' | 'button' | 'form' | 'redirect' | 'scenario'
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'repaired' | 'skipped'

export interface UserRow {
  id: string
  email: string
  password_hash: string
  name: string | null
  created_at: number
}

export interface SessionRow {
  id: string
  user_id: string
  expires_at: number
  created_at: number
}

export interface MapRow {
  id: string
  user_id: string
  website_id: string | null
  target_url: string
  hostname: string
  label: string | null
  status: JobStatus
  depth_profile: string
  login_scenario_id: string | null
  test_user_id: string | null
  progress_current: number
  progress_total: number
  progress_message: string
  error: string | null
  stats_json: string | null
  created_at: number
  started_at: number | null
  finished_at: number | null
}

export interface MapNodeRow {
  id: string
  map_id: string
  url: string
  canonical_url: string
  title: string
  status_code: number
  load_time_ms: number
  depth: number
  kind: NodeKind
  screenshot_path: string | null
  console_errors_json: string | null
  forms_json: string | null
  interactive_json: string | null
  error: string | null
}

export interface MapEdgeRow {
  id: string
  map_id: string
  from_node_id: string
  to_node_id: string
  kind: EdgeKind
  label: string
  selector: string | null
}

export interface TestUserRow {
  id: string
  user_id: string
  website_id: string | null
  label: string
  username: string
  password: string
  login_path: string | null
  created_at: number
}

export interface ScenarioRow {
  id: string
  user_id: string
  website_id: string | null
  name: string
  target_url: string
  map_id: string | null
  source_text: string
  compiled_json: string | null
  compiled_at: number | null
  compile_error: string | null
  step_delay_ms: number
  created_at: number
  updated_at: number
}

export interface WebsiteRow {
  id: string
  user_id: string
  name: string
  target_url: string
  hostname: string
  created_at: number
  updated_at: number
}

export interface RunRow {
  id: string
  scenario_id: string
  user_id: string
  status: JobStatus
  progress_current: number
  progress_total: number
  progress_message: string
  error: string | null
  ai_repairs: number
  duration_ms: number
  created_at: number
  started_at: number | null
  finished_at: number | null
}

export interface RunStepRow {
  id: string
  run_id: string
  idx: number
  action: string
  description: string
  detail: string | null
  selector_used: string | null
  status: StepStatus
  url: string | null
  duration_ms: number
  screenshot_path: string | null
  console_errors_json: string | null
}
