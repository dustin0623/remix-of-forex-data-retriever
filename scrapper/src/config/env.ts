import "dotenv/config";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1).default("./data/forex.db"),
  SCRAPER_ENABLED: bool.default("true"),
  CALENDAR_PROVIDER: z.enum(["mock", "forexfactory"]).default("mock"),
  SCRAPER_MIN_INTERVAL_MS: z.coerce.number().int().min(60_000).default(900_000),
  SCRAPER_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  SCRAPER_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(3),
  SCRAPER_RETRY_BASE_MS: z.coerce.number().int().positive().default(1_000),
  SCRAPER_ENRICH_ACTUALS: bool.default("true"),
  SCRAPER_EXPORT_URL: z.string().url().default("https://nfs.faireconomy.media/ff_calendar_thisweek.json"),
  SCRAPER_HTML_URL: z.string().url().default("https://www.forexfactory.com/calendar?week=this"),
  SCRAPER_METALS_EXPORT_URL: z.string().url().default("https://nfs.faireconomy.media/mm_calendar_thisweek.json"),
  SCRAPER_SOURCES: z
    .string()
    .default("forexfactory,metalsmine")
    .transform((s) =>
      s
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter((v): v is "forexfactory" | "metalsmine" => v === "forexfactory" || v === "metalsmine"),
    )
    .refine((v) => v.length > 0, { message: "SCRAPER_SOURCES must list forexfactory and/or metalsmine" }),
  SCRAPER_USER_AGENT: z
    .string()
    .default("Mozilla/5.0 (compatible; forex-scrapper-api/0.4; +low-frequency calendar reader)"),
  AI_ENABLED: bool.default("false"),
  AI_PROVIDER: z.string().default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-haiku-4-5"),
  POST_STYLE: z.enum(["professional", "concise", "educational"]).default("professional"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export type AppConfig = {
  port: number;
  databaseUrl: string;
  scraperEnabled: boolean;
  calendarProvider: "mock" | "forexfactory";
  scraper: {
    minIntervalMs: number;
    timeoutMs: number;
    maxRetries: number;
    retryBaseMs: number;
    enrichActuals: boolean;
    exportUrl: string;
    htmlUrl: string;
    metalsExportUrl: string;
    sources: ("forexfactory" | "metalsmine")[];
    userAgent: string;
  };
  aiEnabled: boolean;
  aiProvider: string;
  aiModel: string;
  aiTimeoutMs: number;
  postStyle: "professional" | "concise" | "educational";
  /** Never serialise this into responses or logs. */
  anthropicApiKey: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const e = EnvSchema.parse(env);
  return {
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    scraperEnabled: e.SCRAPER_ENABLED,
    calendarProvider: e.CALENDAR_PROVIDER,
    scraper: {
      minIntervalMs: e.SCRAPER_MIN_INTERVAL_MS,
      timeoutMs: e.SCRAPER_TIMEOUT_MS,
      maxRetries: e.SCRAPER_MAX_RETRIES,
      retryBaseMs: e.SCRAPER_RETRY_BASE_MS,
      enrichActuals: e.SCRAPER_ENRICH_ACTUALS,
      exportUrl: e.SCRAPER_EXPORT_URL,
      htmlUrl: e.SCRAPER_HTML_URL,
      userAgent: e.SCRAPER_USER_AGENT,
    },
    aiEnabled: e.AI_ENABLED,
    aiProvider: e.AI_PROVIDER,
    aiModel: e.ANTHROPIC_MODEL,
    aiTimeoutMs: e.AI_TIMEOUT_MS,
    postStyle: e.POST_STYLE,
    anthropicApiKey: e.ANTHROPIC_API_KEY,
  };
}
