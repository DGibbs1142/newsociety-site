// Fans a single query out to all six pillars' own APIs in parallel and shows
// a handful of results from each — the "does NewSociety have anything about
// X" answer that no single pillar page can give on its own. Deliberately
// self-contained (doesn't load the pillar scripts themselves, to avoid the
// naming collisions that would cause — several of them declare their own
// same-named DEMO_ARTICLES/timeAgo/etc as top-level consts) so a bit of
// fetch logic is duplicated here rather than reused directly.

const ESPN_LEAGUE_PATHS = {
  'NBA': 'basketball/nba', 'NFL': 'football/nfl', 'MLB': 'baseball/mlb', 'NHL': 'hockey/nhl',
  'MLS': 'soccer/usa.1', 'NCAAF': 'football/college-football',
  'NCAAM': 'basketball/mens-college-basketball', 'NCAAW': 'basketball/womens-college-basketball',
  'WNBA': 'basketball/wnba'
};

async function deezerApi(params, timeoutMs = 8000){
  const res = await fetch(`/api/deezer?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(timeoutMs) });
  const data = await res.json().catch(() => null);
  if(!res.ok || !data || data.error){
    const message = typeof data?.error === 'string' ? data.error : data?.error?.message;
    throw new Error(message || 'Deezer request failed');
  }
  return data;
}

async function searchSports(query){
  try{
    const res = await fetch(`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(query)}&type=player,team&limit=6`);
    if(!res.ok) return [];
    const data = await res.json();
    const items = (data.results || []).flatMap(r => r.contents || []).slice(0, 4);
    return items.map(item => {
      const league = item.description || item.subtitle || '';
      const leaguePath = ESPN_LEAGUE_PATHS[league];
      const uidMatch = item.uid?.match(/([ta]):(\d+)$/);
      const linkData = {
        title: item.displayName || 'Untitled', status: league || 'ESPN',
        source: 'ESPN', url: item.link?.web || '', imageUrl: item.image?.default || '',
        pillar: 'Sports', from: 'sports.html'
      };
      if(leaguePath && uidMatch){
        linkData.espnLeaguePath = leaguePath;
        if(uidMatch[1] === 'a') linkData.espnAthleteId = uidMatch[2];
        else linkData.espnTeamId = uidMatch[2];
      }
      return { title: linkData.title, status: linkData.status, imageUrl: linkData.imageUrl, href: buildDetailLink(linkData) };
    });
  }catch{ return []; }
}

async function searchAnime(query){
  try{
    const gqlQuery = `query($s:String){ Page(page:1, perPage:4){ media(search:$s, type:ANIME){ id title{ romaji english } averageScore seasonYear description(asHtml:false) siteUrl coverImage{ large } } } }`;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gqlQuery, variables: { s: query } })
    });
    if(!res.ok) return [];
    const { data } = await res.json();
    return (data?.Page?.media || []).map(a => {
      const title = a.title.english || a.title.romaji || 'Untitled';
      const status = `${a.seasonYear || '—'} · ${a.averageScore ? a.averageScore + '/100' : 'Unrated'}`;
      const body = (a.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return {
        title, status, imageUrl: a.coverImage?.large || '',
        href: buildDetailLink({ title, body, status, source: 'AniList', url: a.siteUrl, anilistId: a.id, pillar: 'Anime', from: 'anime.html' })
      };
    });
  }catch{ return []; }
}

async function searchPopCulture(query){
  try{
    const res = await fetch(`/api/tmdb?op=search&query=${encodeURIComponent(query)}&page=1`);
    if(!res.ok) return [];
    const data = await res.json();
    return (data.results || [])
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 4)
      .map(item => {
        const title = item.title || item.name || 'Untitled';
        const year = (item.release_date || item.first_air_date || '').slice(0, 4) || '—';
        const status = `${item.media_type === 'tv' ? 'TV' : 'Movie'} · ${year}`;
        const imageUrl = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '';
        return {
          title, status, imageUrl,
          href: buildDetailLink({
            title, body: item.overview || '', status, source: 'TMDB',
            url: `https://www.themoviedb.org/${item.media_type}/${item.id}`,
            tmdbId: item.id, mediaType: item.media_type, imageUrl, pillar: 'Pop Culture', from: 'pop-culture.html'
          })
        };
      });
  }catch{ return []; }
}

async function searchFashion(query){
  try{
    const res = await fetch(`/api/gnews?op=search&q=${encodeURIComponent(`fashion ${query}`)}&max=4`);
    if(!res.ok) return [];
    const data = await res.json();
    return (data.articles || []).slice(0, 4).map(a => ({
      title: a.title, status: a.source?.name || 'Wire', imageUrl: a.image || '',
      href: buildDetailLink({
        title: a.title, body: a.content || a.description || '', status: a.source?.name || 'Wire',
        source: a.source?.name || 'Wire', url: a.url, publishedAt: a.publishedAt, imageUrl: a.image || '',
        sourceCountry: a.source?.country, pillar: 'Fashion', from: 'fashion.html'
      })
    }));
  }catch{ return []; }
}

