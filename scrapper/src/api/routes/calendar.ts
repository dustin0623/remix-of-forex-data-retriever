import type { FastifyInstance } from "fastify";
import { ChangesQuerySchema, EventIdParamSchema } from "../../models/schemas.js";
import type { CalendarResult, CalendarService } from "../../services/calendarService.js";
import { ApiError, ok } from "../../utils/response.js";

const send = <T>(r: CalendarResult<T>) => ok(r.data, r.meta);

export async function calendarRoutes(app: FastifyInstance, opts: { service: CalendarService }) {
  const s = opts.service;

  app.get("/api/calendar/today", async () => send(await s.today()));
  app.get("/api/calendar/tomorrow", async () => send(await s.tomorrow()));
  app.get("/api/calendar/week", async () => send(await s.week()));
  app.get("/api/calendar/high-impact", async () => send(await s.highImpact()));
  app.get("/api/calendar/gold-relevant", async () => send(await s.goldRelevant()));

  const parseId = (params: unknown) => {
    const parsed = EventIdParamSchema.safeParse(params);
    if (!parsed.success) throw new ApiError(400, "INVALID_EVENT_ID", "Event id must be a lowercase slug");
    return parsed.data.id;
  };

  app.get("/api/events/:id", async (req) => {
    const id = parseId(req.params);
    const event = await s.byId(id);
    if (!event) throw new ApiError(404, "EVENT_NOT_FOUND", `No event with id "${id}"`);
    return ok(event);
  });

  app.get("/api/events/:id/history", async (req) => {
    const id = parseId(req.params);
    const history = s.history(id);
    if (!history) throw new ApiError(404, "EVENT_NOT_FOUND", `No event with id "${id}"`);
    return ok(history);
  });

  app.get("/api/changes", async (req) => {
    const parsed = ChangesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "query"}: ${i.message}`).join("; ");
      throw new ApiError(400, "INVALID_QUERY", msg);
    }
    return ok(s.changes(parsed.data));
  });
}
