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
  AI_ENABLED: bool.default("false"),
  AI_PROVIDER: z.string().default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5"),
});

export type AppConfig = {
  port: number;
  databaseUrl: string;
  scraperEnabled: boolean;
  aiEnabled: boolean;
  aiProvider: string;
  aiModel: string;
  /** Never serialise this into responses or logs. */
  anthropicApiKey: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const e = EnvSchema.parse(env);
  return {
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    scraperEnabled: e.SCRAPER_ENABLED,
    aiEnabled: e.AI_ENABLED,
    aiProvider: e.AI_PROVIDER,
    aiModel: e.ANTHROPIC_MODEL,
    anthropicApiKey: e.ANTHROPIC_API_KEY,
  };
}
