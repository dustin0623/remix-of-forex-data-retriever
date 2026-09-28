import type { FastifyInstance } from "fastify";
import type { AIService } from "../../ai/AIService.js";
import { EventIdParamSchema } from "../../models/schemas.js";
import { ApiError } from "../../utils/response.js";

export async function analyzeRoutes(app: FastifyInstance, opts: { ai: AIService }) {
  const { ai } = opts;
  const id = (params: unknown) => {
    const p = EventIdParamSchema.safeParse(params);
    if (!p.success) throw new ApiError(400, "INVALID_EVENT_ID", "Event id must be a lowercase slug");
    return p.data.id;
  };
  const wrap = (r: Awaited<ReturnType<AIService["goldToday"]>>) => ({ success: true as const, data: r.data, meta: r.meta });

  app.get("/api/analyze/gold/today", async () => wrap(await ai.goldToday()));
  app.get("/api/analyze/event/:id", async (req) => wrap(await ai.event(id(req.params))));
  app.get("/api/analyze/gold/event/:id", async (req) => wrap(await ai.goldEvent(id(req.params))));
}
