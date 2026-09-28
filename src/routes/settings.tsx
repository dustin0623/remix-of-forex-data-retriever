import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { testAiKey } from "@/lib/ai.functions";
import { testMyfxbookLogin } from "@/lib/sentiment.functions";
import { getBaselineInfo, syncLiveCalendar } from "@/services/api/mockApi";
import { AI_PROVIDERS, type AiProvider, type PostStyle } from "@/stores/settingsStore";

import { PageHeader } from "@/components/market/PageHeader";
import { SourceTag } from "@/components/market/badges";
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
        content: "Data source, Scrapper API connection, theme and AI keys.",
      },
      { property: "og:title", content: "Settings — Forex Market Intelligence" },
      {
        property: "og:description",
        content: "Configure local preferences for the Forex intelligence workspace.",
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
        description="Preferences and your own AI keys, stored only in this browser."
        actions={<SourceTag label={dataSource === "live" ? "Scrapper API" : "Direct feed"} />}
      />

      <section className="panel px-5 py-1">
        <Row title="Data source" description="Direct feed pulls Forex Factory + MetalsMine, Binance and news straight from this app. Scrapper API reads the same data from your server.">
          <Select value={dataSource} onValueChange={(v) => { setDataSource(v as "direct" | "live"); toast.success(v === "live" ? "Switched to Scrapper API" : "Switched to Direct feed"); }}>
            <SelectTrigger aria-label="Data source"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct feed</SelectItem>
              <SelectItem value="live">Scrapper API</SelectItem>
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

        <Row title="Real calendar" description="Pull the latest Forex Factory + MetalsMine week now. This clears what-if releases.">
          <SyncButton />
        </Row>
      </section>

      <AiSettings />

      <MyfxbookSettings />
    </>
  );
}

function MyfxbookSettings() {
  const qc = useQueryClient();
  const { myfxbookEmail, myfxbookPassword, setMyfxbook } = useSettingsStore();
  const [email, setEmail] = useState(myfxbookEmail);
  const [password, setPassword] = useState(myfxbookPassword);
  const [testing, setTesting] = useState(false);
  const testLogin = useServerFn(testMyfxbookLogin);

  const save = (nextEmail: string, nextPassword: string) => {
    setMyfxbook(nextEmail, nextPassword);
    void qc.invalidateQueries({ queryKey: ["sentiment"] });
  };

  return (
    <section className="panel px-5 py-1">
      <div className="border-b border-border py-4">
        <p className="text-sm font-semibold text-foreground">Myfxbook community outlook</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sign in with a free Myfxbook account to show live retail long/short positioning for XAUUSD. Your login is kept in this
          browser only and sent straight to Myfxbook. Results are cached for 15 minutes, so you stay well inside the free 100
          requests a day.
        </p>
      </div>

      <Row title="Myfxbook email" description="The email you use on myfxbook.com.">
        <Input
          type="email"
          autoComplete="off"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => save(email, password)}
        />
      </Row>

      <Row title="Myfxbook password" description="Used only to open a Myfxbook session for the outlook data.">
        <div className="space-y-1.5">
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => save(email, password)}
          />
          <a
            href="https://www.myfxbook.com/community/outlook"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline"
          >
            Create a free account
          </a>
        </div>
      </Row>

      <Row title="Test connection" description="Signs in once to confirm the email and password work.">
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={testing || !email || !password}
            onClick={async () => {
              setTesting(true);
              save(email, password);
              try {
                await testLogin({ data: { email, password } });
                toast.success("Myfxbook connected");
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setTesting(false);
              }
            }}
          >
            {testing ? "Testing…" : "Test connection"}
          </Button>
          <Button
            variant="ghost"
            disabled={!myfxbookEmail && !myfxbookPassword}
            onClick={() => {
              setEmail("");
              setPassword("");
              save("", "");
              toast.success("Myfxbook login removed");
            }}
          >
            Remove
          </Button>
        </div>
      </Row>
    </section>
  );
}

function SyncButton() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await syncLiveCalendar();
        await qc.invalidateQueries();
        setBusy(false);
        const info = getBaselineInfo();
        if (info.kind === "live" || info.kind === "cache") toast.success("Calendar synced");
        else toast.error(info.error ?? "Could not reach the calendar feeds");
      }}
    >
      {busy ? "Syncing…" : "Sync live calendar"}
    </Button>
  );
}

function AiSettings() {
  const qc = useQueryClient();
  const { aiProvider, setAiProvider, aiKeys, setAiKey, aiModels, setAiModel, postStyle, setPostStyle } = useSettingsStore();
  const test = useServerFn(testAiKey);
  const [testing, setTesting] = useState(false);
  const meta = AI_PROVIDERS[aiProvider];
  const refresh = () => void qc.invalidateQueries({ queryKey: ["api-status"] });

  return (
    <section className="panel px-5 py-1">
      <div className="border-b border-border py-4">
        <p className="text-sm font-semibold text-foreground">AI analysis & posts</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Keys are saved in this browser only and sent to the provider just for each request. Use throwaway keys — anything on this
          device can read browser storage.
        </p>
      </div>
      <Row title="Provider" description="Used for gold analysis and master posts.">
        <Select value={aiProvider} onValueChange={(v) => { setAiProvider(v as AiProvider); refresh(); qc.invalidateQueries({ queryKey: ["analysis"] }); }}>
          <SelectTrigger aria-label="AI provider"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((p) => (
              <SelectItem key={p} value={p}>{AI_PROVIDERS[p].label}{aiKeys[p] ? " ✓" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row title={`${meta.label} API key`} description={aiProvider === "gemini" ? "Free keys are available from Google AI Studio." : `Create a key in the ${meta.label} console.`}>
        <div className="space-y-1.5">
          <Input
            type="password"
            autoComplete="off"
            placeholder={meta.keyHint}
            value={aiKeys[aiProvider]}
            onChange={(e) => setAiKey(aiProvider, e.target.value)}
            onBlur={() => { refresh(); qc.invalidateQueries({ queryKey: ["analysis"] }); }}
          />
          <a href={meta.keyUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Get a key</a>
        </div>
      </Row>
      <Row title="Model" description="Pick the model to use with your key.">
        <Select value={aiModels[aiProvider]} onValueChange={(v) => setAiModel(aiProvider, v)}>
          <SelectTrigger aria-label="Model" className="num"><SelectValue /></SelectTrigger>
          <SelectContent>
            {meta.models.map((m) => (
              <SelectItem key={m} value={m} className="num">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row title="Post style" description="Tone of generated master posts.">
        <Select value={postStyle} onValueChange={(v) => setPostStyle(v as PostStyle)}>
          <SelectTrigger aria-label="Post style"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="concise">Concise</SelectItem>
            <SelectItem value="educational">Educational</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row title="Test key" description="Sends one tiny request to confirm the key and model work.">
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={testing || !aiKeys[aiProvider]}
            onClick={async () => {
              setTesting(true);
              try {
                await test({ data: { provider: aiProvider, apiKey: aiKeys[aiProvider], model: aiModels[aiProvider] } });
                toast.success(`${meta.label} key works`);
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setTesting(false);
              }
            }}
          >
            {testing ? "Testing…" : "Test key"}
          </Button>
          <Button variant="ghost" disabled={!aiKeys[aiProvider]} onClick={() => { setAiKey(aiProvider, ""); refresh(); }}>Remove</Button>
        </div>
      </Row>
    </section>
  );
}
