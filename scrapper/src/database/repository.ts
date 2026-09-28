import { randomUUID } from "node:crypto";
import type {
  ChangeType, ChangesQuery, EconomicEvent, EventChange, EventSnapshot,
} from "../models/schemas.js";
import type { Database } from "./db.js";

/** Stored event = API event + bookkeeping. */
export interface StoredEvent {
  event: EconomicEvent;
  contentHash: string;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
}

export interface NewChange {
  eventId: string;
  changeType: ChangeType;
  oldValue: string | null;
  newValue: string | null;
  detectedAt: string;
  contentHash: string;
}

/** Storage contract — services depend on this, never on SQL directly. */
export interface EventRepository {
  findById(id: string): StoredEvent | null;
  insertEvent(event: EconomicEvent, hash: string, now: string): void;
  updateEvent(event: EconomicEvent, hash: string, now: string): void;
  touchEvents(ids: string[], now: string): void;
  listEvents(fromIso: string, toIso: string): EconomicEvent[];
  countEvents(): number;
  /** Returns false when a snapshot with this hash already exists. */
  addSnapshot(event: EconomicEvent, hash: string, now: string): boolean;
  /** Returns null when an identical change (same event/hash/type) already exists. */
  addChange(change: NewChange): string | null;
  queryChanges(q: Partial<ChangesQuery> & { limit: number; eventId?: string }): EventChange[];
  countChangesSince(iso: string): number;
  listSnapshots(eventId: string): EventSnapshot[];
  transaction<T>(fn: () => T): T;
}

type EventRow = {
  id: string; source: string; event: string; currency: string; impact: string; datetime: string;
  actual: string | null; forecast: string | null; previous: string | null; gold_relevance: string;
  usd_relevance: string; status: string; description: string; content_hash: string;
  first_seen_at: string; last_seen_at: string; updated_at: string;
};

const rowToEvent = (r: EventRow): EconomicEvent => ({
  id: r.id,
  datetime: r.datetime,
  time: r.datetime.slice(11, 16),
  currency: r.currency,
  title: r.event,
  impact: r.impact as EconomicEvent["impact"],
  status: r.status as EconomicEvent["status"],
  actual: r.actual,
  forecast: r.forecast,
  previous: r.previous,
  goldRelevance: r.gold_relevance as EconomicEvent["goldRelevance"],
  usdRelevance: r.usd_relevance as EconomicEvent["usdRelevance"],
  source: r.source,
  description: r.description,
  history: [],
});

const GOLD_RELEVANT = ["medium", "high", "very_high"];

