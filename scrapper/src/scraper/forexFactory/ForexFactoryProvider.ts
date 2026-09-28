import type { EconomicEvent } from "../../models/schemas.js";
import { GoldRelevanceService } from "../../services/goldRelevanceService.js";
import { ApiError } from "../../utils/response.js";
import { addDays, isSameUtcDay, startOfUtcDay } from "../../utils/dates.js";
import type { CalendarProvider } from "../CalendarProvider.js";
import type { ForexFactoryClient } from "./ForexFactoryClient.js";
import { mergeActuals, mergeFeeds, parseCalendarHtml, parseExport } from "./ForexFactoryParser.js";
import {
  consoleLogger, type FeedSource, type ForexFactoryEvent, type ScraperLogger,
} from "./types.js";

export interface ForexFactoryProviderOptions {
  client: ForexFactoryClient;
  /** @deprecated throttling moved to CalendarCache; ignored. */
  minIntervalMs?: number;
  /** Also fetch the HTML calendar to fill in actual values (export has none). */
  enrichActuals: boolean;
  /** Feeds to combine. Defaults to both Fair Economy calendars. */
  sources?: FeedSource[];
  relevance?: GoldRelevanceService;
  logger?: ScraperLogger;
  now?: () => Date;
}

/**
 * Combines the Forex Factory and MetalsMine weekly calendars into one feed.
 * Stateless apart from in-flight de-duplication: every call hits upstream.
 * Caching, throttling and stale fallback live in CalendarService/CalendarCache.
 */
export class ForexFactoryProvider implements CalendarProvider {
  readonly name = "faireconomy";
  private inflight: Promise<ForexFactoryEvent[]> | null = null;
  private readonly relevance: GoldRelevanceService;
  private readonly log: ScraperLogger;
  private readonly now: () => Date;
  private readonly sources: FeedSource[];

  constructor(private readonly opts: ForexFactoryProviderOptions) {
    this.relevance = opts.relevance ?? new GoldRelevanceService();
    this.log = opts.logger ?? consoleLogger;
    this.now = opts.now ?? (() => new Date());
    this.sources = opts.sources?.length ? opts.sources : ["forexfactory", "metalsmine"];
  }

  async getNormalizedWeek(): Promise<ForexFactoryEvent[]> {
    this.inflight ??= this.refresh().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async fetchFeed(source: FeedSource) {
    const json =
      source === "metalsmine"
        ? await this.opts.client.fetchMetalsExport()
        : await this.opts.client.fetchWeekExport();
    return parseExport(json, source);
  }

  private async refresh(): Promise<ForexFactoryEvent[]> {
    const results = await Promise.allSettled(this.sources.map((s) => this.fetchFeed(s)));
    const feeds: Record<FeedSource, Awaited<ReturnType<typeof this.fetchFeed>>["events"]> = {
      forexfactory: [],
      metalsmine: [],
    };
    let skipped = 0;
    let succeeded = 0;

    results.forEach((r, i) => {
      const source = this.sources[i]!;
      if (r.status === "fulfilled") {
        feeds[source] = r.value.events;
        skipped += r.value.skipped;
        succeeded++;
      } else {
        this.log.warn({ source, error: (r.reason as Error).message }, "calendar feed failed");
      }
    });

    if (succeeded === 0) {
      this.log.error({}, "calendar fetch failed for every source");
      throw new ApiError(503, "UPSTREAM_UNAVAILABLE", "Calendar source unavailable; retry later");
    }

    let merged = mergeFeeds(feeds.forexfactory, feeds.metalsmine);
    if (this.opts.enrichActuals && this.sources.includes("forexfactory")) {
      try {
        merged = mergeActuals(merged, parseCalendarHtml(await this.opts.client.fetchWeekHtml()));
      } catch (err) {
        this.log.warn({ error: (err as Error).message }, "actuals enrichment failed; using export only");
      }
    }

    const out = merged.map((e) => ({ ...e, goldRelevance: this.relevance.classify(e) }));
    this.log.info({ events: out.length, skipped, sources: this.sources }, "calendar fetched");
    return out;
  }

  private toApi(e: ForexFactoryEvent): EconomicEvent {
    const released = e.actual !== null;
    return {
      id: e.id,
      datetime: e.datetime,
      time: e.datetime.slice(11, 16),
      currency: e.currency,
      title: e.event,
      impact: e.impact,
      status: released ? "RELEASED" : "UPCOMING",
      actual: e.actual,
      forecast: e.forecast,
      previous: e.previous,
      goldRelevance: e.goldRelevance,
      usdRelevance: e.currency === "USD" ? (e.impact === "low" ? "medium" : "high") : "none",
      source: e.source,
      metalsImpact: e.metalsImpact,
      description: "",
      history: [],
    };
  }

  async getWeek() {
    return (await this.getNormalizedWeek()).map((e) => this.toApi(e));
  }


  async getToday() {
    const d = startOfUtcDay(this.now());
    return (await this.getWeek()).filter((e) => isSameUtcDay(e.datetime, d));
  }

  async getTomorrow() {
    const d = addDays(startOfUtcDay(this.now()), 1);
    return (await this.getWeek()).filter((e) => isSameUtcDay(e.datetime, d));
  }
}
