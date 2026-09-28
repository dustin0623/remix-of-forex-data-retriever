import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AIError, type AIProvider } from "../src/ai/AIProvider.js";
import { AnthropicProvider, validateAnalysis } from "../src/ai/AnthropicProvider.js";
import type { AnalysisInput, MarketAnalysis } from "../src/ai/schemas/analysis.js";
import { buildApp } from "../src/api/app.js";
import { loadConfig } from "../src/config/env.js";
import { MockCalendarProvider } from "../src/scraper/MockCalendarProvider.js";
import { FIXED_NOW } from "./helpers.js";

const good: MarketAnalysis = {
  market: "XAUUSD", bias: "bullish", confidence: "moderate", riskLevel: "medium",
  summary: "Softer US data may weigh on the dollar.", keyDrivers: ["USD weakness"],
  keyEvents: [{ eventId: null, title: "Core PCE", currency: "USD", impact: "high", whyItMatters: "Fed inflation gauge." }],
  bullishScenario: "A soft print supports gold.", bearishScenario: "A hot print lifts yields.",
  neutralScenario: "In-line data keeps gold ranging.", warnings: ["No XAUUSD price feed available."],
  masterPost: "🟡 GOLD DAILY OUTLOOK\nXAUUSD Macro Bias: Bullish\nGold may react to US inflation data today.",
};

const input: AnalysisInput = {
  task: "gold_today", generatedAt: FIXED_NOW.toISOString(), market: "XAUUSD",
  focusEvent: null, events: [], recentChanges: [], marketSnapshot: null,
};

const KEY = "sk-ant-super-secret";
const toolResponse = (payload: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(payload), { status, headers });
const provider = (fetchImpl: typeof fetch, timeoutMs = 1000) =>
  new AnthropicProvider({ apiKey: KEY, model: "claude-test-model", fetch: fetchImpl, timeoutMs });

describe("validateAnalysis", () => {
  it("accepts a valid analysis", () => expect(validateAnalysis(good)).toEqual(good));
  it("rejects missing/extra fields", () => {
    expect(() => validateAnalysis({ ...good, bias: "up" })).toThrow(AIError);
    expect(() => validateAnalysis({ ...good, entry: 2400 })).toThrow(AIError);
  });
  it.each([
    "BUY gold above 2400", "Place a stop loss at 2380", "take profit near highs",
    "Use 10x leverage", "Entry price 2395", "Reduce position size",
  ])("rejects trading-call language: %s", (text) => {
    expect(() => validateAnalysis({ ...good, masterPost: text })).toThrowError(/trading-call/);
  });
  it("allows descriptive words like selling pressure", () => {
    expect(validateAnalysis({ ...good, summary: "Selling pressure faded as buyers returned today." })).toBeTruthy();
  });
});

