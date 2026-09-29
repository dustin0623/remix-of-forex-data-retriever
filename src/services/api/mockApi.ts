import { analyzeGold } from "@/lib/ai.functions";
import { fetchRealCalendar } from "@/lib/calendar.functions";
import { mockDashboardAnalysis, mockGoldAnalysis } from "@/mock/analysis";
import * as sim from "@/services/mock/whatIfService";
import { AI_PROVIDERS, currentAiConfig, useSettingsStore } from "@/stores/settingsStore";
import type { EconomicEvent, MarketAnalysis } from "@/types/market";

import { realSnapshot, realTimeline } from "./goldPrice";
import type { MarketApi } from "./types";

/**
 * Direct feed implementation: the baseline is the REAL Forex Factory + MetalsMine
 * calendar (fetched server-side); what-if releases/revisions stay local overrides.
 */

const SNAPSHOT_KEY = "fmi.calendar.snapshot.v1";

export interface BaselineInfo {
  kind: "live" | "cache" | "snapshot" | "synthetic";
  fetchedAt: string | null;
  feeds: { forexfactory: boolean; metalsmine: boolean };
  error: string | null;
}

let baselineInfo: BaselineInfo = { kind: "synthetic", fetchedAt: null, feeds: { forexfactory: false, metalsmine: false }, error: null };
let loading: Promise<void> | null = null;
let loaded = false;

export const getBaselineInfo = () => baselineInfo;

async function loadBaseline(force: boolean) {
  try {
    const res = await fetchRealCalendar({ data: { force } });
    sim.setBaseline(res.events);
    baselineInfo = { kind: res.meta.source, fetchedAt: res.meta.fetchedAt, feeds: res.meta.feeds, error: res.meta.error };
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ events: res.events, fetchedAt: res.meta.fetchedAt, feeds: res.meta.feeds }));
    } catch { /* storage full */ }
  } catch (err) {
    const raw = typeof window !== "undefined" ? localStorage.getItem(SNAPSHOT_KEY) : null;
    if (raw) {
      const snap = JSON.parse(raw) as { events: EconomicEvent[]; fetchedAt: string; feeds: BaselineInfo["feeds"] };
      sim.setBaseline(snap.events);
      baselineInfo = { kind: "snapshot", fetchedAt: snap.fetchedAt, feeds: snap.feeds, error: "Calendar feeds unreachable; using your last saved week." };
    } else {
      baselineInfo = { ...baselineInfo, kind: "synthetic", error: (err as Error).message };
    }
  }
}

async function ensureBaseline() {
  if (typeof window === "undefined" || loaded) return;
  loading ??= loadBaseline(false).finally(() => { loaded = true; loading = null; });
  await loading;
}

/** Pulls the latest real calendar (bypassing the 5-minute cache) and clears what-if overrides. */
export async function syncLiveCalendar() {
  await loadBaseline(true);
  loaded = true;
  sim.resetWhatIf();
}

const wrap = <T>(fn: () => T) => ensureBaseline().then(fn);

async function aiGoldAnalysis(subject: "dashboard" | "gold"): Promise<MarketAnalysis> {
  const cfg = currentAiConfig();
  const fallback = subject === "gold" ? mockGoldAnalysis : mockDashboardAnalysis;
  if (!cfg) return { ...fallback, bias: sim.getMarketSnapshot().macroBias };
  const events = sim
    .getWeekEvents()
    .filter((e) => e.goldRelevance === "high" || e.goldRelevance === "medium" || e.feed !== "forexfactory")
    .slice(0, 60)
    .map(({ title, currency, impact, datetime, actual, forecast, previous, goldRelevance }) => ({
      title, currency, impact, datetime, actual, forecast, previous, goldRelevance,
    }));
  const r = await analyzeGold({ data: { ...cfg, events } });
  return {
    id: `ai-${subject}-${Date.now()}`,
    subject: `XAUUSD — ${AI_PROVIDERS[cfg.provider].label} (${cfg.model})`,
    bias: r.bias,
    confidence: r.confidence / 100,
    summary: r.summary,
    keyDrivers: r.keyDrivers,
    mainRisks: r.mainRisks,
    usdContext: r.usdContext,
    scenarios: r.scenarios.map((s) => ({ ...s, probability: s.probability / 100 })),
    generatedAt: r.generatedAt,
    sample: false,
  };
}

export const mockApi: MarketApi = {
  getCalendar: (range = "all") =>
    wrap(() =>
      range === "today"
        ? sim.getTodayEvents()
        : range === "tomorrow"
          ? sim.getTomorrowEvents()
          : range === "week"
            ? sim.getWeekEvents()
            : sim.getAllEvents(),
    ),
  getEvent: (id) => wrap(() => sim.getEvent(id)),
  getChanges: () => wrap(() => sim.getChanges()),
  getMarketAnalysis: (subject) => ensureBaseline().then(() => aiGoldAnalysis(subject)),
  // Never fall back to synthetic prices: a failed feed surfaces as an error state.
  getMarketSnapshot: () => ensureBaseline().then(() => realSnapshot(sim.getTodayEvents())),
  getMarketTimeline: () => ensureBaseline().then(() => realTimeline(sim.getChanges())),
  getStatus: () =>
    ensureBaseline().then(() => {
      const cfg = currentAiConfig();
      const provider = useSettingsStore.getState().aiProvider;
      return {
        environment: "direct" as const,
        apiMode: "Direct" as const,
        aiProvider: cfg ? AI_PROVIDERS[provider].label : "none",
        aiConnected: Boolean(cfg),
        scraperConnected: baselineInfo.kind === "live" || baselineInfo.kind === "cache",
        version: "sim-real-baseline",
        uptimeSeconds: 0,
      };
    }),
  whatIfRelease: (id) => wrap(() => sim.whatIfEventRelease(id)),
  whatIfUpdate: (id) => wrap(() => sim.whatIfEventUpdate(id)),
  resetWhatIf: () => wrap(() => sim.resetWhatIf()),
};
