import type { AIProvider } from "./AIProvider.js";
import type { AnalysisInput, MarketAnalysis } from "./schemas/analysis.js";
import { surpriseDirection } from "./surprise.js";

const FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CHF: "🇨🇭", CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿", CNY: "🇨🇳",
};
const na = (v: string | null, fallback = "n/a") => v ?? fallback;

/**
 * Deterministic, offline provider for tests and local dev (AI_PROVIDER=mock).
 * Builds the analysis purely from the input — no network, no credits.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "mock-analyst-1";
  calls: AnalysisInput[] = [];

  async analyze(input: AnalysisInput): Promise<MarketAnalysis> {
    this.calls.push(input);
    const events = input.focusEvent ? [input.focusEvent] : input.events.slice(0, 4);
    const focus = input.focusEvent;
    const dir = focus ? surpriseDirection(focus.actual, focus.forecast) : null;
    const usdFocus = focus?.currency === "USD";
    const bias: MarketAnalysis["bias"] =
      usdFocus && dir === "above_forecast" ? "bearish" : usdFocus && dir === "below_forecast" ? "bullish" : "neutral";
    const biasLabel = bias[0]!.toUpperCase() + bias.slice(1);

    const eventLines = events.length
      ? events
          .map((e) => `${FLAGS[e.currency] ?? "🌐"} ${e.title} — ${e.datetime.slice(11, 16)} UTC\nActual: ${na(e.actual, "pending")} | Forecast: ${na(e.forecast)} | Previous: ${na(e.previous)}`)
          .join("\n")
      : "No gold-relevant events in the data.";

    const context = focus
      ? `${focus.title} came in ${dir === "not_released" ? "not yet released" : dir?.replace("_", " ")}. A firmer USD result could weigh on gold, while a softer one may support it.`
      : "Gold may react to US data and yield moves; no live price feed is available.";

    const header = focus ? `🟡 GOLD EVENT UPDATE — ${focus.title}` : "🟡 GOLD DAILY OUTLOOK";
    const educational = input.postStyle === "educational" ? "\nWhy it matters: US data can shift yields and the dollar, which gold often moves against.\n" : "";
    const masterPost = [
      header,
      `XAUUSD Macro Bias: ${biasLabel}`,
      "",
      "📊 Key Events (observed):",
      eventLines,
      "",
      "🧭 Market Context (interpretation):",
      context,
      educational,
      "📈 Bullish Scenario: Softer US data could potentially support gold.",
      "📉 Bearish Scenario: Stronger US data may lift yields and pressure gold.",
      "⚠️ Risk: medium — the market may react sharply around releases.",
      "Not financial advice. Context only, no trade signals.",
    ].filter((l) => input.postStyle !== "concise" || l !== "").join("\n");

    return {
      market: "XAUUSD",
      bias,
      confidence: "low",
      riskLevel: "medium",
      summary: context,
      keyDrivers: ["US dollar direction", "Real yields"],
      keyEvents: events.map((e) => ({ eventId: e.id, title: e.title, currency: e.currency, impact: e.impact, whyItMatters: `${e.goldRelevance} gold relevance.` })),
      bullishScenario: "Softer US data could potentially support gold.",
      bearishScenario: "Stronger US data may lift yields and pressure gold.",
      neutralScenario: "In-line data may keep gold range-bound.",
      warnings: input.marketSnapshot ? [] : ["No XAUUSD price snapshot available."],
      masterPost,
      eventAnalysis: focus
        ? {
            actual: focus.actual, forecast: focus.forecast, previous: focus.previous,
            surpriseDirection: dir!,
            macroImplication: "The result could shift rate expectations modestly.",
            goldContext: "Gold may react through the dollar and yields.",
          }
        : null,
    };
  }
}
