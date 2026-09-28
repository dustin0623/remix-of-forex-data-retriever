import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EventsTable } from "@/components/market/EventsTable";
import { ErrorState, PageHeader } from "@/components/market/PageHeader";
import { SimulatedTag } from "@/components/market/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eventsQuery } from "@/services/marketService";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Economic Calendar — Forex Market Intelligence" },
      {
        name: "description",
        content:
          "Filter simulated Forex Factory-style economic events by date, currency, impact and gold relevance.",
      },
      { property: "og:title", content: "Economic Calendar — Forex Market Intelligence" },
      {
        property: "og:description",
        content: "Simulated economic calendar with currency, impact and gold-relevance filters.",
      },
    ],
  }),
  component: CalendarPage,
});

const currencies = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"];

function toDateInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalendarPage() {
  const events = useQuery(eventsQuery());

  const [date, setDate] = useState("");
  const [currency, setCurrency] = useState("all");
  const [impact, setImpact] = useState("all");
  const [gold, setGold] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = events.data ?? [];
    return list.filter((e) => {
      if (date && toDateInput(e.datetime) !== date) return false;
      if (currency !== "all" && e.currency !== currency) return false;
      if (impact !== "all" && e.impact !== impact) return false;
      if (gold === "relevant" && (e.goldRelevance === "none" || e.goldRelevance === "low")) return false;
      if (gold !== "all" && gold !== "relevant" && e.goldRelevance !== gold) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [events.data, date, currency, impact, gold, search]);

  const reset = () => {
    setDate("");
    setCurrency("all");
    setImpact("all");
    setGold("all");
    setSearch("");
  };

  return (
    <>
      <PageHeader
        title="Economic Calendar"
        description="Simulated calendar rows shaped like Forex Factory records. Select any row for full event detail."
        actions={<SimulatedTag label="Simulated data" />}
      />

      <section className="panel p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="cal-date" className="text-xs uppercase tracking-wider text-muted-foreground">
              Date
            </Label>
            <Input id="cal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All currencies</SelectItem>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Impact</Label>
            <Select value={impact} onValueChange={setImpact}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All impact levels</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gold relevance</Label>
            <Select value={gold} onValueChange={setGold}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any relevance</SelectItem>
                <SelectItem value="relevant">Gold-relevant only</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cal-search" className="text-xs uppercase tracking-wider text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cal-search"
                className="pl-8"
                placeholder="Event name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="num text-xs text-muted-foreground">
            {filtered.length} of {events.data?.length ?? 0} events
          </p>
          <Button variant="outline" size="sm" onClick={reset}>
            Reset filters
          </Button>
        </div>
      </section>

      <section className="panel">
        {events.isError ? (
          <div className="p-4">
            <ErrorState message="The simulation layer did not respond." onRetry={() => events.refetch()} />
          </div>
        ) : (
          <EventsTable events={filtered} loading={events.isLoading} showDate />
        )}
      </section>
    </>
  );
}
