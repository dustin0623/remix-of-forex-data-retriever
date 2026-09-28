import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { EconomicEventSchema } from "../src/models/schemas.js";
import { createProvider } from "../src/scraper/createProvider.js";
import { MockCalendarProvider } from "../src/scraper/MockCalendarProvider.js";
import { ForexFactoryClient, UpstreamError } from "../src/scraper/forexFactory/ForexFactoryClient.js";
import {
  buildEventId, mergeActuals, normalizeImpact, parseCalendarHtml, parseExport,
} from "../src/scraper/forexFactory/ForexFactoryParser.js";
import { ForexFactoryProvider } from "../src/scraper/forexFactory/ForexFactoryProvider.js";
import type { ScraperLogger } from "../src/scraper/forexFactory/types.js";
import { GoldRelevanceService } from "../src/services/goldRelevanceService.js";

const exportJson = JSON.parse(readFileSync(new URL("./fixtures/ff_export.json", import.meta.url), "utf8"));
const html = readFileSync(new URL("./fixtures/ff_calendar.html", import.meta.url), "utf8");
const silent: ScraperLogger = { info() {}, warn() {}, error() {} };

describe("ForexFactoryParser", () => {
  it("parses the export, normalizing whitespace, impact and UTC dates", () => {
    const { events, skipped } = parseExport(exportJson);
    expect(skipped).toBe(2);
    expect(events).toHaveLength(5);
    const nfp = events.find((e) => e.event === "Non-Farm Employment Change")!;
    expect(nfp.datetime).toBe("2026-10-02T12:30:00.000Z");
    expect(nfp.impact).toBe("high");
    const cpi = events.find((e) => e.currency === "EUR")!;
    expect(cpi.previous).toBeNull();
    expect(cpi.actual).toBeNull();
    expect(events.find((e) => e.currency === "CNY")!.impact).toBe("low");
  });

  it("returns empty for non-array input", () => {
    expect(parseExport({ nope: true }).events).toEqual([]);
  });

  it("builds deterministic ids independent of order", () => {
    const a = parseExport(exportJson).events.map((e) => e.id);
    const b = parseExport([...exportJson].reverse()).events.map((e) => e.id).reverse();
    expect(a).toEqual(b);
    expect(buildEventId("USD", "CPI m/m", "2026-10-14T12:30:00.000Z"))
      .toBe(buildEventId("usd", "  CPI   m/m ", "2026-10-14T12:30:00.000Z"));
    expect(a[0]).toMatch(/^ff-2026-09-30-usd-[0-9a-f]{10}$/);
  });

  it("parses HTML rows gracefully, inheriting currency and skipping empty rows", () => {
    const rows = parseCalendarHtml(html);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ currency: "EUR", event: "German Prelim CPI m/m", actual: "0.3%" });
    expect(rows[2]).toMatchObject({ currency: "USD", actual: null, forecast: null, previous: null });
  });

  it("merges actuals from HTML onto export events", () => {
    const merged = mergeActuals(parseExport(exportJson).events, parseCalendarHtml(html));
    expect(merged.find((e) => e.event.startsWith("Core PCE"))!.actual).toBe("0.4%");
    expect(merged.find((e) => e.currency === "EUR")!.previous).toBe("0.2%");
    expect(merged.find((e) => e.event.startsWith("Non-Farm"))!.actual).toBeNull();
  });

  it("normalizes impact labels and icon classes", () => {
    expect(normalizeImpact("High")).toBe("high");
    expect(normalizeImpact("icon--ff-impact-ora")).toBe("medium");
    expect(normalizeImpact("Non-Economic")).toBe("low");
  });
});

describe("GoldRelevanceService", () => {
  const svc = new GoldRelevanceService();
  it.each([
    ["CPI m/m", "USD", "high", "very_high"],
    ["Core PCE Price Index m/m", "USD", "high", "very_high"],
    ["Non-Farm Employment Change", "USD", "high", "very_high"],
    ["FOMC Statement", "USD", "high", "very_high"],
    ["Fed Chair Powell Speaks", "USD", "high", "very_high"],
    ["Unemployment Claims", "USD", "high", "very_high"],
    ["FOMC Member Bowman Speaks", "USD", "low", "high"],
    ["German Prelim CPI m/m", "EUR", "medium", "low"],
    ["Retail Sales m/m", "AUD", "high", "medium"],
  ] as const)("%s (%s) -> %s", (event, currency, impact, expected) => {
    expect(svc.classify({ event, currency, impact })).toBe(expected);
  });

  it("accepts custom rules", () => {
    const custom = new GoldRelevanceService([{ name: "x", pattern: /bank holiday/i, relevance: "very_high" }]);
    expect(custom.classify({ event: "Bank Holiday", currency: "CNY", impact: "low" })).toBe("very_high");
  });
});

