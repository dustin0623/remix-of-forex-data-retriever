import type { EconomicEvent } from "../models/schemas.js";

/**
 * In-memory cache of the last successful full fetch, plus fetch-throttling state.
 * A fetch is allowed only once per minIntervalMs (measured from the last attempt,
 * successful or not), so upstream failures never cause tight retry loops.
 */
export class CalendarCache {
  private events: EconomicEvent[] | null = null;
  private lastSuccessAt: number | null = null;
  private lastAttemptAt: number | null = null;

  constructor(
    private readonly minIntervalMs: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get data(): EconomicEvent[] | null {
    return this.events;
  }

  get lastScrapeAt(): Date | null {
    return this.lastSuccessAt === null ? null : new Date(this.lastSuccessAt);
  }

  get nextAllowedScrapeAt(): Date | null {
    return this.lastAttemptAt === null ? null : new Date(this.lastAttemptAt + this.minIntervalMs);
  }

  /** Fresh = we have data and the min interval since the last success hasn't elapsed. */
  isFresh(): boolean {
    return this.events !== null && this.lastSuccessAt !== null
      && this.now().getTime() - this.lastSuccessAt < this.minIntervalMs;
  }

  canFetch(): boolean {
    return this.lastAttemptAt === null || this.now().getTime() >= this.lastAttemptAt + this.minIntervalMs;
  }

  markAttempt(): void {
    this.lastAttemptAt = this.now().getTime();
  }

  store(events: EconomicEvent[]): void {
    this.events = events;
    this.lastSuccessAt = this.now().getTime();
  }

  /** Seed from persisted data (e.g. after restart) without claiming a fresh scrape. */
  seed(events: EconomicEvent[]): void {
    if (this.events === null && events.length) this.events = events;
  }
}
