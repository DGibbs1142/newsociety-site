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

// Only one preview clip plays at a time — starting a new one stops whatever
// was already playing and resets its button back to the play icon.
let activePreviewAudio = null;
let activePreviewBtn = null;

function stopActivePreview(){
  if(activePreviewAudio) activePreviewAudio.pause();
  if(activePreviewBtn){ activePreviewBtn.textContent = '▶'; activePreviewBtn.classList.remove('playing'); }
  activePreviewAudio = null;
  activePreviewBtn = null;
}

function togglePreview(url, btn){
  if(activePreviewBtn === btn){
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
  const audio = new Audio(url);
  activePreviewAudio = audio;
  activePreviewBtn = btn;
  audio.play();
  btn.textContent = '❚❚';
  btn.classList.add('playing');
  audio.addEventListener('ended', stopActivePreview);
}

// Deezer's global chart IS a live "what's actually being played right now"
// ranking — same source as the trending cards above, just the full list
// instead of a top-4 sample. Rendered as a ranked chart card (not full
// drop-cards — 100 of those would be far too heavy), with a play button on
// each row for the 30-second preview clip Deezer provides, plus a link to
// the same on-site detail breakdown as everything else on the site.
async function loadTopChart(){
  const list = document.getElementById('topChartList');
  const status = document.getElementById('topChartStatus');
  if(!list) return;
  try{
    const data = await deezerJsonp(`${DEEZER_API}/chart/0/tracks?limit=100`);
    const tracks = data.data || [];
    if(!tracks.length) throw new Error('No chart data returned');

    const { from, pillar } = currentPillarInfo();
    list.innerHTML = '';
    stopActivePreview();
    tracks.forEach((track, i) => {
      const li = document.createElement('li');
      li.className = 'chart-row';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'chart-play';
      playBtn.textContent = '▶';
      if(track.preview){
        playBtn.setAttribute('aria-label', `Play preview of ${track.title}`);
        playBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          togglePreview(track.preview, playBtn);
        });
      }else{
        playBtn.disabled = true;
        playBtn.setAttribute('aria-label', 'No preview available');
      }

      const a = document.createElement('a');
      a.className = 'chart-item';
      a.href = buildDetailLink({
        title: track.title,
        body: `From "${track.album?.title || 'Unknown Album'}" by ${track.artist?.name || 'Unknown Artist'}.`,
        status: `${track.artist?.name || 'Unknown Artist'} · #${i + 1} on the global chart`,
        source: 'Deezer', url: track.link,
        imageUrl: track.album?.cover_medium,
        deezerId: track.id, deezerType: 'track',
        from, pillar
      });

      const rank = document.createElement('span');
      rank.className = 'chart-rank mono';
      rank.textContent = i + 1;

      const img = document.createElement('img');
      img.src = track.album?.cover_small || '';
      img.alt = '';
      img.onerror = () => img.remove();

      const info = document.createElement('span');
      info.className = 'chart-info';
      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = track.title;
      const artist = document.createElement('span');
      artist.className = 'artist';
      artist.textContent = track.artist?.name || 'Unknown Artist';
      info.append(title, artist);

      const duration = document.createElement('span');
      duration.className = 'chart-duration mono';
      duration.textContent = formatDuration(track.duration);

      a.append(rank, img, info, duration);
      li.append(playBtn, a);
      list.appendChild(li);
    });

    if(status) status.textContent = `Updated live from Deezer's global chart — ${tracks.length} tracks.`;
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