describe("AnthropicProvider", () => {
  it("sends the configured model, key header and structured data", async () => {
    const f = vi.fn(async () => toolResponse({ content: [{ type: "tool_use", name: "submit_market_analysis", input: good }] }));
    const out = await provider(f as unknown as typeof fetch).analyze(input);
    expect(out).toEqual(good);
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("claude-test-model");
    expect(body.tool_choice).toEqual({ type: "tool", name: "submit_market_analysis" });
    expect(body.messages[0].content).toContain('"market": "XAUUSD"');
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(KEY);
    expect(JSON.stringify(provider(f as unknown as typeof fetch))).not.toContain(KEY);
  });

  it.each([
    [401, "AI_INVALID_API_KEY"], [429, "AI_RATE_LIMITED"], [504, "AI_TIMEOUT"], [500, "AI_PROVIDER_ERROR"],
  ])("maps HTTP %i to %s", async (status, code) => {
    const f = async () => toolResponse({ error: { message: `bad key ${KEY}` } }, status, { "retry-after": "12" });
    const err = await provider(f as unknown as typeof fetch).analyze(input).catch((e) => e);
    expect(err).toBeInstanceOf(AIError);
    expect(err.code).toBe(code);
    expect(err.message).not.toContain(KEY);
  });

  it("maps aborts to AI_TIMEOUT", async () => {
    const f = (_u: unknown, init: RequestInit) => new Promise<Response>((_, rej) => {
      init.signal!.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
    await expect(provider(f as unknown as typeof fetch, 20).analyze(input)).rejects.toMatchObject({ code: "AI_TIMEOUT" });
  });

  it("maps malformed responses", async () => {
    const noTool = async () => toolResponse({ content: [{ type: "text", text: "hi" }] });
    await expect(provider(noTool as unknown as typeof fetch).analyze(input)).rejects.toMatchObject({ code: "AI_MALFORMED_RESPONSE" });
    const badJson = async () => new Response("not json", { status: 200 });
    await expect(provider(badJson as unknown as typeof fetch).analyze(input)).rejects.toMatchObject({ code: "AI_MALFORMED_RESPONSE" });
  });
});

describe("analyze endpoints", () => {
  let app: FastifyInstance;
  afterEach(async () => { await app.close(); });
  const boot = async (ai: AIProvider | null | undefined, env: Record<string, string> = {}) => {
    const config = loadConfig({ DATABASE_URL: ":memory:", ...env });
    app = await buildApp({ config, provider: new MockCalendarProvider(() => FIXED_NOW), now: () => FIXED_NOW, ...(ai !== undefined ? { aiProvider: ai } : {}) });
    return (url: string) => app.inject({ method: "GET", url });
  };

  it("returns 503 AI_NOT_CONFIGURED without a key, while calendar keeps working", async () => {
    const get = await boot(undefined, { AI_ENABLED: "true", ANTHROPIC_API_KEY: "" });
    for (const url of ["/api/analyze/gold/today", "/api/analyze/event/usd-x", "/api/analyze/gold/event/usd-x"]) {
      const r = await get(url);
      expect(r.statusCode).toBe(503);
      expect(r.json()).toEqual({ success: false, error: { code: "AI_NOT_CONFIGURED", message: "AI analysis is not configured." } });
    }
    expect((await get("/api/calendar/week")).statusCode).toBe(200);
    expect((await get("/api/status")).json().ai).toBe(false);
  });

  it("returns analysis with provider meta", async () => {
    const analyze = vi.fn(async () => good);
    const get = await boot({ name: "anthropic", model: "claude-haiku-4-5", analyze });
    const r = await get("/api/analyze/gold/today");
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ success: true, data: good, meta: { aiProvider: "anthropic", model: "claude-haiku-4-5", generatedAt: FIXED_NOW.toISOString() } });
    const sent = (analyze.mock.calls[0] as unknown as [AnalysisInput])[0];
    expect(sent.events.length).toBeGreaterThan(0);
    expect(sent.marketSnapshot).toBeNull();

    const id = (await get("/api/calendar/week")).json().data[0].id;
    expect((await get(`/api/analyze/event/${id}`)).statusCode).toBe(200);
    expect((await get(`/api/analyze/gold/event/${id}`)).statusCode).toBe(200);
    expect(((analyze.mock.calls[2] as unknown as [AnalysisInput])[0]).focusEvent?.id).toBe(id);
    expect((await get("/api/analyze/event/usd-missing")).statusCode).toBe(404);
  });

  it("surfaces provider errors with safe codes", async () => {
    const get = await boot({ name: "anthropic", model: "m", analyze: async () => { throw new AIError("AI_RATE_LIMITED", "AI provider rate limit reached; retry later.", 30); } });
    const r = await get("/api/analyze/gold/today");
    expect(r.statusCode).toBe(429);
    expect(r.headers["retry-after"]).toBe("30");
    expect(r.json().error.code).toBe("AI_RATE_LIMITED");
  });

  it("rejects provider output with trading calls", async () => {
    const get = await boot({ name: "anthropic", model: "m", analyze: async () => ({ ...good, summary: "SELL now" }) });
    const r = await get("/api/analyze/gold/today");
    expect(r.statusCode).toBe(502);
    expect(r.json().error.code).toBe("AI_MALFORMED_RESPONSE");
  });
});
