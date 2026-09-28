import { AIError, type AIProvider } from "./AIProvider.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts/goldAnalysis.js";
import {
  MARKET_ANALYSIS_JSON_SCHEMA, MarketAnalysisSchema, findForbiddenTradingLanguage, findHypeLanguage,
  type AnalysisInput, type MarketAnalysis,
} from "./schemas/analysis.js";

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  maxTokens?: number;
  baseUrl?: string;
  fetch?: typeof fetch;
}

const TOOL = "submit_market_analysis";

/** Calls the Anthropic Messages API over fetch, forcing a single structured tool call. */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly model: string;
  // Private fields are never enumerated or serialised, so the key can't leak via logs/JSON.
  readonly #apiKey: string;
  readonly #opts: Omit<AnthropicProviderOptions, "apiKey">;

  constructor(opts: AnthropicProviderOptions) {
    const { apiKey, ...rest } = opts;
    this.model = opts.model;
    this.#apiKey = apiKey;
    this.#opts = rest;
  }

  async analyze(input: AnalysisInput): Promise<MarketAnalysis> {
    const doFetch = this.#opts.fetch ?? fetch;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.#opts.timeoutMs ?? 30_000);
    let res: Response;
    try {
      res = await doFetch(`${this.#opts.baseUrl ?? "https://api.anthropic.com"}/v1/messages`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.#apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.#opts.maxTokens ?? 2048,
          temperature: 0.2,
          system: SYSTEM_PROMPT,
          tools: [{ name: TOOL, description: "Submit the structured XAUUSD market analysis.", input_schema: MARKET_ANALYSIS_JSON_SCHEMA }],
          tool_choice: { type: "tool", name: TOOL },
          messages: [{ role: "user", content: buildUserPrompt(input) }],
        }),
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new AIError("AI_TIMEOUT", "AI provider timed out.");
      throw new AIError("AI_PROVIDER_ERROR", "Could not reach the AI provider.");
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new AIError("AI_INVALID_API_KEY", "AI provider rejected the API key.");
      if (res.status === 429) {
        const ra = Number(res.headers.get("retry-after"));
        throw new AIError("AI_RATE_LIMITED", "AI provider rate limit reached; retry later.", Number.isFinite(ra) && ra > 0 ? ra : undefined);
      }
      if (res.status === 408 || res.status === 504) throw new AIError("AI_TIMEOUT", "AI provider timed out.");
      throw new AIError("AI_PROVIDER_ERROR", `AI provider error (HTTP ${res.status}).`);
    }

    let body: { content?: Array<{ type: string; name?: string; input?: unknown }> };
    try {
      body = await res.json();
    } catch {
      throw new AIError("AI_MALFORMED_RESPONSE", "AI provider returned invalid JSON.");
    }
    const call = body.content?.find((c) => c.type === "tool_use" && c.name === TOOL);
    if (!call) throw new AIError("AI_MALFORMED_RESPONSE", "AI response did not contain a structured analysis.");
    return validateAnalysis(call.input);
  }
}

export function validateAnalysis(raw: unknown): MarketAnalysis {
  const parsed = MarketAnalysisSchema.safeParse(raw);
  if (!parsed.success) throw new AIError("AI_MALFORMED_RESPONSE", "AI response failed schema validation.");
  if (findForbiddenTradingLanguage(parsed.data)) {
    throw new AIError("AI_MALFORMED_RESPONSE", "AI response contained trading-call language and was rejected.");
  }
  if (findHypeLanguage(parsed.data)) {
    throw new AIError("AI_MALFORMED_RESPONSE", "AI response contained overconfident or guaranteed-outcome language and was rejected.");
  }
  return parsed.data;
}
