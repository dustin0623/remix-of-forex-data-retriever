import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { validateAnalysis } from "../src/ai/AnthropicProvider.js";
import { MockAIProvider } from "../src/ai/MockAIProvider.js";
import { buildUserPrompt } from "../src/ai/prompts/goldAnalysis.js";
import type { AnalysisInput, MarketAnalysis } from "../src/ai/schemas/analysis.js";
import { surpriseDirection } from "../src/ai/surprise.js";
import { buildApp } from "../src/api/app.js";
import { loadConfig } from "../src/config/env.js";
import { MockCalendarProvider } from "../src/scraper/MockCalendarProvider.js";
import { FIXED_NOW } from "./helpers.js";

const TRADING_CALLS = [
  /\b(BUY|SELL)\b/, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\b(SL|TP)\b/, /\btake[- ]?profit\b/i, /\bleverage\b/i, /\bposition siz/i,
];
const HYPE = [/will (rise|crash)/i, /guarantee/i, /easy profit/i];

let app: FastifyInstance;
afterEach(async () => { await app?.close(); });

async function boot(env: Record<string, string> = {}) {
  const ai = new MockAIProvider();
  app = await buildApp({
    config: loadConfig({ DATABASE_URL: ":memory:", ...env }),
    provider: new MockCalendarProvider(() => FIXED_NOW),
    now: () => FIXED_NOW,
    aiProvider: ai,
  });
  const get = (url: string) => app.inject({ method: "GET", url }).then((r) => ({ status: r.statusCode, body: r.json() }));
  return { ai, get };
}

describe("surpriseDirection", () => {
  it.each([
    ["0.4%", "0.2%", "above_forecast"], ["152K", "140K", "above_forecast"], ["-1.5%", "-1.2%", "below_forecast"],
    ["3.40%", "3.40%", "in_line"], [null, "0.2%", "not_released"], ["0.4%", null, "unknown"],
    ["0.4%", "140K", "unknown"], ["Hawkish", "0.2%", "unknown"],
  ] as const)("%s vs %s -> %s", (a, f, exp) => expect(surpriseDirection(a, f)).toBe(exp));
});

describe("master post", () => {
  it("gold today returns one masterPost string with the canonical structure", async () => {
    const { get } = await boot();
    const { status, body } = await get("/api/analyze/gold/today");
    expect(status).toBe(200);
    const post: string = body.data.masterPost;
    expect(typeof post).toBe("string");
    expect(Object.keys(body.data).filter((k) => /post/i.test(k))).toEqual(["masterPost"]);
    for (const h of ["🟡 GOLD DAILY OUTLOOK", "XAUUSD Macro Bias:", "Key Events", "Market Context", "Bullish Scenario", "Bearish Scenario", "Risk"]) {
      expect(post).toContain(h);
    }
    expect(post.length).toBeLessThanOrEqual(1500);
    expect(body.data.eventAnalysis).toBeNull();
    expect(body.meta.aiProvider).toBe("mock");
  });

  it("masterPost contains no trading calls or hype in any style", async () => {
    for (const style of ["professional", "concise", "educational"]) {
      const { get, ai } = await boot({ POST_STYLE: style });
      const post: string = (await get("/api/analyze/gold/today")).body.data.masterPost;
      for (const re of [...TRADING_CALLS, ...HYPE]) expect(post).not.toMatch(re);
      expect(ai.calls[0]!.postStyle).toBe(style);
      await app.close();
    }
  });

  it("event analysis returns observed values, server-computed surprise and masterPost", async () => {
    const { get } = await boot();
    const week = (await get("/api/calendar/week")).body.data as Array<{ id: string; actual: string | null; forecast: string | null; previous: string | null }>;
    const released = week.find((e) => e.actual !== null)!;
    const { status, body } = await get(`/api/analyze/event/${released.id}`);
    expect(status).toBe(200);
    expect(body.data.eventAnalysis).toMatchObject({
      actual: released.actual, forecast: released.forecast, previous: released.previous,
      surpriseDirection: surpriseDirection(released.actual, released.forecast),
    });
    expect(body.data.eventAnalysis.macroImplication).toEqual(expect.any(String));
    expect(body.data.eventAnalysis.goldContext).toEqual(expect.any(String));
    expect(body.data.masterPost).toContain("GOLD EVENT UPDATE");
  });

  it("overrides observed values if the model makes them up", async () => {
    const { get, ai } = await boot();
    const orig = ai.analyze.bind(ai);
    ai.analyze = async (i: AnalysisInput) => {
      const r = await orig(i);
      return { ...r, eventAnalysis: { ...r.eventAnalysis!, actual: "999%", surpriseDirection: "above_forecast" } };
    };
    const week = (await get("/api/calendar/week")).body.data as Array<{ id: string; actual: string | null }>;
    const upcoming = week.find((e) => e.actual === null) ?? week[0]!;
    const body = (await get(`/api/analyze/event/${upcoming.id}`)).body;
    expect(body.data.eventAnalysis.actual).toBe(upcoming.actual);
    expect(body.data.eventAnalysis.actual).not.toBe("999%");
  });

  it("the prompt carries style and master-post rules", () => {
    const input = { task: "gold_today", postStyle: "educational", generatedAt: "x", market: "XAUUSD", focusEvent: null, events: [], recentChanges: [], marketSnapshot: null } as AnalysisInput;
    expect(buildUserPrompt(input)).toContain("educational");
  });
});

describe("validation rejects unsafe masterPost", () => {
  const base = async () => {
    const ai = new MockAIProvider();
    return ai.analyze({ task: "gold_today", postStyle: "professional", generatedAt: FIXED_NOW.toISOString(), market: "XAUUSD", focusEvent: null, events: [], recentChanges: [], marketSnapshot: null });
  };
  it.each([
    "BUY XAUUSD now", "SELL below 2380", "Entry price 2395", "Stop loss 2370", "Take profit at 2450",
    "Use 20x leverage", "Position size 2 lots", "Gold will rise tomorrow", "Gold will crash", "Guaranteed move", "Easy profit today",
  ])("rejects: %s", async (bad) => {
    const good: MarketAnalysis = await base();
    expect(() => validateAnalysis(good)).not.toThrow();
    expect(() => validateAnalysis({ ...good, masterPost: `${good.masterPost}\n${bad}` })).toThrow();
  });

  it("rejects an oversized post", async () => {
    const good = await base();
    expect(() => validateAnalysis({ ...good, masterPost: "x".repeat(1501) })).toThrow();
  });
});
