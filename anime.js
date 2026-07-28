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
      title{ romaji english } averageScore seasonYear episodes description(asHtml:false) siteUrl
    }
  }
  underrated: Page(page:$up, perPage:2){
    media(type:ANIME, format:TV, sort:POPULARITY_DESC, popularity_lesser:60000, averageScore_greater:70){
      title{ romaji english } averageScore seasonYear episodes description(asHtml:false) siteUrl
    }
  }
  trending: Page(page:$tp, perPage:2){
    media(type:ANIME, sort:TRENDING_DESC){
      title{ romaji english } averageScore seasonYear episodes description(asHtml:false) siteUrl
    }
  }
}`;

function randomPage(max){
  return Math.floor(Math.random() * max) + 1;
}

function cleanSynopsis(text){
  if(!text) return '';
  const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > 140 ? stripped.slice(0, 140).trim() + '…' : stripped;
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

    const card = document.createElement('a');
    card.className = 'drop-card';
    card.href = buildDetailLink({
      title: heading, body: synopsis, status: statusText,
      source: 'AniList', url: anime.siteUrl, from, pillar
    });

    const status = document.createElement('span');
    status.className = 'drop-status mono';
    status.textContent = statusText;

    const h4 = document.createElement('h4');
    h4.textContent = heading;

    const p = document.createElement('p');
    p.textContent = synopsis;

    card.append(status, h4, p);
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

if(document.getElementById('newsGrid')){
  loadAnime();
}
