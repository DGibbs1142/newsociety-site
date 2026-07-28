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
  img.loading = 'lazy';
  img.onerror = () => media.remove();
  media.appendChild(img);
  card.insertBefore(media, card.firstChild);
}

// Sports-only variant: two team logos side by side with "@" between them,
// used instead of a single photo since a game card represents two teams.
function attachMatchupLogos(card, awayLogo, homeLogo){
  if(!awayLogo && !homeLogo) return;
  const media = document.createElement('div');
  media.className = 'drop-card-matchup';
  if(awayLogo){
    const img = document.createElement('img');
    img.src = awayLogo; img.alt = ''; img.loading = 'lazy';
    img.onerror = () => img.remove();
    media.appendChild(img);
  }
  const vs = document.createElement('span');
  vs.className = 'vs';
  vs.textContent = '@';
  media.appendChild(vs);
  if(homeLogo){
    const img = document.createElement('img');
    img.src = homeLogo; img.alt = ''; img.loading = 'lazy';
    img.onerror = () => img.remove();
    media.appendChild(img);
  }
  card.insertBefore(media, card.firstChild);
}
