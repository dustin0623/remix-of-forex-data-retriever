import type { EventRepository } from "../database/repository.js";
import type { EconomicEvent, EventChange } from "../models/schemas.js";
import type { CalendarProvider } from "../scraper/CalendarProvider.js";

const FIELDS = ["actual", "forecast", "previous"] as const;

export class CalendarService {
  constructor(
    private readonly provider: CalendarProvider,
    private readonly repo: EventRepository,
  ) {}

  /** Persists events, snapshotting and logging field-level changes. */
  private sync(events: EconomicEvent[]): EconomicEvent[] {
    const now = new Date().toISOString();
    return this.repo.transaction(() =>
      events.map((incoming) => {
        const existing = this.repo.findById(incoming.id);
        let event = incoming;
        if (!existing) {
          this.repo.upsert(event);
          this.repo.addSnapshot(event);
          return event;
        }
        const diffs = FIELDS.filter((f) => existing[f] !== incoming[f]);
        if (diffs.length === 0) return existing;
        for (const field of diffs) {
          const changeType: EventChange["changeType"] =
            field === "actual"
              ? existing.actual === null ? "actual_released" : "actual_revised"
              : field === "forecast" ? "forecast_revised" : "previous_revised";
          this.repo.addChange({
            eventId: incoming.id,
            eventTitle: incoming.title,
            changeType,
            field,
            previousValue: existing[field],
            newValue: incoming[field],
            detectedAt: now,
          });
        }
        if (existing.actual !== null && diffs.includes("actual")) {
          event = { ...incoming, status: "UPDATED" };
        }
        this.repo.upsert(event);
        this.repo.addSnapshot(event);
        return event;
      }),
    );
  }

  async today() { return this.sync(await this.provider.getToday()); }
  async tomorrow() { return this.sync(await this.provider.getTomorrow()); }
  async week() { return this.sync(await this.provider.getWeek()); }

  async highImpact() {
    return (await this.week()).filter((e) => e.impact === "high");
  }

  async goldRelevant() {
    return (await this.week()).filter((e) => e.goldRelevance === "high" || e.goldRelevance === "medium");
  }

  async byId(id: string): Promise<EconomicEvent | null> {
    const stored = this.repo.findById(id);
    if (stored) return stored;
    return (await this.week()).find((e) => e.id === id) ?? null;
  }

  changes(limit: number) {
    return this.repo.listChanges(limit);
  }
}
