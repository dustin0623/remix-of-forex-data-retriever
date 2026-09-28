import { randomUUID } from "node:crypto";
import { EconomicEventSchema, type EconomicEvent, type EventChange } from "../models/schemas.js";
import type { Database } from "./db.js";

/** Storage contract — services depend on this, never on SQL directly. */
export interface EventRepository {
  findById(id: string): EconomicEvent | null;
  upsert(event: EconomicEvent): void;
  addSnapshot(event: EconomicEvent): void;
  addChange(change: Omit<EventChange, "id">): EventChange;
  listChanges(limit: number): EventChange[];
  transaction<T>(fn: () => T): T;
}

type ChangeRow = {
  id: string; event_id: string; event_title: string; change_type: string; field: string;
  previous_value: string | null; new_value: string | null; detected_at: string;
};

export class SqliteEventRepository implements EventRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): EconomicEvent | null {
    const row = this.db.prepare("SELECT data FROM events WHERE id = ?").get(id) as
      | { data: string }
      | undefined;
    return row ? EconomicEventSchema.parse(JSON.parse(row.data)) : null;
  }

  upsert(e: EconomicEvent): void {
    this.db
      .prepare(
        `INSERT INTO events (id, datetime, currency, impact, title, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET datetime=excluded.datetime, currency=excluded.currency,
           impact=excluded.impact, title=excluded.title, data=excluded.data, updated_at=excluded.updated_at`,
      )
      .run(e.id, e.datetime, e.currency, e.impact, e.title, JSON.stringify(e), new Date().toISOString());
  }

  addSnapshot(e: EconomicEvent): void {
    this.db
      .prepare("INSERT INTO event_snapshots (event_id, data, captured_at) VALUES (?, ?, ?)")
      .run(e.id, JSON.stringify(e), new Date().toISOString());
  }

  addChange(c: Omit<EventChange, "id">): EventChange {
    const change = { id: randomUUID(), ...c };
    this.db
      .prepare(
        `INSERT INTO changes (id, event_id, event_title, change_type, field, previous_value, new_value, detected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(change.id, c.eventId, c.eventTitle, c.changeType, c.field, c.previousValue, c.newValue, c.detectedAt);
    return change;
  }

  listChanges(limit: number): EventChange[] {
    const rows = this.db
      .prepare("SELECT * FROM changes ORDER BY detected_at DESC LIMIT ?")
      .all(limit) as unknown as ChangeRow[];
    return rows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      eventTitle: r.event_title,
      changeType: r.change_type as EventChange["changeType"],
      field: r.field as EventChange["field"],
      previousValue: r.previous_value,
      newValue: r.new_value,
      detectedAt: r.detected_at,
    }));
  }

  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN");
    try {
      const out = fn();
      this.db.exec("COMMIT");
      return out;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }
}
