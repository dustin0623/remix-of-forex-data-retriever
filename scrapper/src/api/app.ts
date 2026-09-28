import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "../config/env.js";
import { openDatabase } from "../database/db.js";
import { SqliteEventRepository } from "../database/repository.js";
import type { CalendarProvider } from "../scraper/CalendarProvider.js";
import { createProvider } from "../scraper/createProvider.js";
import { CalendarService } from "../services/calendarService.js";
import { ApiError, fail } from "../utils/response.js";
import { calendarRoutes } from "./routes/calendar.js";
import { statusRoutes } from "./routes/status.js";

export interface BuildAppOptions {
  config: AppConfig;
  provider?: CalendarProvider;
  logger?: boolean;
  now?: () => Date;
}

export async function buildApp({ config, provider, logger = false, now }: BuildAppOptions): Promise<FastifyInstance> {
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

  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("Access-Control-Allow-Origin", "*");
    return payload;
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) return reply.status(err.statusCode).send(fail(err.code, err.message));
    app.log.error(err);
    return reply.status(500).send(fail("INTERNAL_ERROR", "Unexpected server error"));
  });

  app.setNotFoundHandler((req, reply) =>
    reply.status(404).send(fail("NOT_FOUND", `Route ${req.method} ${req.url} not found`)),
  );

  await app.register(statusRoutes, { config, service, providerName: source.name });
  await app.register(calendarRoutes, { service });
  return app;
}
