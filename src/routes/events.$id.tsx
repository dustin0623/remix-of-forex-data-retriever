import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/market/PageHeader";
import { ImpactBadge, RelevanceMeter, SimulatedTag } from "@/components/market/badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { simulateActual } from "@/mock/events";
import { eventQuery } from "@/services/marketService";
import { useSimulationStore } from "@/stores/simulationStore";

export const Route = createFileRoute("/events/$id")({
  head: () => ({
    meta: [
      { title: "Event Details — Forex Market Intelligence" },
      {
        name: "description",
        content: "Simulated economic event detail with forecast, previous values and a release simulator.",
      },
      { property: "og:title", content: "Event Details — Forex Market Intelligence" },
      {
        property: "og:description",
        content: "Inspect a simulated economic release and trigger a mock data update.",
      },
    ],
  }),
  component: EventDetails,
});

function Field({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-medium ${mono ? "num" : ""}`}>{value}</p>
    </div>
  );
}

function EventDetails() {
  const { id } = Route.useParams();
  const { data: event, isLoading, isError, refetch } = useQuery(eventQuery(id));
  const released = useSimulationStore((s) => s.releasedActuals[id]);
  const release = useSimulationStore((s) => s.release);
  const reset = useSimulationStore((s) => s.reset);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return <EmptyState title="Couldn't load this event" description="The simulation layer did not respond." />;
  }

  if (!event) {
    return (
      <EmptyState
        title="Event not found"
        description="This simulated event id does not exist. Return to the calendar to pick another."
      />
    );
  }

  const actual = released ?? event.actual;

  return (
    <>
      <Link to="/calendar" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Back to calendar
      </Link>

      <PageHeader
        title={event.title}
        description={`${event.currency} · ${new Date(event.datetime).toLocaleString()} · ${event.source}`}
        actions={
          <div className="flex items-center gap-2">
            <ImpactBadge impact={event.impact} />
            <SimulatedTag label="Simulated data" />
          </div>
        }
      />

      <section className="panel p-5">
        <p className="text-sm text-foreground/90">{event.description}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Actual" value={actual ?? "Not released"} />
          <Field label="Forecast" value={event.forecast ?? "—"} />
          <Field label="Previous" value={event.previous ?? "—"} />
          <Field label="Scheduled" value={event.time} />
          <Field
            label="Gold relevance"
            value={<RelevanceMeter level={event.goldRelevance} label="Gold relevance" />}
            mono={false}
          />
          <Field
            label="USD relevance"
            value={<RelevanceMeter level={event.usdRelevance} label="USD relevance" />}
            mono={false}
          />
          <Field label="Currency" value={event.currency} />
          <Field label="Impact" value={<ImpactBadge impact={event.impact} />} mono={false} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button
            onClick={() => {
              const value = simulateActual(event);
              release(event.id, value);
              toast.success("Simulated release applied", {
                description: `${event.title} actual set to ${value} (local simulation only).`,
              });
            }}
          >
            <Play className="size-4" aria-hidden />
            Simulate release
          </Button>
          {released ? (
            <Button variant="outline" onClick={() => reset(event.id)}>
              <RotateCcw className="size-4" aria-hidden />
              Revert to unreleased
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Generates a local value only. No external request is made.
          </p>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold">Historical prints (simulated)</h2>
        {event.history.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No history for this event type"
              description="Speeches and bulletins have no numeric series."
            />
          </div>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 font-medium">Period</th>
                <th className="py-2 text-right font-medium">Actual</th>
                <th className="py-2 text-right font-medium">Forecast</th>
              </tr>
            </thead>
            <tbody>
              {event.history.map((row) => (
                <tr key={row.period} className="border-b border-border/60 last:border-0">
                  <td className="py-2 text-muted-foreground">{row.period}</td>
                  <td className="num py-2 text-right font-medium">{row.actual}</td>
                  <td className="num py-2 text-right text-muted-foreground">{row.forecast ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
