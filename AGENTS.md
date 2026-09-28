<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- All market data flows through `src/services/marketService.ts` (React Query `queryOptions`), which
  currently resolves from `src/mock/` — so Phase 2 can swap in the `/scrapper` API without UI changes.
- Domain types live in `src/types/market.ts`; global client state is Zustand in `src/stores/` (settings
  only) — kept out of React Query because it is user preference, not server data.
- Shared market UI lives in `src/components/market/`; the shell/nav lives in `src/layouts/AppShell.tsx`
  and is rendered once from `src/routes/__root.tsx`.
- Components read data only via `src/services/marketService.ts` → `src/services/api/apiClient.ts` (`MarketApi`
  interface); the mock implementation delegates to `src/services/mock/simulationService.ts`, which holds
  session-persisted event state + change log, so Phase 3 swaps in the real API by adding one implementation.

- `/scrapper` is a standalone Fastify API (own package.json, node:sqlite, Vitest) outside the frontend build; routes -> CalendarService -> CalendarProvider/EventRepository so the mock provider can be swapped for the real scraper.
