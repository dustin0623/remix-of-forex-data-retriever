import { describe, expect, it } from "vitest";
import { EconomicEventSchema, EventIdParamSchema, StatusSchema } from "../src/models/schemas.js";
import { MockCalendarProvider } from "../src/scraper/MockCalendarProvider.js";
import { FIXED_NOW } from "./helpers.js";

describe("schemas", () => {
  it("mock provider output validates", async () => {
    const events = await new MockCalendarProvider(() => FIXED_NOW).getWeek();
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) expect(EconomicEventSchema.safeParse(e).success).toBe(true);
  });

  it("rejects bad impact", () => {
    const r = EconomicEventSchema.safeParse({ id: "x", impact: "huge" });
    expect(r.success).toBe(false);
  });

  it("validates status", () => {
    expect(StatusSchema.safeParse({ status: "ok", scraper: true, ai: false, aiProvider: "a", aiModel: "m" }).success).toBe(true);
    expect(StatusSchema.safeParse({ status: "down" }).success).toBe(false);
  });

  it("validates event ids", () => {
    expect(EventIdParamSchema.safeParse({ id: "usd-core-pce-2026-09-30" }).success).toBe(true);
    expect(EventIdParamSchema.safeParse({ id: "Bad ID!" }).success).toBe(false);
  });
});
