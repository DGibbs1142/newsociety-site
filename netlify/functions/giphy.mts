// Proxies Giphy's trending endpoint server-side so the API key never ships
// to the browser.
import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const apiKey = Netlify.env.get("GIPHY_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Giphy key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const res = await fetch(`https://api.giphy.com/v1/gifs/trending?limit=4&rating=pg-13&api_key=${apiKey}`);
  const data = await res.json();
  // Browsers keep a good response for 5 minutes. Netlify's durable cache
  // shares one copy across every edge location for 10 minutes, so Giphy
  // gets one request per query per 10 minutes instead of one per region —
  // regional-only caching is what tripped GNews's rate limit. Error responses
  // (like a 429) are never cached, so a blip clears on the next request.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (res.ok) {
    headers["Cache-Control"] = "public, max-age=300";
    headers["Netlify-CDN-Cache-Control"] = "public, durable, s-maxage=600, stale-while-revalidate=300";
  } else {
    headers["Cache-Control"] = "no-store";
  }
  return new Response(JSON.stringify(data), { status: res.status, headers });
};

export const config: Config = {
  path: "/api/giphy"
};
