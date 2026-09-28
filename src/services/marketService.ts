import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/services/api/apiClient";

/**
 * React Query bindings over the apiClient. Query keys and signatures stay
 * stable when the apiClient implementation changes from simulation to real API.
 */

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

export const eventsQuery = () =>
  queryOptions({ queryKey: ["events", "all"], queryFn: () => apiClient.getCalendar("all") });

export const todayEventsQuery = () =>
  queryOptions({ queryKey: ["events", "today"], queryFn: () => apiClient.getCalendar("today") });

export const eventQuery = (id: string) =>
  queryOptions({ queryKey: ["events", "detail", id], queryFn: () => apiClient.getEvent(id) });

export const snapshotQuery = () =>
  queryOptions({ queryKey: ["market", "snapshot"], queryFn: () => apiClient.getMarketSnapshot() });

export const timelineQuery = () =>
  queryOptions({ queryKey: ["market", "timeline"], queryFn: () => apiClient.getMarketTimeline() });

export const dashboardAnalysisQuery = () =>
  queryOptions({ queryKey: ["analysis", "dashboard"], queryFn: () => apiClient.getMarketAnalysis("dashboard") });

export const goldAnalysisQuery = () =>
  queryOptions({ queryKey: ["analysis", "gold"], queryFn: () => apiClient.getMarketAnalysis("gold") });

export const changesQuery = () =>
  queryOptions({ queryKey: ["changes"], queryFn: () => apiClient.getChanges() });

export const apiStatusQuery = () =>
  queryOptions({ queryKey: ["api-status"], queryFn: () => apiClient.getStatus(), staleTime: 30_000 });

/** Simulation controls; every success refreshes all market queries. */
export function useSimulationActions() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries();
  return {
    release: useMutation({ mutationFn: (id: string) => apiClient.simulateRelease(id), onSuccess }),
    update: useMutation({ mutationFn: (id: string) => apiClient.simulateUpdate(id), onSuccess }),
    reset: useMutation({ mutationFn: () => apiClient.resetSimulation(), onSuccess }),
  };
}
