import type { AnalysisInput, MarketAnalysis } from "./schemas/analysis.js";

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  analyze(input: AnalysisInput): Promise<MarketAnalysis>;
}

export type AIErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_INVALID_API_KEY"
  | "AI_RATE_LIMITED"
  | "AI_TIMEOUT"
  | "AI_MALFORMED_RESPONSE"
  | "AI_PROVIDER_ERROR";

const STATUS: Record<AIErrorCode, number> = {
  AI_NOT_CONFIGURED: 503,
  AI_INVALID_API_KEY: 502,
  AI_RATE_LIMITED: 429,
  AI_TIMEOUT: 504,
  AI_MALFORMED_RESPONSE: 502,
  AI_PROVIDER_ERROR: 502,
};

/** Safe-to-return error: messages never include the API key or raw provider bodies. */
export class AIError extends Error {
  readonly statusCode: number;
  constructor(readonly code: AIErrorCode, message: string, readonly retryAfterSec?: number) {
    super(message);
    this.statusCode = STATUS[code];
  }
}
