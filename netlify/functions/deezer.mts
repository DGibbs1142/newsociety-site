// Proxies the handful of Deezer API calls the Music, Search and detail pages
// make. Deezer doesn't send CORS headers, so the browser used to load its
// JSONP endpoint through a <script> tag — which also set a third-party Deezer
// cookie on every visitor. Fetching server-side keeps visitors' browsers from
// ever talking to Deezer. Like gnews.mts, this is an allowlist of operations
// rather than an open passthrough.
import type { Context, Config } from "@netlify/functions";

const DEEZER_API = "https://api.deezer.com";
const CHART_TYPES = ["albums", "tracks"];

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

// Clamp a numeric query param into [min, max], falling back when missing or junk.
function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const op = url.searchParams.get("op");
  let target: string;
  let cacheSeconds: number;

  if (op === "chart") {
    const type = url.searchParams.get("type") || "tracks";
    if (!CHART_TYPES.includes(type)) return jsonError("Invalid chart type", 400);
    const limit = clampInt(url.searchParams.get("limit"), 10, 1, 25);
    target = `${DEEZER_API}/chart/0/${type}?limit=${limit}`;
    cacheSeconds = 1800;
  } else if (op === "search") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q || q.length > 100) return jsonError("Invalid search query", 400);
    const index = clampInt(url.searchParams.get("index"), 0, 0, 500);
    const limit = clampInt(url.searchParams.get("limit"), 10, 1, 25);
    target = `${DEEZER_API}/search?q=${encodeURIComponent(q)}&index=${index}&limit=${limit}`;
    cacheSeconds = 600;
  } else if (op === "track" || op === "album") {
    const id = url.searchParams.get("id") || "";
    if (!/^\d{1,15}$/.test(id)) return jsonError("Invalid id", 400);
    target = `${DEEZER_API}/${op}/${id}`;
    cacheSeconds = 86400;
  } else {
    return jsonError("Unknown op", 400);
  }

  let res: Response;
  try {
    res = await fetch(target);
  } catch {
    return jsonError("Deezer unavailable", 502);
  }
  const data = await res.json().catch(() => null);
  // Deezer reports most failures as HTTP 200 with an { error } body.
  if (!res.ok || !data || data.error) {
    return jsonError(data?.error?.message || "Deezer request failed", res.ok ? 502 : res.status);
  }

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${Math.min(cacheSeconds, 600)}`,
      // Shared across edge locations (see gnews.mts) so Deezer sees one request
      // per chart/search/item per cache window rather than one per region.
      "Netlify-CDN-Cache-Control": `public, durable, s-maxage=${cacheSeconds}, stale-while-revalidate=300`
    }
  });
};

export const config: Config = {
  path: "/api/deezer"
};
