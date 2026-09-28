import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../../config/env.js";
import { StatusSchema } from "../../models/schemas.js";
import type { CalendarService } from "../../services/calendarService.js";

export async function statusRoutes(app: FastifyInstance, opts: { config: AppConfig; service: CalendarService; providerName: string }) {
  const { config, service, providerName } = opts;
  // Raw status object (no envelope); never includes secrets.
  app.get("/api/status", async () =>
    StatusSchema.parse({
      status: "ok",
      scraper: config.scraperEnabled,
      ai: config.aiEnabled,
      aiProvider: config.aiProvider,
      aiModel: config.aiModel,
      provider: providerName,
      ...service.status(),
    }),
  );
}
