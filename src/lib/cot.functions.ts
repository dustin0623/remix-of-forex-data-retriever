import { createServerFn } from "@tanstack/react-start";

import { getGoldCot } from "./cot.server";

/** Weekly CFTC Commitments of Traders positioning for COMEX gold, 1h server cache. */
export const fetchGoldCot = createServerFn({ method: "GET" }).handler(() => getGoldCot());
