import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/api/app.js";
import { loadConfig } from "../src/config/env.js";
import { openDatabase } from "../src/database/db.js";
import { SqliteEventRepository } from "../src/database/repository.js";
import type { EconomicEvent } from "../src/models/schemas.js";
import type { CalendarProvider } from "../src/scraper/CalendarProvider.js";
import { CalendarService } from "../src/services/calendarService.js";
import { ChangeDetectionService, contentHash } from "../src/services/changeDetectionService.js";
import { ApiError } from "../src/utils/response.js";

const base = (over: Partial<EconomicEvent> = {}): EconomicEvent => ({
  id: "usd-core-pce-2026-09-30",
  datetime: "2026-09-30T12:30:00.000Z",
  time: "12:30",
  currency: "USD",
  title: "Core PCE Price Index m/m",
  impact: "high",
  status: "UPCOMING",
  actual: null,
  forecast: "0.2%",
  previous: "0.3%",
  goldRelevance: "very_high",
  usdRelevance: "high",
  source: "forexfactory",
  description: "",
  history: [],
  ...over,
});
const other = (over: Partial<EconomicEvent> = {}) =>
  base({ id: "aud-retail-sales-2026-09-30", currency: "AUD", title: "Retail Sales m/m", impact: "medium", goldRelevance: "low", usdRelevance: "none", ...over });

class FakeProvider implements CalendarProvider {
  readonly name = "fake";
  calls = 0;
  fail = false;
  constructor(public events: EconomicEvent[]) {}
  async getWeek() {
    this.calls++;
    if (this.fail) throw new ApiError(503, "UPSTREAM_UNAVAILABLE", "down");
    return this.events;
  }
  async getToday() { return this.getWeek(); }
  async getTomorrow() { return []; }
}

function setup(events: EconomicEvent[]) {
  let t = new Date("2026-09-30T10:00:00Z");
  const clock = { now: () => t, advance: (ms: number) => { t = new Date(t.getTime() + ms); } };
  const repo = new SqliteEventRepository(openDatabase(":memory:"));
  const detector = new ChangeDetectionService(repo, clock.now);
  return { repo, detector, clock, events };
}

describe("contentHash", () => {
  it("is deterministic and ignores non-content fields", () => {
    expect(contentHash(base())).toBe(contentHash(base({ title: "renamed", description: "x", goldRelevance: "low" })));
    expect(contentHash(base())).not.toBe(contentHash(base({ forecast: "0.3%" })));
  });
});

