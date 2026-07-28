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
