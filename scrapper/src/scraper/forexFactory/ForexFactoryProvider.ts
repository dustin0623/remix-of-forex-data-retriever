import type { EconomicEvent } from "../../models/schemas.js";
import { GoldRelevanceService } from "../../services/goldRelevanceService.js";
import { ApiError } from "../../utils/response.js";
import { addDays, isSameUtcDay, startOfUtcDay } from "../../utils/dates.js";
import type { CalendarProvider } from "../CalendarProvider.js";
import type { ForexFactoryClient } from "./ForexFactoryClient.js";
import { mergeActuals, parseCalendarHtml, parseExport } from "./ForexFactoryParser.js";
import { consoleLogger, type ForexFactoryEvent, type ScraperLogger } from "./types.js";

export interface ForexFactoryProviderOptions {
  client: ForexFactoryClient;
  /** @deprecated throttling moved to CalendarCache; ignored. */
  minIntervalMs?: number;
  /** Also fetch the HTML calendar to fill in actual values (export has none). */
  enrichActuals: boolean;
  relevance?: GoldRelevanceService;
  logger?: ScraperLogger;
  now?: () => Date;
}

/**
 * Stateless apart from in-flight de-duplication: every call hits upstream.
 * Caching, throttling and stale fallback live in CalendarService/CalendarCache.
 */
export class ForexFactoryProvider implements CalendarProvider {
  readonly name = "forexfactory";
  private inflight: Promise<ForexFactoryEvent[]> | null = null;
  private readonly relevance: GoldRelevanceService;
  private readonly log: ScraperLogger;
  private readonly now: () => Date;

  constructor(private readonly opts: ForexFactoryProviderOptions) {
    this.relevance = opts.relevance ?? new GoldRelevanceService();
    this.log = opts.logger ?? consoleLogger;
    this.now = opts.now ?? (() => new Date());
  }

  async getNormalizedWeek(): Promise<ForexFactoryEvent[]> {
    this.inflight ??= this.refresh().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async refresh(): Promise<ForexFactoryEvent[]> {
    try {
      const { events, skipped } = parseExport(await this.opts.client.fetchWeekExport());
      let merged = events;
      if (this.opts.enrichActuals) {
        try {
          merged = mergeActuals(events, parseCalendarHtml(await this.opts.client.fetchWeekHtml()));
        } catch (err) {
          this.log.warn({ error: (err as Error).message }, "actuals enrichment failed; using export only");
        }
      }
      const out = merged.map((e) => ({ ...e, goldRelevance: this.relevance.classify(e) }));
      this.log.info({ events: out.length, skipped }, "calendar fetched");
      return out;
    } catch (err) {
      this.log.error({ error: (err as Error).message }, "calendar fetch failed");
      throw new ApiError(503, "UPSTREAM_UNAVAILABLE", "Calendar source unavailable; retry later");
    }
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
      source: "forexfactory",
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
