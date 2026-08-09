// Proxies Apple's official "Top Songs USA" chart (rss.marketingtools.apple.com)
// server-side. That feed is genuinely country-scoped and free/keyless, but it
// blocks direct browser fetch()es (no CORS headers) — routing it through this
// function means the browser calls same-origin /api/us-top-songs instead, no
// CORS problem, since the actual cross-origin request happens server-to-server.
import type { Context, Config } from "@netlify/functions";

const APPLE_FEED = "https://rss.marketingtools.apple.com/api/v2/us/music/most-played/100/songs.json";

export default async (req: Request, context: Context) => {
  const res = await fetch(APPLE_FEED);
  if (!res.ok) {
    return new Response(JSON.stringify({ error: `Apple feed returned ${res.status}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }

  const data = await res.json();
  const results = data?.feed?.results || [];

  const tracks = results.map((track: any) => {
    const genre = track.genres?.find((g: any) => g.name !== "Music")?.name || track.genres?.[0]?.name || "";
    return {
      title: track.name,
      artist: track.artistName,
      genre,
      releaseDate: track.releaseDate,
      url: track.url,
      artworkUrl: (track.artworkUrl100 || "").replace("100x100", "300x300")
    };
  });

  return new Response(JSON.stringify({ country: "us", updated: data?.feed?.updated, tracks }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=1800"
    }
  });
};

export const config: Config = {
  path: "/api/us-top-songs"
};
