// Populates the Pop Culture drops-grid with trending movies/TV from TMDB
// (themoviedb.org) instead of generic entertainment-category news — real
// titles people are watching/talking about, not just articles that mention them.
// Requires TMDB_API_KEY to be defined (see config.local.js / config.example.js).

const TMDB_ENDPOINT = 'https://api.themoviedb.org/3/trending/all/day';

function yearOf(item){
  const date = item.release_date || item.first_air_date;
  return date ? date.slice(0, 4) : '—';
}

function renderTitles(items){
  const grid = document.getElementById('newsGrid');
  const title = document.getElementById('newsSectionTitle');
  if(!grid) return;

  grid.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('a');
    card.className = 'drop-card';
    card.href = `https://www.themoviedb.org/${item.media_type}/${item.id}`;
    card.target = '_blank';
    card.rel = 'noopener';

    const status = document.createElement('span');
    status.className = 'drop-status mono';
    const rating = item.vote_average ? `${item.vote_average.toFixed(1)}/10` : 'Unrated';
    status.textContent = `${item.media_type === 'tv' ? 'TV' : 'Movie'} · ${yearOf(item)} · ${rating}`;

    const h4 = document.createElement('h4');
    h4.textContent = item.title || item.name || 'Untitled';

    const p = document.createElement('p');
    p.textContent = item.overview || '';

    card.append(status, h4, p);
    grid.appendChild(card);
  });

  if(title) title.textContent = 'Live from the wire.';
}

const DEMO_TITLES = [
  { media_type: 'movie', title: 'Sample Trending Movie', release_date: '2026-01-01', vote_average: 7.8, overview: 'Placeholder content shown because the live feed is unavailable.', id: 0 },
  { media_type: 'tv', name: 'Sample Trending Show', first_air_date: '2025-01-01', vote_average: 8.2, overview: 'Six cards fill this grid in the live version, pulled fresh from TMDB trending.', id: 0 },
  { media_type: 'movie', title: 'Sample Third Pick', release_date: '2024-01-01', vote_average: 6.9, overview: 'Card layout, spacing, and typography match the rest of the site.', id: 0 }
];

function renderError(message){
  renderTitles(DEMO_TITLES);
  const title = document.getElementById('newsSectionTitle');
  if(title) title.textContent = 'Live from the wire. (demo preview)';
  console.warn('Pop Culture feed error, showing demo content:', message);
}

async function loadPopCulture(){
  if(typeof TMDB_API_KEY === 'undefined'){
    renderError('No API key configured — copy config.example.js to config.local.js and add your TMDB key.');
    return;
  }
  try{
    const res = await fetch(`${TMDB_ENDPOINT}?api_key=${TMDB_API_KEY}`);
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    if(!data.results || !data.results.length) throw new Error('No titles returned');
    renderTitles(data.results.slice(0, 6));
  }catch(err){
    renderError(err.message);
  }
}

if(document.getElementById('newsGrid')){
  loadPopCulture();
}
