import type {
  ApiStatus,
  EconomicEvent,
  EventChange,
  MarketAnalysis,
  MarketSnapshot,
  TimelinePoint,
} from "@/types/market";

export type CalendarRange = "today" | "tomorrow" | "week" | "all";
export type AnalysisSubject = "dashboard" | "gold";

export interface MutationResult {
  event: EconomicEvent;
  change: EventChange;
}

/**
 * Contract shared by the simulation and the future /scrapper implementation.
 * Components never touch an implementation directly — only this interface.
 */
export interface MarketApi {
  getCalendar(range?: CalendarRange): Promise<EconomicEvent[]>;
  getEvent(id: string): Promise<EconomicEvent | null>;
  getChanges(): Promise<EventChange[]>;
  getMarketAnalysis(subject: AnalysisSubject): Promise<MarketAnalysis>;
  getMarketSnapshot(): Promise<MarketSnapshot>;
  getMarketTimeline(): Promise<TimelinePoint[]>;
  getStatus(): Promise<ApiStatus>;
  /** Simulation-only controls; the real API will reject these. */
  simulateRelease(id: string): Promise<MutationResult>;
  simulateUpdate(id: string): Promise<MutationResult>;
  resetSimulation(): Promise<void>;
}
