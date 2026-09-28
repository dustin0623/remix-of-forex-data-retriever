export interface GoldQuote {
  symbol: string;
  price: number;
  open24h: number;
  high24h: number;
  low24h: number;
  changeAbsolute: number;
  changePercent: number;
  points: { time: string; price: number }[];
  fetchedAt: string;
  stale: boolean;
}

// data-api.binance.vision is Binance's public market-data mirror (not geo-blocked like api.binance.com).
const HOSTS = ["https://data-api.binance.vision", "https://api.binance.com"];
const TTL = 30_000;
let cache: { at: number; quote: GoldQuote } | null = null;

async function getJson(path: string): Promise<unknown> {
  let last: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return await res.json();
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("Binance unreachable");
}

export async function getGoldQuote(): Promise<GoldQuote> {
  if (cache && Date.now() - cache.at < TTL) return cache.quote;
  try {
    const [t, k] = await Promise.all([
      getJson("/api/v3/ticker/24hr?symbol=PAXGUSDT") as Promise<Record<string, string>>,
      getJson("/api/v3/klines?symbol=PAXGUSDT&interval=15m&limit=96") as Promise<unknown[][]>,
    ]);
    const quote: GoldQuote = {
      symbol: "XAUUSD (PAXG)",
      price: +Number(t["lastPrice"]).toFixed(2),
      open24h: +Number(t["openPrice"]).toFixed(2),
      high24h: +Number(t["highPrice"]).toFixed(2),
      low24h: +Number(t["lowPrice"]).toFixed(2),
      changeAbsolute: +Number(t["priceChange"]).toFixed(2),
      changePercent: +Number(t["priceChangePercent"]).toFixed(2),
      points: k.map((r) => ({ time: new Date(Number(r[6]) + 1).toISOString(), price: +Number(r[4]).toFixed(2) })),
      fetchedAt: new Date().toISOString(),
      stale: false,
    };
    cache = { at: Date.now(), quote };
    return quote;
  } catch (err) {
    if (cache) return { ...cache.quote, stale: true };
    throw new Error(`Gold price feed unavailable: ${(err as Error).message}`);
  }
}
