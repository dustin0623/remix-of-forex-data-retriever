import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { analyzeNews } from "@/lib/ai.functions";
import { fetchNews } from "@/lib/news.functions";
import { currentAiConfig, useAiConfigured } from "@/stores/settingsStore";

type Tab = "all" | "aljazeera" | "telegram";
type Analysis = Awaited<ReturnType<typeof analyzeNews>>;

const label = { aljazeera: "Al Jazeera", telegram: "SM News" } as const;
const toneText = { bullish: "text-bull", bearish: "text-bear", neutral: "text-muted-foreground" } as const;

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
}

/** All headlines from both sources; optional AI pass flags the gold-relevant ones. */
export function NewsCard() {
  const load = useServerFn(fetchNews);
  const analyze = useServerFn(analyzeNews);
  const configured = useAiConfigured();
  const [tab, setTab] = useState<Tab>("all");
  const [onlyRelevant, setOnlyRelevant] = useState(false);
  const [ai, setAi] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["news"], queryFn: () => load(), staleTime: 3 * 60_000, refetchInterval: 3 * 60_000 });

  const flags = useMemo(() => new Map((ai?.relevant ?? []).map((r) => [r.id, r])), [ai]);
  const items = (q.data?.items ?? [])
    .filter((i) => tab === "all" || i.source === tab)
    .filter((i) => !onlyRelevant || flags.has(i.id));

  async function run() {
    const cfg = currentAiConfig();
    if (!cfg || !q.data) return;
    setBusy(true);
    try {
      const r = await analyze({
        data: {
          ...cfg,
          headlines: q.data.items.slice(0, 60).map(({ id, source, title, publishedAt }) => ({ id, source, title, publishedAt })),
        },
      });
      setAi(r);
      setOnlyRelevant(r.relevant.length > 0);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Breaking news & squawk</h2>
          <p className="text-xs text-muted-foreground">
            Al Jazeera + SM News 24h (Telegram), unfiltered · refreshes every 3 min
            {q.data?.stale ? " · a source is using its last known copy" : ""}
          </p>
        </div>
        {configured ? (
          <Button size="sm" onClick={run} disabled={busy || !q.data}>
            {busy ? "Analyzing…" : "Analyze for gold"}
          </Button>
        ) : (
          <Link to="/settings" className="text-xs text-primary underline">Add an AI key to analyze</Link>
        )}
      </div>

      {ai ? (
        <div className="space-y-1 border-b border-border px-5 py-3 text-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider">
            <span className="text-muted-foreground">News bias</span>
            <span className={`font-semibold ${toneText[ai.bias]}`}>{ai.bias}</span>
            <span className="num text-muted-foreground">· {Math.round(ai.confidence)}% confidence</span>
          </div>
          <p className="text-muted-foreground">{ai.summary}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 px-5 py-2">
        {(["all", "aljazeera", "telegram"] as Tab[]).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "secondary" : "ghost"} onClick={() => setTab(t)}>
            {t === "all" ? "All" : label[t]}
          </Button>
        ))}
        {ai ? (
          <Button size="sm" variant={onlyRelevant ? "secondary" : "ghost"} onClick={() => setOnlyRelevant((v) => !v)}>
            Gold-relevant only ({flags.size})
          </Button>
        ) : null}
      </div>

      {q.isLoading ? (
        <div className="space-y-2 px-5 pb-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : q.isError ? (
        <p className="px-5 pb-4 text-sm text-bear">{(q.error as Error).message}</p>
      ) : (
        <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
          {items.map((i) => {
            const f = flags.get(i.id);
            return (
              <li key={i.id} className="px-5 py-2.5">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span>{label[i.source]}</span>
                  <span>· {ago(i.publishedAt)}</span>
                  {f ? <span className={`font-semibold ${toneText[f.impact]}`}>· gold {f.impact}</span> : null}
                </div>
                <a href={i.url} target="_blank" rel="noreferrer" className="text-sm hover:underline">{i.title}</a>
                {f ? <p className="text-xs text-muted-foreground">{f.reason}</p> : null}
              </li>
            );
          })}
          {!items.length ? <li className="px-5 py-4 text-sm text-muted-foreground">No headlines to show.</li> : null}
        </ul>
      )}
    </section>
  );
}