export class SqliteEventRepository implements EventRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): StoredEvent | null {
    const r = this.db.prepare("SELECT * FROM events WHERE id = ?").get(id) as EventRow | undefined;
    if (!r) return null;
    return {
      event: rowToEvent(r),
      contentHash: r.content_hash,
      firstSeenAt: r.first_seen_at,
      lastSeenAt: r.last_seen_at,
      updatedAt: r.updated_at,
    };
  }

  insertEvent(e: EconomicEvent, hash: string, now: string): void {
    this.db
      .prepare(
        `INSERT INTO events (id, source, event, currency, impact, datetime, actual, forecast, previous,
           gold_relevance, usd_relevance, status, description, content_hash, first_seen_at, last_seen_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(e.id, e.source, e.title, e.currency, e.impact, e.datetime, e.actual, e.forecast, e.previous,
        e.goldRelevance, e.usdRelevance, e.status, e.description, hash, now, now, now);
  }

  updateEvent(e: EconomicEvent, hash: string, now: string): void {
    this.db
      .prepare(
        `UPDATE events SET source=?, event=?, currency=?, impact=?, datetime=?, actual=?, forecast=?, previous=?,
           gold_relevance=?, usd_relevance=?, status=?, description=?, content_hash=?, last_seen_at=?, updated_at=?
         WHERE id=?`,
      )
      .run(e.source, e.title, e.currency, e.impact, e.datetime, e.actual, e.forecast, e.previous,
        e.goldRelevance, e.usdRelevance, e.status, e.description, hash, now, now, e.id);
  }

  touchEvents(ids: string[], now: string): void {
    const stmt = this.db.prepare("UPDATE events SET last_seen_at = ? WHERE id = ?");
    for (const id of ids) stmt.run(now, id);
  }

  listEvents(fromIso: string, toIso: string): EconomicEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM events WHERE datetime >= ? AND datetime < ? ORDER BY datetime, id")
      .all(fromIso, toIso) as unknown as EventRow[];
    return rows.map(rowToEvent);
  }

  countEvents(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n;
  }

  addSnapshot(e: EconomicEvent, hash: string, now: string): boolean {
    const res = this.db
      .prepare(
        `INSERT OR IGNORE INTO event_snapshots (event_id, content_hash, actual, forecast, previous, impact, captured_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(e.id, hash, e.actual, e.forecast, e.previous, e.impact, now);
    return Number(res.changes) > 0;
  }

  addChange(c: NewChange): string | null {
    const id = randomUUID();
    const res = this.db
      .prepare(
        `INSERT OR IGNORE INTO changes (id, event_id, change_type, old_value, new_value, detected_at, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, c.eventId, c.changeType, c.oldValue, c.newValue, c.detectedAt, c.contentHash);
    return Number(res.changes) > 0 ? id : null;
  }

  queryChanges(q: Partial<ChangesQuery> & { limit: number; eventId?: string }): EventChange[] {
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (q.eventId) { where.push("c.event_id = ?"); args.push(q.eventId); }
    if (q.since) { where.push("c.detected_at >= ?"); args.push(new Date(q.since).toISOString()); }
    if (q.until) { where.push("c.detected_at <= ?"); args.push(new Date(q.until).toISOString()); }
    if (q.impact) { where.push("e.impact = ?"); args.push(q.impact); }
    if (q.currency) { where.push("e.currency = ?"); args.push(q.currency); }
    if (q.goldRelevant === true) where.push(`e.gold_relevance IN (${GOLD_RELEVANT.map(() => "?").join(",")})`), args.push(...GOLD_RELEVANT);
    if (q.goldRelevant === false) where.push(`e.gold_relevance NOT IN (${GOLD_RELEVANT.map(() => "?").join(",")})`), args.push(...GOLD_RELEVANT);
    const sql = `SELECT c.*, e.event AS title, e.currency, e.impact, e.gold_relevance
      FROM changes c JOIN events e ON e.id = c.event_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY c.detected_at DESC, c.rowid DESC LIMIT ?`;
    const rows = this.db.prepare(sql).all(...args, q.limit) as Array<Record<string, string | null>>;
    return rows.map((r) => ({
      id: r["id"]!,
      eventId: r["event_id"]!,
      eventTitle: r["title"]!,
      currency: r["currency"]!,
      impact: r["impact"] as EventChange["impact"],
      goldRelevance: r["gold_relevance"] as EventChange["goldRelevance"],
      changeType: r["change_type"] as ChangeType,
      oldValue: r["old_value"] ?? null,
      newValue: r["new_value"] ?? null,
      detectedAt: r["detected_at"]!,
      contentHash: r["content_hash"]!,
    }));
  }

  countChangesSince(iso: string): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM changes WHERE detected_at >= ?").get(iso) as { n: number }).n;
  }

  listSnapshots(eventId: string): EventSnapshot[] {
    const rows = this.db
      .prepare("SELECT * FROM event_snapshots WHERE event_id = ? ORDER BY captured_at, id")
      .all(eventId) as Array<Record<string, string | number | null>>;
    return rows.map((r) => ({
      id: Number(r["id"]),
      eventId: String(r["event_id"]),
      contentHash: String(r["content_hash"]),
      actual: (r["actual"] as string | null) ?? null,
      forecast: (r["forecast"] as string | null) ?? null,
      previous: (r["previous"] as string | null) ?? null,
      impact: r["impact"] as EventSnapshot["impact"],
      capturedAt: String(r["captured_at"]),
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
