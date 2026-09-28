import type { FastifyInstance } from "fastify";
import { ChangesQuerySchema, EventIdParamSchema } from "../../models/schemas.js";
import type { CalendarService } from "../../services/calendarService.js";
import { ApiError, ok } from "../../utils/response.js";

export async function calendarRoutes(app: FastifyInstance, opts: { service: CalendarService }) {
  const s = opts.service;

  app.get("/api/calendar/today", async () => ok(await s.today()));
  app.get("/api/calendar/tomorrow", async () => ok(await s.tomorrow()));
  app.get("/api/calendar/week", async () => ok(await s.week()));
  app.get("/api/calendar/high-impact", async () => ok(await s.highImpact()));
  app.get("/api/calendar/gold-relevant", async () => ok(await s.goldRelevant()));

  app.get("/api/events/:id", async (req) => {
    const parsed = EventIdParamSchema.safeParse(req.params);
    if (!parsed.success) throw new ApiError(400, "INVALID_EVENT_ID", "Event id must be a lowercase slug");
    const event = await s.byId(parsed.data.id);
    if (!event) throw new ApiError(404, "EVENT_NOT_FOUND", `No event with id "${parsed.data.id}"`);
    return ok(event);
  });

  app.get("/api/changes", async (req) => {
    const parsed = ChangesQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "limit must be an integer between 1 and 500");
    return ok(s.changes(parsed.data.limit));
  });
}
