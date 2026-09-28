import Fastify, { type FastifyInstance } from "fastify";
import { AIError, type AIProvider } from "../ai/AIProvider.js";
import { AIService, createAIProvider } from "../ai/AIService.js";
import type { AppConfig } from "../config/env.js";
import { openDatabase } from "../database/db.js";
import { SqliteEventRepository } from "../database/repository.js";
import type { CalendarProvider } from "../scraper/CalendarProvider.js";
import { createProvider } from "../scraper/createProvider.js";
import { CalendarService } from "../services/calendarService.js";
import { ApiError, fail } from "../utils/response.js";
import { calendarRoutes } from "./routes/calendar.js";
import { statusRoutes } from "./routes/status.js";
import { analyzeRoutes } from "./routes/analyze.js";

export interface BuildAppOptions {
  config: AppConfig;
  provider?: CalendarProvider;
  logger?: boolean;
  now?: () => Date;
  /** Override the AI provider (tests). null = AI disabled. */
  aiProvider?: AIProvider | null;
}

export async function buildApp({ config, provider, logger = false, now, aiProvider }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger ? { redact: ["req.headers.authorization", "*.anthropicApiKey"] } : false,
  });

  const db = openDatabase(config.databaseUrl);
  app.addHook("onClose", async () => db.close());
  const source = provider ?? createProvider(config, app.log);
  const service = new CalendarService(source, new SqliteEventRepository(db), {
    minIntervalMs: config.scraper.minIntervalMs,
    onError: (err) => app.log.warn({ err }, "calendar fetch failed; serving cache if available"),
    ...(now ? { now } : {}),
  });

  const ai = new AIService(
    aiProvider === undefined ? createAIProvider(config, config.aiTimeoutMs) : aiProvider,
    service,
    now,
  );

  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("Access-Control-Allow-Origin", "*");
    return payload;
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AIError) {
      if (err.code !== "AI_NOT_CONFIGURED") app.log.warn({ code: err.code }, "AI analysis failed");
      if (err.retryAfterSec) reply.header("Retry-After", String(err.retryAfterSec));
      return reply.status(err.statusCode).send(fail(err.code, err.message));
    }
    if (err instanceof ApiError) return reply.status(err.statusCode).send(fail(err.code, err.message));
    app.log.error(err);
    return reply.status(500).send(fail("INTERNAL_ERROR", "Unexpected server error"));
  });

  app.setNotFoundHandler((req, reply) =>
    reply.status(404).send(fail("NOT_FOUND", `Route ${req.method} ${req.url} not found`)),
  );

  await app.register(statusRoutes, { config, service, providerName: source.name, aiConfigured: ai.configured });
  await app.register(calendarRoutes, { service });
  await app.register(analyzeRoutes, { ai });
  return app;
}
