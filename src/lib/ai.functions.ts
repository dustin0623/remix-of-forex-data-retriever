import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Bring-your-own-key AI (Gemini / OpenAI / Anthropic). Keys arrive per request,
 * are used once and never logged, stored or returned.
 */

const Provider = z.enum(["gemini", "openai", "anthropic"]);
export type AiProvider = z.infer<typeof Provider>;

const EventIn = z.object({
  title: z.string().max(200),
  currency: z.string().max(10),
  impact: z.string().max(10),
  datetime: z.string().max(40),
  actual: z.string().max(40).nullable(),
  forecast: z.string().max(40).nullable(),
  previous: z.string().max(40).nullable(),
  goldRelevance: z.string().max(10),
});

const Base = z.object({
  provider: Provider,
  apiKey: z.string().min(10).max(300),
  model: z.string().min(1).max(80),
});

const AnalysisOut = z.object({
  bias: z.enum(["bullish", "bearish", "neutral"]),
  confidence: z.number().min(0).max(100),
  summary: z.string().min(10).max(1500),
  keyDrivers: z.array(z.string().max(300)).min(1).max(6),
  mainRisks: z.array(z.string().max(300)).min(1).max(6),
  usdContext: z.string().max(800),
  scenarios: z
    .array(
      z.object({
        type: z.enum(["bullish", "bearish", "neutral"]),
        title: z.string().max(120),
        probability: z.number().min(0).max(100),
        trigger: z.string().max(300),
        outcome: z.string().max(300),
      }),
    )
    .min(1)
    .max(3),
});

const BANNED = /\b(buy now|sell now|go long|go short|entry at|take profit|stop loss|guaranteed|to the moon|100% sure)\b/i;

function aiError(msg: string): never {
  throw new Error(msg);
}

