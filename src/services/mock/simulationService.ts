import { mockChanges, mockEvents } from "@/mock/events";
import type {
  EconomicEvent,
  EventChange,
  EventStatus,
  MarketSnapshot,
  TimelinePoint,
  Trend,
} from "@/types/market";

/**
 * SIMULATION ENGINE — frontend only, no network.
 *
 * Behaves like a live Forex Factory-style calendar: events move from UPCOMING
 * to RELEASED (and UPDATED on revision), every mutation is diffed into a
 * change record, and XAUUSD reacts to release surprises. All values are
 * deterministic (derived from event ids + revision counters, never
 * Math.random) and the state persists for the browser session.
 */

interface Override {
  actual?: string | null;
  forecast?: string | null;
  status: EventStatus;
  revisions: number;
}

interface SimState {
  overrides: Record<string, Override>;
  changes: EventChange[];
  seq: number;
}

const STORAGE_KEY = "fmi.simulation.v2";
const PREVIOUS_CLOSE = 2660.75;

let state: SimState | null = null;

/** Baseline calendar: real scraped events once synced, synthetic mock events until then. */
let baselineEvents: EconomicEvent[] = mockEvents;
let baselineIsReal = false;

export function setBaseline(events: EconomicEvent[]) {
  baselineEvents = events;
  if (!baselineIsReal && state) state.changes = state.changes.filter((c) => events.some((e) => e.id === c.eventId));
  baselineIsReal = true;
}
export const hasRealBaseline = () => baselineIsReal;

function emptyState(): SimState {
  return { overrides: {}, changes: baselineIsReal ? [] : [...mockChanges], seq: mockChanges.length };
}

function load(): SimState {
  if (state) return state;
  state = emptyState();
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) state = JSON.parse(raw) as SimState;
    } catch {
      /* corrupt storage — start fresh */
    }
  }
  return state;
}

function save() {
  if (typeof window === "undefined" || !state) return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- helpers ----------

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function parseValue(v: string | null): { value: number; suffix: string; decimals: number } | null {
  if (!v) return null;
  const m = v.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const numeric = m[1] ?? "0";
  return {
    value: Number(numeric),
    suffix: m[2] ?? "",
    decimals: numeric.includes(".") ? (numeric.split(".")[1]?.length ?? 0) : 0,
  };
}

/** Moves a value by a deterministic step derived from the seed. */
function drift(base: string | null, seed: string, scale: number): string | null {
  const p = parseValue(base);
  if (!p) return null;
  const r = hash(seed) * 2 - 1; // -1..1
  const unit = p.decimals > 0 ? 10 ** -p.decimals : Math.max(1, Math.round(Math.abs(p.value) * 0.03));
  const steps = Math.round(r * scale) || (r >= 0 ? 1 : -1);
  return `${(p.value + steps * unit).toFixed(p.decimals)}${p.suffix}`;
}

function apply(event: EconomicEvent): EconomicEvent {
  const o = load().overrides[event.id];
  if (!o) return event;
  return {
    ...event,
    actual: o.actual !== undefined ? o.actual : event.actual,
    forecast: o.forecast !== undefined ? o.forecast : event.forecast,
    status: o.status,
  };
}

function allEvents(): EconomicEvent[] {
  return baselineEvents
    .map(apply)
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
}

function dayDiff(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86_400_000);
}

function record(event: EconomicEvent, change: Omit<EventChange, "id" | "eventId" | "eventTitle" | "detectedAt">) {
  const s = load();
  s.seq += 1;
  const entry: EventChange = {
    id: `chg-${String(s.seq).padStart(3, "0")}`,
    eventId: event.id,
    eventTitle: event.title,
    detectedAt: new Date().toISOString(),
    ...change,
  };
  s.changes = [entry, ...s.changes];
  return entry;
}

// ---------- calendar ----------

export function getAllEvents() {
  return allEvents();
}
export function getTodayEvents() {
  return allEvents().filter((e) => dayDiff(e.datetime) === 0);
}
export function getTomorrowEvents() {
  return allEvents().filter((e) => dayDiff(e.datetime) === 1);
}
export function getWeekEvents() {
  return allEvents().filter((e) => {
    const d = dayDiff(e.datetime);
    return d >= -1 && d <= 6;
  });
}
export function getEvent(id: string): EconomicEvent | null {
  const e = baselineEvents.find((x) => x.id === id);
  return e ? apply(e) : null;
}
export function getChanges(): EventChange[] {
  return [...load().changes].sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
  );
}

/** Publishes an actual for an event whose actual is still null. */
export function simulateEventRelease(id: string): { event: EconomicEvent; change: EventChange } {
  const event = getEvent(id);
  if (!event) throw new Error(`Unknown event ${id}`);
  if (event.actual !== null) throw new Error("This event has already been released.");
  const s = load();
  const prev = s.overrides[id];
  const value =
    drift(event.forecast ?? event.previous, `${id}:release:${prev?.revisions ?? 0}`, 3) ?? "Released";
  s.overrides[id] = { ...prev, actual: value, status: "RELEASED", revisions: prev?.revisions ?? 0 };
  const change = record(event, {
    changeType: "actual_released",
    field: "actual",
    previousValue: null,
    newValue: value,
  });
  save();
  return { event: getEvent(id)!, change };
}

