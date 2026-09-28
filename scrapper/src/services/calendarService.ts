import type { EventRepository } from "../database/repository.js";
import type {
  ChangesQuery, EconomicEvent, EventChange, EventSnapshot, ResponseMeta, SourceFilter,
} from "../models/schemas.js";
import type { CalendarProvider } from "../scraper/CalendarProvider.js";
import { addDays, isSameUtcDay, startOfUtcDay } from "../utils/dates.js";
import { ApiError } from "../utils/response.js";
import { CalendarCache } from "./calendarCache.js";
import { ChangeDetectionService } from "./changeDetectionService.js";

export interface CalendarResult<T> {
  data: T;
  meta: ResponseMeta;
}

export interface CalendarServiceOptions {
  minIntervalMs: number;
  now?: () => Date;
  onError?: (err: unknown) => void;
}

const GOLD = ["very_high", "high", "medium"];
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** "both" events belong to each feed, so they survive every source filter. */
const matchesSource = (e: EconomicEvent, source: SourceFilter): boolean =>
  source === "all" || e.source === source || e.source === "both";

/**
 * Single entry point for calendar data. Fetches the provider's week at most once per
 * minIntervalMs, runs change detection on each successful fetch, and falls back to
 * cached/persisted data (meta.stale=true) when the provider fails.
 */
export class CalendarService {
  private readonly cache: CalendarCache;
  private readonly detector: ChangeDetectionService;
  private readonly now: () => Date;
  private inflight: Promise<CalendarResult<EconomicEvent[]>> | null = null;

  constructor(
    private readonly provider: CalendarProvider,
    private readonly repo: EventRepository,
    private readonly opts: CalendarServiceOptions,
  ) {
    this.now = opts.now ?? (() => new Date());
    this.cache = new CalendarCache(opts.minIntervalMs, this.now);
    this.detector = new ChangeDetectionService(repo, this.now);
  }

  private meta(source: "live" | "cache", stale: boolean): ResponseMeta {
    return { source, stale, fetchedAt: this.cache.lastScrapeAt?.toISOString() ?? null };
  }

  private persisted(): EconomicEvent[] {
    const start = addDays(startOfUtcDay(this.now()), -7).toISOString();
    const end = addDays(startOfUtcDay(this.now()), 14).toISOString();
    return this.repo.listEvents(start, end);
  }

  async week(): Promise<CalendarResult<EconomicEvent[]>> {
    if (this.cache.data === null) this.cache.seed(this.persisted());
    if (this.cache.isFresh()) return { data: this.cache.data!, meta: this.meta("cache", false) };
    if (!this.cache.canFetch()) {
      if (this.cache.data) return { data: this.cache.data, meta: this.meta("cache", !this.cache.isFresh()) };
      throw new ApiError(503, "UPSTREAM_UNAVAILABLE", "Calendar source unavailable; retry later");
    }
    this.inflight ??= this.refresh().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async refresh(): Promise<CalendarResult<EconomicEvent[]>> {
    this.cache.markAttempt();
    try {
      const fetched = await this.provider.getWeek();
      const { events } = this.detector.sync(fetched);
      this.cache.store(events);
      return { data: events, meta: this.meta("live", false) };
    } catch (err) {
      this.opts.onError?.(err);
      if (this.cache.data) return { data: this.cache.data, meta: this.meta("cache", true) };
      throw err instanceof ApiError ? err : new ApiError(503, "UPSTREAM_UNAVAILABLE", "Calendar source unavailable; retry later");
    }
  }

  private async filtered(
    pred: (e: EconomicEvent) => boolean,
    source: SourceFilter = "all",
  ): Promise<CalendarResult<EconomicEvent[]>> {
    const r = await this.week();
    return { data: r.data.filter((e) => pred(e) && matchesSource(e, source)), meta: r.meta };
  }

  today(source: SourceFilter = "all") {
    const d = startOfUtcDay(this.now());
    return this.filtered((e) => isSameUtcDay(e.datetime, d), source);
  }
  tomorrow(source: SourceFilter = "all") {
    const d = addDays(startOfUtcDay(this.now()), 1);
    return this.filtered((e) => isSameUtcDay(e.datetime, d), source);
  }
  highImpact(source: SourceFilter = "all") { return this.filtered((e) => e.impact === "high", source); }
  goldRelevant(source: SourceFilter = "all") { return this.filtered((e) => GOLD.includes(e.goldRelevance), source); }

  async byId(id: string): Promise<EconomicEvent | null> {
    const stored = this.repo.findById(id);
    if (stored) return stored.event;
    try {
      return (await this.week()).data.find((e) => e.id === id) ?? null;
    } catch {
      return null;
    }
  }

  history(id: string): { event: EconomicEvent; snapshots: EventSnapshot[]; changes: EventChange[] } | null {
    const stored = this.repo.findById(id);
    if (!stored) return null;
    return {
      event: stored.event,
      snapshots: this.repo.listSnapshots(id),
      changes: this.repo.queryChanges({ eventId: id, limit: 500 }),
    };
  }

  changes(q: Partial<ChangesQuery> & { limit: number }): EventChange[] {
    return this.repo.queryChanges(q);
  }

  status() {
    return {
      lastScrapeAt: this.cache.lastScrapeAt?.toISOString() ?? null,
      nextAllowedScrapeAt: this.cache.nextAllowedScrapeAt?.toISOString() ?? null,
      cachedEvents: this.repo.countEvents(),
      recentChanges: this.repo.countChangesSince(new Date(this.now().getTime() - RECENT_WINDOW_MS).toISOString()),
    };
  }
}
