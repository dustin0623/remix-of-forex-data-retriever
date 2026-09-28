import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AnalysisCard } from "@/components/market/AnalysisCard";
import { EventsTable } from "@/components/market/EventsTable";
import { PageHeader } from "@/components/market/PageHeader";
import { StatCard } from "@/components/market/StatCard";
import { SimulatedTag } from "@/components/market/badges";
import { eventsQuery, goldAnalysisQuery, snapshotQuery } from "@/services/marketService";

export const Route = createFileRoute("/gold")({
  head: () => ({
    meta: [
      { title: "Gold Analysis — Forex Market Intelligence" },
      {
        name: "description",
        content: "Simulated XAUUSD bias, risk level, USD context and bull/bear/neutral scenarios.",
      },
      { property: "og:title", content: "Gold Analysis — Forex Market Intelligence" },
      {
        property: "og:description",
        content: "Mock XAUUSD outlook with key economic events and scenario planning.",
      },
    ],
  }),
  component: GoldPage,
});

function GoldPage() {
  const analysis = useQuery(goldAnalysisQuery());
  const snapshot = useQuery(snapshotQuery());
  const events = useQuery(eventsQuery());

  const goldEvents = (events.data ?? []).filter(
    (e) => e.goldRelevance === "high" || e.goldRelevance === "medium",
  );

  return (
    <>
      <PageHeader
        title="Gold Analysis"
        description="Every figure and scenario below is produced by a local simulation. It is not market analysis and not advice."
        actions={<SimulatedTag label="Simulated analysis" />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="XAUUSD"
          value={snapshot.data ? snapshot.data.price.toFixed(2) : "—"}
          tone="gold"
          hint="Simulated price"
          loading={snapshot.isLoading}
        />
        <StatCard
          label="Bias"
          value={<span className="capitalize">{analysis.data?.bias ?? "—"}</span>}
          tone={analysis.data?.bias === "bullish" ? "bull" : analysis.data?.bias === "bearish" ? "bear" : "default"}
          hint="Simulated directional lean"
          loading={analysis.isLoading}
        />
        <StatCard
          label="Risk level"
          value={<span className="capitalize">{snapshot.data?.riskLevel ?? "—"}</span>}
          tone="warn"
          hint="Event-driven volatility risk"
          loading={snapshot.isLoading}
        />
        <StatCard
          label="Key events"
          value={goldEvents.length}
          hint="Gold-relevant this week"
          loading={events.isLoading}
        />
      </div>

      <AnalysisCard
        analysis={analysis.data}
        loading={analysis.isLoading}
        title="XAUUSD outlook"
        showUsdContext
      />

      <section className="panel">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Key economic events for gold</h2>
          <SimulatedTag />
        </div>
        <EventsTable
          events={goldEvents}
          loading={events.isLoading}
          showDate
          emptyTitle="No gold-relevant events in the simulated window"
        />
      </section>
    </>
  );
}
