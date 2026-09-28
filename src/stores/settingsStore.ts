import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type DataSource = "simulation" | "live";
export type AiProvider = "gemini" | "openai" | "anthropic";
export type PostStyle = "professional" | "concise" | "educational";

export const DEFAULT_API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/+$/, "") || "http://localhost:5000";

export const AI_PROVIDERS: Record<AiProvider, { label: string; defaultModel: string; models: string[]; keyHint: string; keyUrl: string }> = {
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-3.8-flash",
    models: ["gemini-3.8-flash", "gemini-3.5-flash-lite"],
    keyHint: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
    keyHint: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    label: "Anthropic",
    defaultModel: "claude-haiku-4-5",
    models: ["claude-haiku-4-5", "claude-sonnet-4-5"],
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
};

export interface SettingsState {
  /** SIMULATION = real scraped calendar + local what-if overrides; LIVE = /scrapper API. */
  dataSource: DataSource;
  simulationMode: boolean;
  theme: "dark" | "system";
  apiBaseUrl: string;
  aiProvider: AiProvider;
  aiKeys: Record<AiProvider, string>;
  aiModels: Record<AiProvider, string>;
  postStyle: PostStyle;
  /** Myfxbook account used for the Community Outlook sentiment (browser only). */
  myfxbookEmail: string;
  myfxbookPassword: string;
  setMyfxbook: (email: string, password: string) => void;
  setDataSource: (value: DataSource) => void;
  setTheme: (value: "dark" | "system") => void;
  setApiBaseUrl: (value: string) => void;
  setAiProvider: (value: AiProvider) => void;
  setAiKey: (p: AiProvider, key: string) => void;
  setAiModel: (p: AiProvider, model: string) => void;
  setPostStyle: (value: PostStyle) => void;
}

/**
 * Client-only preferences persisted to localStorage, including the user's own
 * (throwaway) AI keys. Keys are sent to the server only per AI request.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dataSource: "simulation",
      simulationMode: true,
      theme: "dark",
      apiBaseUrl: DEFAULT_API_BASE_URL,
      aiProvider: "gemini",
      aiKeys: { gemini: "", openai: "", anthropic: "" },
      aiModels: { gemini: AI_PROVIDERS.gemini.defaultModel, openai: AI_PROVIDERS.openai.defaultModel, anthropic: AI_PROVIDERS.anthropic.defaultModel },
      postStyle: "professional",
      myfxbookEmail: "",
      myfxbookPassword: "",
      setMyfxbook: (myfxbookEmail, myfxbookPassword) => set({ myfxbookEmail: myfxbookEmail.trim(), myfxbookPassword }),
      setDataSource: (dataSource) => set({ dataSource, simulationMode: dataSource === "simulation" }),
      setTheme: (theme) => set({ theme }),
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl: apiBaseUrl.trim().replace(/\/+$/, "") }),
      setAiProvider: (aiProvider) => set({ aiProvider }),
      setAiKey: (p, key) => set((s) => ({ aiKeys: { ...s.aiKeys, [p]: key.trim() } })),
      setAiModel: (p, model) => set((s) => ({ aiModels: { ...s.aiModels, [p]: model.trim() } })),
      setPostStyle: (postStyle) => set({ postStyle }),
    }),
    {
      name: "fmi-settings",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      migrate: (persisted) => persisted as SettingsState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...p,
          aiKeys: { ...current.aiKeys, ...(p.aiKeys ?? {}) },
          aiModels: Object.fromEntries(
            (Object.keys(AI_PROVIDERS) as AiProvider[]).map((k) => {
              const saved = p.aiModels?.[k];
              return [k, saved && AI_PROVIDERS[k].models.includes(saved) ? saved : AI_PROVIDERS[k].defaultModel];
            }),
          ) as Record<AiProvider, string>,
        };
      },
      partialize: (s) => ({
        dataSource: s.dataSource,
        simulationMode: s.simulationMode,
        theme: s.theme,
        apiBaseUrl: s.apiBaseUrl,
        aiProvider: s.aiProvider,
        aiKeys: s.aiKeys,
        aiModels: s.aiModels,
        postStyle: s.postStyle,
        myfxbookEmail: s.myfxbookEmail,
        myfxbookPassword: s.myfxbookPassword,
      }),
    },
  ),
);

export const useDataSource = () => useSettingsStore((s) => s.dataSource);
export const useIsLive = () => useSettingsStore((s) => s.dataSource === "live");

/** Current AI credentials, or null when the active provider has no key. */
export function currentAiConfig() {
  const s = useSettingsStore.getState();
  const apiKey = s.aiKeys[s.aiProvider];
  return apiKey ? { provider: s.aiProvider, apiKey, model: s.aiModels[s.aiProvider] || AI_PROVIDERS[s.aiProvider].defaultModel } : null;
}
export const useAiConfigured = () => useSettingsStore((s) => Boolean(s.aiKeys[s.aiProvider]));
export const useMyfxbookConfigured = () =>
  useSettingsStore((s) => Boolean(s.myfxbookEmail && s.myfxbookPassword));
