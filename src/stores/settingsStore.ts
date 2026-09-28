import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type DataSource = "simulation" | "live";

export const DEFAULT_API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/+$/, "") || "http://localhost:5000";

export interface SettingsState {
  /** SIMULATION (default) uses the local mock layer; LIVE calls the /scrapper API. */
  dataSource: DataSource;
  /** Kept for existing readers; always equals dataSource === "simulation". */
  simulationMode: boolean;
  theme: "dark" | "system";
  apiBaseUrl: string;
  setDataSource: (value: DataSource) => void;
  setTheme: (value: "dark" | "system") => void;
  setApiBaseUrl: (value: string) => void;
}

/**
 * Client-only preferences, persisted to localStorage. No secrets are ever stored here.
 * Hydration is manual (see SettingsHydrator) so server and first client render match.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dataSource: "simulation",
      simulationMode: true,
      theme: "dark",
      apiBaseUrl: DEFAULT_API_BASE_URL,
      setDataSource: (dataSource) => set({ dataSource, simulationMode: dataSource === "simulation" }),
      setTheme: (theme) => set({ theme }),
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl: apiBaseUrl.trim().replace(/\/+$/, "") }),
    }),
    {
      name: "fmi-settings",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ dataSource: s.dataSource, simulationMode: s.simulationMode, theme: s.theme, apiBaseUrl: s.apiBaseUrl }),
    },
  ),
);

export const useDataSource = () => useSettingsStore((s) => s.dataSource);
export const useIsLive = () => useSettingsStore((s) => s.dataSource === "live");
