import type BetterSqlite3 from 'better-sqlite3'

/**
 * The whole schema, applied idempotently on first connection. SQLite has no
 * `ALTER TABLE ... IF NOT EXISTS`, so evolving a column later means adding a
 * numbered block to `MIGRATIONS` rather than editing the CREATE statements —
 * existing databases never re-run the initial block.
 */

const INITIAL = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS maps (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_url        TEXT NOT NULL,
  hostname          TEXT NOT NULL,
  label             TEXT,
  status            TEXT NOT NULL DEFAULT 'queued',
  depth_profile     TEXT NOT NULL DEFAULT 'standard',
  login_scenario_id TEXT REFERENCES scenarios(id) ON DELETE SET NULL,
  progress_current  INTEGER NOT NULL DEFAULT 0,
  progress_total    INTEGER NOT NULL DEFAULT 0,
  progress_message  TEXT NOT NULL DEFAULT 'Queued',
  error             TEXT,
  stats_json        TEXT,
  created_at        INTEGER NOT NULL,
  started_at        INTEGER,
  finished_at       INTEGER
);
CREATE INDEX IF NOT EXISTS idx_maps_user ON maps(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS map_nodes (
  id                  TEXT PRIMARY KEY,
  map_id              TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  url                 TEXT NOT NULL,
  canonical_url       TEXT NOT NULL,
  title               TEXT NOT NULL DEFAULT '',
  status_code         INTEGER NOT NULL DEFAULT 0,
  load_time_ms        INTEGER NOT NULL DEFAULT 0,
  depth               INTEGER NOT NULL DEFAULT 0,
  kind                TEXT NOT NULL DEFAULT 'page',
  screenshot_path     TEXT,
  console_errors_json TEXT,
  forms_json          TEXT,
  interactive_json    TEXT,
  error               TEXT
);
CREATE INDEX IF NOT EXISTS idx_nodes_map ON map_nodes(map_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_canonical ON map_nodes(map_id, canonical_url);

CREATE TABLE IF NOT EXISTS map_edges (
  id           TEXT PRIMARY KEY,
  map_id       TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  from_node_id TEXT NOT NULL,
  to_node_id   TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'link',
  label        TEXT NOT NULL DEFAULT '',
  selector     TEXT
);
CREATE INDEX IF NOT EXISTS idx_edges_map ON map_edges(map_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique
  ON map_edges(map_id, from_node_id, to_node_id, kind, label);

CREATE TABLE IF NOT EXISTS scenarios (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  target_url    TEXT NOT NULL,
  map_id        TEXT REFERENCES maps(id) ON DELETE SET NULL,
  source_text   TEXT NOT NULL,
  compiled_json TEXT,
  compiled_at   INTEGER,
  compile_error TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scenarios_user ON scenarios(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS runs (
  id               TEXT PRIMARY KEY,
  scenario_id      TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'queued',
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_total   INTEGER NOT NULL DEFAULT 0,
  progress_message TEXT NOT NULL DEFAULT 'Queued',
  error            TEXT,
  ai_repairs       INTEGER NOT NULL DEFAULT 0,
  duration_ms      INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  started_at       INTEGER,
  finished_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_runs_scenario ON runs(scenario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS run_steps (
  id                  TEXT PRIMARY KEY,
  run_id              TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  idx                 INTEGER NOT NULL,
  action              TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  detail              TEXT,
  selector_used       TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  url                 TEXT,
  duration_ms         INTEGER NOT NULL DEFAULT 0,
  screenshot_path     TEXT,
  console_errors_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_steps_run ON run_steps(run_id, idx);
`

/**
 * A saved website login the crawler can use on its own, without a scripted
 * scenario. The password is plaintext for the same reason a scenario's is:
 * the executor has to type it into a real form field.
 */
const ADD_TEST_USERS = `
CREATE TABLE IF NOT EXISTS test_users (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  username   TEXT NOT NULL,
  password   TEXT NOT NULL,
  login_path TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_test_users_user ON test_users(user_id, created_at DESC);

ALTER TABLE maps ADD COLUMN test_user_id TEXT REFERENCES test_users(id) ON DELETE SET NULL;
`

/** How long the executor pauses after each step, configurable per scenario. */
const ADD_STEP_DELAY = `
ALTER TABLE scenarios ADD COLUMN step_delay_ms INTEGER NOT NULL DEFAULT 1000;
`

/**
 * A website is now the organizing unit: its map, scenarios and test users all
 * hang off it. A map row is created alongside its website and never deleted
 * on its own, so "one map per website" is a standing invariant rather than
 * something every reader has to check for — the partial unique index makes
 * the database enforce it too. Pre-existing maps/scenarios/test_users (from
 * before this migration) are left with a NULL website_id; nothing in the new,
 * website-scoped UI can reach them, but they are not deleted.
 */
const ADD_WEBSITES = `
CREATE TABLE IF NOT EXISTS websites (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  target_url TEXT NOT NULL,
  hostname   TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_websites_user ON websites(user_id, created_at DESC);

ALTER TABLE maps ADD COLUMN website_id TEXT REFERENCES websites(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_maps_website
  ON maps(website_id) WHERE website_id IS NOT NULL;

ALTER TABLE scenarios ADD COLUMN website_id TEXT REFERENCES websites(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_scenarios_website ON scenarios(website_id, created_at DESC);

ALTER TABLE test_users ADD COLUMN website_id TEXT REFERENCES websites(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_test_users_website ON test_users(website_id, created_at DESC);
`

/**
 * Append-only. Each entry runs once, in order, and its index is recorded in
 * `user_version` so a database never replays one it has already applied.
 */
const MIGRATIONS: string[] = [INITIAL, ADD_TEST_USERS, ADD_STEP_DELAY, ADD_WEBSITES]

export function migrate(db: BetterSqlite3.Database): void {
  const applied = db.pragma('user_version', { simple: true }) as number

  for (let version = applied; version < MIGRATIONS.length; version++) {
    db.exec(MIGRATIONS[version])
    // pragma values cannot be bound as parameters.
    db.pragma(`user_version = ${version + 1}`)
  }
}
