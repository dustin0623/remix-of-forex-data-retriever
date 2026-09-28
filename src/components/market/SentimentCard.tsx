import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Skeleton } from "@/components/ui/skeleton";
import { fetchCommunitySentiment } from "@/lib/sentiment.functions";
import { useSettingsStore } from "@/stores/settingsStore";

function num(v: number, digits = 2) {
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Retail positioning for XAUUSD from the Myfxbook Community Outlook. */
export function SentimentCard({ symbol = "XAUUSD" }: { symbol?: string }) {
  const email = useSettingsStore((s) => s.myfxbookEmail);
  const password = useSettingsStore((s) => s.myfxbookPassword);
  const configured = Boolean(email && password);
  const fetchSentiment = useServerFn(fetchCommunitySentiment);

  const q = useQuery({
    queryKey: ["sentiment", symbol, email],
    queryFn: () => fetchSentiment({ data: { email, password, symbol } }),
    enabled: configured,
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  const d = q.data;

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Retail positioning · {symbol}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {configured
              ? d?.stale
                ? "Last known Myfxbook outlook — the feed did not answer just now."
                : "Myfxbook Community Outlook, refreshed every 15 minutes."
              : "Add your free Myfxbook account in Settings to see live crowd positioning."}
          </p>
        </div>
        {configured && d ? (
          <span className="rounded border border-border px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            {d.totalPositions.toLocaleString()} positions
          </span>
        ) : null}
      </div>

      {!configured ? (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link to="/settings" className="text-primary underline">
            Open Settings
          </Link>{" "}
          and sign in with your Myfxbook email and password.
        </p>
      ) : q.isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : q.isError ? (
        <p className="mt-4 text-sm text-bear">{(q.error as Error).message}</p>
      ) : d ? (
        <>
          <div className="mt-4 flex items-center justify-between text-xs font-medium">
            <span className="text-bull num">Long {d.longPercentage}%</span>
            <span className="text-bear num">Short {d.shortPercentage}%</span>
          </div>
          <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="bg-bull" style={{ width: `${d.longPercentage}%` }} />
            <div className="bg-bear" style={{ width: `${d.shortPercentage}%` }} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Metric label="Long lots" value={num(d.longVolume)} tone="bull" />
            <Metric label="Short lots" value={num(d.shortVolume)} tone="bear" />
            <Metric label="Long positions" value={d.longPositions.toLocaleString()} tone="bull" />
            <Metric label="Short positions" value={d.shortPositions.toLocaleString()} tone="bear" />
            <Metric label="Avg long price" value={num(d.avgLongPrice)} tone="bull" />
            <Metric label="Avg short price" value={num(d.avgShortPrice)} tone="bear" />
          </div>
        </>
      ) : null}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "bull" | "bear" }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num mt-0.5 font-semibold ${tone === "bull" ? "text-bull" : "text-bear"}`}>{value}</p>
    </div>
  );
}
