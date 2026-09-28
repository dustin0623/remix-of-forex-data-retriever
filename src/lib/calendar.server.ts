import type { Currency, EconomicEvent, EventSource, Impact, Relevance } from "@/types/market";

/**
 * Server-only port of /scrapper's Fair Economy ingestion: fetches the
 * Forex Factory + MetalsMine weekly JSON exports, merges duplicates and
 * applies the same gold relevance rules, returning the frontend event shape.
 */

const FEEDS = {
  forexfactory: "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  metalsmine: "https://nfs.faireconomy.media/mm_calendar_thisweek.json",
} as const;
type Feed = keyof typeof FEEDS;

interface Row {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();
const orNull = (s: string | undefined) => clean(s) || null;

function normalizeImpact(raw: string | undefined): Impact {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("high")) return "high";
  if (v.includes("medium")) return "medium";
  return "low";
}
const rank: Record<Impact, number> = { low: 0, medium: 1, high: 2 };

/** FNV-1a (portable; same id for the same event in both feeds). */
function fnv(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function buildEventId(currency: string, title: string, iso: string) {
  const date = iso.slice(0, 10);
  return `ff-${date}-${currency.toLowerCase()}-${fnv([date, currency, title.toLowerCase(), iso.slice(11, 16)].join("|"))}`;
}

type RuleRel = "medium" | "high" | "very_high";
const RULES: { pattern: RegExp; usdOnly: boolean; relevance: RuleRel }[] = [
  { pattern: /\bfomc member\b/i, usdOnly: true, relevance: "high" },
  { pattern: /\bfed chair\b|\bpowell\b/i, usdOnly: true, relevance: "very_high" },
  { pattern: /\bfomc\b|federal funds rate/i, usdOnly: true, relevance: "very_high" },
  { pattern: /\bcpi\b/i, usdOnly: true, relevance: "very_high" },
  { pattern: /\bpce\b/i, usdOnly: true, relevance: "very_high" },
  { pattern: /non-?farm|\bnfp\b/i, usdOnly: true, relevance: "very_high" },
  { pattern: /\bgdp\b/i, usdOnly: true, relevance: "very_high" },
  { pattern: /\bppi\b/i, usdOnly: true, relevance: "very_high" },
  { pattern: /retail sales/i, usdOnly: true, relevance: "very_high" },
  { pattern: /unemployment|jobless|employment change|\bjolts\b/i, usdOnly: true, relevance: "very_high" },
  { pattern: /rate statement|cash rate|refinancing rate|policy rate/i, usdOnly: false, relevance: "medium" },
];

export function goldRelevance(currency: string, title: string, impact: Impact, feed: EventSource): Relevance {
  for (const r of RULES) {
    if (r.usdOnly && currency !== "USD") continue;
    if (r.pattern.test(title)) return r.relevance === "medium" ? "medium" : "high";
  }
  if (/\bgold\b|\bsilver\b|xau|metal/i.test(title)) return "high";
  if (feed !== "forexfactory") return impact === "high" ? "high" : "medium";
  if (currency === "USD") return impact === "high" ? "medium" : "low";
  return impact === "high" ? "low" : "none";
}

function usdRelevance(currency: string, impact: Impact): Relevance {
  if (currency === "USD") return impact === "high" ? "high" : impact === "medium" ? "medium" : "low";
  return impact === "high" ? "low" : "none";
}

function hhmm(iso: string, raw: string): string {
  // Feed dates are published in US Eastern; keep the UTC time for display consistency.
  if (/T00:00:00/.test(raw) && false) return "All Day";
  return iso.slice(11, 16);
}

function toEvent(row: Row, feed: Feed): EconomicEvent | null {
  const title = clean(row.title);
  const ts = Date.parse(row.date ?? "");
  if (!title || Number.isNaN(ts)) return null;
  const datetime = new Date(ts).toISOString();
  const currency = clean(row.country).toUpperCase() as Currency;
  const impact = normalizeImpact(row.impact);
  const actual = orNull(row.actual);
  return {
    id: buildEventId(currency, title, datetime),
    datetime,
    time: hhmm(datetime, row.date ?? ""),
    currency,
    title,
    impact,
    status: actual ? "RELEASED" : "UPCOMING",
    actual,
    forecast: orNull(row.forecast),
    previous: orNull(row.previous),
    goldRelevance: "none",
    usdRelevance: usdRelevance(currency, impact),
    source: feed === "forexfactory" ? "Forex Factory" : "MetalsMine",
    feed,
    metalsImpact: feed === "metalsmine" ? impact : null,
    description: `${title} (${currency}) from the ${feed === "forexfactory" ? "Forex Factory" : "MetalsMine"} weekly calendar.`,
    history: [],
  };
}

export function mergeFeeds(ff: EconomicEvent[], mm: EconomicEvent[]): EconomicEvent[] {
  const byId = new Map<string, EconomicEvent>();
  for (const e of ff) byId.set(e.id, e);
  for (const m of mm) {
    const f = byId.get(m.id);
    if (!f) {
      byId.set(m.id, m);
      continue;
    }
    byId.set(m.id, {
      ...f,
      feed: "both",
      source: "Forex Factory + MetalsMine",
      impact: rank[m.impact] > rank[f.impact] ? m.impact : f.impact,
      metalsImpact: m.impact,
      actual: f.actual ?? m.actual,
      forecast: f.forecast ?? m.forecast,
      previous: f.previous ?? m.previous,
      status: f.actual ?? m.actual ? "RELEASED" : "UPCOMING",
    });
  }
  return [...byId.values()]
    .map((e) => ({ ...e, goldRelevance: goldRelevance(e.currency, e.title, e.impact, e.feed) }))
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
}

async function fetchFeed(feed: Feed): Promise<EconomicEvent[]> {
  const res = await fetch(FEEDS[feed], {
    headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (ForexMarketIntelligence)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${feed} HTTP ${res.status}`);
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) throw new Error(`${feed} returned non-array`);
  return json.map((r) => toEvent(r as Row, feed)).filter((e): e is EconomicEvent => e !== null);
}

export interface CalendarPayload {
  events: EconomicEvent[];
  meta: {
    source: "live" | "cache";
    stale: boolean;
    fetchedAt: string;
    feeds: { forexfactory: boolean; metalsmine: boolean };
    error: string | null;
  };
}

const MIN_INTERVAL_MS = 5 * 60_000;
let cache: CalendarPayload | null = null;
let cacheAt = 0;
let inflight: Promise<CalendarPayload> | null = null;

async function scrape(): Promise<CalendarPayload> {
  const [ff, mm] = await Promise.allSettled([fetchFeed("forexfactory"), fetchFeed("metalsmine")]);
  const ok = { forexfactory: ff.status === "fulfilled", metalsmine: mm.status === "fulfilled" };
  if (!ok.forexfactory && !ok.metalsmine) {
    const reason = ff.status === "rejected" ? String(ff.reason) : "unknown";
    throw new Error(`Both calendar feeds failed: ${reason}`);
  }
  const events = mergeFeeds(ff.status === "fulfilled" ? ff.value : [], mm.status === "fulfilled" ? mm.value : []);
  return {
    events,
    meta: {
      source: "live",
      stale: false,
      fetchedAt: new Date().toISOString(),
      feeds: ok,
      error: ok.forexfactory && ok.metalsmine ? null : "One calendar feed is temporarily unavailable.",
    },
  };
}

/** Returns the merged calendar, reusing a 5-minute cache and serving stale data on upstream failure. */
export async function getCalendar(force = false): Promise<CalendarPayload> {
  const fresh = cache && Date.now() - cacheAt < MIN_INTERVAL_MS;
  if (cache && fresh && !force) return { ...cache, meta: { ...cache.meta, source: "cache" } };
  inflight ??= scrape().finally(() => { inflight = null; });
  try {
    const result = await inflight;
    cache = result;
    cacheAt = Date.now();
    return result;
  } catch (err) {
    console.error("[calendar] scrape failed", err);
    if (cache) return { ...cache, meta: { ...cache.meta, source: "cache", stale: true, error: "Calendar feeds unavailable; showing last good data." } };
    throw new Error("The calendar feeds are temporarily unavailable. Try again shortly.");
  }
}