function fakeClient(opts: { exportFail?: boolean; htmlFail?: boolean; metalsFail?: boolean } = {}) {
  return {
    fetchWeekExport: vi.fn(async () => {
      if (opts.exportFail) throw new UpstreamError("down", 503);
      return exportJson;
    }),
    fetchMetalsExport: vi.fn(async () => {
      if (opts.metalsFail) throw new UpstreamError("down", 503);
      return metalsJson;
    }),
    fetchWeekHtml: vi.fn(async () => {
      if (opts.htmlFail) throw new UpstreamError("blocked", 403);
      return html;
    }),
  } as unknown as ForexFactoryClient & {
    fetchWeekExport: ReturnType<typeof vi.fn>;
    fetchMetalsExport: ReturnType<typeof vi.fn>;
    fetchWeekHtml: ReturnType<typeof vi.fn>;
  };
}

describe("ForexFactoryProvider", () => {
  it("fetches upstream on each call (caching lives in CalendarService)", async () => {
    const client = fakeClient();
    const p = new ForexFactoryProvider({ client, enrichActuals: true, logger: silent, now: () => new Date("2026-09-30T15:00:00Z") });
    await p.getWeek();
    await p.getWeek();
    expect(client.fetchWeekExport).toHaveBeenCalledTimes(2);
  });

  it("maps to valid API events with relevance applied", async () => {
    const p = new ForexFactoryProvider({ client: fakeClient(), minIntervalMs: 900_000, enrichActuals: true, logger: silent, now: () => new Date("2026-09-30T15:00:00Z") });
    const week = await p.getWeek();
    for (const e of week) expect(EconomicEventSchema.safeParse(e).success).toBe(true);
    const pce = week.find((e) => e.title.startsWith("Core PCE"))!;
    expect(pce).toMatchObject({ goldRelevance: "very_high", status: "RELEASED", actual: "0.4%" });
    expect((await p.getToday()).every((e) => e.datetime.startsWith("2026-09-30"))).toBe(true);
  });

  it("falls back to export-only data when HTML is blocked", async () => {
    const p = new ForexFactoryProvider({ client: fakeClient({ htmlFail: true }), minIntervalMs: 900_000, enrichActuals: true, logger: silent });
    const week = await p.getWeek();
    expect(week).toHaveLength(5);
    expect(week.every((e) => e.actual === null)).toBe(true);
  });

  it("throws a clean 503 when upstream fails", async () => {
    const p = new ForexFactoryProvider({ client: fakeClient({ exportFail: true }), minIntervalMs: 900_000, enrichActuals: false, logger: silent });
    await expect(p.getWeek()).rejects.toMatchObject({ statusCode: 503, code: "UPSTREAM_UNAVAILABLE" });
  });
});

describe("ForexFactoryClient", () => {
  const base = { exportUrl: "https://example.test/x.json", htmlUrl: "https://example.test/c", userAgent: "t", timeoutMs: 1000, baseDelayMs: 100, logger: silent };

  it("retries with exponential backoff then succeeds", async () => {
    const sleeps: number[] = [];
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(Response.json([{ ok: 1 }]));
    const c = new ForexFactoryClient({ ...base, maxRetries: 3, fetchImpl, sleep: async (ms) => { sleeps.push(ms); } });
    expect(await c.fetchWeekExport()).toEqual([{ ok: 1 }]);
    expect(sleeps).toEqual([100, 200]);
  });

  it("does not retry non-retryable statuses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
    const c = new ForexFactoryClient({ ...base, maxRetries: 3, fetchImpl, sleep: async () => {} });
    await expect(c.fetchWeekHtml()).rejects.toBeInstanceOf(UpstreamError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("provider selection", () => {
  it("defaults to mock", () => {
    expect(createProvider(loadConfig({}))).toBeInstanceOf(MockCalendarProvider);
  });
  it("selects the combined Fair Economy provider via CALENDAR_PROVIDER", () => {
    expect(createProvider(loadConfig({ CALENDAR_PROVIDER: "forexfactory" }), silent).name).toBe("faireconomy");
  });
  it("reads the enabled sources from SCRAPER_SOURCES", () => {
    expect(loadConfig({}).scraper.sources).toEqual(["forexfactory", "metalsmine"]);
    expect(loadConfig({ SCRAPER_SOURCES: "metalsmine" }).scraper.sources).toEqual(["metalsmine"]);
  });
  it("uses mock when scraper is disabled", () => {
    expect(createProvider(loadConfig({ CALENDAR_PROVIDER: "forexfactory", SCRAPER_ENABLED: "false" }))).toBeInstanceOf(MockCalendarProvider);
  });
  it("rejects intervals below one minute", () => {
    expect(() => loadConfig({ SCRAPER_MIN_INTERVAL_MS: "1000" })).toThrow();
  });
});
