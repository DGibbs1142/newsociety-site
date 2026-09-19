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

function renderError(message){
  console.warn('News feed error:', message);
  const cached = feedCache.load('news');
  if(cached){
    renderArticles(cached.items);
    const title = document.getElementById('newsSectionTitle');
    if(title) title.textContent = 'Live from the wire. (last update ' + feedCache.ago(cached.at) + ')';
    return;
  }
  renderFeedUnavailable('newsGrid', 'newsSectionTitle', 'Live from the wire.',
    'The wire is quiet right now. Refresh in a few minutes for fresh headlines.');
}

async function loadNews(){
  try{
    const res = await fetch('/api/gnews?op=headlines&category=general&max=10');
    if(res.status === 403 || res.status === 429) throw new Error('GNews usage limit reached');
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    const articles = (data.articles || []).map(mapGNewsArticle);
    if(!articles.length) throw new Error('No articles returned');
    feedCache.save('news', articles.slice(0, 6));
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
