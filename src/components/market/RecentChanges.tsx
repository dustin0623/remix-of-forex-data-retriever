import { Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/market/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChangeType, EventChange } from "@/types/market";

const labels: Record<ChangeType, string> = {
  actual_released: "Actual released",
  actual_revised: "Actual revised",
  forecast_revised: "Forecast revised",
  forecast_changed: "Forecast changed",
  previous_changed: "Previous revised",
  impact_changed: "Impact changed",
  event_updated: "Time changed",
};

export function RecentChanges({ changes, loading, limit = 8 }: { changes?: EventChange[] | undefined; loading?: boolean; limit?: number }) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (!changes || changes.length === 0) {
    return (
      <div className="p-4">
        <EmptyState title="No changes detected" description="Simulate a release on any event to see it here." />
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/60 text-sm">
      {changes.slice(0, limit).map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5">
          <span className="num w-28 shrink-0 text-xs text-muted-foreground">
            {new Date(c.detectedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="w-32 shrink-0 text-xs uppercase tracking-wider text-primary">{labels[c.changeType]}</span>
          <Link to="/events/$id" params={{ id: c.eventId }} className="min-w-0 flex-1 truncate hover:underline">
            {c.eventTitle}
          </Link>
          <span className="num text-muted-foreground">
            {c.previousValue ?? "—"} <span aria-hidden>→</span>
            <span className="sr-only">changed to</span>{" "}
            <span className="font-medium text-foreground">{c.newValue ?? "—"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
