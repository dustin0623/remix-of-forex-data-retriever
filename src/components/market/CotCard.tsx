import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Skeleton } from "@/components/ui/skeleton";
import { fetchGoldCot } from "@/lib/cot.functions";

const signalLabel = {
  accumulation: "Accumulation zone",
  neutral: "Neutral positioning",
  overbought: "Overbought / late stage",
} as const;

function contracts(v: number) {
  return `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString()}`;
}

/** Weekly CFTC Commitments of Traders positioning for COMEX gold futures. */
export function CotCard() {
  const fetchCot = useServerFn(fetchGoldCot);
  const q = useQuery({
    queryKey: ["cot", "gold"],
    queryFn: () => fetchCot(),
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
  });

  const d = q.data;
  const tone = d?.bias === "bullish" ? "text-bull" : d?.bias === "bearish" ? "text-bear" : "text-muted-foreground";
  const barTone = d?.bias === "bullish" ? "bg-bull" : d?.bias === "bearish" ? "bg-bear" : "bg-primary";

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Institutional positioning · COT gold futures</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {d?.stale
              ? "Last known report — the source did not answer just now."
              : "CFTC Commitments of Traders, published every Friday for COMEX gold."}
          </p>
        </div>
        {d ? (
          <span className={`rounded border border-border px-2 py-0.5 text-[11px] uppercase tracking-wider ${tone}`}>
            {signalLabel[d.signal]}
          </span>
        ) : null}
      </div>

      {q.isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : q.isError ? (
        <p className="mt-4 text-sm text-bear">{(q.error as Error).message}</p>
      ) : d ? (
        <>
          <div className="mt-4 flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">COT index</span>
            <span className={`num ${tone}`}>{d.latest.cotIndex}%</span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={barTone} style={{ width: `${Math.max(2, Math.min(100, d.latest.cotIndex))}%`, height: "100%" }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>0 · overbought</span>
            <span>100 · accumulation</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <Metric
              label="Commercials"
              value={contracts(d.latest.commercialNet)}
              sub={d.weekChange ? `${contracts(d.weekChange.commercialNet)} wk` : undefined}
            />
            <Metric
              label="Large specs"
              value={contracts(d.latest.nonCommercialNet)}
              sub={d.weekChange ? `${contracts(d.weekChange.nonCommercialNet)} wk` : undefined}
            />
            <Metric
              label="Small traders"
              value={contracts(d.latest.smallTraderNet)}
              sub={d.weekChange ? `${contracts(d.weekChange.smallTraderNet)} wk` : undefined}
            />
            <Metric
              label="Open interest"
              value={Math.round(d.latest.openInterest).toLocaleString()}
              sub={d.weekChange ? `${contracts(d.weekChange.openInterest)} wk` : undefined}
            />
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{d.interpretation}</p>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Week of {d.latest.date} · futures close {d.latest.close.toLocaleString()}
          </p>
        </>
      ) : null}
    </section>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="num mt-0.5 font-semibold">{value}</p>
      {sub ? <p className="num text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
