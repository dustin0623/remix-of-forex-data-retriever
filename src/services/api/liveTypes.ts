/** Response shapes of the independent /scrapper API (see scrapper/src/models + src/ai/schemas). */

export type LiveImpact = "low" | "medium" | "high";
export type LiveRelevance = "none" | "low" | "medium" | "high" | "very_high";

export interface LiveEvent {
  id: string;
  datetime: string;
  time: string;
  currency: string;
  title: string;
  impact: LiveImpact;
  status: "UPCOMING" | "RELEASED" | "UPDATED";
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  goldRelevance: LiveRelevance;
  usdRelevance: LiveRelevance;
  /** Feed attribution: "forexfactory", "metalsmine" or "both". */
  source: string;
  metalsImpact?: LiveImpact | null;
  description: string;
  history: { period: string; actual: string; forecast: string | null }[];
}

export type LiveChangeType =
  | "actual_released"
  | "actual_revised"
  | "forecast_changed"
  | "previous_changed"
  | "impact_changed"
  | "event_updated";

export interface LiveChange {
  id: string;
  eventId: string;
  eventTitle: string;
  currency: string;
  impact: LiveImpact;
  goldRelevance: LiveRelevance;
  changeType: LiveChangeType;
  oldValue: string | null;
  newValue: string | null;
  detectedAt: string;
  contentHash: string;
}

export interface LiveSnapshot {
  id: number;
  eventId: string;
  contentHash: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  impact: LiveImpact;
  capturedAt: string;
}

export interface LiveEventHistory {
  event: LiveEvent;
  snapshots: LiveSnapshot[];
  changes: LiveChange[];
}

export interface LiveStatus {
  status: "ok";
  scraper: boolean;
  ai: boolean;
  aiProvider: string;
  aiModel: string;
  provider: string;
  lastScrapeAt: string | null;
  nextAllowedScrapeAt: string | null;
  cachedEvents: number;
  recentChanges: number;
}

export interface LiveMeta {
  source: "live" | "cache";
  stale: boolean;
  fetchedAt: string | null;
}

export interface LiveAnalysis {
  market: "XAUUSD";
  bias: "bullish" | "bearish" | "neutral";
  confidence: "low" | "moderate" | "high";
  riskLevel: "low" | "medium" | "high";
  summary: string;
  keyDrivers: string[];
  keyEvents: { eventId: string | null; title: string; currency: string | null; impact: LiveImpact | null; whyItMatters: string }[];
  bullishScenario: string;
  bearishScenario: string;
  neutralScenario: string;
  warnings: string[];
  masterPost: string;
  eventAnalysis?: {
    actual: string | null;
    forecast: string | null;
    previous: string | null;
    surpriseDirection: "above_forecast" | "below_forecast" | "in_line" | "not_released" | "unknown";
    macroImplication: string;
    goldContext: string;
  } | null;
}

export interface LiveAnalysisMeta {
  aiProvider: string;
  model: string;
  generatedAt: string;
}

export interface LiveResult<T, M = LiveMeta | undefined> {
  data: T;
  meta: M;
}
