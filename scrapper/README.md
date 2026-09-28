# /scrapper — Forex Calendar API (Phase 3)

Independent Fastify + TypeScript API. It is **not** part of the frontend build and
the frontend still runs in simulation mode. This phase uses a `MockCalendarProvider`;
it does **not** scrape Forex Factory and does **not** call Anthropic.

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
npm test           # vitest
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
- `parser/forexFactoryParser.ts` — Cheerio parser skeleton for the future scraper.
- `database/` — SQLite tables `events`, `event_snapshots`, `changes`, accessed only via
  `EventRepository`.
- `models/schemas.ts` — Zod schemas for every API object (mirrors the frontend's `EconomicEvent`).

Reference for future scraping: [AtaCanYmc/ForexFactoryScrapper](https://github.com/AtaCanYmc/ForexFactoryScrapper).
Respect Forex Factory's terms and robots directives before scraping.
