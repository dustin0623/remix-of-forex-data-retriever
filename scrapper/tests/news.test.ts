import { describe, expect, it } from "vitest";
import { parseRss, parseTelegram } from "../src/services/newsService.js";

describe("news parsers", () => {
  it("parses Al Jazeera RSS items", () => {
    const xml = `<rss><channel><item><title><![CDATA[Oil jumps &amp; gold rises]]></title><link>https://aljazeera.com/a</link><guid>g1</guid><pubDate>Mon, 28 Sep 2026 14:00:00 +0000</pubDate><description>Desc</description></item></channel></rss>`;
    const [i] = parseRss(xml);
    expect(i).toMatchObject({ id: "aj:g1", source: "aljazeera", title: "Oil jumps & gold rises", url: "https://aljazeera.com/a", publishedAt: "2026-09-28T14:00:00.000Z" });
  });
  it("parses Telegram web preview posts", () => {
    const html = `<div class="tgme_widget_message_wrap js-widget_message_wrap"><div data-post="SM_News_24h/42"><div class="tgme_widget_message_text js-message_text" dir="auto">Fed <b>hikes</b> rates</div><time datetime="2026-09-28T12:08:56+00:00"></time></div></div>`;
    const [i] = parseTelegram(html);
    expect(i).toMatchObject({ id: "tg:SM_News_24h/42", title: "Fed hikes rates", url: "https://t.me/SM_News_24h/42" });
  });
});
