import { createHash } from "node:crypto";
import type { EventRepository, NewChange } from "../database/repository.js";
import type { ChangeType, EconomicEvent } from "../models/schemas.js";

/** Fields that define an event's content. Anything else changing does not create a change. */
export function contentHash(e: Pick<EconomicEvent, "id" | "actual" | "forecast" | "previous" | "impact" | "datetime">): string {
  const canonical = JSON.stringify([e.id, e.actual, e.forecast, e.previous, e.impact, e.datetime]);
  return createHash("sha256").update(canonical).digest("hex");
}

export interface SyncResult {
  events: EconomicEvent[];
  inserted: number;
  unchanged: number;
  updated: number;
  changes: number;
}

export class ChangeDetectionService {
  constructor(
    private readonly repo: EventRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Pure diff: which change records an update from `before` to `after` implies. */
  static diff(before: EconomicEvent, after: EconomicEvent): Array<Omit<NewChange, "eventId" | "detectedAt" | "contentHash">> {
    const out: Array<Omit<NewChange, "eventId" | "detectedAt" | "contentHash">> = [];
    const push = (changeType: ChangeType, oldValue: string | null, newValue: string | null) =>
      out.push({ changeType, oldValue, newValue });
    if (before.actual !== after.actual) {
      push(before.actual === null ? "actual_released" : "actual_revised", before.actual, after.actual);
    }
    if (before.forecast !== after.forecast) push("forecast_changed", before.forecast, after.forecast);
    if (before.previous !== after.previous) push("previous_changed", before.previous, after.previous);
    if (before.impact !== after.impact) push("impact_changed", before.impact, after.impact);
    if (before.datetime !== after.datetime) push("event_updated", before.datetime, after.datetime);
    return out;
  }

  /** Persists a batch: new -> insert + snapshot; same hash -> touch only; new hash -> snapshot + changes + update. */
  sync(incoming: EconomicEvent[]): SyncResult {
    const now = this.now().toISOString();
    const result: SyncResult = { events: [], inserted: 0, unchanged: 0, updated: 0, changes: 0 };
    this.repo.transaction(() => {
      const touched: string[] = [];
      for (const next of incoming) {
        const hash = contentHash(next);
        const stored = this.repo.findById(next.id);
        if (!stored) {
          this.repo.insertEvent(next, hash, now);
          this.repo.addSnapshot(next, hash, now);
          result.inserted++;
          result.events.push(next);
          continue;
        }
        if (stored.contentHash === hash) {
          touched.push(next.id);
          result.unchanged++;
          // Keep status (e.g. UPDATED) from storage; refresh non-hashed metadata lazily.
          result.events.push({ ...next, status: stored.event.status });
          continue;
        }
        const diffs = ChangeDetectionService.diff(stored.event, next);
        const revised = diffs.some((d) => d.changeType === "actual_revised") || stored.event.status === "UPDATED";
        const event: EconomicEvent = {
          ...next,
          status: next.actual === null ? "UPCOMING" : revised ? "UPDATED" : "RELEASED",
        };
        this.repo.addSnapshot(event, hash, now);
        for (const d of diffs) {
          if (this.repo.addChange({ ...d, eventId: next.id, detectedAt: now, contentHash: hash })) result.changes++;
        }
        this.repo.updateEvent(event, hash, now);
        result.updated++;
        result.events.push(event);
      }
      this.repo.touchEvents(touched, now);
    });
    return result;
  }
}
