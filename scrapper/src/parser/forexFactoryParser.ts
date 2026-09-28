import * as cheerio from "cheerio";

/**
 * Raw calendar row as it appears on the Forex Factory calendar table.
 * Not used by the mock provider; wired up when the real scraper lands.
 * Blank date/currency cells inherit from the previous row.
 */
export interface RawCalendarRow {
  date: string;
  time: string;
  currency: string;
  impact: string;
  event: string;
  actual: string;
  forecast: string;
  previous: string;
}

export function parseCalendarHtml(html: string): RawCalendarRow[] {
  const $ = cheerio.load(html);
  const rows: RawCalendarRow[] = [];
  let date = "";
  let time = "";
  $("tr.calendar__row").each((_, el) => {
    const cell = (cls: string) => $(el).find(`.calendar__${cls}`).text().trim();
    date = cell("date") || date;
    time = cell("time") || time;
    const event = cell("event");
    if (!event) return;
    const impactClass = $(el).find(".calendar__impact span").attr("class") ?? "";
    rows.push({
      date,
      time,
      currency: cell("currency"),
      impact: impactClass,
      event,
      actual: cell("actual"),
      forecast: cell("forecast"),
      previous: cell("previous"),
    });
  });
  return rows;
}
