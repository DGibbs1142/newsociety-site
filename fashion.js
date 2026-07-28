// Populates the Fashion drops-grid with live fashion news from TheNewsAPI,
// filtered to a "fashion" keyword search rather than a generic category
// (TheNewsAPI has no dedicated fashion category). Same free-tier 3-per-request
// cap as the other TheNewsAPI-backed pages, so two pages are combined for 6.

const FASHION_ENDPOINT = 'https://api.thenewsapi.com/v1/news/all?limit=6&language=en&search=fashion';

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
  const { from, pillar } = currentPillarInfo();
  articles.forEach(article => {
    const statusText = `${article.source || 'Wire'} · ${timeAgo(article.published_at)}`;
    const card = document.createElement('a');
    card.className = 'drop-card';
    card.href = buildDetailLink({
      title: article.title, body: article.description, status: statusText,
      source: article.source, url: article.url, from, pillar
    });

    const status = document.createElement('span');
    status.className = 'drop-status mono';
    status.textContent = statusText;

    const h4 = document.createElement('h4');
    h4.textContent = article.title || 'Untitled';

    const p = document.createElement('p');
    p.textContent = article.description || '';

    card.append(status, h4, p);
    grid.appendChild(card);
  });

  if(title) title.textContent = 'Live from the runway.';
}

const DEMO_ARTICLES = [
  { source:'Demo Wire', published_at:new Date().toISOString(), title:'Sample Headline — Live Feed Coming Soon', description:'This is placeholder content shown because the live feed is unavailable.', url:'#' },
  { source:'Demo Wire', published_at:new Date().toISOString(), title:'Another Sample Story For Layout Preview', description:'Six cards fill this grid in the live version, pulled fresh from TheNewsAPI.', url:'#' },
  { source:'Demo Wire', published_at:new Date().toISOString(), title:'Third Placeholder Drop', description:'Card layout, spacing, and typography match the rest of the site.', url:'#' }
];

function renderError(message){
  renderArticles(DEMO_ARTICLES);
  const title = document.getElementById('newsSectionTitle');
  if(title) title.textContent = 'Live from the runway. (demo preview)';
  console.warn('Fashion feed error, showing demo content:', message);
}

async function loadFashion(){
  if(typeof NEWS_API_KEY === 'undefined'){
    renderError('No API key configured — copy config.example.js to config.local.js and add your TheNewsAPI key.');
    return;
  }
  try{
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const pages = await Promise.all([1, 2, 3].map(async page => {
      const res = await fetch(`${FASHION_ENDPOINT}&page=${page}&published_after=${weekAgo}&api_token=${NEWS_API_KEY}`);
      if(!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    }));
    const articles = pages.flat().filter(a => a.description && a.description.length > 20);
    if(!articles.length) throw new Error('No articles returned');
    renderArticles(articles.slice(0, 6));
  }catch(err){
    renderError(err.message);
  }
}

if(document.getElementById('newsGrid')){
  loadFashion();
}
