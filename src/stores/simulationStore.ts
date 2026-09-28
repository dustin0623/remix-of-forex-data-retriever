import { create } from "zustand";

interface SimulationState {
  /** eventId -> simulated "actual" value produced locally by the user. */
  releasedActuals: Record<string, string>;
  release: (eventId: string, value: string) => void;
  reset: (eventId: string) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  releasedActuals: {},
  release: (eventId, value) =>
    set((state) => ({ releasedActuals: { ...state.releasedActuals, [eventId]: value } })),
  reset: (eventId) =>
    set((state) => {
      const next = { ...state.releasedActuals };
      delete next[eventId];
      return { releasedActuals: next };
    }),
}));
