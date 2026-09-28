import type { FastifyInstance } from "fastify";
import type { CotService } from "../../services/cotService.js";
import { ok } from "../../utils/response.js";

export async function cotRoutes(app: FastifyInstance, opts: { cot: CotService }) {
  app.get("/api/cot/gold", async () => ok(await opts.cot.getGold()));
}
