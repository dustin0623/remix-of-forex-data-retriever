import type { FastifyInstance } from "fastify";
import type { NewsService } from "../../services/newsService.js";
import { ok } from "../../utils/response.js";

export async function newsRoutes(app: FastifyInstance, opts: { news: NewsService }) {
  app.get<{ Querystring: { source?: string } }>("/api/news", async (req) => {
    const feed = await opts.news.getLatest();
    const s = req.query.source;
    return ok(s === "aljazeera" || s === "telegram" ? { ...feed, items: feed.items.filter((i) => i.source === s) } : feed);
  });
}
