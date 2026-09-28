import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Loads saved settings after hydration (so server and first client render match)
 * and refetches all market data whenever the data source or API address changes.
 */
export function SettingsHydrator() {
  const qc = useQueryClient();
  useEffect(() => {
    const before = useSettingsStore.getState();
    let prev = { dataSource: before.dataSource, apiBaseUrl: before.apiBaseUrl };
    const unsub = useSettingsStore.subscribe((s) => {
      if (s.dataSource !== prev.dataSource || s.apiBaseUrl !== prev.apiBaseUrl) {
        prev = { dataSource: s.dataSource, apiBaseUrl: s.apiBaseUrl };
        void qc.resetQueries();
      }
    });
    void useSettingsStore.persist.rehydrate();
    return unsub;
  }, [qc]);
  return null;
}
