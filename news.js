// Populates a page's drops-grid with live headlines from TheNewsAPI (thenewsapi.com).
// Requires NEWS_API_KEY to be defined (see config.local.js / config.example.js).
// The #newsGrid element's data-category attribute picks the TheNewsAPI category
// (e.g. "sports", "entertainment") — omit it for general top headlines.

function newsEndpointFor(category){
  const base = 'https://api.thenewsapi.com/v1/news/top?limit=6';
  if(!category) return `${base}&locale=us`;
  return `${base}&categories=${category}`;
}

function timeAgo(dateStr){
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if(mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if(hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function renderArticles(articles){
  const grid = document.getElementById('newsGrid');
  const title = document.getElementById('newsSectionTitle');
  if(!grid) return;

  grid.innerHTML = '';
  articles.forEach(article => {
    const card = document.createElement('a');
    card.className = 'drop-card';
    card.href = article.url;
    card.target = '_blank';
    card.rel = 'noopener';

    const status = document.createElement('span');
    status.className = 'drop-status mono';
    status.textContent = `${article.source || 'Wire'} · ${timeAgo(article.published_at)}`;

    const h4 = document.createElement('h4');
    h4.textContent = article.title || 'Untitled';

    const p = document.createElement('p');
    p.textContent = article.description || '';

    card.append(status, h4, p);
    grid.appendChild(card);
  });

  if(title) title.textContent = 'Live from the wire.';
}

const DEMO_ARTICLES = [
  { source:'Demo Wire', published_at:new Date().toISOString(), title:'Sample Headline — Live Feed Coming Soon', description:'This is placeholder content shown because the live feed is unavailable.', url:'#' },
  { source:'Demo Wire', published_at:new Date().toISOString(), title:'Another Sample Story For Layout Preview', description:'Six cards fill this grid in the live version, pulled fresh from TheNewsAPI.', url:'#' },
  { source:'Demo Wire', published_at:new Date().toISOString(), title:'Third Placeholder Drop', description:'Card layout, spacing, and typography match the rest of the site.', url:'#' }
];

function renderError(message){
  renderArticles(DEMO_ARTICLES);
  const title = document.getElementById('newsSectionTitle');
  if(title) title.textContent = 'Live from the wire. (demo preview)';
  console.warn('News feed error, showing demo content:', message);
}

async function loadNews(){
  const grid = document.getElementById('newsGrid');
  const category = grid?.dataset.category || '';

  if(typeof NEWS_API_KEY === 'undefined'){
    renderError('No API key configured — copy config.example.js to config.local.js and add your TheNewsAPI key.');
    return;
  }
  try{
    const res = await fetch(`${newsEndpointFor(category)}&api_token=${NEWS_API_KEY}`);
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    if(!data.data || !data.data.length) throw new Error('No articles returned');
    renderArticles(data.data);
  }catch(err){
    renderError(err.message);
  }
}

if(document.getElementById('newsGrid')){
  loadNews();
}
