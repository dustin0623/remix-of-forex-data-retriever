import { mockApiStatus, mockDashboardAnalysis, mockGoldAnalysis } from "@/mock/analysis";
import * as sim from "@/services/mock/simulationService";

import type { MarketApi } from "./types";

const LATENCY_MS = 280;

function respond<T>(fn: () => T, latency = LATENCY_MS): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (err) {
        reject(err);
      }
    }, latency),
  );
}

/** Simulation implementation of the MarketApi contract. */
export const mockApi: MarketApi = {
  getCalendar: (range = "all") =>
    respond(() =>
      range === "today"
        ? sim.getTodayEvents()
        : range === "tomorrow"
          ? sim.getTomorrowEvents()
          : range === "week"
            ? sim.getWeekEvents()
            : sim.getAllEvents(),
    ),
  getEvent: (id) => respond(() => sim.getEvent(id)),
  getChanges: () => respond(() => sim.getChanges()),
  getMarketAnalysis: (subject) =>
    respond(() => {
      const base = subject === "gold" ? mockGoldAnalysis : mockDashboardAnalysis;
      return { ...base, bias: sim.getMarketSnapshot().macroBias };
    }, 600),
  getMarketSnapshot: () => respond(() => sim.getMarketSnapshot()),
  getMarketTimeline: () => respond(() => sim.getMarketTimeline()),
  getStatus: () => respond(() => mockApiStatus, 150),
  simulateRelease: (id) => respond(() => sim.simulateEventRelease(id), 150),
  simulateUpdate: (id) => respond(() => sim.simulateEventUpdate(id), 150),
  resetSimulation: () => respond(() => sim.resetSimulation(), 150),
};
