import type { Currency, EconomicEvent, EventChange, EventSource, Relevance } from "@/types/market";

import type { ScrapperClient } from "./apiClient";
import type { LiveChange, LiveEvent, LiveRelevance } from "./liveTypes";
import { realSnapshot, realTimeline } from "./goldPrice";
import type { MarketApi } from "./types";

const rel = (r: LiveRelevance): Relevance => (r === "very_high" ? "high" : r);

export const toEvent = (e: LiveEvent): EconomicEvent => ({
  ...e,
  currency: e.currency as Currency,
  goldRelevance: rel(e.goldRelevance),
  usdRelevance: rel(e.usdRelevance),
  feed: (e.source === "metalsmine" || e.source === "both" ? e.source : "forexfactory") as EventSource,
  metalsImpact: e.metalsImpact ?? null,
});

const FIELD: Record<LiveChange["changeType"], EventChange["field"]> = {
  actual_released: "actual",
  actual_revised: "actual",
  forecast_changed: "forecast",
  previous_changed: "previous",
  impact_changed: "impact",
  event_updated: "datetime",
};

export const toChange = (c: LiveChange): EventChange => ({
  id: c.id,
  eventId: c.eventId,
  eventTitle: c.eventTitle,
  changeType: c.changeType,
  field: FIELD[c.changeType],
  previousValue: c.oldValue,
  newValue: c.newValue,
  detectedAt: c.detectedAt,
});

/** Thrown for data the /scrapper API does not provide (price feed, simulated analysis). */
export class NotInLiveModeError extends Error {
  constructor(what: string) {
    super(`${what} is not available from the live API.`);
    this.name = "NotInLiveModeError";
  }
}

export function createLiveMarketApi(client: ScrapperClient): MarketApi {
  const simOnly = () => Promise.reject(new Error("Simulation controls are disabled in Live API mode."));
  return {
    getCalendar: async (range = "all") => {
      const r =
        range === "today" ? await client.getTodayCalendar()
          : range === "tomorrow" ? await client.getTomorrowCalendar()
            : await client.getWeekCalendar();
      return r.data.map(toEvent);
    },
    getEvent: async (id) => {
      try {
        return toEvent(await client.getEvent(id));
      } catch (err) {
        if ((err as { kind?: string }).kind === "not_found") return null;
        throw err;
      }
    },
    getChanges: async () => (await client.getChanges({ limit: 50 })).map(toChange),
    getMarketAnalysis: () => Promise.reject(new NotInLiveModeError("Simulated analysis")),
    getMarketSnapshot: async () => {
      const today = await client.getTodayCalendar().then((r) => r.data.map(toEvent)).catch(() => []);
      return realSnapshot(today);
    },
    getMarketTimeline: async () => {
      const changes = await client.getChanges({ limit: 50 }).then((c) => c.map(toChange)).catch(() => []);
      return realTimeline(changes);
    },
    getStatus: async () => {
      const s = await client.getStatus();
      return {
        environment: "live",
        apiMode: "Connected",
        aiProvider: s.ai ? `${s.aiProvider} (${s.aiModel})` : "Not configured",
        aiConnected: s.ai,
        scraperConnected: s.scraper,
        version: s.provider,
        uptimeSeconds: 0,
      };
    },
    whatIfRelease: simOnly,
    whatIfUpdate: simOnly,
    resetWhatIf: simOnly,
  };
}
