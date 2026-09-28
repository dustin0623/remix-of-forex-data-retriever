import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../../config/env.js";
import { StatusSchema } from "../../models/schemas.js";

export async function statusRoutes(app: FastifyInstance, opts: { config: AppConfig }) {
  const { config } = opts;
  // Intentionally returns the raw status object (no envelope) per spec; no secrets.
  app.get("/api/status", async () =>
    StatusSchema.parse({
      status: "ok",
      scraper: config.scraperEnabled,
      ai: config.aiEnabled,
      aiProvider: config.aiProvider,
      aiModel: config.aiModel,
    }),
  );
}
