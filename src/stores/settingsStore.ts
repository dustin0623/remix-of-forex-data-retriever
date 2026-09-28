import { create } from "zustand";

export interface SettingsState {
  simulationMode: boolean;
  dataSource: "simulation" | "external";
  theme: "dark" | "system";
  apiEndpoint: string;
  aiProvider: string;
  setSimulationMode: (value: boolean) => void;
  setTheme: (value: "dark" | "system") => void;
  setApiEndpoint: (value: string) => void;
}

/** Client-only preferences. Nothing here connects to a real service yet. */
export const useSettingsStore = create<SettingsState>((set) => ({
  simulationMode: true,
  dataSource: "simulation",
  theme: "dark",
  apiEndpoint: "http://localhost:4000",
  aiProvider: "Not configured",
  setSimulationMode: (simulationMode) => set({ simulationMode }),
  setTheme: (theme) => set({ theme }),
  setApiEndpoint: (apiEndpoint) => set({ apiEndpoint }),
}));