async function sendOnce(p: z.infer<typeof Base>, system: string, user: string): Promise<Response> {
  let res: Response;
  const signal = AbortSignal.timeout(45_000);
  if (p.provider === "gemini") {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent`,
      {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", "x-goog-api-key": p.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      },
    );
  } else if (p.provider === "openai") {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({
        model: p.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } else {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": p.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: p.model,
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: `${user}\n\nRespond with JSON only.` }],
      }),
    });
  }
  return res;
}

async function callModel(p: z.infer<typeof Base>, system: string, user: string): Promise<string> {
  const send = async () => {
    try {
      return await sendOnce(p, system, user);
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"))
        aiError(`"${p.model}" took too long to answer. Try again, or pick a faster model (e.g. a "lite" one) in Settings.`);
      aiError("Could not reach the AI provider. Check your connection and try again.");
    }
  };
  let res = await send();
  // One bounded retry for transient provider overload (5xx).
  if (res.status >= 500) {
    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));
    res = await send();
  }
  if (res.status === 401 || res.status === 403) aiError("The AI provider rejected the API key. Check it in Settings.");
  if (res.status === 429) aiError("The AI provider rate-limited this key. Try again in a minute.");
  if (res.status === 503)
    aiError(`"${p.model}" is overloaded at the provider right now. Try again in a minute or pick another model in Settings.`);
  if (!res.ok) {
    let detail = "";
    try {
      const b = (await res.json()) as any;
      detail = String(b?.error?.message ?? b?.message ?? "").slice(0, 200);
    } catch {}
    console.error(`[ai] ${p.provider} HTTP ${res.status} ${detail}`);
    aiError(
      res.status === 404
        ? `Model "${p.model}" was not found for this ${p.provider} key. Pick another model in Settings.${detail ? ` (${detail})` : ""}`
        : `The AI provider returned an error (HTTP ${res.status}).${detail ? ` ${detail}` : ""}`,
    );
  }
  const body = (await res.json()) as any;
  const text: string | undefined =
    p.provider === "gemini"
      ? body.candidates?.[0]?.content?.parts?.[0]?.text
      : p.provider === "openai"
        ? body.choices?.[0]?.message?.content
        : body.content?.find((c: any) => c.type === "text")?.text;
  if (!text) aiError("The AI provider returned an empty response.");
  return text;
}

function parseJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(m ? m[0] : text);
  } catch {
    aiError("The AI response was not valid JSON. Try again.");
  }
}

const SYSTEM = `You are a macro analyst covering XAUUSD (gold) and the US dollar.
Describe transmission mechanisms (real yields, USD strength, risk sentiment) in neutral, educational language.
Never give trading instructions, entries, stops, targets or hype. Base analysis only on the supplied events.`;

export const testAiKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Base.parse(d))
  .handler(async ({ data }) => {
    await callModel(data, "Reply with JSON.", 'Return {"ok": true}');
    return { ok: true };
  });

const HeadlineIn = z.object({
  id: z.string().max(300),
  source: z.string().max(20),
  title: z.string().max(400),
  publishedAt: z.string().max(40),
});

export const analyzeGold = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    Base.extend({
      events: z.array(EventIn).max(60),
      headlines: z.array(HeadlineIn).max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const news = data.headlines?.length
      ? `\n\nRecent breaking headlines (UTC). Weigh only those that plausibly move gold (safe-haven demand, USD, real yields, oil/geopolitics, central banks); ignore the rest:\n${data.headlines
          .map((h) => `- ${h.publishedAt} (${h.source}) ${h.title}`)
          .join("\n")}`
      : "";
    const user = `This week's gold-relevant calendar (UTC):\n${data.events
      .map((e) => `- ${e.datetime} ${e.currency} [${e.impact}, gold:${e.goldRelevance}] ${e.title} | actual ${e.actual ?? "-"} | forecast ${e.forecast ?? "-"} | previous ${e.previous ?? "-"}`)
      .join("\n")}${news}

Return JSON: {"bias":"bullish|bearish|neutral","confidence":0-100,"summary":string,"keyDrivers":string[],"mainRisks":string[],"usdContext":string,"scenarios":[{"type":"bullish|bearish|neutral","title":string,"probability":0-100,"trigger":string,"outcome":string}]}`;
    const parsed = AnalysisOut.safeParse(parseJson(await callModel(data, SYSTEM, user)));
    if (!parsed.success) aiError("The AI response did not match the expected analysis format. Try again.");
    if (BANNED.test(JSON.stringify(parsed.data))) aiError("The AI response contained trading-call language and was rejected. Try again.");
    return { ...parsed.data, generatedAt: new Date().toISOString() };
  });


export const generateMasterPost = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    Base.extend({ events: z.array(EventIn).max(60), style: z.enum(["professional", "concise", "educational"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const user = `Write one market-intelligence post (max 1500 characters, ${data.style} tone) about what this week's calendar means for gold. For released events state whether actual beat or missed forecast.
Events:\n${data.events.map((e) => `- ${e.datetime} ${e.currency} ${e.title}: actual ${e.actual ?? "pending"}, forecast ${e.forecast ?? "-"}, previous ${e.previous ?? "-"}`).join("\n")}
Return JSON: {"post": string}`;
    const out = z.object({ post: z.string().min(20) }).safeParse(parseJson(await callModel(data, SYSTEM, user)));
    if (!out.success) aiError("The AI response did not contain a post. Try again.");
    const post = out.data.post.slice(0, 1500);
    if (BANNED.test(post)) aiError("The post contained trading-call language and was rejected. Try again.");
    return { post, generatedAt: new Date().toISOString() };
  });

const NewsOut = z.object({
  bias: z.enum(["bullish", "bearish", "neutral"]),
  confidence: z.number().min(0).max(100),
  summary: z.string().min(10).max(1200),
  relevant: z
    .array(
      z.object({
        id: z.string().max(300),
        impact: z.enum(["bullish", "bearish", "neutral"]),
        reason: z.string().max(300),
      }),
    )
    .max(15),
});

export const analyzeNews = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    Base.extend({
      headlines: z
        .array(z.object({ id: z.string().max(300), source: z.string().max(20), title: z.string().max(400), publishedAt: z.string().max(40) }))
        .min(1)
        .max(60),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const user = `Recent headlines (UTC, unfiltered):\n${data.headlines
      .map((h) => `- [${h.id}] ${h.publishedAt} (${h.source}) ${h.title}`)
      .join("\n")}

Identify only the headlines that plausibly affect gold (safe-haven demand, USD, real yields, oil/geopolitics, central banks). Ignore the rest.
Return JSON: {"bias":"bullish|bearish|neutral","confidence":0-100,"summary":string,"relevant":[{"id":string (the bracketed id),"impact":"bullish|bearish|neutral","reason":string}]}`;
    const parsed = NewsOut.safeParse(parseJson(await callModel(data, SYSTEM, user)));
    if (!parsed.success) aiError("The AI response did not match the expected news format. Try again.");
    if (BANNED.test(JSON.stringify(parsed.data))) aiError("The AI response contained trading-call language and was rejected. Try again.");
    return { ...parsed.data, generatedAt: new Date().toISOString() };
  });
