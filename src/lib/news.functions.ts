import { createServerFn } from "@tanstack/react-start";

import { getNews } from "./news.server";

/** Unfiltered Al Jazeera + SM_News_24h Telegram headlines, 3-min server cache. */
export const fetchNews = createServerFn({ method: "GET" }).handler(() => getNews());
