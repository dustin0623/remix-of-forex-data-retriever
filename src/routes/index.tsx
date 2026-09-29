import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Coins, DollarSign, Flame } from "lucide-react";

import { AnalysisCard } from "@/components/market/AnalysisCard";
import { EventsTable } from "@/components/market/EventsTable";
import { ErrorState, PageHeader } from "@/components/market/PageHeader";
import { MarketTimeline } from "@/components/market/MarketTimeline";
import { RecentChanges } from "@/components/market/RecentChanges";
import { StatCard } from "@/components/market/StatCard";
import { SourceTag } from "@/components/market/badges";
import { Skeleton } from "@/components/ui/skeleton";
import { changesQuery, dashboardAnalysisQuery, snapshotQuery, timelineQuery, todayEventsQuery } from "@/services/marketService";
import { useAiConfigured } from "@/stores/settingsStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Forex Market Intelligence" },
      {
        name: "description",
        content:
          "Macro dashboard: today's real Forex Factory + MetalsMine events, live XAUUSD price and AI market overview.",
      },
      { property: "og:title", content: "Dashboard — Forex Market Intelligence" },
      {
        property: "og:description",
        content: "Real economic calendar, live gold price and AI-driven market overview for XAUUSD traders.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const events = useQuery(todayEventsQuery());
  const snapshot = useQuery(snapshotQuery());
  const changes = useQuery(changesQuery());
  const timeline = useQuery(timelineQuery());
  const aiConfigured = useAiConfigured();
  const analysis = useQuery({ ...dashboardAnalysisQuery(), enabled: aiConfigured, staleTime: 10 * 60_000 });

  const list = events.data ?? [];
  const highImpact = list.filter((e) => e.impact === "high");
  const usdEvents = list.filter((e) => e.currency === "USD");
  const goldEvents = list.filter((e) => e.goldRelevance === "high" || e.goldRelevance === "medium");

  const snap = snapshot.data;
  const changeTone = (snap?.changePercent ?? 0) >= 0 ? "bull" : "bear";

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Real Forex Factory + MetalsMine calendar and live gold price (Binance PAXG/USDT). Try what-if releases from any event page."
        actions={<SourceTag label="Direct feed · real data" />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Events today"
          value={list.length}
          hint={`${list.filter((e) => e.actual !== null).length} released · ${list.filter((e) => e.actual === null).length} upcoming`}
          icon={<CalendarClock className="size-4" />}
          loading={events.isLoading}
        />
        <StatCard
          label="High impact"
          value={highImpact.length}
          tone="bear"
          icon={<Flame className="size-4" />}
          loading={events.isLoading}
        />
        <StatCard
          label="USD events"
          value={usdEvents.length}
          icon={<DollarSign className="size-4" />}
          loading={events.isLoading}
        />
        <StatCard
          label="Gold-relevant"
          value={goldEvents.length}
          tone="gold"
          icon={<Coins className="size-4" />}
          loading={events.isLoading}
        />
      </div>

      <section className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Today's market overview</h2>
          <span className="text-xs text-muted-foreground">Live XAU/USD spot · refreshes every 30s</span>
        </div>
        {snapshot.isError && !snap ? (
          <p className="mt-4 text-sm text-bear">Gold price is unavailable right now. Retrying automatically.</p>
        ) : snapshot.isLoading || !snap ? (
          <Skeleton className="mt-4 h-20 w-full" />
        ) : (
          <dl className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-6">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{snap.symbol}</dt>
              <dd className="num mt-1 text-2xl font-semibold text-gold">{snap.price.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Daily change</dt>
              <dd
                className={`num mt-1 text-2xl font-semibold ${changeTone === "bull" ? "text-bull" : "text-bear"}`}
              >
                {snap.changePercent > 0 ? "+" : ""}
                {snap.changePercent.toFixed(2)}%
                <span className="ml-2 text-sm text-muted-foreground">
                  ({snap.changeAbsolute > 0 ? "+" : ""}
                  {snap.changeAbsolute.toFixed(2)})
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">24h open</dt>
              <dd className="num mt-1 text-lg font-medium">{snap.previousPrice.toFixed(2)}</dd>
              <dd className="mt-0.5 text-xs capitalize text-muted-foreground">Trend: {snap.trend}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Macro bias</dt>
              <dd className="mt-1 text-lg font-medium capitalize">{snap.macroBias}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Risk level</dt>
              <dd className="mt-1 text-lg font-medium capitalize text-warn">{snap.riskLevel}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">High-impact events</dt>
              <dd className="num mt-1 text-lg font-medium">{snap.highImpactEventCount}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="panel">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Upcoming events</h2>
          <Link to="/calendar" className="text-xs text-primary hover:underline">
            Open full calendar
          </Link>
        </div>
        {events.isError ? (
          <div className="p-4">
            <ErrorState message="The calendar feed did not respond." onRetry={() => events.refetch()} />
          </div>
        ) : (
          <EventsTable
            events={list}
            loading={events.isLoading}
            emptyTitle="No events scheduled today"
          />
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Recent changes</h2>
            <SourceTag />
          </div>
          <RecentChanges changes={changes.data} loading={changes.isLoading} />
        </section>
        <section className="panel">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">XAUUSD market timeline (24h)</h2>
            <span className="text-xs text-muted-foreground">Binance PAXG/USDT</span>
          </div>
          <MarketTimeline points={timeline.data} loading={timeline.isLoading} />
        </section>
      </div>

      <AnalysisCard
        analysis={analysis.data}
        loading={aiConfigured && analysis.isLoading}
        needsKey={!aiConfigured}
      />
    </>
  );
}
