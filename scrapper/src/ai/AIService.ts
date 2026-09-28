import type { AppConfig } from "../config/env.js";
import type { EconomicEvent } from "../models/schemas.js";
import type { CalendarService } from "../services/calendarService.js";
import { ApiError } from "../utils/response.js";
import { AIError, type AIProvider } from "./AIProvider.js";
import { AnthropicProvider, validateAnalysis } from "./AnthropicProvider.js";
import type { AnalysisInput, MarketAnalysis } from "./schemas/analysis.js";

export interface AIResult {
  data: MarketAnalysis;
  meta: { aiProvider: string; model: string; generatedAt: string };
}

const GOLD = ["very_high", "high", "medium"];
const toInput = (e: EconomicEvent) => ({
  id: e.id, title: e.title, currency: e.currency, datetime: e.datetime, impact: e.impact,
  goldRelevance: e.goldRelevance, status: e.status, actual: e.actual, forecast: e.forecast, previous: e.previous,
});

/** Returns null when AI is disabled or no key is set — the server still starts. */
export function createAIProvider(config: AppConfig, timeoutMs?: number): AIProvider | null {
  if (!config.aiEnabled || !config.anthropicApiKey || config.aiProvider !== "anthropic") return null;
  return new AnthropicProvider({ apiKey: config.anthropicApiKey, model: config.aiModel, ...(timeoutMs ? { timeoutMs } : {}) });
}

export class AIService {
  constructor(
    private readonly provider: AIProvider | null,
    private readonly calendar: CalendarService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get configured(): boolean {
    return this.provider !== null;
  }

  private async run(input: AnalysisInput): Promise<AIResult> {
    if (!this.provider) throw new AIError("AI_NOT_CONFIGURED", "AI analysis is not configured.");
    const data = validateAnalysis(await this.provider.analyze(input)); // re-validate any provider
    return { data, meta: { aiProvider: this.provider.name, model: this.provider.model, generatedAt: this.now().toISOString() } };
  }

  private base(task: AnalysisInput["task"], events: EconomicEvent[], focus: EconomicEvent | null): AnalysisInput {
    const ids = new Set(events.map((e) => e.id));
    if (focus) ids.add(focus.id);
    const recentChanges = this.calendar
      .changes({ limit: 50, since: new Date(this.now().getTime() - 86_400_000).toISOString() })
      .filter((c) => ids.has(c.eventId))
      .map(({ eventId, eventTitle, changeType, oldValue, newValue, detectedAt }) => ({ eventId, eventTitle, changeType, oldValue, newValue, detectedAt }));
    return {
      task,
      generatedAt: this.now().toISOString(),
      market: "XAUUSD",
      focusEvent: focus ? toInput(focus) : null,
      events: events.map(toInput),
      recentChanges,
      marketSnapshot: null, // no live XAUUSD feed yet
    };
  }

  async goldToday(): Promise<AIResult> {
    if (!this.provider) throw new AIError("AI_NOT_CONFIGURED", "AI analysis is not configured.");
    const today = (await this.calendar.today()).data.filter((e) => GOLD.includes(e.goldRelevance) || e.impact === "high");
    return this.run(this.base("gold_today", today, null));
  }

  private async forEvent(task: "event" | "gold_event", id: string): Promise<AIResult> {
    if (!this.provider) throw new AIError("AI_NOT_CONFIGURED", "AI analysis is not configured.");
    const event = await this.calendar.byId(id);
    if (!event) throw new ApiError(404, "EVENT_NOT_FOUND", `No event with id "${id}"`);
    return this.run(this.base(task, [], event));
  }

  event(id: string) { return this.forEvent("event", id); }
  goldEvent(id: string) { return this.forEvent("gold_event", id); }
}
