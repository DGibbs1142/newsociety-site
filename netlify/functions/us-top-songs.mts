// Builds NewSociety's own blended US chart from two independent sources,
// server-side (so both Apple's no-CORS feed and the merge logic itself stay
// off the client entirely):
//  - Apple's official "Top Songs USA" feed — genuinely country-scoped, but
//    only reflects Apple Music listeners.
//  - Deezer's global chart/0 — a different, much larger listener base, but
//    with no real country filter of its own (tested and confirmed a no-op).
// A song's position in the blend is the SUM of its rank on each chart it
// appears on (missing from a chart counts as a rank-100 penalty for that
// chart), so a song popular on BOTH platforms naturally outranks one that's
// only strong on a single platform — a simple, defensible way to be more
// representative than either source alone, without pretending to be an
// official chart we don't have access to (like Billboard's, which has no
// public API).
import type { Context, Config } from "@netlify/functions";

const APPLE_FEED = "https://rss.marketingtools.apple.com/api/v2/us/music/most-played/100/songs.json";
const DEEZER_CHART = "https://api.deezer.com/chart/0/tracks?limit=100";
const MISSING_RANK_PENALTY = 100;

function normalizeKey(title: string, artist: string): string {
  const clean = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${clean(title)}|${clean(artist)}`;
}

type Entry = {
  title: string;
  artist: string;
  genre: string;
  releaseDate: string;
  url: string;
  artworkUrl: string;
  appleRank: number | null;
  deezerRank: number | null;
};

export default async (req: Request, context: Context) => {
  const [appleRes, deezerRes] = await Promise.allSettled([fetch(APPLE_FEED), fetch(DEEZER_CHART)]);

  const appleResults = appleRes.status === "fulfilled" && appleRes.value.ok
    ? (await appleRes.value.json())?.feed?.results || []
    : [];
  const deezerResults = deezerRes.status === "fulfilled" && deezerRes.value.ok
    ? (await deezerRes.value.json())?.data || []
    : [];

  if (!appleResults.length && !deezerResults.length) {
    return new Response(JSON.stringify({ error: "Both chart sources unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }

  const merged = new Map<string, Entry>();

  appleResults.forEach((t: any, i: number) => {
    const genre = t.genres?.find((g: any) => g.name !== "Music")?.name || t.genres?.[0]?.name || "";
    merged.set(normalizeKey(t.name, t.artistName), {
      title: t.name,
      artist: t.artistName,
      genre,
      releaseDate: t.releaseDate || "",
      url: t.url,
      artworkUrl: (t.artworkUrl100 || "").replace("100x100", "300x300"),
      appleRank: i + 1,
      deezerRank: null
    });
  });

  deezerResults.forEach((t: any, i: number) => {
    const key = normalizeKey(t.title, t.artist?.name || "");
    const existing = merged.get(key);
    if (existing) {
      existing.deezerRank = i + 1;
    } else {
      merged.set(key, {
        title: t.title,
        artist: t.artist?.name || "Unknown Artist",
        genre: "",
        releaseDate: "",
        url: t.link,
        artworkUrl: t.album?.cover_medium || "",
        appleRank: null,
        deezerRank: i + 1
      });
    }
  });

  const blended = Array.from(merged.values())
    .map(e => ({ ...e, score: (e.appleRank ?? MISSING_RANK_PENALTY) + (e.deezerRank ?? MISSING_RANK_PENALTY) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 100)
    .map(({ score, appleRank, deezerRank, ...rest }) => ({
      ...rest,
      source: appleRank && deezerRank ? "Apple Music + Deezer" : appleRank ? "Apple Music" : "Deezer"
    }));

  return new Response(JSON.stringify({ country: "us", updated: new Date().toISOString(), tracks: blended }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=1800",
      // Shared across all edge locations (see gnews.mts), so Apple and Deezer
      // are hit once per 30 minutes rather than once per region.
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=1800, stale-while-revalidate=600"
    }
  });
};

export const config: Config = {
  path: "/api/us-top-songs"
};
