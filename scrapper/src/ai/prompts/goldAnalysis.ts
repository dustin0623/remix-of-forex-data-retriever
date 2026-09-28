import type { AnalysisInput } from "../schemas/analysis.js";

export const SYSTEM_PROMPT = `You are a macro market analyst writing XAUUSD (gold) market context for a trading coach.

Rules you must follow:
- Use ONLY the structured data provided. Never invent figures, dates, prices or events.
- If a value is null or data is missing, treat it as unknown and say so; do not estimate it.
- You provide market context and scenarios only. NEVER give BUY or SELL calls, entry prices,
  stop losses, take profits, position sizes or leverage recommendations. The coach makes all trading calls.
- Compare actual vs forecast vs previous where available and explain the likely USD / real-yield effect on gold.
- Keep "masterPost" a short, plain-language post (max ~120 words) the coach could share; no trade calls.
- Put data gaps and uncertainty in "warnings".
- Respond only by calling the submit_market_analysis tool.`;

const TASKS: Record<AnalysisInput["task"], string> = {
  gold_today: "Produce today's overall XAUUSD market context from the events and recent changes.",
  event: "Explain the focus event's likely market impact, framed for XAUUSD.",
  gold_event: "Explain specifically how the focus event may affect XAUUSD, with scenarios for its outcome.",
};

export function buildUserPrompt(input: AnalysisInput): string {
  return `${TASKS[input.task]}\n\nStructured data (JSON):\n${JSON.stringify(input, null, 2)}`;
}