describe("ChangeDetectionService", () => {
  it("identical data creates no changes or extra snapshots", () => {
    const { repo, detector, clock } = setup([]);
    detector.sync([base()]);
    clock.advance(60_000);
    const r = detector.sync([base()]);
    expect(r).toMatchObject({ inserted: 0, unchanged: 1, updated: 0, changes: 0 });
    expect(repo.queryChanges({ limit: 50 })).toHaveLength(0);
    expect(repo.listSnapshots(base().id)).toHaveLength(1);
    expect(repo.findById(base().id)!.lastSeenAt).toBe("2026-09-30T10:01:00.000Z");
  });

  it("detects actual release, then revision", () => {
    const { repo, detector, clock } = setup([]);
    detector.sync([base()]);
    clock.advance(1000);
    const r = detector.sync([base({ actual: "0.4%" })]);
    expect(r.changes).toBe(1);
    expect(r.events[0]!.status).toBe("RELEASED");
    clock.advance(1000);
    const r2 = detector.sync([base({ actual: "0.5%" })]);
    expect(r2.events[0]!.status).toBe("UPDATED");
    const types = repo.queryChanges({ limit: 50 }).map((c) => c.changeType);
    expect(types).toEqual(["actual_revised", "actual_released"]);
    expect(repo.listSnapshots(base().id)).toHaveLength(3);
    expect(repo.findById(base().id)!.event.actual).toBe("0.5%");
  });

  it("detects forecast, previous, impact and datetime changes", () => {
    const { repo, detector } = setup([]);
    detector.sync([base()]);
    detector.sync([base({ forecast: "0.1%", previous: "0.2%", impact: "medium", datetime: "2026-09-30T14:00:00.000Z" })]);
    const byType = Object.fromEntries(repo.queryChanges({ limit: 50 }).map((c) => [c.changeType, c]));
    expect(byType["forecast_changed"]).toMatchObject({ oldValue: "0.2%", newValue: "0.1%" });
    expect(byType["previous_changed"]).toMatchObject({ oldValue: "0.3%", newValue: "0.2%" });
    expect(byType["impact_changed"]).toMatchObject({ oldValue: "high", newValue: "medium" });
    expect(byType["event_updated"]).toBeDefined();
  });

  it("prevents duplicate snapshots and changes for the same content", () => {
    const { repo, detector } = setup([]);
    detector.sync([base()]);
    detector.sync([base({ previous: "0.4%" })]);
    // Flip back and forth: returning to a previous hash must not duplicate its snapshot.
    detector.sync([base()]);
    detector.sync([base({ previous: "0.4%" })]);
    const snaps = repo.listSnapshots(base().id);
    expect(new Set(snaps.map((s) => s.contentHash)).size).toBe(snaps.length);
    expect(snaps).toHaveLength(2);
    const changes = repo.queryChanges({ limit: 50 });
    const keys = changes.map((c) => `${c.contentHash}:${c.changeType}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("CalendarService cache", () => {
  const make = (events: EconomicEvent[]) => {
    const s = setup(events);
    const provider = new FakeProvider(events);
    const service = new CalendarService(provider, s.repo, { minIntervalMs: 900_000, now: s.clock.now });
    return { ...s, provider, service };
  };

  it("does not refetch within the minimum interval", async () => {
    const { provider, service, clock } = make([base(), other()]);
    expect((await service.week()).meta).toMatchObject({ source: "live", stale: false });
    await service.today();
    await service.highImpact();
    clock.advance(899_000);
    expect((await service.week()).meta).toMatchObject({ source: "cache", stale: false });
    expect(provider.calls).toBe(1);
    clock.advance(2_000);
    await service.week();
    expect(provider.calls).toBe(2);
  });

  it("serves stale cached data when the scraper fails, and throttles retries", async () => {
    const { provider, service, clock } = make([base()]);
    await service.week();
    provider.fail = true;
    clock.advance(900_000);
    const r = await service.week();
    expect(r.meta).toMatchObject({ source: "cache", stale: true });
    expect(r.data).toHaveLength(1);
    await service.week();
    expect(provider.calls).toBe(2); // failed attempt also starts the interval
    expect(service.status().nextAllowedScrapeAt).toBe("2026-09-30T10:30:00.000Z");
  });

  it("falls back to persisted events after a restart when upstream is down", async () => {
    const { repo, clock } = make([base()]);
    await new CalendarService(new FakeProvider([base()]), repo, { minIntervalMs: 900_000, now: clock.now }).week();
    const down = new FakeProvider([]);
    down.fail = true;
    const r = await new CalendarService(down, repo, { minIntervalMs: 900_000, now: clock.now }).week();
    expect(r.meta).toMatchObject({ source: "cache", stale: true });
    expect(r.data.map((e) => e.id)).toEqual([base().id]);
  });

  it("throws 503 when upstream fails with nothing cached", async () => {
    const { provider, service } = make([]);
    provider.fail = true;
    await expect(service.week()).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("API: changes, history, stale meta", () => {
  let app: FastifyInstance;
  afterEach(async () => { await app.close(); });

  async function boot(provider: FakeProvider, clock: { now: () => Date }) {
    const config = loadConfig({ DATABASE_URL: ":memory:" });
    app = await buildApp({ config, provider, now: clock.now });
    return (url: string) => app.inject({ method: "GET", url }).then((r) => ({ status: r.statusCode, body: r.json() }));
  }

  it("filters changes and returns event history", async () => {
    const { clock } = setup([]);
    const provider = new FakeProvider([base(), other()]);
    const get = await boot(provider, clock);
    await get("/api/calendar/week");
    provider.events = [base({ actual: "0.4%" }), other({ actual: "0.1%" })];
    clock.advance(900_000);
    const week = await get("/api/calendar/week");
    expect(week.body.meta).toMatchObject({ source: "live", stale: false });

    expect((await get("/api/changes")).body.data).toHaveLength(2);
    const hi = await get("/api/changes?impact=high&goldRelevant=true");
    expect(hi.body.data.map((c: { eventId: string }) => c.eventId)).toEqual([base().id]);
    expect((await get("/api/changes?currency=aud")).body.data).toHaveLength(1);
    expect((await get("/api/changes?since=2030-01-01T00:00:00Z")).body.data).toHaveLength(0);
    expect((await get("/api/changes?until=2020-01-01T00:00:00Z")).body.data).toHaveLength(0);
    expect((await get("/api/changes?limit=1")).body.data).toHaveLength(1);
    expect((await get("/api/changes?impact=extreme")).status).toBe(400);

    const h = await get(`/api/events/${base().id}/history`);
    expect(h.status).toBe(200);
    expect(h.body.data.snapshots).toHaveLength(2);
    expect(h.body.data.changes[0]).toMatchObject({ changeType: "actual_released", newValue: "0.4%" });
    expect((await get("/api/events/usd-nope/history")).status).toBe(404);

    const status = (await get("/api/status")).body;
    expect(status).toMatchObject({ provider: "fake", cachedEvents: 2, recentChanges: 2 });
  });

  it("returns stale cache metadata when the scraper fails", async () => {
    const { clock } = setup([]);
    const provider = new FakeProvider([base()]);
    const get = await boot(provider, clock);
    await get("/api/calendar/week");
    provider.fail = true;
    clock.advance(900_000);
    const r = await get("/api/calendar/week");
    expect(r.status).toBe(200);
    expect(r.body.meta).toMatchObject({ source: "cache", stale: true });
    expect(r.body.data).toHaveLength(1);
  });
});
