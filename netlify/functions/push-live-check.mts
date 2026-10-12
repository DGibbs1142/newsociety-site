// Scheduled every 5 minutes. Polls the same public ESPN scoreboard endpoint
// sports.js already uses client-side, and pushes one generic "it's live"
// alert the first time any NFL/NBA/MLB/NHL game transitions into progress.
// Not personalized — every subscriber gets the same alert — so this stays
// rate-limited to at most one push per hour regardless of how many games
// start, and dedupes per game per day so re-polling the same live game
// doesn't re-notify anyone.
import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { configureWebPush, broadcastPush } from "./lib/push-shared.mts";

// Roughly by average US audience size — only the first newly-live game
// found each run gets pushed, so a slate of simultaneous start times
// doesn't fire one notification per game.
const LEAGUES = [
  { path: "football/nfl", label: "NFL" },
  { path: "basketball/nba", label: "NBA" },
  { path: "baseball/mlb", label: "MLB" },
  { path: "hockey/nhl", label: "NHL" }
];

const MIN_GAP_MS = 60 * 60 * 1000;

interface NotifyState {
  day: string;
  notifiedIds: string[];
  lastSentAt: number;
}

async function loadState(store: ReturnType<typeof getStore>): Promise<NotifyState> {
  const today = new Date().toISOString().slice(0, 10);
  const state = (await store.get("notify-state", { type: "json" }).catch(() => null)) as NotifyState | null;
  if (state && state.day === today) return state;
  return { day: today, notifiedIds: [], lastSentAt: 0 };
}

async function fetchLiveGames(league: { path: string; label: string }) {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league.path}/scoreboard`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events || [])
      .filter((e: any) => e.status?.type?.state === "in")
      .map((e: any) => ({ id: String(e.id), name: e.shortName || e.name, league: league.label }));
  } catch {
    return [];
  }
}

export default async (req: Request) => {
  const store = getStore("push-state");
  const state = await loadState(store);

  if (Date.now() - state.lastSentAt < MIN_GAP_MS) {
    return new Response("Skipped — within rate-limit window", { status: 200 });
  }

  let candidate: { id: string; name: string; league: string } | null = null;
  for (const league of LEAGUES) {
    const live = await fetchLiveGames(league);
    candidate = live.find((g) => !state.notifiedIds.includes(g.id)) || null;
    if (candidate) break;
  }

  if (!candidate) {
    return new Response("No new live games", { status: 200 });
  }

  if (!configureWebPush()) {
    return new Response("Push is not configured", { status: 200 });
  }

  await broadcastPush({
    title: `🔴 Live now: ${candidate.league}`,
    body: candidate.name,
    url: "/sports.html"
  });

  state.notifiedIds.push(candidate.id);
  state.lastSentAt = Date.now();
  await store.setJSON("notify-state", state);

  return new Response(`Notified: ${candidate.name}`, { status: 200 });
};

export const config: Config = {
  schedule: "*/5 * * * *"
};
