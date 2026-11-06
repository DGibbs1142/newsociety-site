// Story reactions (🔥 😂 🤯) and save counts.
//
//   GET  /api/react?ids=<id>,<id>   -> { counts: { <id>: { fire, laugh, mind, save } } }
//   POST /api/react  { id, reaction, action: "add"|"remove", meta: { title, pillar, href, imageUrl } }
//
// A story's id is the SHA-256 of its stable key (source URL, or title+pillar),
// computed in the browser by engagement.js — stories come from live APIs and
// have no database row of their own. Every reaction also feeds the decayed
// "trending" index that trending.mts reads.
import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, updateJSON, visitorMark, cleanText, decayed, type TrendingEntry } from "./lib/engagement-shared.mts";

const REACTIONS = ["fire", "laugh", "mind", "save"] as const;
type Reaction = typeof REACTIONS[number];
type Counts = Record<Reaction, number>;

interface Story {
  counts: Counts;
  title: string;
  pillar: string;
  href: string;
  imageUrl: string;
  lastAt: number;
}

const ID_RE = /^[a-f0-9]{64}$/;
const INDEX_LIMIT = 150;
const WEIGHT: Record<Reaction, number> = { fire: 1, laugh: 1, mind: 1, save: 2 };

const emptyCounts = (): Counts => ({ fire: 0, laugh: 0, mind: 0, save: 0 });

// Only on-site detail links and https images make it into the trending index,
// so a crafted request can't plant an off-site link on the homepage.
function cleanMeta(raw: any) {
  const href = cleanText(raw?.href, 2000);
  const imageUrl = cleanText(raw?.imageUrl, 600);
  return {
    title: cleanText(raw?.title, 160),
    pillar: cleanText(raw?.pillar, 40),
    href: href.startsWith("detail.html?") ? href : "",
    imageUrl: imageUrl.startsWith("https://") ? imageUrl : ""
  };
}

export default async (req: Request, context: Context) => {
  const stories = getStore("engagement-stories");

  if(req.method === "GET"){
    const ids = (new URL(req.url).searchParams.get("ids") || "")
      .split(",").filter(id => ID_RE.test(id)).slice(0, 40);
    const counts: Record<string, Counts> = {};
    await Promise.all(ids.map(async id => {
      const story = await stories.get(id, { type: "json" }).catch(() => null) as Story | null;
      counts[id] = story?.counts || emptyCounts();
    }));
    return json({ counts }, 200, "public, max-age=15");
  }

  if(req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try{ body = await req.json(); }catch{ return json({ error: "Invalid JSON body" }, 400); }

  const id = typeof body?.id === "string" ? body.id : "";
  const reaction = body?.reaction as Reaction;
  const action = body?.action === "remove" ? "remove" : "add";
  if(!ID_RE.test(id) || !REACTIONS.includes(reaction)) return json({ error: "Invalid reaction" }, 400);

  // The marker decides whether this visitor's add/remove actually counts:
  // a second "add" from the same visitor, or a "remove" with nothing to
  // remove, changes nothing.
  const seen = getStore("engagement-seen");
  const mark = await visitorMark(context, "react", id, reaction);
  let delta = 0;
  if(action === "add"){
    const res = await seen.set(mark, "1", { onlyIfNew: true });
    if((res as any)?.modified !== false) delta = 1;
  }else if(await seen.get(mark)){
    await seen.delete(mark);
    delta = -1;
  }

  const meta = cleanMeta(body?.meta);
  const now = Date.now();
  const story = await updateJSON<Story>(stories, id,
    () => ({ counts: emptyCounts(), title: "", pillar: "", href: "", imageUrl: "", lastAt: 0 }),
    s => {
      s.counts[reaction] = Math.max(0, (s.counts[reaction] || 0) + delta);
      // First good metadata wins; later requests can fill gaps but not rename the story.
      s.title ||= meta.title; s.pillar ||= meta.pillar; s.href ||= meta.href; s.imageUrl ||= meta.imageUrl;
      if(delta > 0) s.lastAt = now;
      return s;
    });

  if(delta !== 0 && story.title && story.href){
    const index = getStore("engagement-index");
    await updateJSON<TrendingEntry[]>(index, "trending", () => [], entries => {
      let entry = entries.find(e => e.id === id);
      if(!entry){
        if(delta < 0) return entries;
        entry = { id, title: story.title, pillar: story.pillar, href: story.href, imageUrl: story.imageUrl, score: 0, scoredAt: now };
        entries.push(entry);
      }
      entry.score = Math.max(0, decayed(entry.score, entry.scoredAt, now) + delta * WEIGHT[reaction]);
      entry.scoredAt = now;
      return entries
        .sort((a, b) => decayed(b.score, b.scoredAt, now) - decayed(a.score, a.scoredAt, now))
        .slice(0, INDEX_LIMIT);
    }).catch(() => null); // trending is best-effort; the count itself already saved
  }

  return json({ counts: story.counts, counted: delta !== 0 });
};

export const config: Config = {
  path: "/api/react"
};
