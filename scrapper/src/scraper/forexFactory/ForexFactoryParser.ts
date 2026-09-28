import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { z } from "zod";
import { FF_SELECTORS } from "./selectors.js";
import type { FFExportRow, FFHtmlRow, FFImpact, ParsedForexFactoryEvent } from "./types.js";

export const normalizeWhitespace = (s: string | null | undefined): string =>
  (s ?? "").replace(/\s+/g, " ").trim();

const emptyToNull = (s: string | null | undefined): string | null => {
  const v = normalizeWhitespace(s);
  return v === "" ? null : v;
};

export function normalizeImpact(raw: string): FFImpact {
  const v = raw.toLowerCase();
  if (v.includes("high") || v.includes("red")) return "high";
  if (v.includes("medium") || v.includes("ora")) return "medium";
  return "low"; // low, yellow, holiday, non-economic, unknown
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Deterministic id: source + date + currency + event + time (never array indexes). */
export function buildEventId(currency: string, event: string, datetimeUtc: string): string {
  const date = datetimeUtc.slice(0, 10);
  const time = datetimeUtc.slice(11, 16);
  const hash = createHash("sha1")
    .update(["forexfactory", date, currency.toUpperCase(), normalizeWhitespace(event).toLowerCase(), time].join("|"))
    .digest("hex")
    .slice(0, 10);
  return `ff-${date}-${slug(currency)}-${hash}`;
}

/** Key used to match an HTML row to an export row. */
export const matchKey = (currency: string, event: string) =>
  `${currency.toUpperCase()}|${normalizeWhitespace(event).toLowerCase()}`;

const ExportRowSchema = z.object({
  title: z.string(),
  country: z.string(),
  date: z.string(),
  impact: z.string().default("Low"),
  forecast: z.string().optional(),
  previous: z.string().optional(),
  actual: z.string().optional(),
});

/** Parses the weekly JSON export. Invalid rows are skipped, never fatal. */
export function parseExport(json: unknown): { events: ParsedForexFactoryEvent[]; skipped: number } {
  const rows = Array.isArray(json) ? json : [];
  const events: ParsedForexFactoryEvent[] = [];
  let skipped = 0;
  for (const raw of rows) {
    const r = ExportRowSchema.safeParse(raw);
    const ts = r.success ? Date.parse(r.data.date) : NaN;
    if (!r.success || Number.isNaN(ts) || !normalizeWhitespace(r.data.title)) {
      skipped++;
      continue;
    }
    const row: FFExportRow = r.data;
    const datetime = new Date(ts).toISOString();
    const currency = normalizeWhitespace(row.country).toUpperCase();
    const event = normalizeWhitespace(row.title);
    events.push({
      id: buildEventId(currency, event, datetime),
      source: "forexfactory",
      event,
      currency,
      impact: normalizeImpact(row.impact),
      datetime,
      actual: emptyToNull(row.actual),
      forecast: emptyToNull(row.forecast),
      previous: emptyToNull(row.previous),
    });
  }
  return { events, skipped };
}

/** Parses the HTML calendar table. Missing cells become null. */
export function parseCalendarHtml(html: string): FFHtmlRow[] {
  const $ = cheerio.load(html);
  const out: FFHtmlRow[] = [];
  let lastCurrency = "";
  $(FF_SELECTORS.row).each((_, el) => {
    const row = $(el);
    const text = (sel: string) => emptyToNull(row.find(sel).first().text());
    const event = text(FF_SELECTORS.title);
    if (!event) return;
    const currency = text(FF_SELECTORS.currency) ?? lastCurrency;
    if (!currency) return;
    lastCurrency = currency;
    out.push({
      currency: currency.toUpperCase(),
      event,
      actual: text(FF_SELECTORS.actual),
      forecast: text(FF_SELECTORS.forecast),
      previous: text(FF_SELECTORS.previous),
    });
  });
  return out;
}

/**
 * Copies actuals (and revised previous values) from HTML rows onto export events.
 * Matches on currency + title; duplicates are disambiguated by forecast.
 */
export function mergeActuals(events: ParsedForexFactoryEvent[], htmlRows: FFHtmlRow[]): ParsedForexFactoryEvent[] {
  const byKey = new Map<string, FFHtmlRow[]>();
  for (const r of htmlRows) {
    const k = matchKey(r.currency, r.event);
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  return events.map((e) => {
    const candidates = byKey.get(matchKey(e.currency, e.event));
    if (!candidates?.length) return e;
    const idx = Math.max(0, candidates.findIndex((c) => c.forecast === e.forecast));
    const [hit] = candidates.splice(idx, 1);
    if (!hit) return e;
    return { ...e, actual: hit.actual ?? e.actual, previous: hit.previous ?? e.previous };
  });
}
