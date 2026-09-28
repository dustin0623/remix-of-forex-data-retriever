import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EconomicEventSchema } from "../src/models/schemas.js";
import { FIXED_NOW, testApp } from "./helpers.js";

let app: FastifyInstance;
beforeEach(async () => { app = await testApp(); });
afterEach(async () => { await app.close(); });

const get = async (url: string) => {
  const res = await app.inject({ method: "GET", url });
  return { status: res.statusCode, body: res.json(), raw: res.body };
};

describe("GET /api/status", () => {
  it("returns status without secrets", async () => {
    const { status, body, raw } = await get("/api/status");
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "ok", scraper: true, ai: false, aiProvider: "anthropic", aiModel: "claude-haiku-4-5", provider: "mock", lastScrapeAt: null, cachedEvents: 0, recentChanges: 0 });
    await get("/api/calendar/week");
    const after = (await get("/api/status")).body;
    expect(after.lastScrapeAt).toBe(FIXED_NOW.toISOString());
    expect(after.nextAllowedScrapeAt).toBe(new Date(FIXED_NOW.getTime() + 900_000).toISOString());
    expect(after.cachedEvents).toBeGreaterThan(0);
    expect(raw).not.toContain("sk-secret-test");
  });
});

describe("calendar endpoints", () => {
  it.each(["today", "tomorrow", "week", "high-impact", "gold-relevant"])("/api/calendar/%s", async (p) => {
    const { status, body } = await get(`/api/calendar/${p}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    for (const e of body.data) expect(EconomicEventSchema.safeParse(e).success).toBe(true);
  });

  it("today only contains today's events", async () => {
    const { body } = await get("/api/calendar/today");
    for (const e of body.data) expect(e.datetime.startsWith("2026-09-30")).toBe(true);
  });

  it("filters high impact and gold relevance", async () => {
    const hi = await get("/api/calendar/high-impact");
    expect(hi.body.data.every((e: { impact: string }) => e.impact === "high")).toBe(true);
    const gold = await get("/api/calendar/gold-relevant");
    expect(gold.body.data.every((e: { goldRelevance: string }) => ["high", "medium"].includes(e.goldRelevance))).toBe(true);
  });
});

describe("event lookup", () => {
  it("finds an event by id", async () => {
    const week = await get("/api/calendar/week");
    const id = week.body.data[0].id;
    const { status, body } = await get(`/api/events/${id}`);
    expect(status).toBe(200);
    expect(body.data.id).toBe(id);
  });

  it("returns 404 for unknown id", async () => {
    const { status, body } = await get("/api/events/usd-does-not-exist");
    expect(status).toBe(404);
    expect(body).toEqual({ success: false, error: { code: "EVENT_NOT_FOUND", message: expect.any(String) } });
  });

  it("returns 400 for malformed id", async () => {
    const { status, body } = await get("/api/events/BAD%20ID!");
    expect(status).toBe(400);
    expect(body.error.code).toBe("INVALID_EVENT_ID");
  });
});

describe("misc", () => {
  it("GET /api/changes returns a list", async () => {
    const { status, body } = await get("/api/changes");
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("unknown routes use the error envelope", async () => {
    const { status, body } = await get("/api/nope");
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });
});
