// Proxies GNews requests server-side so the API key never ships to the
// browser. A small allowlist of operations (rather than a fully open
// passthrough) keeps this from becoming a free relay for arbitrary GNews
// traffic.
import type { Context, Config } from "@netlify/functions";

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

  if (op === "headlines") {
    const category = url.searchParams.get("category") || "general";
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return new Response(JSON.stringify({ error: "Invalid category" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    target = `${GNEWS_BASE}/top-headlines?category=${category}&lang=en&country=us&max=${encodeURIComponent(max)}&apikey=${apiKey}`;
  } else if (op === "search") {
    const q = url.searchParams.get("q") || "";
    const page = url.searchParams.get("page") || "1";
    target = `${GNEWS_BASE}/search?q=${encodeURIComponent(q)}&lang=en&max=${encodeURIComponent(max)}&page=${encodeURIComponent(page)}&apikey=${apiKey}`;
  } else {
    return new Response(JSON.stringify({ error: "Unknown op" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const res = await fetch(target);
  const data = await res.json();
  // Browsers keep a good response for 5 minutes. Netlify's durable cache
  // shares one copy across every edge location for 10 minutes, so GNews
  // gets one request per query per 10 minutes instead of one per region —
  // regional-only caching is what tripped GNews's rate limit. Error responses
  // (like a 429) are never cached, so a blip clears on the next request.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (res.ok) {
    headers["Cache-Control"] = "public, max-age=600";
    headers["Netlify-CDN-Cache-Control"] = "public, durable, s-maxage=1800, stale-while-revalidate=600, stale-if-error=86400";
  } else {
    headers["Cache-Control"] = "no-store";
  }
  return new Response(JSON.stringify(data), { status: res.status, headers });
};

export const config: Config = {
  path: "/api/gnews"
};