async function searchMusic(query){
  try{
    const data = await deezerApi({ op: 'search', q: query, limit: 4 });
    return (data.data || []).map(t => {
      const artist = t.artist?.name || 'Unknown Artist';
      const status = `${artist} · ${t.album?.title || ''}`;
      return {
        title: t.title, status, imageUrl: t.album?.cover_medium || '',
        href: buildDetailLink({
          title: t.title, body: `From "${t.album?.title || 'Unknown Album'}" by ${artist}.`, status,
          source: 'Deezer', url: t.link, imageUrl: t.album?.cover_medium || '',
          deezerId: t.id, deezerType: 'track', pillar: 'Music', from: 'music.html'
        })
      };
    });
  }catch{ return []; }
}

async function searchCurrentEvents(query){
  try{
    const res = await fetch(`/api/gnews?op=search&q=${encodeURIComponent(query)}&max=4`);
    if(!res.ok) return [];
    const data = await res.json();
    return (data.articles || []).slice(0, 4).map(a => ({
      title: a.title, status: a.source?.name || 'Wire', imageUrl: a.image || '',
      href: buildDetailLink({
        title: a.title, body: a.content || a.description || '', status: a.source?.name || 'Wire',
        source: a.source?.name || 'Wire', url: a.url, publishedAt: a.publishedAt, imageUrl: a.image || '',
        sourceCountry: a.source?.country, pillar: 'Current Events', from: 'current-events.html'
      })
    }));
  }catch{ return []; }
}

const SECTIONS = [
  { id: 'sports', label: 'Sports', more: 'sports.html', fetcher: searchSports },
  { id: 'anime', label: 'Anime', more: 'anime.html', fetcher: searchAnime },
  { id: 'pop-culture', label: 'Pop Culture', more: 'pop-culture.html', fetcher: searchPopCulture },
  { id: 'fashion', label: 'Fashion', more: 'fashion.html', fetcher: searchFashion },
  { id: 'music', label: 'Music', more: 'music.html', fetcher: searchMusic },
  { id: 'current-events', label: 'Current Events', more: 'current-events.html', fetcher: searchCurrentEvents }
];

function renderResultCard(grid, result, pillar){
  const card = document.createElement('a');
  card.className = 'drop-card';
  card.href = result.href;

  const status = document.createElement('span');
  status.className = 'drop-status mono';
  status.textContent = result.status || '';

  const h4 = document.createElement('h3');
  h4.textContent = result.title || 'Untitled';

  card.append(status, h4);
  attachCardImage(card, result.imageUrl);
  attachSaveButton(card, { href: card.href, title: result.title || 'Untitled', pillar, status: result.status || '', imageUrl: result.imageUrl || '' });
  grid.appendChild(card);
}

async function runGlobalSearch(query){
  const heading = document.getElementById('searchHeading');
  const status = document.getElementById('searchStatus');
  const container = document.getElementById('searchSections');
  if(heading) heading.textContent = `Results for "${query}"`;
  if(status) status.textContent = 'Searching every pillar…';
  container.innerHTML = '';

  const results = await Promise.all(SECTIONS.map(s => s.fetcher(query)));
  let totalCount = 0;

  SECTIONS.forEach((section, i) => {
    const items = results[i];
    if(!items.length) return;
    totalCount += items.length;

    const wrap = document.createElement('div');
    wrap.className = 'search-section';

    const head = document.createElement('div');
    head.className = 'section-head';
    // A real h2 (styled exactly like the other section labels) so the result
    // cards' h3 headings don't jump straight from the page's h1.
    head.innerHTML = `<div><h2 class="section-label">// ${section.label.toLowerCase()}</h2></div>`;
    const more = document.createElement('a');
    more.className = 'search-section-more mono';
    more.href = section.more;
    more.textContent = `All ${section.label} →`;
    head.appendChild(more);

    const grid = document.createElement('div');
    grid.className = 'drops-grid';
    items.forEach(item => renderResultCard(grid, item, section.label));

    wrap.append(head, grid);
    container.appendChild(wrap);
  });

  if(status){
    status.textContent = totalCount
      ? `Found ${totalCount} result${totalCount === 1 ? '' : 's'} across ${SECTIONS.filter((_, i) => results[i].length).length} pillars.`
      : `No results anywhere for "${query}" — try a different keyword.`;
  }
}

const searchParams = new URLSearchParams(window.location.search);
const initialQuery = searchParams.get('q');
const navInput = document.querySelector('.nav-search input');
if(navInput && initialQuery) navInput.value = initialQuery;

if(initialQuery) runGlobalSearch(initialQuery);
else{
  const heading = document.getElementById('searchHeading');
  const status = document.getElementById('searchStatus');
  if(heading) heading.textContent = 'Search NewSociety';
  if(status) status.textContent = 'Type something in the search bar above to look across every pillar at once.';
}
