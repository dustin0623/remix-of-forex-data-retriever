import { consoleLogger, type ScraperLogger } from "./types.js";

export interface ForexFactoryClientOptions {
  exportUrl: string;
  htmlUrl: string;
  userAgent: string;
  timeoutMs: number;
  maxRetries: number;
  baseDelayMs: number;
  logger?: ScraperLogger;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class UpstreamError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Thin HTTP client: timeout + exponential-backoff retries. No parsing here. */
export class ForexFactoryClient {
  private readonly log: ScraperLogger;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly opts: ForexFactoryClientOptions) {
    this.log = opts.logger ?? consoleLogger;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  fetchWeekExport(): Promise<unknown> {
    return this.request(this.opts.exportUrl, "json");
  }

  fetchWeekHtml(): Promise<string> {
    return this.request(this.opts.htmlUrl, "text") as Promise<string>;
  }

  private async request(url: string, as: "json" | "text"): Promise<unknown> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      const started = Date.now();
      try {
        const res = await this.fetchImpl(url, {
          headers: {
            "User-Agent": this.opts.userAgent,
            Accept: as === "json" ? "application/json" : "text/html",
          },
          signal: AbortSignal.timeout(this.opts.timeoutMs),
        });
        if (!res.ok) {
          const err = new UpstreamError(`HTTP ${res.status} from ${new URL(url).host}`, res.status);
          if (!RETRYABLE.has(res.status)) throw Object.assign(err, { fatal: true });
          throw err;
        }
        const body = as === "json" ? await res.json() : await res.text();
        this.log.info({ url, attempt, ms: Date.now() - started }, "fetch ok");
        return body;
      } catch (err) {
        lastErr = err;
        const fatal = (err as { fatal?: boolean }).fatal === true;
        this.log.warn({ url, attempt, error: (err as Error).message }, "fetch failed");
        if (fatal || attempt === this.opts.maxRetries) break;
        await this.sleep(this.opts.baseDelayMs * 2 ** attempt);
      }
    }
    throw lastErr instanceof UpstreamError
      ? lastErr
      : new UpstreamError((lastErr as Error)?.message ?? "Request failed");
  }
}
