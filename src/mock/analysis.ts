import type { ApiStatus, MarketAnalysis, MarketSnapshot } from "@/types/market";

/** SIMULATED DATA ONLY — no AI provider is contacted. */

export const mockSnapshot: MarketSnapshot = {
  symbol: "XAUUSD",
  price: 2648.35,
  previousPrice: 2660.75,
  trend: "down",
  changeAbsolute: -12.4,
  changePercent: -0.47,
  macroBias: "neutral",
  riskLevel: "elevated",
  highImpactEventCount: 2,
  updatedAt: new Date().toISOString(),
};

export const mockDashboardAnalysis: MarketAnalysis = {
  id: "ana-dash-001",
  subject: "Today's macro session",
  bias: "neutral",
  confidence: 0.58,
  summary:
    "Positioning is defensive ahead of the US inflation print. Rate-cut pricing has drifted lower this week, keeping the dollar firm and capping metals, but no directional conviction is present until the data lands.",
  keyDrivers: [
    "Core PCE is the session's primary catalyst for real yields",
    "Front-end rate pricing has repriced ~15bp hawkish over five sessions",
    "Labour-market data remains resilient, limiting dovish repricing",
    "Month-end rebalancing flows are adding noise to intraday moves",
  ],
  mainRisks: [
    "A hot inflation surprise lifting the dollar and forcing a metals flush",
    "Thin pre-release liquidity exaggerating the initial spike",
    "Unscheduled central-bank commentary overriding the data reaction",
  ],
  usdContext:
    "The dollar index is holding the upper end of its two-week range. A softer inflation print is the clearest route to a broad USD pullback.",
  scenarios: [
    {
      type: "bullish",
      title: "Soft inflation, yields retreat",
      probability: 0.35,
      trigger: "Core PCE prints at or below 0.1% m/m",
      outcome: "Real yields fall, dollar gives back weekly gains, XAUUSD grinds toward the prior range high.",
    },
    {
      type: "bearish",
      title: "Hot print, hawkish repricing",
      probability: 0.3,
      trigger: "Core PCE prints at 0.4% m/m or above",
      outcome: "Front-end yields jump, dollar extends, metals lose the near-term support shelf.",
    },
    {
      type: "neutral",
      title: "In-line, range holds",
      probability: 0.35,
      trigger: "Core PCE lands at 0.2% m/m as forecast",
      outcome: "Initial spike fades within the session and price returns to the pre-release range.",
    },
  ],
  generatedAt: new Date().toISOString(),
  simulated: true,
};

export const mockGoldAnalysis: MarketAnalysis = {
  id: "ana-gold-001",
  subject: "XAUUSD daily outlook",
  bias: "bearish",
  confidence: 0.52,
  summary:
    "Gold is consolidating below the recent high with a mild downward drift. The path of least resistance stays lower while real yields firm, but downside is shallow given persistent central-bank demand.",
  keyDrivers: [
    "Firm 10-year real yields reducing the appeal of non-yielding assets",
    "Steady official-sector buying cushioning pullbacks",
    "Reduced ETF outflows relative to the prior month",
    "Two high-impact USD releases scheduled inside 48 hours",
  ],
  mainRisks: [
    "A dovish policy surprise invalidating the bearish lean outright",
    "Geopolitical headlines triggering a fast safe-haven bid",
    "Low-liquidity spikes around the employment release",
  ],
  usdContext:
    "USD strength is the dominant constraint on gold this week. Every scenario below is conditional on the dollar's reaction to US data rather than on metals-specific flow.",
  scenarios: [
    {
      type: "bullish",
      title: "Dollar rolls over",
      probability: 0.3,
      trigger: "Both US releases miss forecast and yields fall",
      outcome: "XAUUSD reclaims the week's midpoint and tests the prior swing high.",
    },
    {
      type: "bearish",
      title: "Yields extend higher",
      probability: 0.45,
      trigger: "Inflation and employment both beat",
      outcome: "Support gives way and price works toward the lower end of the monthly range.",
    },
    {
      type: "neutral",
      title: "Two-way chop",
      probability: 0.25,
      trigger: "Mixed data with offsetting surprises",
      outcome: "Range persists, with intraday spikes mean-reverting into the close.",
    },
  ],
  generatedAt: new Date().toISOString(),
  simulated: true,
};

export const mockApiStatus: ApiStatus = {
  environment: "simulation",
  apiMode: "Simulated",
  aiProvider: "Not configured",
  aiConnected: false,
  scraperConnected: false,
  version: "0.1.0-phase1",
  uptimeSeconds: 0,
};
