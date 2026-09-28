import type { EconomicEvent } from "../models/schemas.js";

/**
 * Source of calendar events. Phase 3 ships MockCalendarProvider;
 * a ForexFactoryCalendarProvider will implement the same contract later.
 */
export interface CalendarProvider {
  readonly name: string;
  getToday(): Promise<EconomicEvent[]>;
  getTomorrow(): Promise<EconomicEvent[]>;
  getWeek(): Promise<EconomicEvent[]>;
}
