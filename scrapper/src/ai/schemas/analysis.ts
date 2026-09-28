import { z } from "zod";
import { ChangeTypeSchema, ImpactSchema, RelevanceSchema } from "../../models/schemas.js";

/** Structured input sent to the model. Never raw HTML; missing values are null, never guessed. */
export const AnalysisEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  currency: z.string(),
  datetime: z.string(),
  impact: ImpactSchema,
  goldRelevance: RelevanceSchema,
  status: z.string(),
  actual: z.string().nullable(),
  forecast: z.string().nullable(),
  previous: z.string().nullable(),
});

export const AnalysisInputSchema = z.object({
  task: z.enum(["gold_today", "event", "gold_event"]),
  generatedAt: z.string(),
  market: z.literal("XAUUSD"),
  focusEvent: AnalysisEventSchema.nullable(),
  events: z.array(AnalysisEventSchema),
  recentChanges: z.array(
    z.object({
      eventId: z.string(),
      eventTitle: z.string(),
      changeType: ChangeTypeSchema,
      oldValue: z.string().nullable(),
      newValue: z.string().nullable(),
      detectedAt: z.string(),
    }),
  ),
  /** Optional XAUUSD snapshot; null when no market feed is available. */
  marketSnapshot: z
    .object({ price: z.number().nullable(), changePct: z.number().nullable(), asOf: z.string().nullable() })
    .nullable(),
});
export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;

export const KeyEventSchema = z
  .object({
    eventId: z.string().nullable(),
    title: z.string(),
    currency: z.string().nullable(),
    impact: ImpactSchema.nullable(),
    whyItMatters: z.string(),
  })
  .strict();

export const MarketAnalysisSchema = z
  .object({
    market: z.literal("XAUUSD"),
    bias: z.enum(["bullish", "bearish", "neutral"]),
    confidence: z.enum(["low", "moderate", "high"]),
    riskLevel: z.enum(["low", "medium", "high"]),
    summary: z.string().min(1),
    keyDrivers: z.array(z.string()),
    keyEvents: z.array(KeyEventSchema),
    bullishScenario: z.string(),
    bearishScenario: z.string(),
    neutralScenario: z.string(),
    warnings: z.array(z.string()),
    masterPost: z.string(),
  })
  .strict();
export type MarketAnalysis = z.infer<typeof MarketAnalysisSchema>;

/** Trading-call language the AI must never produce (context and scenarios only). */
const FORBIDDEN: RegExp[] = [
  /\b(BUY|SELL)\b/, // upper-case trade calls; lower-case "selling pressure" is allowed context
  /\b(go|going) (long|short)\b/i,
  /\bentry (price|point|level|zone|at)\b/i,
  /\bstop[- ]?loss(es)?\b/i,
  /\btake[- ]?profits?\b/i,
  /\bposition[- ]siz(e|es|ing)\b/i,
  /\bleverage\b/i,
];

export function findForbiddenTradingLanguage(a: MarketAnalysis): string | null {
  const texts = [
    a.summary, a.bullishScenario, a.bearishScenario, a.neutralScenario, a.masterPost,
    ...a.keyDrivers, ...a.warnings, ...a.keyEvents.map((e) => e.whyItMatters),
  ];
  for (const t of texts) for (const re of FORBIDDEN) if (re.test(t)) return re.source;
  return null;
}

/** JSON Schema given to Claude as the only tool it may call (forces structured output). */
export const MARKET_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "market", "bias", "confidence", "riskLevel", "summary", "keyDrivers", "keyEvents",
    "bullishScenario", "bearishScenario", "neutralScenario", "warnings", "masterPost",
  ],
  properties: {
    market: { type: "string", enum: ["XAUUSD"] },
    bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
    confidence: { type: "string", enum: ["low", "moderate", "high"] },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    summary: { type: "string" },
    keyDrivers: { type: "array", items: { type: "string" } },
    keyEvents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["eventId", "title", "currency", "impact", "whyItMatters"],
        properties: {
          eventId: { type: ["string", "null"] },
          title: { type: "string" },
          currency: { type: ["string", "null"] },
          impact: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
          whyItMatters: { type: "string" },
        },
      },
    },
    bullishScenario: { type: "string" },
    bearishScenario: { type: "string" },
    neutralScenario: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
    masterPost: { type: "string" },
  },
} as const;
