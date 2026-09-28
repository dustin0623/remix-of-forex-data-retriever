import type { GoldRelevance } from "../scraper/forexFactory/types.js";

export interface GoldRelevanceRule {
  name: string;
  /** Matched against the event title (case-insensitive). */
  pattern: RegExp;
  /** Restrict to these currencies; omit for any. */
  currencies?: string[];
  relevance: GoldRelevance;
}

/** Ordered — first match wins. Edit freely; the parser never sees these. */
export const DEFAULT_GOLD_RULES: GoldRelevanceRule[] = [
  { name: "FOMC member speech", pattern: /\bfomc member\b/i, currencies: ["USD"], relevance: "high" },
  { name: "Fed Chair speech", pattern: /\bfed chair\b|\bpowell\b/i, currencies: ["USD"], relevance: "very_high" },
  { name: "FOMC decision/statement", pattern: /\bfomc\b|federal funds rate/i, currencies: ["USD"], relevance: "very_high" },
  { name: "CPI", pattern: /\bcpi\b/i, currencies: ["USD"], relevance: "very_high" },
  { name: "PCE", pattern: /\bpce\b/i, currencies: ["USD"], relevance: "very_high" },
  { name: "Non-Farm Payrolls", pattern: /non-?farm|\bnfp\b/i, currencies: ["USD"], relevance: "very_high" },
  { name: "GDP", pattern: /\bgdp\b/i, currencies: ["USD"], relevance: "very_high" },
  { name: "PPI", pattern: /\bppi\b/i, currencies: ["USD"], relevance: "very_high" },
  { name: "Retail Sales", pattern: /retail sales/i, currencies: ["USD"], relevance: "very_high" },
  { name: "Labour market", pattern: /unemployment|jobless|employment change|\bjolts\b/i, currencies: ["USD"], relevance: "very_high" },
  { name: "Other central-bank rate", pattern: /rate statement|cash rate|refinancing rate|policy rate/i, relevance: "medium" },
];
