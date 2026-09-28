import { buildApp } from "../src/api/app.js";
import { loadConfig } from "../src/config/env.js";
import { MockCalendarProvider } from "../src/scraper/MockCalendarProvider.js";

// Wednesday 12:00 UTC — fixed so results are deterministic.
export const FIXED_NOW = new Date("2026-09-30T12:00:00Z");

export function testApp(env: Record<string, string> = {}) {
  const config = loadConfig({ DATABASE_URL: ":memory:", ANTHROPIC_API_KEY: "sk-secret-test", ...env });
  return buildApp({ config, provider: new MockCalendarProvider(() => FIXED_NOW) });
}
