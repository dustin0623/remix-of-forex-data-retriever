import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "bull" | "bear" | "warn" | "gold";
  loading?: boolean;
}

const toneStyles = {
  default: "text-foreground",
  bull: "text-bull",
  bear: "text-bear",
  warn: "text-warn",
  gold: "text-gold",
};

export function StatCard({ label, value, hint, icon, tone = "default", loading }: StatCardProps) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className={cn("num mt-2 text-2xl font-semibold", toneStyles[tone])}>{value}</p>
      )}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
