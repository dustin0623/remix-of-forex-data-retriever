import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Database = DatabaseSync;

/** Bump when the schema changes incompatibly. Older local DBs are rebuilt (cache data only). */
const SCHEMA_VERSION = 3;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  event TEXT NOT NULL,
  currency TEXT NOT NULL,
  impact TEXT NOT NULL,
  datetime TEXT NOT NULL,
  actual TEXT,
  forecast TEXT,
  previous TEXT,
  gold_relevance TEXT NOT NULL,
  usd_relevance TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'UPCOMING',
  description TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_datetime ON events(datetime);
CREATE INDEX IF NOT EXISTS idx_events_currency_impact ON events(currency, impact);
CREATE INDEX IF NOT EXISTS idx_events_gold ON events(gold_relevance);

CREATE TABLE IF NOT EXISTS event_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  actual TEXT,
  forecast TEXT,
  previous TEXT,
  impact TEXT NOT NULL,
  captured_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_snapshots_event_hash ON event_snapshots(event_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_snapshots_event_time ON event_snapshots(event_id, captured_at);

CREATE TABLE IF NOT EXISTS changes (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  detected_at TEXT NOT NULL,
  content_hash TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_changes_dedupe ON changes(event_id, content_hash, change_type);
CREATE INDEX IF NOT EXISTS idx_changes_detected ON changes(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_changes_event ON changes(event_id, detected_at);
`;

/** Opens (and migrates) a SQLite database. Use ":memory:" in tests. */
export function openDatabase(url: string): Database {
  if (url !== ":memory:") mkdirSync(dirname(url), { recursive: true });
  const db = new DatabaseSync(url);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (user_version < SCHEMA_VERSION) {
    db.exec("DROP TABLE IF EXISTS changes; DROP TABLE IF EXISTS event_snapshots; DROP TABLE IF EXISTS events;");
  }
  db.exec(SCHEMA);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return db;
}