/**
 * Revises an event: the forecast before release, the actual after release.
 * Either way the event is marked UPDATED.
 */
export function simulateEventUpdate(id: string): { event: EconomicEvent; change: EventChange } {
  const event = getEvent(id);
  if (!event) throw new Error(`Unknown event ${id}`);
  const s = load();
  const prev = s.overrides[id];
  const revisions = (prev?.revisions ?? 0) + 1;
  const field = event.actual !== null ? "actual" : "forecast";
  const current = field === "actual" ? event.actual : event.forecast;
  const next = drift(current ?? event.previous, `${id}:${field}:${revisions}`, 2);
  if (next === null || next === current) throw new Error("This event has no numeric value to revise.");
  s.overrides[id] = { ...prev, [field]: next, status: "UPDATED", revisions };
  const change = record(event, {
    changeType: field === "actual" ? "actual_revised" : "forecast_revised",
    field,
    previousValue: current,
    newValue: next,
  });
  save();
  return { event: getEvent(id)!, change };
}

export function resetSimulation() {
  state = emptyState();
  if (typeof window !== "undefined") window.sessionStorage.removeItem(STORAGE_KEY);
}

// ---------- market ----------

/** Deterministic intraday baseline for XAUUSD at a given fractional UTC hour. */
function baseline(hour: number): number {
  return PREVIOUS_CLOSE - 1.1 * hour + 6.5 * Math.sin(hour / 2.6) + 2.8 * Math.sin(hour * 1.9 + 1.3);
}

/** Gold reaction to a simulated USD data surprise (strong USD data → gold lower). */
function releaseImpact(change: EventChange): number {
  const event = baselineEvents.find((e) => e.id === change.eventId);
  if (!event || event.currency !== "USD" || event.goldRelevance === "none") return 0;
  if (change.field !== "actual") return 0;
  const actual = parseValue(change.newValue);
  const ref = parseValue(getEvent(event.id)?.forecast ?? event.previous);
  const weight = { high: 7, medium: 3.5, low: 1.2 }[event.impact];
  const surprise = actual && ref ? Math.sign(actual.value - ref.value) : 0;
  // Unemployment claims: higher = weaker USD.
  const inverse = /claims|unemployment rate/i.test(event.title) ? -1 : 1;
  return -surprise * inverse * weight;
}

function hourOf(iso: string) {
  const d = new Date(iso);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export function getMarketTimeline(): TimelinePoint[] {
  const now = new Date();
  const nowHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const releases = getChanges()
    .filter((c) => dayDiff(c.detectedAt) === 0 && releaseImpact(c) !== 0)
    .reverse();

  const offsetAt = (hour: number) =>
    releases.filter((c) => hourOf(c.detectedAt) <= hour).reduce((sum, c) => sum + releaseImpact(c), 0);

  const points: TimelinePoint[] = [];
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  for (let h = 0; h <= Math.floor(nowHour); h++) {
    points.push({
      time: new Date(day.getTime() + h * 3_600_000).toISOString(),
      price: +(baseline(h) + offsetAt(h)).toFixed(2),
      label: null,
    });
  }
  for (const c of releases) {
    const h = hourOf(c.detectedAt);
    points.push({
      time: c.detectedAt,
      price: +(baseline(h) + offsetAt(h)).toFixed(2),
      label: `${c.eventTitle}: ${c.newValue}`,
    });
  }
  points.push({ time: now.toISOString(), price: +(baseline(nowHour) + offsetAt(nowHour)).toFixed(2), label: null });
  return points.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

export function getMarketSnapshot(): MarketSnapshot {
  const timeline = getMarketTimeline();
  const price = timeline[timeline.length - 1]?.price ?? PREVIOUS_CLOSE;
  const earlier = timeline[Math.max(0, timeline.length - 4)]?.price ?? price;
  const changeAbsolute = +(price - PREVIOUS_CLOSE).toFixed(2);
  const changePercent = +((changeAbsolute / PREVIOUS_CLOSE) * 100).toFixed(2);
  const slope = price - earlier;
  const trend: Trend = Math.abs(slope) < 1.5 ? "sideways" : slope > 0 ? "up" : "down";
  const today = getTodayEvents();
  const pendingHigh = today.filter((e) => e.impact === "high" && e.actual === null).length;
  return {
    symbol: "XAUUSD",
    price,
    previousPrice: PREVIOUS_CLOSE,
    changeAbsolute,
    changePercent,
    trend,
    macroBias: changePercent > 0.25 ? "bullish" : changePercent < -0.25 ? "bearish" : "neutral",
    riskLevel: pendingHigh >= 2 ? "high" : pendingHigh === 1 ? "elevated" : "low",
    highImpactEventCount: today.filter((e) => e.impact === "high").length,
    updatedAt: new Date().toISOString(),
  };
}
