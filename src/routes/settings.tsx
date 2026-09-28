import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { PageHeader } from "@/components/market/PageHeader";
import { SimulatedTag } from "@/components/market/badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settingsStore";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Forex Market Intelligence" },
      {
        name: "description",
        content: "Simulation mode, theme, planned API endpoint and AI provider status.",
      },
      { property: "og:title", content: "Settings — Forex Market Intelligence" },
      {
        property: "og:description",
        content: "Configure local preferences for the simulated Forex intelligence workspace.",
      },
    ],
  }),
  component: SettingsPage,
});

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4 last:border-0">
      <div className="max-w-md">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-[220px]">{children}</div>
    </div>
  );
}

function SettingsPage() {
  const {
    simulationMode,
    setSimulationMode,
    dataSource,
    theme,
    setTheme,
    apiEndpoint,
    setApiEndpoint,
    aiProvider,
  } = useSettingsStore();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Local preferences only. No credentials are stored and nothing connects to an external service."
        actions={<SimulatedTag label="Phase 1" />}
      />

      <section className="panel px-5 py-1">
        <Row
          title="Simulation mode"
          description="Keeps all data sourced from the local mock layer. Live mode becomes available once the scraper service ships."
        >
          <div className="flex items-center justify-end gap-3">
            <Switch
              id="sim-mode"
              checked={simulationMode}
              onCheckedChange={(value) => {
                if (!value) {
                  toast.warning("Live mode is not available in Phase 1", {
                    description: "No scraper or market data service is connected yet.",
                  });
                  return;
                }
                setSimulationMode(true);
              }}
            />
            <Label htmlFor="sim-mode" className="text-sm">
              {simulationMode ? "On" : "Off"}
            </Label>
          </div>
        </Row>

        <Row
          title="Data source"
          description="Where calendar, change and market data come from."
        >
          <div className="space-y-1.5">
            <Select value={dataSource}>
              <SelectTrigger aria-label="Data source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simulation">Simulation</SelectItem>
                <SelectItem value="external" disabled>
                  External API
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Real API integration will be enabled in a later phase.
            </p>
          </div>
        </Row>

        <Row title="Theme" description="The trading terminal palette is tuned for low-light desks.">
          <Select value={theme} onValueChange={(v) => setTheme(v as "dark" | "system")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark (terminal)</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </Row>

        <Row
          title="API endpoint"
          description="Base URL the frontend will call once the /scrapper service exists. Stored in memory only."
        >
          <Input value={apiEndpoint} onChange={(e) => setApiEndpoint(e.target.value)} className="num" />
        </Row>

        <Row title="AI provider" description="Analysis text is produced by the local simulation layer.">
          <p className="text-right text-sm text-muted-foreground">{aiProvider}</p>
        </Row>

        <Row title="AI connection status" description="No provider key is configured and none is required.">
          <div className="flex items-center justify-end gap-2">
            <span className="size-2 rounded-full bg-warn" aria-hidden />
            <span className="text-sm text-foreground">Not connected</span>
          </div>
        </Row>
      </section>
    </>
  );
}
