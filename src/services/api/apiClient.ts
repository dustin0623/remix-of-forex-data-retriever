import { useSettingsStore } from "@/stores/settingsStore";

import type {
  LiveAnalysis, LiveAnalysisMeta, LiveChange, LiveEvent, LiveEventHistory, LiveMeta, LiveResult, LiveStatus,
} from "./liveTypes";
import { createLiveMarketApi } from "./liveMarketApi";
import { mockApi } from "./mockApi";
import type { MarketApi } from "./types";

export type { AnalysisSubject, CalendarRange, MarketApi, MutationResult } from "./types";

export type ApiErrorKind = "offline" | "timeout" | "ai_not_configured" | "not_found" | "unavailable" | "http" | "invalid";

/** Error with a friendly, user-facing message. Never contains server secrets. */
export class ApiClientError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI analysis is not available because no Anthropic API key is configured on the API server.";

const TIMEOUT_MS = 10_000;

export interface RawResponse {
  ok: boolean;
  status: number | null;
  durationMs: number;
  body: unknown;
  error: string | null;
}

/** Low-level request used by the API Explorer: never throws, always reports status + duration. */
export async function rawRequest(baseUrl: string, path: string): Promise<RawResponse> {
  const started = performance.now();
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    return { ok: res.ok, status: res.status, durationMs: Math.round(performance.now() - started), body, error: null };
  } catch (err) {
    const timeout = (err as Error).name === "TimeoutError" || (err as Error).name === "AbortError";
    return {
      ok: false, status: null, durationMs: Math.round(performance.now() - started), body: null,
      error: timeout ? `Request timed out after ${TIMEOUT_MS / 1000}s.` : offlineMessage(baseUrl),
    };
  }
}

const offlineMessage = (baseUrl: string) =>
  `Can't reach the API at ${baseUrl}. Make sure the scrapper server is running and the URL in Settings is correct.`;

type Envelope<T, M> = { success: true; data: T; meta?: M } | { success: false; error: { code: string; message: string } };

async function request<T, M = LiveMeta | undefined>(baseUrl: string, path: string, raw = false): Promise<LiveResult<T, M>> {
  const r = await rawRequest(baseUrl, path);
  if (r.status === null) {
    throw new ApiClientError(r.error?.startsWith("Request timed out") ? "timeout" : "offline", r.error ?? offlineMessage(baseUrl));
  }
  const body = r.body as Envelope<T, M> | T | null;
  if (raw && r.ok) return { data: body as T, meta: undefined as M };
  if (!body || typeof body !== "object") throw new ApiClientError("invalid", "The API returned an unexpected response.", r.status);
  const env = body as Envelope<T, M>;
  if ("success" in env && env.success) return { data: env.data, meta: env.meta as M };
  const code = "error" in env ? env.error.code : null;
  if (code === "AI_NOT_CONFIGURED") throw new ApiClientError("ai_not_configured", AI_NOT_CONFIGURED_MESSAGE, r.status, code);
  if (r.status === 404) throw new ApiClientError("not_found", "That item was not found on the API.", 404, code);
  if (code === "UPSTREAM_UNAVAILABLE")
    throw new ApiClientError("unavailable", "The calendar source is temporarily unavailable and the API has no cached data yet.", r.status, code);
  if (code === "AI_RATE_LIMITED") throw new ApiClientError("unavailable", "The AI provider is busy right now. Try again in a minute.", r.status, code);
  if (code?.startsWith("AI_")) throw new ApiClientError("unavailable", "AI analysis failed on the server. Try again shortly.", r.status, code);
  const msg = "error" in env ? env.error.message : `Request failed (HTTP ${r.status}).`;
  throw new ApiClientError("http", msg, r.status, code);
}

const enc = encodeURIComponent;

export interface ChangesParams {
  since?: string;
  until?: string;
  impact?: "low" | "medium" | "high";
  currency?: string;
  goldRelevant?: boolean;
  limit?: number;
}

/** Typed client for the independent /scrapper API. */
export function createScrapperClient(baseUrl: string) {
  return {
    baseUrl,
    getStatus: () => request<LiveStatus>(baseUrl, "/api/status", true).then((r) => r.data),
    getTodayCalendar: () => request<LiveEvent[]>(baseUrl, "/api/calendar/today"),
    getTomorrowCalendar: () => request<LiveEvent[]>(baseUrl, "/api/calendar/tomorrow"),
    getWeekCalendar: () => request<LiveEvent[]>(baseUrl, "/api/calendar/week"),
    getHighImpactEvents: () => request<LiveEvent[]>(baseUrl, "/api/calendar/high-impact"),
    getGoldRelevantEvents: () => request<LiveEvent[]>(baseUrl, "/api/calendar/gold-relevant"),
    getEvent: (id: string) => request<LiveEvent>(baseUrl, `/api/events/${enc(id)}`).then((r) => r.data),
    getChanges: (p: ChangesParams = {}) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(p)) if (v !== undefined) qs.set(k, String(v));
      const q = qs.toString();
      return request<LiveChange[]>(baseUrl, `/api/changes${q ? `?${q}` : ""}`).then((r) => r.data);
    },
    getEventHistory: (id: string) => request<LiveEventHistory>(baseUrl, `/api/events/${enc(id)}/history`).then((r) => r.data),
    getGoldAnalysis: () => request<LiveAnalysis, LiveAnalysisMeta>(baseUrl, "/api/analyze/gold/today"),
    getEventAnalysis: (id: string) => request<LiveAnalysis, LiveAnalysisMeta>(baseUrl, `/api/analyze/event/${enc(id)}`),
  };
}
export type ScrapperClient = ReturnType<typeof createScrapperClient>;

export const currentScrapperClient = () => createScrapperClient(useSettingsStore.getState().apiBaseUrl);

const current = (): MarketApi =>
  useSettingsStore.getState().dataSource === "live" ? createLiveMarketApi(currentScrapperClient()) : mockApi;

/**
 * Single entry point for page data. Delegates to the direct feed or the Scrapper API
 * based on Settings → Data Source, so components never branch on the source.
 */
export const apiClient: MarketApi = {
  getCalendar: (range) => current().getCalendar(range),
  getEvent: (id) => current().getEvent(id),
  getChanges: () => current().getChanges(),
  getMarketAnalysis: (s) => current().getMarketAnalysis(s),
  getMarketSnapshot: () => current().getMarketSnapshot(),
  getMarketTimeline: () => current().getMarketTimeline(),
  getStatus: () => current().getStatus(),
  whatIfRelease: (id) => current().whatIfRelease(id),
  whatIfUpdate: (id) => current().whatIfUpdate(id),
  resetWhatIf: () => current().resetWhatIf(),
};
