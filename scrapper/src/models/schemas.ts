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

export const ChangeTypeSchema = z.enum([
  "actual_released",
  "actual_revised",
  "forecast_changed",
  "previous_changed",
  "impact_changed",
  "event_updated",
]);
export type ChangeType = z.infer<typeof ChangeTypeSchema>;

export const EventChangeSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  eventTitle: z.string(),
  currency: z.string(),
  impact: ImpactSchema,
  goldRelevance: RelevanceSchema,
  changeType: ChangeTypeSchema,
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  detectedAt: z.string().datetime(),
  contentHash: z.string(),
});
export type EventChange = z.infer<typeof EventChangeSchema>;

export const EventSnapshotSchema = z.object({
  id: z.number().int(),
  eventId: z.string(),
  contentHash: z.string(),
  actual: z.string().nullable(),
  forecast: z.string().nullable(),
  previous: z.string().nullable(),
  impact: ImpactSchema,
  capturedAt: z.string().datetime(),
});
export type EventSnapshot = z.infer<typeof EventSnapshotSchema>;

export const StatusSchema = z.object({
  status: z.literal("ok"),
  scraper: z.boolean(),
  ai: z.boolean(),
  aiProvider: z.string(),
  aiModel: z.string(),
  provider: z.string(),
  lastScrapeAt: z.string().datetime().nullable(),
  nextAllowedScrapeAt: z.string().datetime().nullable(),
  cachedEvents: z.number().int().nonnegative(),
  recentChanges: z.number().int().nonnegative(),
});
export type Status = z.infer<typeof StatusSchema>;

export const ResponseMetaSchema = z.object({
  source: z.enum(["live", "cache"]),
  stale: z.boolean(),
  fetchedAt: z.string().datetime().nullable(),
});
export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;

/** Event IDs are lowercase slugs, e.g. "usd-core-pce-2026-09-28". */
export const EventIdParamSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/, "Invalid event id"),
});

export const ChangesQuerySchema = z
  .object({
    since: z.string().datetime({ offset: true }).optional(),
    until: z.string().datetime({ offset: true }).optional(),
    impact: ImpactSchema.optional(),
    currency: z
      .string()
      .transform((s) => s.toUpperCase())
      .pipe(CurrencySchema)
      .optional(),
    goldRelevant: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
    limit: z.coerce.number().int().min(1).max(500).default(50),
  })
  .refine((q) => !q.since || !q.until || Date.parse(q.since) <= Date.parse(q.until), {
    message: "since must be before until",
  });
export type ChangesQuery = z.infer<typeof ChangesQuerySchema>;

export const ErrorBodySchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
});

export const successSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ success: z.literal(true), data, meta: ResponseMetaSchema.optional() });
