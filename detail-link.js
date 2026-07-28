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

function buildDetailLink({ title, body, status, source, url, from, pillar }){
  const params = new URLSearchParams({
    title: title || '',
    body: body || '',
    status: status || '',
    source: source || '',
    url: url || '',
    from: from || '',
    pillar: pillar || ''
  });
  return `detail.html?${params.toString()}`;
}
