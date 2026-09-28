import type { AppConfig } from "../config/env.js";
import type { CalendarProvider } from "./CalendarProvider.js";
import { MockCalendarProvider } from "./MockCalendarProvider.js";
import { ForexFactoryClient } from "./forexFactory/ForexFactoryClient.js";
import { ForexFactoryProvider } from "./forexFactory/ForexFactoryProvider.js";
import type { ScraperLogger } from "./forexFactory/types.js";

/** CALENDAR_PROVIDER=forexfactory selects the real source (only if SCRAPER_ENABLED). */
export function createProvider(config: AppConfig, logger?: ScraperLogger): CalendarProvider {
  if (config.calendarProvider !== "forexfactory" || !config.scraperEnabled) {
    return new MockCalendarProvider();
  }
  const s = config.scraper;
  const client = new ForexFactoryClient({
    exportUrl: s.exportUrl,
    htmlUrl: s.htmlUrl,
    userAgent: s.userAgent,
    timeoutMs: s.timeoutMs,
    maxRetries: s.maxRetries,
    baseDelayMs: s.retryBaseMs,
    ...(logger ? { logger } : {}),
  });
  return new ForexFactoryProvider({
    client,
    minIntervalMs: s.minIntervalMs,
    enrichActuals: s.enrichActuals,
    ...(logger ? { logger } : {}),
  });
}
