import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { migrate } from './schema'

export const DATA_DIR = process.env.AISCENTRY_DATA_DIR
  ? path.resolve(process.env.AISCENTRY_DATA_DIR)
  : path.join(process.cwd(), '.data')

export const SCREENSHOT_DIR = path.join(DATA_DIR, 'screenshots')

// Next.js hot-reloads modules in dev. Without a global handle each reload opens
// a second connection to the same file and they fight over the write lock.
declare global {
  var _aiscentryDb: Database.Database | undefined
}

function open(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

  const db = new Database(path.join(DATA_DIR, 'aiscentry.db'))
  // WAL lets the polling readers run while a crawl is writing progress.
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  migrate(db)
  return db
}

export function getDb(): Database.Database {
  if (!global._aiscentryDb) global._aiscentryDb = open()
  return global._aiscentryDb
}

/** Short, URL-safe, collision-resistant enough for row identifiers. */
export function newId(): string {
  return crypto.randomBytes(12).toString('hex')
}

export function now(): number {
  return Date.now()
}
