import { queryOptions } from "@tanstack/react-query";

import { mockApiStatus, mockDashboardAnalysis, mockGoldAnalysis, mockSnapshot } from "@/mock/analysis";
import { mockChanges, mockEvents } from "@/mock/events";
import type { ApiStatus, EconomicEvent, EventChange, MarketAnalysis, MarketSnapshot } from "@/types/market";

/**
 * Simulated transport layer.
 *
 * Every function here resolves from the mock modules with a small artificial
 * latency so loading states are real. To go live in a later phase, replace the
 * bodies with fetch calls to the /scrapper API — the signatures and the query
 * keys below stay identical, so no UI has to change.
 */

const LATENCY_MS = 280;

function simulateRequest<T>(data: T, latency = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), latency));
}

export function isSameDay(iso: string, offsetDays = 0): boolean {
  const target = new Date();
  target.setDate(target.getDate() + offsetDays);
  const d = new Date(iso);
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  );
}

function byTime(a: EconomicEvent, b: EconomicEvent) {
  return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
}

async function fetchEvents(): Promise<EconomicEvent[]> {
  return simulateRequest([...mockEvents].sort(byTime));
}

export const eventsQuery = () =>
  queryOptions({ queryKey: ["events"], queryFn: fetchEvents, staleTime: 60_000 });

export const todayEventsQuery = () =>
  queryOptions({
    queryKey: ["events", "today"],
    queryFn: async () => (await fetchEvents()).filter((e) => isSameDay(e.datetime, 0)),
    staleTime: 60_000,
  });

export const eventQuery = (id: string) =>
  queryOptions({
    queryKey: ["events", id],
    queryFn: async () => (await fetchEvents()).find((e) => e.id === id) ?? null,
    staleTime: 60_000,
  });

export const snapshotQuery = () =>
  queryOptions({
    queryKey: ["snapshot"],
    queryFn: (): Promise<MarketSnapshot> => simulateRequest(mockSnapshot),
    staleTime: 60_000,
  });

export const dashboardAnalysisQuery = () =>
  queryOptions({
    queryKey: ["analysis", "dashboard"],
    queryFn: (): Promise<MarketAnalysis> => simulateRequest(mockDashboardAnalysis, 600),
    staleTime: 60_000,
  });

export const goldAnalysisQuery = () =>
  queryOptions({
    queryKey: ["analysis", "gold"],
    queryFn: (): Promise<MarketAnalysis> => simulateRequest(mockGoldAnalysis, 600),
    staleTime: 60_000,
  });

export const changesQuery = () =>
  queryOptions({
    queryKey: ["changes"],
    queryFn: (): Promise<EventChange[]> => simulateRequest(mockChanges),
    staleTime: 60_000,
  });

export const apiStatusQuery = () =>
  queryOptions({
    queryKey: ["api-status"],
    queryFn: (): Promise<ApiStatus> => simulateRequest(mockApiStatus, 150),
    staleTime: 30_000,
  });
