import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { generateMasterPost } from "@/lib/ai.functions";
import { currentAiConfig, useAiConfigured, useSettingsStore } from "@/stores/settingsStore";
import type { EconomicEvent } from "@/types/market";

/** Generates one canonical market post from the current gold-relevant events using the user's own AI key. */
export function MasterPostPanel({ events }: { events: EconomicEvent[] }) {
  const configured = useAiConfigured();
  const style = useSettingsStore((s) => s.postStyle);
  const generate = useServerFn(generateMasterPost);
  const [post, setPost] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    const cfg = currentAiConfig();
    if (!cfg) return;
    setBusy(true);
    try {
      const r = await generate({
        data: {
          ...cfg,
          style,
          events: events.slice(0, 60).map(({ title, currency, impact, datetime, actual, forecast, previous, goldRelevance }) => ({
            title, currency, impact, datetime, actual, forecast, previous, goldRelevance,
          })),
        },
      });
      setPost(r.post);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Master post</h2>
          <p className="text-xs text-muted-foreground">One {style} post about this week's gold calendar (max 1,500 characters).</p>
        </div>
        {configured ? (
          <Button size="sm" onClick={run} disabled={busy || events.length === 0}>
            {busy ? "Generating…" : "Generate post"}
          </Button>
        ) : (
          <Link to="/settings" className="text-xs text-primary underline">Add an AI key in Settings</Link>
        )}
      </div>
      {post && (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap rounded border border-border bg-surface p-3 text-sm text-foreground">{post}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="num">{post.length} / 1500</span>
            <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(post); toast.success("Copied"); }}>Copy</Button>
          </div>
        </div>
      )}
    </section>
  );
}
