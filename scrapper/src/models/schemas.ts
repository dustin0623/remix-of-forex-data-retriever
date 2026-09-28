import { z } from "zod";

export const ImpactSchema = z.enum(["low", "medium", "high"]);
export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/);
export const RelevanceSchema = z.enum(["none", "low", "medium", "high", "very_high"]);
export const EventStatusSchema = z.enum(["UPCOMING", "RELEASED", "UPDATED"]);

/** Mirrors the frontend's EconomicEvent (src/types/market.ts). */
export const EconomicEventSchema = z.object({
  id: z.string().min(1),
  datetime: z.string().datetime(),
  time: z.string(),
  currency: CurrencySchema,
  title: z.string().min(1),
  impact: ImpactSchema,
  status: EventStatusSchema,
  actual: z.string().nullable(),
  forecast: z.string().nullable(),
  previous: z.string().nullable(),
  goldRelevance: RelevanceSchema,
  usdRelevance: RelevanceSchema,
  source: z.string(),
  description: z.string(),
  history: z.array(
    z.object({ period: z.string(), actual: z.string(), forecast: z.string().nullable() }),
  ),
});
export type EconomicEvent = z.infer<typeof EconomicEventSchema>;

export const ChangeFieldSchema = z.enum(["actual", "forecast", "previous"]);
export const ChangeTypeSchema = z.enum([
  "actual_released",
  "actual_revised",
  "forecast_revised",
  "previous_revised",
]);

export const EventChangeSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  eventTitle: z.string(),
  changeType: ChangeTypeSchema,
  field: ChangeFieldSchema,
  previousValue: z.string().nullable(),
  newValue: z.string().nullable(),
  detectedAt: z.string().datetime(),
});
export type EventChange = z.infer<typeof EventChangeSchema>;

export const StatusSchema = z.object({
  status: z.literal("ok"),
  scraper: z.boolean(),
  ai: z.boolean(),
  aiProvider: z.string(),
  aiModel: z.string(),
});
export type Status = z.infer<typeof StatusSchema>;

/** Event IDs are lowercase slugs, e.g. "usd-core-pce-2026-09-28". */
export const EventIdParamSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/, "Invalid event id"),
});

export const ChangesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const ErrorBodySchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
});

export const successSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ success: z.literal(true), data });
