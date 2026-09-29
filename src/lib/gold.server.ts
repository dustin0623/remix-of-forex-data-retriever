export interface GoldQuote {
  symbol: string;
  price: number;
  open24h: number;
  high24h: number;
  low24h: number;
  changeAbsolute: number;
  changePercent: number;
  points: { time: string; price: number }[];
  source: string;
  spotUpdatedAt: string | null;
  fetchedAt: string;
  stale: boolean;
}

// Spot XAU/USD from gold-api.com (free, no key). The 24h shape comes from Binance PAXG
// 15m closes, shifted by the live basis so the line sits on the real spot level.
const SPOT_URL = "https://api.gold-api.com/price/XAU";
const HOSTS = ["https://data-api.binance.vision", "https://api.binance.com"];
const TTL = 30_000;
let cache: { at: number; quote: GoldQuote } | null = null;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function binance(path: string): Promise<unknown> {
  let last: unknown;
  for (const host of HOSTS) {
    try {
      return await getJson(`${host}${path}`);
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("Binance unreachable");
}

const r2 = (n: number) => +n.toFixed(2);

export async function getGoldQuote(): Promise<GoldQuote> {
  if (cache && Date.now() - cache.at < TTL) return cache.quote;
  try {
    const spotRes = (await getJson(SPOT_URL)) as { price?: number; updatedAt?: string };
    const spot = Number(spotRes.price);
    if (!Number.isFinite(spot) || spot <= 0) throw new Error("Spot feed returned no price");

    let points: { time: string; price: number }[] = [];
    let open = spot;
    let high = spot;
    let low = spot;
    try {
      const k = (await binance("/api/v3/klines?symbol=PAXGUSDT&interval=15m&limit=96")) as unknown[][];
      const closes = k.map((r) => ({ time: new Date(Number(r[6]) + 1).toISOString(), price: Number(r[4]) }));
      const last = closes[closes.length - 1]?.price;
      if (last) {
        const basis = spot - last;
        points = closes.map((p) => ({ time: p.time, price: r2(p.price + basis) }));
        points[points.length - 1] = { time: new Date().toISOString(), price: r2(spot) };
        open = Number(k[0]?.[1]) + basis;
        high = Math.max(...k.map((r) => Number(r[2]))) + basis;
        low = Math.min(...k.map((r) => Number(r[3]))) + basis;
      }
    } catch {
      /* intraday shape optional; spot price still valid */
    }
    const change = spot - open;
    const quote: GoldQuote = {
      symbol: "XAUUSD",
      price: r2(spot),
      open24h: r2(open),
      high24h: r2(Math.max(high, spot)),
      low24h: r2(Math.min(low, spot)),
      changeAbsolute: r2(change),
      changePercent: r2((change / open) * 100),
      points,
      source: "XAU/USD spot",
      spotUpdatedAt: spotRes.updatedAt ?? null,
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
