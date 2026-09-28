import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { CotCard } from "@/components/market/CotCard";
import { AnalysisCard } from "@/components/market/AnalysisCard";
import { EventsTable } from "@/components/market/EventsTable";
import { MasterPostPanel } from "@/components/market/MasterPostPanel";
import { PageHeader } from "@/components/market/PageHeader";
import { SentimentCard } from "@/components/market/SentimentCard";
import { StatCard } from "@/components/market/StatCard";
import { SourceTag } from "@/components/market/badges";
import { Button } from "@/components/ui/button";
import { analyzeGold } from "@/lib/ai.functions";
import { fetchNews } from "@/lib/news.functions";
import { eventsQuery, goldAnalysisQuery, snapshotQuery } from "@/services/marketService";
import { AI_PROVIDERS, currentAiConfig, useAiConfigured } from "@/stores/settingsStore";
import type { MarketAnalysis } from "@/types/market";

export const Route = createFileRoute("/gold")({
  head: () => ({
    meta: [
      { title: "Gold Analysis — Forex Market Intelligence" },
      {
        name: "description",
        content: "XAUUSD bias, risk level, USD context and scenarios from the economic calendar, with optional breaking-news context.",
      },
      { property: "og:title", content: "Gold Analysis — Forex Market Intelligence" },
      {
        property: "og:description",
        content: "XAUUSD outlook built from real economic events, with an optional news-aware second opinion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GoldPage,
});

function GoldPage() {
  const aiConfigured = useAiConfigured();
  const analysis = useQuery({ ...goldAnalysisQuery(), enabled: aiConfigured, staleTime: 10 * 60_000 });
  const snapshot = useQuery(snapshotQuery());
  const events = useQuery(eventsQuery());

  const runAnalysis = useServerFn(analyzeGold);
  const loadNews = useServerFn(fetchNews);
  const [newsAnalysis, setNewsAnalysis] = useState<MarketAnalysis | null>(null);
  const [mode, setMode] = useState<"calendar" | "news">("calendar");
  const [busy, setBusy] = useState(false);

  const goldEvents = (events.data ?? []).filter(
    (e) => e.goldRelevance === "high" || e.goldRelevance === "medium",
  );

  async function runWithNews() {
    const cfg = currentAiConfig();
    if (!cfg) return;
    setBusy(true);
    try {
      const news = await loadNews();
      const r = await runAnalysis({
        data: {
          ...cfg,
          events: goldEvents.slice(0, 60).map(({ title, currency, impact, datetime, actual, forecast, previous, goldRelevance }) => ({
            title, currency, impact, datetime, actual, forecast, previous, goldRelevance,
          })),
          headlines: news.items.slice(0, 40).map(({ id, source, title, publishedAt }) => ({ id, source, title, publishedAt })),
        },
      });
      setNewsAnalysis({
        id: `ai-gold-news-${Date.now()}`,
        subject: `XAUUSD + news — ${AI_PROVIDERS[cfg.provider].label} (${cfg.model})`,
        bias: r.bias,
        confidence: r.confidence / 100,
        summary: r.summary,
        keyDrivers: r.keyDrivers,
        mainRisks: r.mainRisks,
        usdContext: r.usdContext,
        scenarios: r.scenarios.map((s) => ({ ...s, probability: s.probability / 100 })),
        generatedAt: r.generatedAt,
        sample: false,
      });
      setMode("news");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shown = mode === "news" ? newsAnalysis : analysis.data;

  return (
    <>
      <PageHeader
        title="Gold Analysis"
        description="Real Forex Factory + MetalsMine events and live gold price. The outlook is written by your own AI key (Settings). Not advice."
        actions={analysis.data?.sample === false ? <SourceTag label="AI analysis" /> : null}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="XAUUSD"
          value={snapshot.data ? snapshot.data.price.toFixed(2) : "—"}
          tone="gold"
          hint="Live · Binance PAXG/USDT"
          loading={snapshot.isLoading}
        />
        <StatCard
          label="Bias"
          value={<span className="capitalize">{shown?.bias ?? "—"}</span>}
          tone={shown?.bias === "bullish" ? "bull" : shown?.bias === "bearish" ? "bear" : "default"}
          hint={aiConfigured ? (mode === "news" ? "Calendar + breaking news" : "Calendar only") : "Add an AI key in Settings"}
          loading={aiConfigured && analysis.isLoading}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <SentimentCard symbol="XAUUSD" />
        <CotCard />
      </div>

      <MasterPostPanel events={goldEvents} />

      <section className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Outlook source</h2>
          <p className="text-xs text-muted-foreground">
            The default outlook uses the economic calendar only. Add breaking news for a safe-haven view of the same events.
          </p>
        </div>
        {aiConfigured ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={mode === "calendar" ? "secondary" : "ghost"} onClick={() => setMode("calendar")}>
              Calendar only
            </Button>
            <Button
              size="sm"
              variant={mode === "news" ? "secondary" : "ghost"}
              onClick={() => (newsAnalysis ? setMode("news") : void runWithNews())}
              disabled={busy || events.isLoading}
            >
              {busy ? "Analyzing…" : "Calendar + news"}
            </Button>
            {newsAnalysis ? (
              <Button size="sm" variant="ghost" onClick={() => void runWithNews()} disabled={busy}>
                Refresh news analysis
              </Button>
            ) : null}
            <Link to="/news" className="text-xs text-primary underline">
              View all headlines
            </Link>
          </div>
        ) : (
          <Link to="/settings" className="text-xs text-primary underline">
            Add an AI key to generate an outlook
          </Link>
        )}
      </section>

      <AnalysisCard
        analysis={shown}
        loading={busy || (aiConfigured && mode === "calendar" && analysis.isLoading)}
        needsKey={!aiConfigured}
        title={mode === "news" ? "XAUUSD outlook — calendar + breaking news" : "XAUUSD outlook — calendar only"}
        showUsdContext
      />

      <section className="panel">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Key economic events for gold</h2>
          <SourceTag />
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
