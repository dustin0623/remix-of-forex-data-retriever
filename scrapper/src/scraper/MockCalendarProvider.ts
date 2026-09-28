import { EconomicEventSchema, type EconomicEvent } from "../models/schemas.js";
import { addDays, isSameUtcDay, isoDate, startOfUtcDay, startOfUtcWeek } from "../utils/dates.js";
import type { EventSource } from "../models/schemas.js";
import type { CalendarProvider } from "./CalendarProvider.js";

type Template = Omit<
  EconomicEvent,
  "id" | "datetime" | "status" | "actual" | "source" | "metalsImpact"
> & {
  /** Day offset from Monday (0-6). -1 = today, -2 = tomorrow. */
  day: number;
  actualValue: string;
  /** Which upstream feed this event mirrors. */
  feed?: EventSource;
  metalsImpact?: EconomicEvent["metalsImpact"];
};

const TEMPLATES: Template[] = [
  { day: -1, time: "08:30", currency: "USD", title: "Core PCE Price Index m/m", impact: "high", forecast: "0.2%", previous: "0.3%", goldRelevance: "high", usdRelevance: "high", description: "Fed's preferred inflation gauge.", history: [{ period: "Jul", actual: "0.3%", forecast: "0.2%" }], actualValue: "0.3%", feed: "both", metalsImpact: "high" },
  { day: -1, time: "10:00", currency: "USD", title: "Pending Home Sales m/m", impact: "medium", forecast: "0.5%", previous: "-1.2%", goldRelevance: "low", usdRelevance: "medium", description: "Signed contracts for existing homes.", history: [], actualValue: "0.8%" },
  { day: -1, time: "09:00", currency: "EUR", title: "German Prelim CPI m/m", impact: "high", forecast: "0.1%", previous: "0.2%", goldRelevance: "medium", usdRelevance: "low", description: "Early read on German inflation.", history: [], actualValue: "0.1%" },
  { day: -1, time: "08:00", currency: "GBP", title: "LME Copper Inventories", impact: "medium", forecast: "", previous: "325", goldRelevance: "medium", usdRelevance: "none", description: "Warehouse stocks of industrial metals.", history: [], actualValue: "318", feed: "metalsmine", metalsImpact: "medium" },
  { day: -2, time: "08:30", currency: "USD", title: "Unemployment Claims", impact: "high", forecast: "225K", previous: "219K", goldRelevance: "medium", usdRelevance: "high", description: "Weekly initial jobless claims.", history: [], actualValue: "231K", feed: "both", metalsImpact: "medium" },
  { day: -2, time: "01:30", currency: "AUD", title: "Retail Sales m/m", impact: "medium", forecast: "0.3%", previous: "0.5%", goldRelevance: "low", usdRelevance: "none", description: "Change in retail sales value.", history: [], actualValue: "0.2%" },
  { day: 0, time: "10:00", currency: "USD", title: "ISM Manufacturing PMI", impact: "high", forecast: "48.9", previous: "48.7", goldRelevance: "medium", usdRelevance: "high", description: "Purchasing managers survey.", history: [], actualValue: "49.2", feed: "both", metalsImpact: "high" },
  { day: 1, time: "02:30", currency: "AUD", title: "Commodity Prices y/y", impact: "medium", forecast: "", previous: "15.5%", goldRelevance: "medium", usdRelevance: "none", description: "Index of Australian commodity export prices.", history: [], actualValue: "14.8%", feed: "metalsmine", metalsImpact: "medium" },
  { day: 2, time: "08:15", currency: "USD", title: "ADP Non-Farm Employment Change", impact: "high", forecast: "140K", previous: "99K", goldRelevance: "high", usdRelevance: "high", description: "Private payrolls estimate.", history: [], actualValue: "152K", feed: "both", metalsImpact: "medium" },
  { day: 3, time: "07:45", currency: "EUR", title: "ECB Main Refinancing Rate", impact: "high", forecast: "3.40%", previous: "3.65%", goldRelevance: "medium", usdRelevance: "medium", description: "ECB policy rate decision.", history: [], actualValue: "3.40%" },
  { day: 4, time: "08:30", currency: "USD", title: "Non-Farm Employment Change", impact: "high", forecast: "150K", previous: "142K", goldRelevance: "high", usdRelevance: "high", description: "Monthly payrolls report.", history: [], actualValue: "187K", feed: "both", metalsImpact: "high" },
  { day: 4, time: "08:30", currency: "CAD", title: "Unemployment Rate", impact: "high", forecast: "6.6%", previous: "6.6%", goldRelevance: "low", usdRelevance: "low", description: "Canadian jobless rate.", history: [], actualValue: "6.5%" },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export class MockCalendarProvider implements CalendarProvider {
  readonly name = "mock";
  constructor(private readonly now: () => Date = () => new Date()) {}

  private build(): EconomicEvent[] {
    const now = this.now();
    const today = startOfUtcDay(now);
    const monday = startOfUtcWeek(now);
    return TEMPLATES.map((t) => {
      const day = t.day === -1 ? today : t.day === -2 ? addDays(today, 1) : addDays(monday, t.day);
      const [h, m] = t.time.split(":").map(Number);
      const dt = new Date(day.getTime() + (h! * 60 + m!) * 60_000);
      const released = dt.getTime() <= now.getTime();
      const { day: _d, actualValue, feed, metalsImpact, ...rest } = t;
      return EconomicEventSchema.parse({
        ...rest,
        id: `${slug(t.currency)}-${slug(t.title)}-${isoDate(day)}`,
        datetime: dt.toISOString(),
        status: released ? "RELEASED" : "UPCOMING",
        actual: released ? actualValue : null,
        source: feed ?? "forexfactory",
        metalsImpact: metalsImpact ?? null,
      });
    }).sort((a, b) => a.datetime.localeCompare(b.datetime));
  }

  async getToday() {
    const today = startOfUtcDay(this.now());
    return this.build().filter((e) => isSameUtcDay(e.datetime, today));
  }

  async getTomorrow() {
    const tomorrow = addDays(startOfUtcDay(this.now()), 1);
    return this.build().filter((e) => isSameUtcDay(e.datetime, tomorrow));
  }

  async getWeek() {
    const monday = startOfUtcWeek(this.now());
    const end = addDays(monday, 7).getTime();
    // Include today/tomorrow even when tomorrow spills into next week.
    const tomorrowEnd = addDays(startOfUtcDay(this.now()), 2).getTime();
    return this.build().filter((e) => {
      const t = Date.parse(e.datetime);
      return t >= monday.getTime() && t < Math.max(end, tomorrowEnd);
    });
  }
}
