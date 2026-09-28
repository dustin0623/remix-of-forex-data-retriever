import { Skeleton } from "@/components/ui/skeleton";
import type { TimelinePoint } from "@/types/market";

const W = 800;
const H = 140;

export function MarketTimeline({ points, loading }: { points?: TimelinePoint[] | undefined; loading?: boolean }) {
  if (loading || !points) return <Skeleton className="m-5 h-36" />;
  if (points.length < 2) return <p className="p-5 text-sm text-muted-foreground">Not enough data yet today.</p>;

  const t0 = new Date(points[0]!.time).getTime();
  const t1 = new Date(points[points.length - 1]!.time).getTime();
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices) - 1;
  const max = Math.max(...prices) + 1;
  const x = (iso: string) => ((new Date(iso).getTime() - t0) / Math.max(1, t1 - t0)) * W;
  const y = (p: number) => H - ((p - min) / (max - min)) * H;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.time).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const markers = points.filter((p) => p.label);

  return (
    <div className="p-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" preserveAspectRatio="none" role="img" aria-label="XAUUSD 24h price line">
        <path d={path} fill="none" stroke="var(--gold)" strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
        {markers.map((m) => (
          <circle key={m.time} cx={x(m.time)} cy={y(m.price)} r={4} fill="var(--primary)">
            <title>{m.label}</title>
          </circle>
        ))}
      </svg>
      <div className="num mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{new Date(points[0]!.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span>
          Range {min.toFixed(2)} – {max.toFixed(2)}
        </span>
        <span>Now</span>
      </div>
      {markers.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs">
          {markers.map((m) => (
            <li key={m.time} className="flex gap-3">
              <span className="num text-muted-foreground">
                {new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="flex-1">{m.label}</span>
              <span className="num text-gold">{m.price.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
