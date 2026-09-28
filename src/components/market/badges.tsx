import type { Bias, Impact, Relevance } from "@/types/market";
import { cn } from "@/lib/utils";

const impactStyles: Record<Impact, string> = {
  low: "border-muted-foreground/30 text-muted-foreground",
  medium: "border-warn/40 text-warn",
  high: "border-bear/50 text-bear",
};

export function ImpactBadge({ impact, className }: { impact: Impact; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        impactStyles[impact],
        className,
      )}
      title={`${impact} impact event`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {impact}
    </span>
  );
}

const relevanceStyles: Record<Relevance, string> = {
  none: "text-muted-foreground/60",
  low: "text-muted-foreground",
  medium: "text-warn",
  high: "text-gold",
};

export function RelevanceMeter({ level, label }: { level: Relevance; label: string }) {
  const filled = { none: 0, low: 1, medium: 2, high: 3 }[level];
  return (
    <span className={cn("inline-flex items-center gap-1", relevanceStyles[level])} title={`${label}: ${level}`}>
      <span className="flex items-center gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("h-3 w-1 rounded-sm", i < filled ? "bg-current" : "bg-border")}
          />
        ))}
      </span>
      <span className="sr-only">{`${label}: ${level}`}</span>
      <span className="text-xs capitalize">{level}</span>
    </span>
  );
}

const biasStyles: Record<Bias, string> = {
  bullish: "border-bull/40 bg-bull/10 text-bull",
  bearish: "border-bear/40 bg-bear/10 text-bear",
  neutral: "border-info/40 bg-info/10 text-info",
};

export function BiasBadge({ bias, className }: { bias: Bias; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize",
        biasStyles[bias],
        className,
      )}
    >
      {bias}
    </span>
  );
}

export function SimulatedTag({ label = "Simulated", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border border-sim-foreground/30 bg-sim/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-sim-foreground",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
