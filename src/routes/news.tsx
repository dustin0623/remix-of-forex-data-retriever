import { createFileRoute } from "@tanstack/react-router";

import { NewsCard } from "@/components/market/NewsCard";
import { PageHeader } from "@/components/market/PageHeader";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Breaking News & Squawk — Forex Market Intelligence" },
      {
        name: "description",
        content:
          "Unfiltered Al Jazeera and SM News 24h headlines with optional AI screening for gold-relevant macro and geopolitical risk.",
      },
      { property: "og:title", content: "Breaking News & Squawk — Forex Market Intelligence" },
      {
        property: "og:description",
        content: "Live geopolitical and macro headlines that can move XAUUSD, with optional AI relevance scoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  return (
    <>
      <PageHeader
        title="Breaking News & Squawk"
        description="Every headline from Al Jazeera and SM News 24h, unfiltered. AI screening for gold relevance is optional and on demand."
      />
      <NewsCard />
    </>
  );
}
