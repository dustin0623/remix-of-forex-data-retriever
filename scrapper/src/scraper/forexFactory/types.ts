export type FFImpact = "low" | "medium" | "high";
export type GoldRelevance = "low" | "medium" | "high" | "very_high";

/** Normalized Forex Factory event (the scraper's own output shape). */
export interface ForexFactoryEvent {
  id: string;
  source: "forexfactory";
  event: string;
  currency: string;
  impact: FFImpact;
  /** ISO 8601, UTC. */
  datetime: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  goldRelevance: GoldRelevance;
}

/** Event before relevance is applied — the parser never decides relevance. */
export type ParsedForexFactoryEvent = Omit<ForexFactoryEvent, "goldRelevance">;

/** One row of the official weekly JSON export (ff_calendar_thisweek.json). */
export interface FFExportRow {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

/** Values scraped from the HTML calendar, used only to enrich actuals. */
export interface FFHtmlRow {
  currency: string;
  event: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

export interface ScraperLogger {
  info(obj: object | string, msg?: string): void;
  warn(obj: object | string, msg?: string): void;
  error(obj: object | string, msg?: string): void;
}

export const consoleLogger: ScraperLogger = {
  info: (o, m) => console.info("[scraper]", m ?? "", o),
  warn: (o, m) => console.warn("[scraper]", m ?? "", o),
  error: (o, m) => console.error("[scraper]", m ?? "", o),
};
