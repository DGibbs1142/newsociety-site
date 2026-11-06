// The live poll on each page. To run a new poll, change the question/options
// AND give it a new id — votes are stored by id, so a new id starts at zero
// and the old results stay in storage untouched. Keep options to 2–6.
//
// Keys are the page's filename without .html (index = homepage).
export interface Poll {
  id: string;
  question: string;
  options: string[];
}

export const POLLS: Record<string, Poll> = {
  index: {
    id: "home-2026-11-beat-v2",
    question: "Which beat should we cover more?",
    options: ["Sports", "Anime", "Pop Culture", "Music", "Fashion", "Current Events"]
  },
  sports: {
    id: "sports-2026-11-weekend",
    question: "What are you locked in on this weekend?",
    options: ["NFL", "College football", "NBA", "Soccer"]
  },
  anime: {
    id: "anime-2026-11-subdub",
    question: "Sub or dub?",
    options: ["Sub, always", "Dub, always", "Depends on the show", "I read the manga"]
  },
  "pop-culture": {
    id: "pop-2026-11-first",
    question: "Where do you hear about what's trending first?",
    options: ["TikTok", "X", "Instagram", "The group chat"]
  },
  music: {
    id: "music-2026-11-discover",
    question: "How do you find new music?",
    options: ["Spotify / Apple playlists", "TikTok sounds", "Friends", "Radio & DJs"]
  },
  fashion: {
    id: "fashion-2026-11-buy",
    question: "Where do you actually buy clothes?",
    options: ["Brand sites", "Thrift & resale", "Drops & limited releases", "Big retailers"]
  },
  "current-events": {
    id: "news-2026-11-source",
    question: "How do you get your news?",
    options: ["Social feeds", "News apps & sites", "TV", "Podcasts"]
  }
};
