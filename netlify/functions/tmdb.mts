// Proxies TMDB requests server-side so the API key never ships to the
// browser. A small allowlist of operations (rather than a fully open
// passthrough) keeps this from becoming a free relay for arbitrary TMDB
// traffic.
import type { Context, Config } from "@netlify/functions";

const TMDB_BASE = "https://api.themoviedb.org/3";

export default async (req: Request, context: Context) => {
  const apiKey = Netlify.env.get("TMDB_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "TMDB key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(req.url);
  const op = url.searchParams.get("op");
  let target: string;

  if (op === "trending") {
    target = `${TMDB_BASE}/trending/all/day?api_key=${apiKey}`;
  } else if (op === "search") {
    const query = url.searchParams.get("query") || "";
    const page = url.searchParams.get("page") || "1";
    target = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&page=${encodeURIComponent(page)}&api_key=${apiKey}`;
  } else if (op === "detail") {
    const mediaType = url.searchParams.get("mediaType");
    const id = url.searchParams.get("id");
    if (!id || (mediaType !== "movie" && mediaType !== "tv")) {
      return new Response(JSON.stringify({ error: "Invalid mediaType/id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    target = `${TMDB_BASE}/${mediaType}/${encodeURIComponent(id)}?api_key=${apiKey}&append_to_response=credits`;
  } else {
    return new Response(JSON.stringify({ error: "Unknown op" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const res = await fetch(target);
  const data = await res.json();
  // Browsers keep a good response for 5 minutes. Netlify's durable cache
  // shares one copy across every edge location for 10 minutes, so TMDB
  // gets one request per query per 10 minutes instead of one per region —
  // regional-only caching is what tripped GNews's rate limit. Error responses
  // (like a 429) are never cached, so a blip clears on the next request.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (res.ok) {
    headers["Cache-Control"] = "public, max-age=300";
    headers["Netlify-CDN-Cache-Control"] = "public, durable, s-maxage=600, stale-while-revalidate=300, stale-if-error=86400";
  } else {
    headers["Cache-Control"] = "no-store";
  }
  return new Response(JSON.stringify(data), { status: res.status, headers });
};

export const config: Config = {
  path: "/api/tmdb"
};
