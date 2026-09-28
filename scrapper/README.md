# /scrapper — Forex Calendar API (Phase 4)

Independent Fastify + TypeScript API. It is **not** part of the frontend build and
the frontend still runs in simulation mode. It can serve a mock calendar
(`CALENDAR_PROVIDER=mock`, default) or real Forex Factory data (`CALENDAR_PROVIDER=forexfactory`).
It does **not** call Anthropic yet.

## Installation

Requires **Node.js 22.13+** (uses the built-in `node:sqlite`, so no native build step).

```bash
cd scrapper
npm install
cp .env.example .env
```

## Environment variables

| Name | Default | Notes |
|---|---|---|
| `PORT` | `5000` | HTTP port |
| `DATABASE_URL` | `./data/forex.db` | SQLite file path (`:memory:` allowed) |
| `SCRAPER_ENABLED` | `true` | Reported in `/api/status` |
| `AI_ENABLED` | `false` | Reported in `/api/status` |
| `AI_PROVIDER` | `anthropic` | |
| `ANTHROPIC_API_KEY` | _(empty)_ | Never returned or logged |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | |

## Commands

```bash
npm run dev        # development, auto-reload (tsx)
npm run build      # compile to dist/
npm start          # production (after build)
npm test           # vitest (fixtures only, never hits Forex Factory)
npm run scraper:test  # fetch real data once and print a summary (dev only)
docker build -t forex-api . && docker run -p 5000:5000 forex-api
```

## API endpoints

All responses use `{ "success": true, "data": ... }` or
`{ "success": false, "error": { "code", "message" } }` — except `/api/status`,
which returns its object directly.

| Method | Path | Description |
|---|---|---|
| GET | `/api/status` | Service/AI/scraper flags |
| GET | `/api/calendar/today` | Today's events (UTC) |
| GET | `/api/calendar/tomorrow` | Tomorrow's events |
| GET | `/api/calendar/week` | Current week (Mon–Sun, UTC) |
| GET | `/api/calendar/high-impact` | High-impact events this week |
| GET | `/api/calendar/gold-relevant` | Medium/high gold relevance this week |
| GET | `/api/events/:id` | One event. `400 INVALID_EVENT_ID`, `404 EVENT_NOT_FOUND` |
| GET | `/api/changes?limit=50` | Detected actual/forecast/previous changes |

## Architecture

```text
routes (api/) -> CalendarService (services/) -> CalendarProvider (scraper/)
                                             -> EventRepository (database/)
```

- `scraper/CalendarProvider.ts` — interface; swap `MockCalendarProvider` for a real
  Forex Factory provider without touching routes or storage.
- `database/` — SQLite tables `events`, `event_snapshots`, `changes`, accessed only via
  `EventRepository`.
- `models/schemas.ts` — Zod schemas for every API object (mirrors the frontend's `EconomicEvent`).

Reference for future scraping: [AtaCanYmc/ForexFactoryScrapper](https://github.com/AtaCanYmc/ForexFactoryScrapper).
Respect Forex Factory's terms and robots directives before scraping.

## Forex Factory ingestion

**Data sources (investigated):**

1. **Structured weekly export** — `https://nfs.faireconomy.media/ff_calendar_thisweek.json`
   (the official Forex Factory export feed). Provides event, currency, impact, date+time
   (with timezone offset) and forecast/previous. It does **not** include `actual`. This is the
   primary source and gives us reliable UTC timestamps.
2. **HTML calendar** — `https://www.forexfactory.com/calendar?week=this`, parsed with Cheerio
   **only** to fill in `actual` (and revised `previous`). Rows are matched to export events by
   currency + title. If the page is blocked (e.g. HTTP 403) the API keeps working with export
   data and actuals stay `null`. All selectors live in `src/scraper/forexFactory/selectors.ts`.

Code: `src/scraper/forexFactory/` — `ForexFactoryClient` (HTTP, timeout, retries),
`ForexFactoryParser` (pure parsing/normalizing, deterministic ids), `ForexFactoryProvider`
(caching, min interval, mapping), `types.ts`. Gold relevance is decided by
`GoldRelevanceService` using ordered rules in `src/config/goldRelevanceRules.ts`
(`low | medium | high | very_high`) — edit that file to change relevance; the parser never does.

Event ids are deterministic: `ff-<date>-<currency>-<sha1(source|date|currency|event|time)[0..10]>`.

### Scraper configuration

| Name | Default | Notes |
|---|---|---|
| `CALENDAR_PROVIDER` | `mock` | `mock` or `forexfactory` |
| `SCRAPER_ENABLED` | `true` | `false` forces the mock provider |
| `SCRAPER_MIN_INTERVAL_MS` | `900000` | Min time between full fetches (15 min; floor 60 s) |
| `SCRAPER_TIMEOUT_MS` | `15000` | Per-request timeout |
| `SCRAPER_MAX_RETRIES` | `3` | Retries on network errors / 408, 429, 5xx |
| `SCRAPER_RETRY_BASE_MS` | `1000` | Backoff: base × 2^attempt (1 s, 2 s, 4 s) |
| `SCRAPER_ENRICH_ACTUALS` | `true` | Fetch the HTML page for actual values |
| `SCRAPER_EXPORT_URL` / `SCRAPER_HTML_URL` | see above | Override sources |
| `SCRAPER_USER_AGENT` | identifies this API | Sent with every request |

### Responsible polling

- There is **no background polling**. Data is fetched lazily when an endpoint is called, at most
  once per `SCRAPER_MIN_INTERVAL_MS`; every other request is served from the in-memory cache.
- One refresh = at most 2 requests (export + HTML), plus retries only on transient errors.
  4xx responses other than 408/429 are not retried.
- Concurrent requests share a single in-flight fetch.
- If a refresh fails, the last good data is served; with no data yet, the API returns
  `503 UPSTREAM_UNAVAILABLE` and won't retry upstream for 60 s.
- The weekly export covers the current week only, so `tomorrow` is empty on Sundays.
- Review Forex Factory's terms and robots rules before running this in production.
