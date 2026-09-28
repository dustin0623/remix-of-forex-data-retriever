import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/market/PageHeader";
import { SourceTag } from "@/components/market/badges";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/api-explorer")({
  head: () => ({
    meta: [
      { title: "API Explorer — Forex Market Intelligence" },
      {
        name: "description",
        content: "Planned endpoints for the Forex Market Intelligence API with sample JSON responses.",
      },
      { property: "og:title", content: "API Explorer — Forex Market Intelligence" },
      {
        property: "og:description",
        content: "Documentation preview of the calendar, changes and analysis endpoints.",
      },
    ],
  }),
  component: ApiExplorer,
});

interface Endpoint {
  method: "GET";
  path: string;
  summary: string;
  sample: unknown;
}

const eventSample = {
  id: "evt-003",
  datetime: "2026-09-28T12:30:00.000Z",
  time: "12:30",
  currency: "USD",
  title: "Core PCE Price Index m/m",
  impact: "high",
  actual: null,
  forecast: "0.2%",
  previous: "0.3%",
  goldRelevance: "high",
  usdRelevance: "high",
  source: "Bureau of Economic Analysis",
};

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/api/status",
    summary: "Service health, environment and AI connection state.",
    sample: {
      environment: "direct",
      apiMode: "Direct",
      aiProvider: "Not configured",
      aiConnected: false,
      scraperConnected: false,
      version: "0.1.0-phase1",
    },
  },
  {
    method: "GET",
    path: "/api/calendar/today",
    summary: "All calendar records scheduled for the current UTC day.",
    sample: { total: 6, offset: 0, limit: null, results: [eventSample] },
  },
  {
    method: "GET",
    path: "/api/calendar/tomorrow",
    summary: "All calendar records scheduled for the next UTC day.",
    sample: { total: 4, offset: 0, limit: null, results: [eventSample] },
  },
  {
    method: "GET",
    path: "/api/calendar/week",
    summary: "Records for the current calendar week. Supports limit and offset paging.",
    sample: { total: 18, offset: 0, limit: 50, results: [eventSample] },
  },
  {
    method: "GET",
    path: "/api/calendar/high-impact",
    summary: "Week records filtered to high-impact releases only.",
    sample: { total: 5, offset: 0, limit: null, results: [eventSample] },
  },
  {
    method: "GET",
    path: "/api/calendar/gold-relevant",
    summary: "Records with medium or high gold relevance.",
    sample: { total: 7, offset: 0, limit: null, results: [eventSample] },
  },
  {
    method: "GET",
    path: "/api/events/:id",
    summary: "Full detail for a single event including the historical series.",
    sample: {
      ...eventSample,
      history: [{ period: "Prev month", actual: "0.3%", forecast: "0.2%" }],
    },
  },
  {
    method: "GET",
    path: "/api/changes",
    summary: "Field-level changes detected between consecutive scrapes.",
    sample: {
      total: 3,
      results: [
        {
          id: "chg-001",
          eventId: "evt-017",
          field: "actual",
          from: null,
          to: "3.0%",
          detectedAt: "2026-09-27T12:31:00.000Z",
        },
      ],
    },
  },
  {
    method: "GET",
    path: "/api/analyze/gold/today",
    summary: "Structured XAUUSD outlook with scenarios.",
    sample: {
      subject: "XAUUSD daily outlook",
      bias: "bearish",
      confidence: 0.52,
      keyDrivers: ["Firm real yields", "Steady official-sector buying"],
      scenarios: [
        { type: "bearish", probability: 0.45, trigger: "Inflation and employment both beat" },
      ],
      sample: true,
    },
  },
  {
    method: "GET",
    path: "/api/analyze/event/:id",
    summary: "Structured interpretation of a single release.",
    sample: {
      eventId: "evt-003",
      bias: "neutral",
      confidence: 0.58,
      summary: "In-line print keeps the range intact.",
      sample: true,
    },
  },
];

function ApiExplorer() {
  const [selected, setSelected] = useState(0);
  const endpoint = endpoints[selected] ?? endpoints[0]!;
  const apiEndpoint = useSettingsStore((s) => s.apiBaseUrl);

  return (
    <>
      <PageHeader
        title="API Explorer"
        description="Contract preview for the scraper service that will live in /scrapper. These endpoints are documentation only — nothing is callable yet."
        actions={<SourceTag label="Not callable" />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <nav className="panel overflow-hidden" aria-label="Endpoints">
          <p className="border-b border-border px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">
            Endpoints
          </p>
          <ul>
            {endpoints.map((item, index) => (
              <li key={item.path}>
                <button
                  onClick={() => setSelected(index)}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-border/60 px-4 py-2.5 text-left text-sm transition-colors last:border-0",
                    index === selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                  )}
                >
                  <span className="num rounded border border-bull/40 px-1.5 py-0.5 text-[10px] font-semibold text-bull">
                    {item.method}
                  </span>
                  <span className="num truncate text-xs">{item.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num rounded border border-bull/40 px-2 py-0.5 text-xs font-semibold text-bull">
              {endpoint.method}
            </span>
            <code className="num text-sm text-foreground">{endpoint.path}</code>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{endpoint.summary}</p>

          <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Planned base URL</p>
          <code className="num mt-1 block truncate rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            {apiEndpoint}
            {endpoint.path}
          </code>

          <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Sample response</p>
          <pre className="num mt-1 max-h-[420px] overflow-auto rounded-md border border-border bg-background/60 p-4 text-xs leading-relaxed text-foreground/90">
            {JSON.stringify(endpoint.sample, null, 2)}
          </pre>

          <p className="mt-4 text-xs text-muted-foreground">
            Response shapes mirror the record structure used by the reference Forex Factory scraper
            (date, time, currency, impact, event, actual, forecast, previous) plus paging metadata, so the
            frontend can switch from mocks to the real service without UI changes.
          </p>
        </section>
      </div>
    </>
  );
}
