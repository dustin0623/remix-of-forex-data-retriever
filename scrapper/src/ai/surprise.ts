import type { SurpriseDirection } from "./schemas/analysis.js";

/** Parses "0.4%", "187K", "-1.2%", "3.40%" into value + unit. Returns null for anything else. */
function parse(v: string): { n: number; unit: string } | null {
  const m = v.trim().replace(/,/g, "").match(/^([+-]?\d+(?:\.\d+)?)\s*(%|[KMBT])?$/i);
  return m ? { n: Number(m[1]), unit: (m[2] ?? "").toUpperCase() } : null;
}

/**
 * Direction only — never a magnitude. "unknown" whenever values can't be compared safely
 * (missing forecast, different units, non-numeric text).
 */
export function surpriseDirection(actual: string | null, forecast: string | null): SurpriseDirection {
  if (actual === null) return "not_released";
  if (forecast === null) return "unknown";
  const a = parse(actual);
  const f = parse(forecast);
  if (!a || !f || a.unit !== f.unit) return "unknown";
  if (a.n === f.n) return "in_line";
  return a.n > f.n ? "above_forecast" : "below_forecast";
}
