import { describe, expect, it } from "vitest";
import { buildApp } from "../src/api/app.js";
import { CotService, parseCotHtml } from "../src/services/cotService.js";
import { loadConfig } from "../src/config/env.js";

const HTML = `<script>var dataGraph = [
{date: new Date(2026, 8, 15), open: 4000, high: 4100, low: 3950, close: 4050, Commercial: -250000, NonCommercial: 200000, NonRept: 50000, OpenInterest: 500000, Cot: 30},
{date: new Date(2026, 8, 22), open: 4050, high: 4200, low: 4020, close: 4150, Commercial: -240000, NonCommercial: 190000, NonRept: 50000, OpenInterest: 510000, Cot: 85}
];</script>`;

const okFetch = (async () => new Response(HTML)) as unknown as typeof fetch;
const badFetch = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;

describe("COT parser", () => {
  it("parses the embedded dataGraph", () => {
    const w = parseCotHtml(HTML);
    expect(w).toHaveLength(2);
    expect(w[1]).toMatchObject({ date: "2026-09-22", commercialNet: -240000, cotIndex: 85 });
  });
});

describe("CotService", () => {
  it("builds a report with week change and signal", async () => {
    const r = await new CotService(okFetch).getGold();
    expect(r.signal).toBe("accumulation");
    expect(r.bias).toBe("bullish");
    expect(r.weekChange?.commercialNet).toBe(10000);
  });
  it("serves stale cache when the source fails", async () => {
    let t = 0; let f = okFetch;
    const svc = new CotService(((...a: Parameters<typeof fetch>) => f(...a)) as typeof fetch, () => t);
    await svc.getGold();
    f = badFetch; t = 2 * 60 * 60_000;
    expect((await svc.getGold()).stale).toBe(true);
  });
});

describe("GET /api/cot/gold", () => {
  it("returns the report, or 502 when unavailable", async () => {
    const config = loadConfig({ DATABASE_URL: ":memory:", CALENDAR_PROVIDER: "mock" } as NodeJS.ProcessEnv);
    const app = await buildApp({ config, cotService: new CotService(okFetch), aiProvider: null });
    const res = await app.inject({ method: "GET", url: "/api/cot/gold" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.latest.cotIndex).toBe(85);
    await app.close();
    const bad = await buildApp({ config, cotService: new CotService(badFetch), aiProvider: null });
    const r2 = await bad.inject({ method: "GET", url: "/api/cot/gold" });
    expect(r2.statusCode).toBe(502);
    expect(r2.json().error.code).toBe("COT_UNAVAILABLE");
    await bad.close();
  });
});
