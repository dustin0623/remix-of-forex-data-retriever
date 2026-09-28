import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { PageHeader } from "@/components/market/PageHeader";
import { SimulatedTag } from "@/components/market/badges";
import { Input } from "@/components/ui/input";
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
  const { dataSource, setDataSource, theme, setTheme, apiBaseUrl, setApiBaseUrl } = useSettingsStore();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Local preferences stored in this browser. No credentials or API keys are stored here."
        actions={<SimulatedTag label={dataSource === "live" ? "Live API" : "Simulation"} />}
      />

      <section className="panel px-5 py-1">
        <Row title="Data source" description="Simulation uses the built-in mock data. Live API reads from the scrapper server.">
          <Select value={dataSource} onValueChange={(v) => { setDataSource(v as "simulation" | "live"); toast.success(v === "live" ? "Switched to Live API" : "Switched to Simulation"); }}>
            <SelectTrigger aria-label="Data source"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simulation">Simulation</SelectItem>
              <SelectItem value="live">Live API</SelectItem>
            </SelectContent>
          </Select>
        </Row>

        <Row title="API base URL" description="Address of the scrapper server used in Live API mode.">
          <Input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} className="num" />
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

      </section>
    </>
  );
}
