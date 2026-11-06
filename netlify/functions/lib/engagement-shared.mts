// Shared by react.mts, trending.mts and poll.mts. Lives in a subdirectory of
// netlify/functions so it isn't routed as its own function (same as
// push-shared.mts).
//
// Blobs has no atomic increment, so counters are updated read-modify-write
// with the blob's etag as a guard: if two visitors react at the same instant,
// one write loses the race, re-reads, and tries again instead of silently
// overwriting the other's count.
import { getStore } from "@netlify/blobs";

type Store = ReturnType<typeof getStore>;

export function json(data: unknown, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cache }
  });
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function updateJSON<T>(store: Store, key: string, init: () => T, change: (value: T) => T): Promise<T> {
  for(let attempt = 0; attempt < 6; attempt++){
    const current = await store.getWithMetadata(key, { type: "json", consistency: "strong" } as any) as { data: T; etag?: string } | null;
    const next = change(current ? current.data : init());
    const result = current?.etag
      ? await store.setJSON(key, next, { onlyIfMatch: current.etag })
      : await store.setJSON(key, next, { onlyIfNew: true });
    if((result as any)?.modified !== false) return next;
    await new Promise(r => setTimeout(r, 25 + Math.random() * 75));
  }
  throw new Error("Too much contention, try again");
}

// One reaction/vote per visitor, without storing who they are: the marker key
// is a hash of their IP plus what they reacted to, salted so the stored hashes
// can't be reversed by hashing every IP address.
export async function visitorMark(context: { ip?: string }, ...parts: string[]): Promise<string> {
  const salt = Netlify.env.get("ENGAGEMENT_SALT") || "newsociety-engagement";
  return sha256([salt, context.ip || "unknown", ...parts].join("|"));
}

export function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

// Trending is a running score that halves every 24 hours, so a story that got
// a burst of reactions last week drops below one getting steady ones today.
export interface TrendingEntry {
  id: string;
  title: string;
  pillar: string;
  href: string;
  imageUrl: string;
  score: number;   // engagement score as of scoredAt
  scoredAt: number;
}

const HALF_LIFE_MS = 24 * 3600 * 1000;

export function decayed(score: number, scoredAt: number, now = Date.now()) {
  return score * Math.pow(0.5, Math.max(0, now - scoredAt) / HALF_LIFE_MS);
}
