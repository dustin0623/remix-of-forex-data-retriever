import type { FastifyInstance } from "fastify";
import { ChangesQuerySchema, EventIdParamSchema, SourceQuerySchema } from "../../models/schemas.js";
import type { CalendarResult, CalendarService } from "../../services/calendarService.js";
import { ApiError, ok } from "../../utils/response.js";

const send = <T>(r: CalendarResult<T>) => ok(r.data, r.meta);

/** ?source=all|forexfactory|metalsmine — "all" merges both Fair Economy feeds. */
const parseSource = (query: unknown) => {
  const parsed = SourceQuerySchema.safeParse(query ?? {});
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_SOURCE", "source must be all, forexfactory or metalsmine");
  }
  return parsed.data.source;
};

export async function calendarRoutes(app: FastifyInstance, opts: { service: CalendarService }) {
  const s = opts.service;

  app.get("/api/calendar/today", async (req) => send(await s.today(parseSource(req.query))));
  app.get("/api/calendar/tomorrow", async (req) => send(await s.tomorrow(parseSource(req.query))));
  app.get("/api/calendar/week", async (req) => send(await s.weekBySource(parseSource(req.query))));
  app.get("/api/calendar/high-impact", async (req) => send(await s.highImpact(parseSource(req.query))));
  app.get("/api/calendar/gold-relevant", async (req) => send(await s.goldRelevant(parseSource(req.query))));

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
