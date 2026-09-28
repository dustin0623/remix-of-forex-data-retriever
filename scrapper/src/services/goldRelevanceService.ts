import { DEFAULT_GOLD_RULES, type GoldRelevanceRule } from "../config/goldRelevanceRules.js";
import type { FFImpact, GoldRelevance } from "../scraper/forexFactory/types.js";

export class GoldRelevanceService {
  constructor(private readonly rules: GoldRelevanceRule[] = DEFAULT_GOLD_RULES) {}

  classify(e: { event: string; currency: string; impact: FFImpact }): GoldRelevance {
    const cur = e.currency.toUpperCase();
    for (const rule of this.rules) {
      if (rule.currencies && !rule.currencies.includes(cur)) continue;
      if (rule.pattern.test(e.event)) return rule.relevance;
    }
    // Fallback: USD drives gold; other currencies matter less.
    if (cur === "USD") return e.impact === "high" ? "high" : e.impact === "medium" ? "medium" : "low";
    return e.impact === "high" ? "medium" : "low";
  }
}
