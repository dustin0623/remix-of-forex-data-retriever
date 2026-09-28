/** npm run scraper:test — fetch Forex Factory once and print a summary (dev only). */
import { loadConfig } from "../config/env.js";
import { ForexFactoryClient } from "../scraper/forexFactory/ForexFactoryClient.js";
import { ForexFactoryProvider } from "../scraper/forexFactory/ForexFactoryProvider.js";

const s = loadConfig().scraper;
const provider = new ForexFactoryProvider({
  client: new ForexFactoryClient({
    exportUrl: s.exportUrl,
    htmlUrl: s.htmlUrl,
    userAgent: s.userAgent,
    timeoutMs: s.timeoutMs,
    maxRetries: s.maxRetries,
    baseDelayMs: s.retryBaseMs,
  }),
  minIntervalMs: s.minIntervalMs,
  enrichActuals: s.enrichActuals,
});

try {
  const events = await provider.getNormalizedWeek();
  const withActual = events.filter((e) => e.actual !== null).length;
  console.log(`\nFetched ${events.length} events (${withActual} with actuals).\n`);
  console.table(
    events
      .filter((e) => e.impact === "high" || e.goldRelevance === "very_high")
      .slice(0, 25)
      .map((e) => ({ datetime: e.datetime, cur: e.currency, event: e.event, impact: e.impact, gold: e.goldRelevance, actual: e.actual, forecast: e.forecast, previous: e.previous })),
  );
} catch (err) {
  console.error("Scraper test failed:", (err as Error).message);
  process.exit(1);
}
