// Populates the Music drops-grid with real chart data from Deezer's public
// API — no key or login needed at all. Deezer doesn't send CORS headers for
// plain fetch() from a browser, so we use their JSONP output instead (loading
// the response via a <script> tag sidesteps CORS entirely — an older but
// still legitimate technique for exactly this situation).

const DEEZER_API = 'https://api.deezer.com';

function deezerJsonp(url, timeoutMs = 8000){
  return new Promise((resolve, reject) => {
    const callbackName = 'deezer_cb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    };
    const timer = setTimeout(() => {
      if(settled) return;
      cleanup();
      reject(new Error('Deezer request timed out'));
    }, timeoutMs);

    window[callbackName] = (data) => {
      if(settled) return;
      cleanup();
      if(data?.error){ reject(new Error(data.error.message || 'Deezer error')); return; }
      resolve(data);
    };
    script.onerror = () => {
      if(settled) return;
      cleanup();
      reject(new Error('Deezer request failed'));
    };
    const sep = url.includes('?') ? '&' : '?';
    script.src = `${url}${sep}output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

function formatDuration(seconds){
  if(!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function albumToCard(album){
  return {
    title: album.title,
    body: `New from ${album.artist?.name || 'the artist'}.`,
    status: `NewSociety Sound · New Release`,
    source: 'Deezer', url: album.link,
    imageUrl: album.cover_medium,
    deezerId: album.id, deezerType: 'album'
  };
}

function trackToCard(track){
  return {
    title: track.title,
    body: `From "${track.album?.title || 'Unknown Album'}" by ${track.artist?.name || 'Unknown Artist'}.`,
    status: `NewSociety Sound · Trending`,
    source: 'Deezer', url: track.link,
    imageUrl: track.album?.cover_medium,
    deezerId: track.id, deezerType: 'track'
  };
}

async function fetchChartAlbums(){
  const data = await deezerJsonp(`${DEEZER_API}/chart/0/albums?limit=4`);
  return (data.data || []).map(albumToCard);
}

async function fetchChartTracks(){
  const data = await deezerJsonp(`${DEEZER_API}/chart/0/tracks?limit=4`);
  return (data.data || []).map(trackToCard);
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
    el.href = buildDetailLink({ ...card, from, pillar });

    const status = document.createElement('span');
    status.className = 'drop-status mono';
    status.textContent = card.status;

    const h4 = document.createElement('h4');
    h4.textContent = card.title;

    const p = document.createElement('p');
    p.textContent = card.body;

    el.append(status, h4, p);
    attachCardImage(el, card.imageUrl);
    attachSaveButton(el, { href: el.href, title: card.title || 'Untitled', pillar, status: card.status || '', imageUrl: card.imageUrl || '' });
    grid.appendChild(el);
  });

  if(title) title.textContent = 'Live from the charts.';
}

const DEMO_TRACKS = [
  { status: 'NewSociety Sound · New Release', title: 'Sample New Release', body: 'Placeholder content shown because the live feed is unavailable.', url: '#' },
  { status: 'NewSociety Sound · Trending', title: 'Sample Trending Track', body: 'Six cards fill this grid in the live version, mixing new releases and trending tracks straight from Deezer.', url: '#' },
  { status: 'NewSociety Sound · New Release', title: 'Sample Album Drop', body: 'Card layout, spacing, and typography match the rest of the site.', url: '#' },
  { status: 'NewSociety Sound · Trending', title: 'Sample Chart Climber', body: 'This grid always shows six cards, live or demo, so the layout never looks broken.', url: '#' },
  { status: 'NewSociety Sound · New Release', title: 'Sample Fresh Single', body: 'Once the feed reconnects, these get replaced with real releases and chart data.', url: '#' },
  { status: 'NewSociety Sound · Trending', title: 'Sample Playlist Pick', body: 'Check back shortly, or try the search below once the live feed is back.', url: '#' }
];

function renderError(message){
  renderCards(DEMO_TRACKS);
  const title = document.getElementById('newsSectionTitle');
  if(title) title.textContent = 'Live from the charts. (demo preview)';
  console.warn('Music feed error, showing demo content:', message);
}

async function loadMusic(){
  try{
    const [albums, tracks] = await Promise.all([fetchChartAlbums(), fetchChartTracks()]);
    const combined = pickBalanced([albums, tracks], 6);
    if(!combined.length) throw new Error('No music content returned');
    renderCards(combined);
  }catch(err){
    renderError(err.message);
  }
}

async function fetchMusicSearchPage(query, page){
  const index = (page - 1) * 10;
  const data = await deezerJsonp(`${DEEZER_API}/search?q=${encodeURIComponent(query)}&index=${index}&limit=10`);
  return (data.data || []).map(track => ({
    title: track.title,
    body: `From "${track.album?.title || 'Unknown Album'}" by ${track.artist?.name || 'Unknown Artist'}.`,
    status: `${track.artist?.name || 'Unknown Artist'} · ${formatDuration(track.duration)}`,
    source: 'Deezer', url: track.link,
    imageUrl: track.album?.cover_medium,
    deezerId: track.id, deezerType: 'track'
  }));
}

// The NewSociety 100 — our own blended US chart, built server-side by
// /api/us-top-songs from Apple Music's official US chart plus Deezer's
// chart (Apple alone only reflects Apple Music listeners; Deezer alone has
// no real country filter). A song's blended rank rewards showing up on
// both, so it's more broadly representative than either single source —
// see the function itself for the actual merge math. Neither feed's own
// preview clips survive the blend cleanly, so each row's play button looks
// one up on demand from Apple's (separate, CORS-friendly) iTunes Search API
// instead of fetching all 100 upfront. Split into two 50-track slides
// rather than one long scroll, with each row also linking to the same
// on-site detail breakdown as everything else on the site.
const ITUNES_SEARCH = 'https://itunes.apple.com/search';
const CHART_SLIDE_SIZE = 50;
let chartTracks = [];
let chartSlide = 0;
let chartAutoAdvanceTimer = null;
let activePreviewAudio = null;
let activePreviewBtn = null;

function stopActivePreview(){
  if(activePreviewAudio) activePreviewAudio.pause();
  if(activePreviewBtn){ activePreviewBtn.textContent = '▶'; activePreviewBtn.classList.remove('playing', 'loading'); }
  activePreviewAudio = null;
  activePreviewBtn = null;
}

async function togglePreview(track, btn){
  if(activePreviewBtn === btn && activePreviewAudio){
    if(activePreviewAudio.paused){
      activePreviewAudio.play();
      btn.textContent = '❚❚';
      btn.classList.add('playing');
    }else{
      activePreviewAudio.pause();
      btn.textContent = '▶';
      btn.classList.remove('playing');
    }
    return;
  }

  stopActivePreview();
  activePreviewBtn = btn;
  btn.classList.add('loading');
  btn.textContent = '···';

  try{
    const res = await fetch(`${ITUNES_SEARCH}?term=${encodeURIComponent(`${track.title} ${track.artist}`)}&media=music&limit=1`);
    const data = await res.json();
    const previewUrl = data.results?.[0]?.previewUrl;
    if(activePreviewBtn !== btn) return; // a different row was clicked while this lookup was in flight

    btn.classList.remove('loading');
    if(!previewUrl){
      btn.textContent = '▶';
      btn.disabled = true;
      btn.setAttribute('aria-label', 'No preview available');
      activePreviewBtn = null;
      return;
    }

    const audio = new Audio(previewUrl);
    activePreviewAudio = audio;
    audio.play();
    btn.textContent = '❚❚';
    btn.classList.add('playing');
    audio.addEventListener('ended', stopActivePreview);
  }catch(err){
    btn.classList.remove('loading');
    btn.textContent = '▶';
    activePreviewBtn = null;
    console.warn('Preview lookup failed:', err.message);
  }
}

function renderChartSlide(){
  const list = document.getElementById('topChartList');
  if(!list) return;

  list.innerHTML = '';
  stopActivePreview();
  const start = chartSlide * CHART_SLIDE_SIZE;
  const slice = chartTracks.slice(start, start + CHART_SLIDE_SIZE);
  const { from, pillar } = currentPillarInfo();

  slice.forEach((track, idx) => {
    const rankNum = start + idx + 1;
    const li = document.createElement('li');
    li.className = 'chart-row';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'chart-play';
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', `Play preview of ${track.title}`);
    playBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePreview(track, playBtn);
    });

    const a = document.createElement('a');
    a.className = 'chart-item';
    a.href = buildDetailLink({
      title: track.title,
      body: `#${rankNum} on the NewSociety 100, blending Apple Music and Deezer listening data. By ${track.artist}.`,
      status: `${track.artist} · #${rankNum} on the US chart`,
      source: track.source, url: track.url,
      imageUrl: track.artworkUrl,
      categories: track.genre, publishedAt: track.releaseDate,
      from, pillar
    });

    const rank = document.createElement('span');
    rank.className = 'chart-rank mono';
    rank.textContent = rankNum;

    const img = document.createElement('img');
    img.src = track.artworkUrl || '';
    img.alt = '';
    img.onerror = () => img.remove();

    const info = document.createElement('span');
    info.className = 'chart-info';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = track.title;
    const artist = document.createElement('span');
    artist.className = 'artist';
    artist.textContent = track.artist || 'Unknown Artist';
    info.append(title, artist);

    const meta = document.createElement('span');
    meta.className = 'chart-meta mono';
    meta.textContent = track.genre || '';

    a.append(rank, img, info, meta);
    li.append(playBtn, a);
    list.appendChild(li);
  });

  document.querySelectorAll('.chart-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === chartSlide);
  });
}

