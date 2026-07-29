// Populates the Anime drops-grid with a genuine mix of anime pulled live from
// AniList (graphql.anilist.co) — no API key needed, own database (not scraped
// from MyAnimeList, which is unreliable for live queries). Deliberately mixes
// three buckets so it's not just mainstream top-10 titles: classics (pre-2010,
// high score), underrated (lower popularity but well-scored), and trending.

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const ANIME_QUERY = `
query($cp:Int,$up:Int,$tp:Int){
  classics: Page(page:$cp, perPage:2){
    media(type:ANIME, format:TV, sort:SCORE_DESC, startDate_lesser:20100101){
      id title{ romaji english } averageScore seasonYear episodes description(asHtml:false) siteUrl coverImage{ large }
    }
  }
  underrated: Page(page:$up, perPage:2){
    media(type:ANIME, format:TV, sort:POPULARITY_DESC, popularity_lesser:60000, averageScore_greater:70){
      id title{ romaji english } averageScore seasonYear episodes description(asHtml:false) siteUrl coverImage{ large }
    }
  }
  trending: Page(page:$tp, perPage:2){
    media(type:ANIME, sort:TRENDING_DESC){
      id title{ romaji english } averageScore seasonYear episodes description(asHtml:false) siteUrl coverImage{ large }
    }
  }
}`;

function randomPage(max){
  return Math.floor(Math.random() * max) + 1;
}

// Strips HTML/whitespace but keeps the FULL text — used for the detail page.
function cleanFullSynopsis(text){
  if(!text) return '';
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Truncated version for the card preview only, where space is tight — the
// detail page (linked via buildDetailLink) always gets the full synopsis.
function cleanSynopsis(text){
  const full = cleanFullSynopsis(text);
  return full.length > 140 ? full.slice(0, 140).trim() + '…' : full;
}

function renderAnime(mediaList){
  const grid = document.getElementById('newsGrid');
  const title = document.getElementById('newsSectionTitle');
  if(!grid) return;

  grid.innerHTML = '';
  const { from, pillar } = currentPillarInfo();
  mediaList.forEach(anime => {
    const score = anime.averageScore ? `${anime.averageScore}/100` : 'Unrated';
    const statusText = `${anime.seasonYear || '—'} · ${score}`;
    const heading = anime.title.english || anime.title.romaji || 'Untitled';
    const synopsis = cleanSynopsis(anime.description);
    const fullSynopsis = cleanFullSynopsis(anime.description);

    const card = document.createElement('a');
    card.className = 'drop-card';
    card.href = buildDetailLink({
      title: heading, body: fullSynopsis, status: statusText,
      source: 'AniList', url: anime.siteUrl, from, pillar,
      anilistId: anime.id
    });

    const status = document.createElement('span');
    status.className = 'drop-status mono';
    status.textContent = statusText;

    const h4 = document.createElement('h4');
    h4.textContent = heading;

    const p = document.createElement('p');
    p.textContent = synopsis;

    card.append(status, h4, p);
    attachCardImage(card, anime.coverImage?.large);
    grid.appendChild(card);
  });

  if(title) title.textContent = 'Live from the archive.';
}

const DEMO_ANIME = [
  { title:{ english:'Sample Classic Pick' }, seasonYear:2004, averageScore:88, siteUrl:'#', description:'Placeholder content shown because the live feed is unavailable.' },
  { title:{ english:'Sample Underrated Pick' }, seasonYear:2016, averageScore:73, siteUrl:'#', description:'Six cards fill this grid in the live version — a mix of classics, underrated picks, and trending titles pulled fresh from AniList.' },
  { title:{ english:'Sample Trending Pick' }, seasonYear:2026, averageScore:85, siteUrl:'#', description:'Card layout, spacing, and typography match the rest of the site.' }
];

function renderError(message){
  renderAnime(DEMO_ANIME);
  const title = document.getElementById('newsSectionTitle');
  if(title) title.textContent = 'Live from the archive. (demo preview)';
  console.warn('Anime feed error, showing demo content:', message);
}

async function loadAnime(){
  try{
    const res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ANIME_QUERY,
        variables: { cp: randomPage(4), up: randomPage(6), tp: randomPage(2) }
      })
    });
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const { data, errors } = await res.json();
    if(errors) throw new Error(errors[0]?.message || 'AniList query error');
    const combined = [...data.classics.media, ...data.underrated.media, ...data.trending.media];
    if(!combined.length) throw new Error('No anime returned');
    renderAnime(combined);
  }catch(err){
    renderError(err.message);
  }
}

const SEARCH_QUERY = `
query($s:String,$p:Int){
  Page(page:$p, perPage:10){
    media(search:$s, type:ANIME){
      id title{ romaji english } averageScore seasonYear episodes description(asHtml:false) siteUrl coverImage{ large }
    }
  }
}`;

async function fetchAnimeSearchPage(query, page){
  const res = await fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { s: query, p: page } })
  });
  if(!res.ok) throw new Error(`${res.status}`);
  const { data, errors } = await res.json();
  if(errors) throw new Error(errors[0]?.message || 'AniList search error');
  return (data.Page.media || []).map(anime => {
    const score = anime.averageScore ? `${anime.averageScore}/100` : 'Unrated';
    return {
      title: anime.title.english || anime.title.romaji || 'Untitled',
      body: cleanFullSynopsis(anime.description),
      cardBody: cleanSynopsis(anime.description),
      status: `${anime.seasonYear || '—'} · ${score}`,
      source: 'AniList', url: anime.siteUrl, anilistId: anime.id,
      imageUrl: anime.coverImage?.large
    };
  });
}

if(document.getElementById('newsGrid')){
  loadAnime();
  initSearchWidget({
    formId: 'searchForm', inputId: 'searchInput', gridId: 'searchResultsGrid',
    statusId: 'searchStatus', moreBtnId: 'searchMoreBtn', fetchPage: fetchAnimeSearchPage
  });
}
