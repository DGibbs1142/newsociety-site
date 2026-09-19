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
// ESPN serves team logos at 500x500 (~500 KB each as PNG) even though
// cards show them at a fraction of that. Its image combiner returns a
// resized copy (96px: ~7 KB), so request roughly 2x the displayed size.
// Non-ESPN URLs pass through unchanged.
function espnSized(url, px){
  if(!url) return url;
  const m = url.match(/^https:\/\/a\.espncdn\.com(\/i\/[^?#]+)$/);
  return m ? `https://a.espncdn.com/combiner/i?img=${m[1]}&w=${px}&h=${px}` : url;
}

function attachCardImage(card, imageUrl){
  if(!imageUrl) return;
  const media = document.createElement('div');
  media.className = 'drop-card-media';
  const img = document.createElement('img');
  img.src = espnSized(imageUrl, 320);
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.onerror = () => media.remove();
  media.appendChild(img);
  card.insertBefore(media, card.firstChild);
}

// Adds a "···" toggle right after a card's paragraph, but only when the
// text is actually being cut off by the 3-line clamp — clicking it expands
// the full text in place, right there in the grid, without navigating to
// the detail page. Measured on the next animation frame rather than
// immediately: cards are usually still detached from the document when
// this runs (built, then appended right after), and a detached element
// always reports 0 for scrollHeight/clientHeight, so measuring "now" would
// never detect truncation.
function attachExpandToggle(card, p){
  requestAnimationFrame(() => {
    // scrollHeight is unreliable on a -webkit-line-clamp box (it tends to
    // just report the clamped height back) — briefly drop to a plain block
    // display to get the paragraph's true unclamped height, then restore
    // before anything paints, so there's no visible flash.
    const clampedHeight = p.clientHeight;
    const prevDisplay = p.style.display;
    const prevClamp = p.style.webkitLineClamp;
    p.style.display = 'block';
    p.style.webkitLineClamp = 'unset';
    const naturalHeight = p.scrollHeight;
    p.style.display = prevDisplay;
    p.style.webkitLineClamp = prevClamp;

    if(naturalHeight <= clampedHeight + 1) return;
    const dots = document.createElement('button');
    dots.type = 'button';
    dots.className = 'expand-dots';
    dots.textContent = '···';
    dots.setAttribute('aria-label', 'Show full text');
    dots.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const expanded = p.classList.toggle('expanded');
      dots.textContent = expanded ? '︿' : '···';
      dots.setAttribute('aria-label', expanded ? 'Show less' : 'Show full text');
    });
    p.insertAdjacentElement('afterend', dots);
  });
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
  img.src = espnSized(imageUrl, 320);
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
    img.src = espnSized(awayLogo, 96); img.alt = '';
    img.loading = 'lazy'; img.decoding = 'async';
    img.onerror = () => img.remove();
    media.appendChild(img);
  }
  const vs = document.createElement('span');
  vs.className = 'vs';
  vs.textContent = '@';
  media.appendChild(vs);
  if(homeLogo){
    const img = document.createElement('img');
    img.src = espnSized(homeLogo, 96); img.alt = '';
    img.loading = 'lazy'; img.decoding = 'async';
    img.onerror = () => img.remove();
    media.appendChild(img);
  }
  card.insertBefore(media, card.firstChild);
}

// ---- Last-good feed cache ----
// Every pillar pulls from a live API, and those APIs go down or hit their
// daily limit. Showing visitors placeholder "Sample Headline" cards makes a
// working site look unfinished, so each feed stashes its last successful
// payload here and re-renders that instead, labelled with its age.
const feedCache = {
  key(name){ return 'ns-feed-' + name; },
  save(name, items){
    try{
      if(!Array.isArray(items) || !items.length) return;
      localStorage.setItem(this.key(name), JSON.stringify({ at: Date.now(), items }));
    }catch(err){ /* private mode or full storage — caching is optional */ }
  },
  // Anything older than three days is stale enough to be misleading.
  load(name, maxAgeHours = 72){
    try{
      const raw = localStorage.getItem(this.key(name));
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      if(!parsed || !Array.isArray(parsed.items) || !parsed.items.length) return null;
      if(Date.now() - parsed.at > maxAgeHours * 3600 * 1000) return null;
      return parsed;
    }catch(err){ return null; }
  },
  ago(at){
    const mins = Math.max(1, Math.round((Date.now() - at) / 60000));
    if(mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    const hours = Math.round(mins / 60);
    if(hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    const days = Math.round(hours / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }
};

// Honest empty state for when a feed fails and nothing is cached: one short
// line in the grid, instead of six invented cards.
function renderFeedUnavailable(gridId, titleId, titleText, message){
  const grid = document.getElementById(gridId);
  const title = document.getElementById(titleId);
  if(title && titleText) title.textContent = titleText;
  if(!grid) return;
  grid.innerHTML = '';
  const note = document.createElement('p');
  note.className = 'feed-note';
  note.textContent = message || 'This feed is taking a break. Refresh in a few minutes and it should be back.';
  grid.appendChild(note);
}
