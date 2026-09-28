import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getCalendar } from "./calendar.server";

/** Real Forex Factory + MetalsMine weekly calendar, fetched server-side (no CORS, no extra backend). */
export const fetchRealCalendar = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ force: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data }) => getCalendar(data.force ?? false));
