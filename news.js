// Populates the Current Events drops-grid with live general headlines from
// GNews.io, via our own serverless proxy (netlify/functions/gnews.mts) so
// the API key stays server-side.

function timeAgo(dateStr){
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if(mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if(hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function mapGNewsArticle(article){
  return {
    title: article.title,
    body: article.content || article.description || '',
    shortBody: article.description || '',
    status: `NewSociety Wire · ${timeAgo(article.publishedAt)}`,
    source: article.source?.name || 'Wire',
    url: article.url,
    publishedAt: article.publishedAt,
    imageUrl: article.image,
    sourceCountry: article.source?.country
  };
}

function renderArticles(articles){
  const grid = document.getElementById('newsGrid');
  const title = document.getElementById('newsSectionTitle');
  if(!grid) return;

  grid.innerHTML = '';
  setPillarAboutImage(articles[0]?.imageUrl);
  const { from, pillar } = currentPillarInfo();
  articles.forEach(article => {
    const card = document.createElement('a');
    card.className = 'drop-card';
    card.href = buildDetailLink({ ...article, from, pillar });

    const status = document.createElement('span');
    status.className = 'drop-status mono';
    status.textContent = article.status;

    const h4 = document.createElement('h3');
    h4.textContent = article.title || 'Untitled';

    const p = document.createElement('p');
    p.textContent = article.shortBody || article.body || '';

    card.append(status, h4, p);
    attachCardImage(card, article.imageUrl);
    attachSaveButton(card, { href: card.href, title: article.title || 'Untitled', pillar, status: article.status || '', imageUrl: article.imageUrl || '' });
    attachExpandToggle(card, p);
    grid.appendChild(card);
  });

  if(title) title.textContent = 'Live from the wire.';
}

const DEMO_ARTICLES = [
  { source:'Demo Wire', status: 'Demo Wire · now', publishedAt:new Date().toISOString(), title:'Sample Headline — Live Feed Coming Soon', body:'This is placeholder content shown because the live feed is unavailable.', shortBody:'This is placeholder content shown because the live feed is unavailable.', url:'#' },
  { source:'Demo Wire', status: 'Demo Wire · now', publishedAt:new Date().toISOString(), title:'Another Sample Story For Layout Preview', body:'Six cards fill this grid in the live version, pulled fresh from GNews.', shortBody:'Six cards fill this grid in the live version, pulled fresh from GNews.', url:'#' },
  { source:'Demo Wire', status: 'Demo Wire · now', publishedAt:new Date().toISOString(), title:'Third Placeholder Drop', body:'Card layout, spacing, and typography match the rest of the site.', shortBody:'Card layout, spacing, and typography match the rest of the site.', url:'#' },
  { source:'Demo Wire', status: 'Demo Wire · now', publishedAt:new Date().toISOString(), title:'Fourth Placeholder Drop', body:'This grid always shows six cards, live or demo, so the layout never looks broken.', shortBody:'This grid always shows six cards, live or demo, so the layout never looks broken.', url:'#' },
  { source:'Demo Wire', status: 'Demo Wire · now', publishedAt:new Date().toISOString(), title:'Fifth Placeholder Drop', body:'Once the feed reconnects, these get replaced with real headlines.', shortBody:'Once the feed reconnects, these get replaced with real headlines.', url:'#' },
  { source:'Demo Wire', status: 'Demo Wire · now', publishedAt:new Date().toISOString(), title:'Sixth Placeholder Drop', body:'Check back shortly, or try the search below once the live feed is back.', shortBody:'Check back shortly, or try the search below once the live feed is back.', url:'#' }
];

function renderError(message){
  renderArticles(DEMO_ARTICLES);
  const title = document.getElementById('newsSectionTitle');
  if(title) title.textContent = 'Live from the wire. (demo preview)';
  console.warn('News feed error, showing demo content:', message);
}

async function loadNews(){
  try{
    const res = await fetch('/api/gnews?op=headlines&category=general&max=10');
    if(res.status === 403 || res.status === 429) throw new Error('GNews usage limit reached');
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    const articles = (data.articles || []).map(mapGNewsArticle);
    if(!articles.length) throw new Error('No articles returned');
    renderArticles(articles.slice(0, 6));
  }catch(err){
    renderError(err.message);
  }
}

async function fetchNewsSearchPage(query, page){
  const res = await fetch(`/api/gnews?op=search&q=${encodeURIComponent(query)}&max=10&page=${page}`);
  if(res.status === 403 || res.status === 429) throw new Error('GNews usage limit reached — try again later');
  if(!res.ok) return [];
  const data = await res.json();
  return (data.articles || []).map(mapGNewsArticle);
}

if(document.getElementById('newsGrid')){
  loadNews();
  initSearchWidget({
    formId: 'searchForm', inputId: 'searchInput', gridId: 'searchResultsGrid',
    statusId: 'searchStatus', moreBtnId: 'searchMoreBtn', fetchPage: fetchNewsSearchPage
  });
}
