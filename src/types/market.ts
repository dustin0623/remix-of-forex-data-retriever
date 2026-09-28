export type Impact = "low" | "medium" | "high";
export type Currency = "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "CHF" | "NZD" | "CNY";
export type Relevance = "none" | "low" | "medium" | "high";
export type Bias = "bullish" | "bearish" | "neutral";

/**
 * Field shape intentionally mirrors a Forex Factory calendar row
 * (date, time, currency, impact, event, actual, forecast, previous)
 * so the scraper API in /scrapper can later populate it unchanged.
 */
export interface EconomicEvent {
  id: string;
  /** ISO 8601 timestamp of the scheduled release (UTC). */
  datetime: string;
  /** Display time as published on the calendar, e.g. "14:30" or "All Day". */
  time: string;
  currency: Currency;
  title: string;
  impact: Impact;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  goldRelevance: Relevance;
  usdRelevance: Relevance;
  source: string;
  description: string;
  history: { period: string; actual: string; forecast: string | null }[];
}

export interface MarketSnapshot {
  symbol: string;
  price: number;
  changeAbsolute: number;
  changePercent: number;
  macroBias: Bias;
  riskLevel: "low" | "elevated" | "high";
  highImpactEventCount: number;
  updatedAt: string;
}

export interface Scenario {
  type: Bias;
  title: string;
  probability: number;
  trigger: string;
  outcome: string;
}

export interface MarketAnalysis {
  id: string;
  subject: string;
  bias: Bias;
  confidence: number;
  summary: string;
  keyDrivers: string[];
  mainRisks: string[];
  usdContext: string;
  scenarios: Scenario[];
  generatedAt: string;
  simulated: true;
}

export interface ApiStatus {
  environment: "simulation" | "live";
  apiMode: "Simulated" | "Connected";
  aiProvider: string;
  aiConnected: boolean;
  scraperConnected: boolean;
  version: string;
  uptimeSeconds: number;
}

export interface EventChange {
  id: string;
  eventId: string;
  eventTitle: string;
  field: "actual" | "forecast" | "previous";
  from: string | null;
  to: string | null;
  detectedAt: string;
}
