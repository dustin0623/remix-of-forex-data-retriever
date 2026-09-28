import { fetchGoldQuote } from "@/lib/gold.functions";
import type { EconomicEvent, EventChange, MarketSnapshot, TimelinePoint, Trend } from "@/types/market";

/** Builds the dashboard snapshot from the real Binance quote plus today's calendar. */
export async function realSnapshot(today: EconomicEvent[]): Promise<MarketSnapshot> {
  const q = await fetchGoldQuote();
  const pts = q.points;
  const earlier = pts[Math.max(0, pts.length - 4)]?.price ?? q.price;
  const slope = q.price - earlier;
  const trend: Trend = Math.abs(slope) < 1.5 ? "sideways" : slope > 0 ? "up" : "down";
  const pendingHigh = today.filter((e) => e.impact === "high" && e.actual === null).length;
  return {
    symbol: "XAUUSD",
    price: q.price,
    previousPrice: q.open24h,
    changeAbsolute: q.changeAbsolute,
    changePercent: q.changePercent,
    trend,
    macroBias: q.changePercent > 0.25 ? "bullish" : q.changePercent < -0.25 ? "bearish" : "neutral",
    riskLevel: pendingHigh >= 2 ? "high" : pendingHigh === 1 ? "elevated" : "low",
    highImpactEventCount: today.filter((e) => e.impact === "high").length,
    updatedAt: q.fetchedAt,
  };
}

/** Real 24h 15-minute closes; release changes are shown as markers at the nearest real price. */
export async function realTimeline(changes: EventChange[] = []): Promise<TimelinePoint[]> {
  const q = await fetchGoldQuote();
  const points: TimelinePoint[] = q.points.map((p) => ({ ...p, label: null }));
  if (!points.length) return points;
  const t0 = new Date(points[0]!.time).getTime();
  for (const c of changes) {
    if (c.field !== "actual") continue;
    const t = new Date(c.detectedAt).getTime();
    if (t < t0) continue;
    const near = points.reduce((a, b) =>
      Math.abs(new Date(b.time).getTime() - t) < Math.abs(new Date(a.time).getTime() - t) ? b : a,
    );
    points.push({ time: c.detectedAt, price: near.price, label: `${c.eventTitle}: ${c.newValue}` });
  }
  return points.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}