// Auto-advances to the next 50 every 15s. Any manual navigation (arrows or
// dots) cancels the timer for good, so the chart stays on whichever slide
// the visitor picked instead of yanking it out from under them.
function goToChartSlide(index, manual){
  const slideCount = Math.ceil(chartTracks.length / CHART_SLIDE_SIZE);
  chartSlide = ((index % slideCount) + slideCount) % slideCount;
  renderChartSlide();
  if(manual && chartAutoAdvanceTimer){
    clearInterval(chartAutoAdvanceTimer);
    chartAutoAdvanceTimer = null;
  }
}

function startChartAutoAdvance(){
  const slideCount = Math.ceil(chartTracks.length / CHART_SLIDE_SIZE);
  if(slideCount <= 1) return;
  chartAutoAdvanceTimer = setInterval(() => goToChartSlide(chartSlide + 1, false), 15000);
}

async function loadTopChart(){
  const status = document.getElementById('topChartStatus');
  const prevBtn = document.getElementById('chartPrevBtn');
  const nextBtn = document.getElementById('chartNextBtn');
  if(!document.getElementById('topChartList')) return;
  try{
    const res = await fetch('/api/us-top-songs');
    if(!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    chartTracks = data.tracks || [];
    if(!chartTracks.length) throw new Error('No chart data returned');

    goToChartSlide(0, false);
    startChartAutoAdvance();
    if(prevBtn) prevBtn.addEventListener('click', () => goToChartSlide(chartSlide - 1, true));
    if(nextBtn) nextBtn.addEventListener('click', () => goToChartSlide(chartSlide + 1, true));
    document.querySelectorAll('.chart-dot').forEach((dot, i) => {
      dot.addEventListener('click', () => goToChartSlide(i, true));
    });

    if(status) status.textContent = `The NewSociety 100 — blended from Apple Music and Deezer, updated live. ${chartTracks.length} tracks.`;
  }catch(err){
    if(status) status.textContent = 'Chart temporarily unavailable — check back shortly.';
    console.warn('Top chart error:', err.message);
  }
}

if(document.getElementById('newsGrid')){
  loadMusic();
  loadTopChart();
  initSearchWidget({
    formId: 'searchForm', inputId: 'searchInput', gridId: 'searchResultsGrid',
    statusId: 'searchStatus', moreBtnId: 'searchMoreBtn', fetchPage: fetchMusicSearchPage
  });
}
