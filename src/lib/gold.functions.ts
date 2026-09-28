import { createServerFn } from "@tanstack/react-start";

import { getGoldQuote } from "./gold.server";

/** Real gold spot proxy (Binance PAXG/USDT): 24h ticker + 15m closes, 30s server cache. */
export const fetchGoldQuote = createServerFn({ method: "GET" }).handler(() => getGoldQuote());
