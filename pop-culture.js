// Populates the Pop Culture drops-grid from multiple sources so it's not just
// movies/TV: trending titles (TMDB), celebrity/industry news (GNews), viral
// videos (YouTube Data API), and trending GIFs/memes (Giphy). TMDB/GNews/
// Giphy go through our own serverless proxies (netlify/functions/) so their
// keys stay server-side — YouTube's key was never actually configured, so
// that source just stays skipped as it always has. GIFs/videos are optional
// either way — the grid balances across whichever sources are available.

const YOUTUBE_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=24&regionCode=US&maxResults=4';

function yearOf(item){
  const date = item.release_date || item.first_air_date;
  return date ? date.slice(0, 4) : '—';
}

function timeAgo(dateStr){
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if(mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if(hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// --- Each fetcher returns a flat array of normalized cards: { status, heading, body, url } ---

async function fetchTitles(){
  try{
    const res = await fetch('/api/tmdb?op=trending');
    if(!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 4).map(item => ({
      status: `${item.media_type === 'tv' ? 'TV' : 'Movie'} · ${yearOf(item)} · ${item.vote_average ? item.vote_average.toFixed(1) + '/10' : 'Unrated'}`,
      heading: item.title || item.name || 'Untitled',
      body: item.overview || '',
      source: 'TMDB',
      url: `https://www.themoviedb.org/${item.media_type}/${item.id}`,
      tmdbId: item.id,
      mediaType: item.media_type,
      imageUrl: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : ''
    }));
  }catch{ return []; }
}

async function fetchCelebrityNews(){
  try{
    const res = await fetch('/api/gnews?op=headlines&category=entertainment&max=4');
    if(!res.ok) return [];
    const data = await res.json();
    return (data.articles || []).map(article => ({
      status: `NewSociety Buzz · ${timeAgo(article.publishedAt)}`,
      heading: article.title || 'Untitled',
      body: article.description || article.content || '',
      source: article.source?.name || 'Wire',
      url: article.url,
      publishedAt: article.publishedAt,
      imageUrl: article.image,
      sourceCountry: article.source?.country
    }));
  }catch{ return []; }
}

async function fetchTrendingVideos(){
  if(typeof YOUTUBE_API_KEY === 'undefined') return [];
  try{
    const res = await fetch(`${YOUTUBE_ENDPOINT}&key=${YOUTUBE_API_KEY}`);
    if(!res.ok) return [];
    const data = await res.json();
    return (data.items || []).slice(0, 4).map(video => ({
      status: `NewSociety Watch · ${Number(video.statistics?.viewCount || 0).toLocaleString()} views`,
      heading: video.snippet?.title || 'Untitled',
      body: video.snippet?.description || '',
      source: 'YouTube',
      url: `https://www.youtube.com/watch?v=${video.id}`,
      imageUrl: video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.medium?.url || ''
    }));
  }catch{ return []; }
}

async function fetchTrendingGifs(){
  try{
    const res = await fetch('/api/giphy');
    if(!res.ok) return [];
    const data = await res.json();
    return (data.data || []).slice(0, 4).map(gif => ({
      status: 'NewSociety Reactions · Trending',
      heading: gif.title || 'Untitled GIF',
      body: `Trending reaction from ${gif.username || 'the community'}.`,
      source: 'Giphy',
      url: gif.url,
      imageUrl: gif.images?.fixed_width?.url || ''
    }));
  }catch{ return []; }
}

function pickBalanced(buckets, count){
  const lists = buckets.filter(b => b.length).map(b => [...b]);
  const picked = [];
  let i = 0;
  while(picked.length < count && lists.some(l => l.length)){
    const list = lists[i % lists.length];
    if(list.length) picked.push(list.shift());
    i++;
  }
  return picked;
}

function renderCards(cards){
  const grid = document.getElementById('newsGrid');
  const title = document.getElementById('newsSectionTitle');
  if(!grid) return;

  grid.innerHTML = '';
  setPillarAboutImage(cards[0]?.imageUrl);
  const { from, pillar } = currentPillarInfo();
  cards.forEach(card => {
    const el = document.createElement('a');
    el.className = 'drop-card';
    el.href = buildDetailLink({
      title: card.heading, body: card.body, status: card.status,
      source: card.source, url: card.url, from, pillar,
      tmdbId: card.tmdbId, mediaType: card.mediaType,
      categories: card.categories, publishedAt: card.publishedAt, imageUrl: card.imageUrl,
      sourceCountry: card.sourceCountry
    });

    const status = document.createElement('span');
    status.className = 'drop-status mono';
    status.textContent = card.status;

    const h4 = document.createElement('h4');
    h4.textContent = card.heading;

    const p = document.createElement('p');
    p.textContent = card.body;

    el.append(status, h4, p);
    attachCardImage(el, card.imageUrl);
    attachSaveButton(el, { href: el.href, title: card.heading || 'Untitled', pillar, status: card.status || '', imageUrl: card.imageUrl || '' });
    grid.appendChild(el);
  });

  if(title) title.textContent = 'Live from the wire.';
}

const DEMO_CARDS = [
  { status: 'Movie · 2026 · 7.8/10', heading: 'Sample Trending Movie', body: 'Placeholder content shown because the live feed is unavailable.', url: '#' },
  { status: 'Deadline.com · 2h ago', heading: 'Sample Celebrity Headline', body: 'Six cards fill this grid in the live version, mixing trending titles, celebrity news, and more.', url: '#' },
  { status: 'YouTube · 1.2M views', heading: 'Sample Viral Video', body: 'Card layout, spacing, and typography match the rest of the site.', url: '#' },
  { status: 'Giphy · Trending', heading: 'Sample Trending GIF', body: 'This grid always shows six cards, live or demo, so the layout never looks broken.', url: '#' },
  { status: 'TV · 2026 · 8.1/10', heading: 'Sample Trending Show', body: 'Once the feed reconnects, these get replaced with real trending content.', url: '#' },
  { status: 'Wire.com · 4h ago', heading: 'Sample Pop Culture Headline', body: 'Check back shortly, or try the search below once the live feed is back.', url: '#' }
];

function renderError(message){
  renderCards(DEMO_CARDS);
  const title = document.getElementById('newsSectionTitle');
  if(title) title.textContent = 'Live from the wire. (demo preview)';
  console.warn('Pop Culture feed error, showing demo content:', message);
}

async function loadPopCulture(){
  try{
    const [titles, news, videos, gifs] = await Promise.all([
      fetchTitles(), fetchCelebrityNews(), fetchTrendingVideos(), fetchTrendingGifs()
    ]);
    const combined = pickBalanced([titles, news, videos, gifs], 6);
    if(!combined.length) throw new Error('No pop culture content returned');
    renderCards(combined);
  }catch(err){
    renderError(err.message);
  }
}

async function fetchTitleSearchPage(query, page){
  const res = await fetch(`/api/tmdb?op=search&query=${encodeURIComponent(query)}&page=${page}`);
  if(!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  return (data.results || [])
    .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
    .map(item => ({
      title: item.title || item.name || 'Untitled',
      body: item.overview || '',
      status: `${item.media_type === 'tv' ? 'TV' : 'Movie'} · ${yearOf(item)} · ${item.vote_average ? item.vote_average.toFixed(1) + '/10' : 'Unrated'}`,
      source: 'TMDB', url: `https://www.themoviedb.org/${item.media_type}/${item.id}`,
      tmdbId: item.id, mediaType: item.media_type,
      imageUrl: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : ''
    }));
}

if(document.getElementById('newsGrid')){
  loadPopCulture();
  initSearchWidget({
    formId: 'searchForm', inputId: 'searchInput', gridId: 'searchResultsGrid',
    statusId: 'searchStatus', moreBtnId: 'searchMoreBtn', fetchPage: fetchTitleSearchPage,
    resultsPerPage: 10
  });
}
