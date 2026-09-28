import { ApiError } from "../utils/response.js";

/**
 * CFTC Commitments of Traders (COT) for COMEX gold futures.
 *
 * insider-week.com embeds the full weekly series in the page HTML as a
 * JavaScript array (`var dataGraph = [...]`), so we parse that directly —
 * no API key, no Cloudflare challenge. CFTC publishes once a week
 * (Friday 15:30 EST), so a long cache is safe.
 */

export interface CotWeek {
  /** Report week (ISO date, YYYY-MM-DD). */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Net position of commercial hedgers (banks, miners) — usually negative. */
  commercialNet: number;
  /** Net position of large speculators (hedge funds). */
  nonCommercialNet: number;
  /** Net position of small / non-reportable traders (retail). */
  smallTraderNet: number;
  openInterest: number;
  /** 0-100 oscillator. High = commercials accumulating, low = overbought. */
  cotIndex: number;
}

export type CotSignal = "accumulation" | "neutral" | "overbought";

export interface CotReport {
  symbol: string;
  latest: CotWeek;
  previous: CotWeek | null;
  /** Week-over-week change in each net position and open interest. */
  weekChange: {
    commercialNet: number;
    nonCommercialNet: number;
    smallTraderNet: number;
    openInterest: number;
    cotIndex: number;
    close: number;
  } | null;
  signal: CotSignal;
  bias: "bullish" | "bearish" | "neutral";
  interpretation: string;
  /** Most recent weeks, oldest first (max 26). */
  history: CotWeek[];
  source: string;
  fetchedAt: string;
  stale: boolean;
}

export const COT_URL = "https://insider-week.com/en/cot/gold/";
const TTL = 60 * 60_000; // 1 hour; CFTC data only moves once a week.


const RECORD =
  /\{\s*date:\s*new Date\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)\s*,\s*open:\s*(-?[\d.]+)\s*,\s*high:\s*(-?[\d.]+)\s*,\s*low:\s*(-?[\d.]+)\s*,\s*close:\s*(-?[\d.]+)\s*,\s*Commercial:\s*(-?[\d.]+)\s*,\s*NonCommercial:\s*(-?[\d.]+)\s*,\s*NonRept:\s*(-?[\d.]+)\s*,\s*OpenInterest:\s*(-?[\d.]+)\s*,\s*Cot:\s*(-?[\d.]+)\s*\}/g;

/** JS `new Date(y, m, d)` is 0-indexed on the month and normalises day 0. */
function isoDate(y: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(y, monthIndex, day)).toISOString().slice(0, 10);
}

export function parseCotHtml(html: string): CotWeek[] {
  const start = html.indexOf("dataGraph");
  if (start === -1) return [];
  const end = html.indexOf("];", start);
  const block = html.slice(start, end === -1 ? undefined : end + 2);

  const weeks: CotWeek[] = [];
  RECORD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RECORD.exec(block)) !== null) {
    const n = (i: number) => Number(m![i]);
    weeks.push({
      date: isoDate(n(1), n(2), n(3)),
      open: n(4),
      high: n(5),
      low: n(6),
      close: n(7),
      commercialNet: n(8),
      nonCommercialNet: n(9),
      smallTraderNet: n(10),
      openInterest: n(11),
      cotIndex: n(12),
    });
  }
  return weeks.sort((a, b) => a.date.localeCompare(b.date));
}

function signalFor(cotIndex: number): CotSignal {
  if (cotIndex >= 80) return "accumulation";
  if (cotIndex <= 20) return "overbought";
  return "neutral";
}

export function describeCot(latest: CotWeek, previous: CotWeek | null): {
  signal: CotSignal;
  bias: CotReport["bias"];
  interpretation: string;
} {
  const signal = signalFor(latest.cotIndex);
  const bias = signal === "accumulation" ? "bullish" : signal === "overbought" ? "bearish" : "neutral";

  const hedgeShift = previous ? latest.commercialNet - previous.commercialNet : 0;
  const specShift = previous ? latest.nonCommercialNet - previous.nonCommercialNet : 0;

  const head =
    signal === "accumulation"
      ? `COT index at ${latest.cotIndex} — commercial hedgers are closer to the buy side of their multi-year range, historically an accumulation zone.`
      : signal === "overbought"
        ? `COT index at ${latest.cotIndex} — commercial hedgers are near the short extreme of their range, historically a late-stage / exhaustion zone.`
        : `COT index at ${latest.cotIndex} — positioning sits in the middle of its range, with no positioning extreme.`;

  const flow = previous
    ? ` Week over week hedgers moved ${hedgeShift >= 0 ? "+" : ""}${Math.round(hedgeShift).toLocaleString()} contracts and large speculators ${specShift >= 0 ? "+" : ""}${Math.round(specShift).toLocaleString()}, with open interest at ${Math.round(latest.openInterest).toLocaleString()}.`
    : "";

  return {
    signal,
    bias,
    interpretation: `${head}${flow} Positioning is a slow, weekly context signal, not a timing tool, and is not advice.`,
  };
}

export function buildReport(weeks: CotWeek[], stale = false): CotReport {
  const latest = weeks[weeks.length - 1]!;
  const previous = weeks.length > 1 ? weeks[weeks.length - 2]! : null;
  const { signal, bias, interpretation } = describeCot(latest, previous);

  return {
    symbol: "XAUUSD (COMEX GC futures)",
    latest,
    previous,
    weekChange: previous
      ? {
          commercialNet: latest.commercialNet - previous.commercialNet,
          nonCommercialNet: latest.nonCommercialNet - previous.nonCommercialNet,
          smallTraderNet: latest.smallTraderNet - previous.smallTraderNet,
          openInterest: latest.openInterest - previous.openInterest,
          cotIndex: latest.cotIndex - previous.cotIndex,
          close: +(latest.close - previous.close).toFixed(2),
        }
      : null,
    signal,
    bias,
    interpretation,
    history: weeks.slice(-26),
    source: COT_URL,
    fetchedAt: new Date().toISOString(),
    stale,
  };
}

/** Fetches + caches the weekly COT report; serves stale data if the source fails. */
export class CotService {
  private cache: { at: number; report: CotReport } | null = null;
  constructor(private readonly fetchImpl: typeof fetch = fetch, private readonly now: () => number = Date.now) {}

  async getGold(): Promise<CotReport> {
    if (this.cache && this.now() - this.cache.at < TTL) return this.cache.report;
    try {
      const res = await this.fetchImpl(COT_URL, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GoldDeskBot/1.0)", Accept: "text/html" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const weeks = parseCotHtml(await res.text());
      if (weeks.length === 0) throw new Error("COT dataset not found in page");
      const report = buildReport(weeks);
      this.cache = { at: this.now(), report };
      return report;
    } catch (err) {
      if (this.cache) return { ...this.cache.report, stale: true };
      throw new ApiError(502, "COT_UNAVAILABLE", `COT feed unavailable: ${(err as Error).message}`);
    }
  }
}
