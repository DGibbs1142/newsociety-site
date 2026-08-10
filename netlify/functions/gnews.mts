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
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
  });
};

export const config: Config = {
  path: "/api/gnews"
};
