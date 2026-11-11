// Proxies GNews requests server-side so the API key never ships to the
// browser. A small allowlist of operations (rather than a fully open
// passthrough) keeps this from becoming a free relay for arbitrary GNews
// traffic.
import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const GNEWS_BASE = "https://gnews.io/api/v4";
const ALLOWED_CATEGORIES = ["general", "entertainment"];

export default async (req: Request, context: Context) => {
  const apiKey = Netlify.env.get("GNEWS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GNews key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(req.url);
  const op = url.searchParams.get("op");
  const max = url.searchParams.get("max") || "10";
  let target: string;
  // Identifies the query without the API key, for the last-good store.
  let cacheKey: string;

  if (op === "headlines") {
    const category = url.searchParams.get("category") || "general";
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return new Response(JSON.stringify({ error: "Invalid category" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    target = `${GNEWS_BASE}/top-headlines?category=${category}&lang=en&country=us&max=${encodeURIComponent(max)}&apikey=${apiKey}`;
    cacheKey = `headlines/${category}/${max}`;
  } else if (op === "search") {
    const q = url.searchParams.get("q") || "";
    const page = url.searchParams.get("page") || "1";
    target = `${GNEWS_BASE}/search?q=${encodeURIComponent(q)}&lang=en&max=${encodeURIComponent(max)}&page=${encodeURIComponent(page)}&apikey=${apiKey}`;
    cacheKey = `search/${encodeURIComponent(q.toLowerCase())}/${max}/${page}`;
  } else {
    return new Response(JSON.stringify({ error: "Unknown op" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // The free GNews plan has a small daily quota, and every deploy empties
  // Netlify's CDN cache, so 429s happen. Every good answer is kept in Blobs;
  // when GNews refuses or times out, the last good answer for the same query
  // is served instead of an error, flagged with X-NewSociety-Stale.
  const store = getStore("gnews-last-good");
  let res: Response | null = null;
  let data: any = null;
  const call = async (ms: number) => {
    try{
      const r = await fetch(target, { signal: AbortSignal.timeout(ms) });
      return { r, d: await r.json().catch(() => null) };
    }catch{
      return { r: null, d: null };
    }
  };
  ({ r: res, d: data } = await call(8000));
  // The free plan also allows only about one request per second. Site search
  // and the homepage ask for two searches at once, so the second is often
  // refused with a 429 that has nothing to do with the daily quota. A 429
  // comes back fast, so wait a moment and try once more before falling back.
  if (res && res.status === 429) {
    await new Promise(done => setTimeout(done, 1200));
    ({ r: res, d: data } = await call(5000));
  }

  if (res && res.ok && data) {
    try{ await store.setJSON(cacheKey, { at: Date.now(), data }); }catch{}
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Browsers keep a good response for 10 minutes; Netlify's durable
        // cache shares one copy across every edge location.
        "Cache-Control": "public, max-age=600",
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=1800, stale-while-revalidate=600, stale-if-error=86400"
      }
    });
  }

  let saved: { at: number; data: any } | null = null;
  try{ saved = await store.get(cacheKey, { type: "json" }); }catch{}
  if (saved?.data) {
    return new Response(JSON.stringify(saved.data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Short, so fresh news replaces this as soon as the quota resets.
        "Cache-Control": "public, max-age=120",
        "X-NewSociety-Stale": new Date(saved.at).toISOString()
      }
    });
  }

  return new Response(JSON.stringify(data || { error: "GNews unavailable" }), {
    status: res ? res.status : 504,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
};

export const config: Config = {
  path: "/api/gnews"
};
