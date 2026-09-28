import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Database = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  datetime TEXT NOT NULL,
  currency TEXT NOT NULL,
  impact TEXT NOT NULL,
  title TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_datetime ON events(datetime);

CREATE TABLE IF NOT EXISTS event_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  captured_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_event ON event_snapshots(event_id);

CREATE TABLE IF NOT EXISTS changes (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_title TEXT NOT NULL,
  change_type TEXT NOT NULL,
  field TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  detected_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_changes_detected ON changes(detected_at DESC);
`;

/** Opens (and migrates) a SQLite database. Use ":memory:" in tests. */
export function openDatabase(url: string): Database {
  if (url !== ":memory:") mkdirSync(dirname(url), { recursive: true });
  const db = new DatabaseSync(url);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}
