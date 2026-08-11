// Shared by every pillar's feed script — builds a link to detail.html that
// carries the card's data via query params (site has no backend/database,
// so this is how a static site can show a branded detail page for live-pulled
// content instead of sending visitors straight to the source).
// Reads the current page's filename + pillar label (from the eyebrow text)
// so each fetcher doesn't have to hardcode which page it's running on.
function currentPillarInfo(){
  const from = document.body.dataset.page || '';
  const eyebrow = document.querySelector('.eyebrow');
  const pillar = eyebrow ? eyebrow.textContent.trim() : '';
  return { from, pillar };
}

// Accepts any fields — common ones (title/body/status/source/url/from/pillar)
// plus optional per-source lookup IDs (espnId/espnPath, tmdbId/mediaType,
// anilistId) that detail.js uses to fetch its own richer data instead of
// relying only on what's in the URL.
function buildDetailLink(data){
  const params = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if(value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  return `detail.html?${params.toString()}`;
}

// Prepends a media image to a drop-card (inserted first regardless of when
// called, since it uses insertBefore). Silently removes itself if the image
// fails to load — better than a broken-image icon on a live feed.
function attachCardImage(card, imageUrl){
  if(!imageUrl) return;
  const media = document.createElement('div');
  media.className = 'drop-card-media';
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = '';
  img.onerror = () => media.remove();
  media.appendChild(img);
  card.insertBefore(media, card.firstChild);
}

// Fills the "About this pillar" section's image with a real, live image —
// each pillar's fetcher passes in whatever its first live item already
// returned (a poster, cover, album art, team logo, article photo…), so this
// needs no extra API call of its own. Stays hidden until an image actually
// loads successfully, and hides itself again if that image fails.
function setPillarAboutImage(imageUrl){
  const media = document.getElementById('aboutMedia');
  const img = document.getElementById('aboutImage');
  if(!media || !img || !imageUrl) return;
  img.onerror = () => { media.style.display = 'none'; };
  img.onload = () => { media.style.display = 'block'; };
  img.src = imageUrl;
  img.alt = '';
}

// "Save for later" — pure client-side via localStorage, no backend needed.
// Each saved item stores just enough to redisplay itself on saved.html
// without re-fetching anything: the detail link (used as its unique id),
// title, pillar, status, and image.
const SAVED_STORAGE_KEY = 'newsociety_saved';

function getSavedItems(){
  try{
    return JSON.parse(localStorage.getItem(SAVED_STORAGE_KEY)) || [];
  }catch{ return []; }
}

function isItemSaved(href){
  return getSavedItems().some(item => item.href === href);
}

function toggleSavedItem(item){
  const items = getSavedItems();
  const idx = items.findIndex(i => i.href === item.href);
  if(idx >= 0) items.splice(idx, 1);
  else items.unshift(item);
  localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(items));
  return idx < 0; // true if the item is now saved
}

// Adds a bookmark toggle button to a drop-card. Nested inside the card's own
// <a> (like attachCardImage's media div) rather than as a sibling, so it
// needs preventDefault/stopPropagation to keep clicks from also following
// the card's link — same technique already used for the chart's play
// buttons, just inline instead of alongside.
function attachSaveButton(card, item){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'save-btn';
  const sync = () => {
    const saved = isItemSaved(item.href);
    btn.classList.toggle('saved', saved);
    btn.textContent = saved ? '★' : '☆';
    btn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save for later');
  };
  sync();
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSavedItem(item);
    sync();
  });
  card.appendChild(btn);
  return btn;
}

// Sports-only variant: two team logos side by side with "@" between them,
// used instead of a single photo since a game card represents two teams.
function attachMatchupLogos(card, awayLogo, homeLogo){
  if(!awayLogo && !homeLogo) return;
  const media = document.createElement('div');
  media.className = 'drop-card-matchup';
  if(awayLogo){
    const img = document.createElement('img');
    img.src = awayLogo; img.alt = '';
    img.onerror = () => img.remove();
    media.appendChild(img);
  }
  const vs = document.createElement('span');
  vs.className = 'vs';
  vs.textContent = '@';
  media.appendChild(vs);
  if(homeLogo){
    const img = document.createElement('img');
    img.src = homeLogo; img.alt = '';
    img.onerror = () => img.remove();
    media.appendChild(img);
  }
  card.insertBefore(media, card.firstChild);
}
