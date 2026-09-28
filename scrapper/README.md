# /scrapper — Phase 2 placeholder

This folder will hold the independent TypeScript API that serves the frontend.
Nothing here is implemented yet, and the Phase 1 frontend makes **no** network
calls: all data comes from `src/mock/` via `src/services/marketService.ts`.

## Reference implementation

Design notes are taken from [AtaCanYmc/ForexFactoryScrapper](https://github.com/AtaCanYmc/ForexFactoryScrapper)
(Python/Flask), used as a structural reference only — no code is copied.

What it tells us:

- **Record shape** — one calendar row is `date, time, currency, impact, event,
  actual, forecast, previous`. `src/types/market.ts` (`EconomicEvent`) mirrors
  this and adds derived fields (`goldRelevance`, `usdRelevance`, `history`).
- **URL strategy** — the calendar page is requested per timeline
  (`day` / `week` / `month`) with explicit `day`, `month`, `year` params, then
  the HTML table is parsed. Rows inherit the last seen date and currency when
  those cells are blank — that inheritance is the main parsing pitfall.
- **Validation** — date and paging params are validated before any fetch, and
  parsed rows go through a schema (Pydantic there, Zod here) before being
  returned.
- **Response envelope** — list endpoints return
  `{ total, offset, limit, results }`. The API Explorer page already documents
  this envelope.
- **Operational shape** — route modules per source, a shared helpers module,
  centralised error handlers, and a status/health route.

## Phase 2 outline

1. Fetch the calendar HTML for a requested day/week with a normal browser
   user-agent and a polite request rate plus on-disk caching.
2. Parse rows with `cheerio`, carrying forward date/currency, and normalise
   impact to `low | medium | high`.
3. Validate with Zod into the `EconomicEvent` shape and persist snapshots so
   field-level diffs can power `GET /api/changes`.
4. Expose the endpoints documented on the API Explorer page using the
   `{ total, offset, limit, results }` envelope.
5. Point the frontend at it by replacing the bodies in
   `src/services/marketService.ts` — query keys and component code stay as-is.

Respect Forex Factory's terms of service and robots directives before running
any scraper against the live site.
