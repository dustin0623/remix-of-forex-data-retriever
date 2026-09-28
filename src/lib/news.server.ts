/**
 * Raw news from Al Jazeera (public RSS) and the SM_News_24h Telegram channel
 * (public web preview at t.me/s/...). Everything is shown unfiltered; AI
 * analysis is optional and on demand. 3-minute cache with stale fallback.
 */

export type NewsSource = "aljazeera" | "telegram";

export interface NewsItem {
  id: string;
  source: NewsSource;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string;
}

export interface NewsFeed {
  items: NewsItem[];
  sources: { source: NewsSource; ok: boolean; count: number }[];
  fetchedAt: string;
  stale: boolean;
}

const RSS_URL = "https://www.aljazeera.com/xml/rss/all.xml";
const TG_CHANNEL = "SM_News_24h";
const TTL = 3 * 60_000;
const UA = "Mozilla/5.0 (compatible; MarketIntel/1.0)";

let cache: { at: number; feed: NewsFeed } | null = null;
const lastGood: Partial<Record<NewsSource, NewsItem[]>> = {};

export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? stripTags(m[1]) : null;
}

export function parseRss(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const title = tag(b, "title");
    const url = tag(b, "link");
    const date = tag(b, "pubDate");
    if (!title || !url) continue;
    const t = date ? new Date(date) : new Date();
    out.push({
      id: `aj:${tag(b, "guid") ?? url}`,
      source: "aljazeera",
      title,
      summary: tag(b, "description") || null,
      url,
      publishedAt: (isNaN(t.getTime()) ? new Date() : t).toISOString(),
    });
  }
  return out;
}

export function parseTelegram(html: string, channel = TG_CHANNEL): NewsItem[] {
  const out: NewsItem[] = [];
  const blocks = html.split('class="tgme_widget_message_wrap').slice(1);
  for (const b of blocks) {
    const post = b.match(/data-post="([^"]+)"/)?.[1];
    const textHtml = b.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    const dt = b.match(/<time datetime="([^"]+)"/)?.[1];
    if (!post || !textHtml) continue;
    const text = stripTags(textHtml);
    if (!text) continue;
    const title = text.length > 220 ? `${text.slice(0, 217)}…` : text;
    out.push({
      id: `tg:${post}`,
      source: "telegram",
      title,
      summary: text.length > 220 ? text : null,
      url: `https://t.me/${post.includes("/") ? post : `${channel}/${post}`}`,
      publishedAt: dt ? new Date(dt).toISOString() : new Date().toISOString(),
    });
  }
  return out;
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function getNews(): Promise<NewsFeed> {
  if (cache && Date.now() - cache.at < TTL) return cache.feed;
  const jobs: [NewsSource, () => Promise<NewsItem[]>][] = [
    ["aljazeera", async () => parseRss(await get(RSS_URL))],
    ["telegram", async () => parseTelegram(await get(`https://t.me/s/${TG_CHANNEL}`))],
  ];
  const results = await Promise.all(
    jobs.map(async ([source, fn]) => {
      try {
        const items = await fn();
        if (items.length) lastGood[source] = items;
        return { source, ok: items.length > 0, items };
      } catch (e) {
        console.error(`[news] ${source} failed`, (e as Error).message);
        return { source, ok: false, items: lastGood[source] ?? [] };
      }
    }),
  );
  const items = results
    .flatMap((r) => r.items)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 80);
  if (!items.length && cache) return { ...cache.feed, stale: true };
  if (!items.length) throw new Error("News sources are unavailable right now. Try again shortly.");
  const feed: NewsFeed = {
    items,
    sources: results.map((r) => ({ source: r.source, ok: r.ok, count: r.items.length })),
    fetchedAt: new Date().toISOString(),
    stale: results.some((r) => !r.ok),
  };
  cache = { at: Date.now(), feed };
  return feed;
}
