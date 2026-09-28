import { useNavigate } from "@tanstack/react-router";

import { EmptyState } from "@/components/market/PageHeader";
import { ImpactBadge, RelevanceMeter } from "@/components/market/badges";
import { Skeleton } from "@/components/ui/skeleton";
import type { EconomicEvent } from "@/types/market";
import { cn } from "@/lib/utils";

export function formatTime(event: EconomicEvent) {
  if (event.time === "All Day") return "All Day";
  return new Date(event.datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function EventsTable({
  events,
  loading,
  showDate = false,
  emptyTitle = "No events match these filters",
}: {
  events: EconomicEvent[];
  loading?: boolean;
  showDate?: boolean;
  emptyTitle?: string;
}) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-4">
        <EmptyState title={emptyTitle} description="Adjust the filters or pick a different date." />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            {showDate ? <th className="px-3 py-2 font-medium">Date</th> : null}
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Cur</th>
            <th className="px-3 py-2 font-medium">Event</th>
            <th className="px-3 py-2 font-medium">Impact</th>
            <th className="px-3 py-2 text-right font-medium">Actual</th>
            <th className="px-3 py-2 text-right font-medium">Forecast</th>
            <th className="px-3 py-2 text-right font-medium">Previous</th>
            <th className="px-3 py-2 font-medium">Gold</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const actual = event.actual;
            return (
              <tr
                key={event.id}
                tabIndex={0}
                role="link"
                aria-label={`Open details for ${event.title}`}
                onClick={() => navigate({ to: "/events/$id", params: { id: event.id } })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate({ to: "/events/$id", params: { id: event.id } });
                  }
                }}
                className="cursor-pointer border-b border-border/60 outline-none transition-colors last:border-0 hover:bg-accent/50 focus-visible:bg-accent/60"
              >
                {showDate ? (
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDay(event.datetime)}</td>
                ) : null}
                <td className="num whitespace-nowrap px-3 py-2 text-muted-foreground">{formatTime(event)}</td>
                <td className="num px-3 py-2 font-medium">{event.currency}</td>
                <td className="px-3 py-2 text-foreground">{event.title}</td>
                <td className="px-3 py-2">
                  <ImpactBadge impact={event.impact} />
                </td>
                <td
                  className={cn(
                    "num px-3 py-2 text-right",
                    actual ? "font-medium text-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {actual ?? "—"}
                  {event.status === "UPDATED" ? (
                    <span className="ml-1 text-[10px] uppercase text-warn" title="Revised after publication">rev</span>
                  ) : null}
                </td>
                <td className="num px-3 py-2 text-right text-muted-foreground">{event.forecast ?? "—"}</td>
                <td className="num px-3 py-2 text-right text-muted-foreground">{event.previous ?? "—"}</td>
                <td className="px-3 py-2">
                  <RelevanceMeter level={event.goldRelevance} label="Gold relevance" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
