import { mockApi } from "./mockApi";
import type { MarketApi } from "./types";

export type { AnalysisSubject, CalendarRange, MarketApi, MutationResult } from "./types";

/**
 * Single entry point for all market data.
 * Phase 3+: add an `httpApi` implementing MarketApi against /scrapper and
 * select it here when Settings → Data Source is "External API".
 */
export const apiClient: MarketApi = mockApi;
