// Quick polls — one per page, defined in lib/polls.mts.
//
//   GET  /api/poll?page=sports           -> { id, question, options, counts, total }
//   POST /api/poll  { id, option }       -> same shape, plus counted: boolean
//
// One vote per visitor per poll (by salted IP hash, see visitorMark).
import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, updateJSON, visitorMark } from "./lib/engagement-shared.mts";
import { POLLS, type Poll } from "./lib/polls.mts";

type Tally = number[];

function shape(poll: Poll, counts: Tally) {
  const padded = poll.options.map((_, i) => counts[i] || 0);
  return { id: poll.id, question: poll.question, options: poll.options, counts: padded, total: padded.reduce((a, b) => a + b, 0) };
}

export default async (req: Request, context: Context) => {
  const store = getStore("engagement-polls");

  if(req.method === "GET"){
    const page = new URL(req.url).searchParams.get("page") || "";
    const poll = POLLS[page];
    if(!poll) return json({ error: "No poll for this page" }, 404, "public, max-age=300");
    const counts = await store.get(poll.id, { type: "json" }).catch(() => null) as Tally | null;
    return json(shape(poll, counts || []), 200, "public, max-age=15");
  }

  if(req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try{ body = await req.json(); }catch{ return json({ error: "Invalid JSON body" }, 400); }

  const poll = Object.values(POLLS).find(p => p.id === body?.id);
  const option = Number(body?.option);
  if(!poll || !Number.isInteger(option) || option < 0 || option >= poll.options.length){
    return json({ error: "Invalid vote" }, 400);
  }

  const mark = await visitorMark(context, "poll", poll.id);
  const res = await getStore("engagement-seen").set(mark, String(option), { onlyIfNew: true });
  const counted = (res as any)?.modified !== false;

  const counts = counted
    ? await updateJSON<Tally>(store, poll.id, () => [], t => { t[option] = (t[option] || 0) + 1; return t; })
    : (await store.get(poll.id, { type: "json" }).catch(() => null) as Tally | null) || [];

  return json({ ...shape(poll, counts), counted });
};

export const config: Config = {
  path: "/api/poll"
};
