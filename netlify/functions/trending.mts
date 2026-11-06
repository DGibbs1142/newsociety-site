// "Trending on NewSociety" — the stories visitors are reacting to and saving
// most right now, ranked by a score that halves every 24 hours.
//
//   GET /api/trending?limit=6  -> { items: [{ title, pillar, href, imageUrl, heat }] }
import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, decayed, type TrendingEntry } from "./lib/engagement-shared.mts";

// Below this a story has had maybe one stray reaction a day or two ago —
// not enough to call it trending.
const MIN_SCORE = 0.75;

export default async (req: Request) => {
  if(req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const limit = Math.min(12, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 6));

  const entries = await getStore("engagement-index")
    .get("trending", { type: "json" }).catch(() => null) as TrendingEntry[] | null;

  const now = Date.now();
  const items = (entries || [])
    .map(e => ({ ...e, heat: decayed(e.score, e.scoredAt, now) }))
    .filter(e => e.heat >= MIN_SCORE)
    .sort((a, b) => b.heat - a.heat)
    .slice(0, limit)
    .map(({ title, pillar, href, imageUrl, heat }) => ({ title, pillar, href, imageUrl, heat: Math.round(heat * 10) / 10 }));

  return json({ items }, 200, "public, max-age=60");
};

export const config: Config = {
  path: "/api/trending"
};
