// One real, live item per pillar on the homepage — today's actual top game,
// anime pick, trending title, fashion headline, chart track, and news
// headline, each linking to the same on-site detail breakdown as
// everywhere else. Deliberately a single lightweight fetch per pillar
// (not full grids) — this is a "the feed is alive right now" strip, not
// a duplicate of each pillar's own page.

function homeDeezerJsonp(url, timeoutMs = 8000){
  return new Promise((resolve, reject) => {
    const callbackName = 'deezer_cb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = () => { settled = true; clearTimeout(timer); delete window[callbackName]; script.remove(); };
    const timer = setTimeout(() => { if(settled) return; cleanup(); reject(new Error('timeout')); }, timeoutMs);
    window[callbackName] = (data) => { if(settled) return; cleanup(); resolve(data); };
    script.onerror = () => { if(settled) return; cleanup(); reject(new Error('failed')); };
    const sep = url.includes('?') ? '&' : '?';
    script.src = `${url}${sep}output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

async function homeLatestSports(){
  try{
    const leagues = [
      { path: 'basketball/nba', label: 'NBA' },
      { path: 'football/nfl', label: 'NFL' },
      { path: 'soccer/eng.1', label: 'Premier League' },
      { path: 'baseball/mlb', label: 'MLB' }
    ];
    const results = await Promise.all(leagues.map(l =>
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${l.path}/scoreboard`)
        .then(r => r.ok ? r.json() : { events: [] })
        .then(d => (d.events || []).map(e => ({ ...e, leagueLabel: l.label, leaguePath: l.path })))
        .catch(() => [])
    ));
    const pool = results.flat();
    const event = pool.find(e => e.status?.type?.state === 'in') || pool[0];
    if(!event) return null;
    const statusText = `${event.leagueLabel} · ${event.status?.type?.shortDetail || event.status?.type?.description || ''}`;
    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find(c => c.homeAway === 'home');
    return {
      pillar: 'Sports', title: event.name, status: statusText, imageUrl: home?.team?.logo || '',
      href: buildDetailLink({
        title: event.name, status: statusText, source: 'ESPN', url: event.links?.[0]?.href || '',
        espnId: event.id, espnPath: event.leaguePath, espnLeague: event.leagueLabel,
        pillar: 'Sports', from: 'sports.html'
      })
    };
  }catch{ return null; }
}

async function homeLatestAnime(){
  try{
    const gqlQuery = `query{ Page(page:1, perPage:1){ media(type:ANIME, sort:TRENDING_DESC){ id title{ romaji english } averageScore seasonYear description(asHtml:false) siteUrl coverImage{ large } } } }`;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: gqlQuery })
    });
    if(!res.ok) return null;
    const { data } = await res.json();
    const a = data?.Page?.media?.[0];
    if(!a) return null;
    const title = a.title.english || a.title.romaji || 'Untitled';
    const status = `${a.seasonYear || '—'} · ${a.averageScore ? a.averageScore + '/100' : 'Unrated'}`;
    const body = (a.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      pillar: 'Anime', title, status, imageUrl: a.coverImage?.large || '',
      href: buildDetailLink({ title, body, status, source: 'AniList', url: a.siteUrl, anilistId: a.id, pillar: 'Anime', from: 'anime.html' })
    };
  }catch{ return null; }
}

async function homeLatestPopCulture(){
  try{
    const res = await fetch('/api/tmdb?op=trending');
    if(!res.ok) return null;
    const data = await res.json();
    const item = data.results?.[0];
    if(!item) return null;
    const title = item.title || item.name || 'Untitled';
    const year = (item.release_date || item.first_air_date || '').slice(0, 4) || '—';
    const status = `${item.media_type === 'tv' ? 'TV' : 'Movie'} · ${year}`;
    const imageUrl = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '';
    return {
      pillar: 'Pop Culture', title, status, imageUrl,
      href: buildDetailLink({
        title, body: item.overview || '', status, source: 'TMDB',
        url: `https://www.themoviedb.org/${item.media_type}/${item.id}`,
        tmdbId: item.id, mediaType: item.media_type, imageUrl, pillar: 'Pop Culture', from: 'pop-culture.html'
      })
    };
  }catch{ return null; }
}

async function homeLatestFashion(){
  try{
    const res = await fetch('/api/gnews?op=search&q=fashion&max=1');
    if(!res.ok) return null;
    const data = await res.json();
    const a = data.articles?.[0];
    if(!a) return null;
    return {
      pillar: 'Fashion', title: a.title, status: a.source?.name || 'Wire', imageUrl: a.image || '',
      href: buildDetailLink({
        title: a.title, body: a.content || a.description || '', status: a.source?.name || 'Wire',
        source: a.source?.name || 'Wire', url: a.url, publishedAt: a.publishedAt, imageUrl: a.image || '',
        sourceCountry: a.source?.country, pillar: 'Fashion', from: 'fashion.html'
      })
    };
  }catch{ return null; }
}

async function homeLatestMusic(){
  try{
    const data = await homeDeezerJsonp('https://api.deezer.com/chart/0/tracks?limit=1');
    const t = data?.data?.[0];
    if(!t) return null;
    const artist = t.artist?.name || 'Unknown Artist';
    const status = `${artist} · Trending`;
    return {
      pillar: 'Music', title: t.title, status, imageUrl: t.album?.cover_medium || '',
      href: buildDetailLink({
        title: t.title, body: `From "${t.album?.title || 'Unknown Album'}" by ${artist}.`, status,
        source: 'Deezer', url: t.link, imageUrl: t.album?.cover_medium || '',
        deezerId: t.id, deezerType: 'track', pillar: 'Music', from: 'music.html'
      })
    };
  }catch{ return null; }
}

async function homeLatestNews(){
  try{
    const res = await fetch('/api/gnews?op=headlines&category=general&max=1');
    if(!res.ok) return null;
    const data = await res.json();
    const a = data.articles?.[0];
    if(!a) return null;
    return {
      pillar: 'Current Events', title: a.title, status: a.source?.name || 'Wire', imageUrl: a.image || '',
      href: buildDetailLink({
        title: a.title, body: a.content || a.description || '', status: a.source?.name || 'Wire',
        source: a.source?.name || 'Wire', url: a.url, publishedAt: a.publishedAt, imageUrl: a.image || '',
        sourceCountry: a.source?.country, pillar: 'Current Events', from: 'current-events.html'
      })
    };
  }catch{ return null; }
}

async function loadHomepageLive(){
  const grid = document.getElementById('liveNowGrid');
  const section = document.getElementById('liveNowSection');
  if(!grid) return;

  const fetchers = [homeLatestSports, homeLatestAnime, homeLatestPopCulture, homeLatestFashion, homeLatestMusic, homeLatestNews];
  const results = (await Promise.all(fetchers.map(fn => fn()))).filter(Boolean);

  if(!results.length){
    if(section) section.style.display = 'none';
    return;
  }

  grid.innerHTML = '';
  results.forEach(item => {
    const card = document.createElement('a');
    card.className = 'drop-card';
    card.href = item.href;

    const status = document.createElement('span');
    status.className = 'drop-status mono';
    status.textContent = `${item.pillar} · ${item.status}`;

    const h4 = document.createElement('h4');
    h4.textContent = item.title;

    card.append(status, h4);
    attachCardImage(card, item.imageUrl);
    attachSaveButton(card, { href: card.href, title: item.title, pillar: item.pillar, status: item.status, imageUrl: item.imageUrl || '' });
    grid.appendChild(card);
  });
}

loadHomepageLive();
