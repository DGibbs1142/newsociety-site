// Populates detail.html from the query params set by buildDetailLink()
// (see detail-link.js). Static site, no backend — the card's data travels
// in the URL itself rather than being looked up from a database.

const params = new URLSearchParams(window.location.search);

const title = params.get('title');
const body = params.get('body');
const status = params.get('status');
const source = params.get('source');
const sourceUrl = params.get('url');
const from = params.get('from');
const pillar = params.get('pillar');

if(title){
  document.title = `${title} — NewSociety`;
  document.getElementById('detailTitle').textContent = title;
  document.getElementById('detailStatus').textContent = status || '';
  document.getElementById('detailBody').textContent = body || '';
  document.getElementById('detailPillar').textContent = pillar || 'NewSociety';

  const backLink = document.getElementById('backLink');
  if(from){
    backLink.href = from;
    backLink.textContent = `← Back to ${pillar || 'Pillar'}`;
  }

  const credit = document.getElementById('detailCredit');
  if(source && sourceUrl){
    credit.textContent = 'Source: ';
    const link = document.createElement('a');
    link.href = sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = source;
    link.style.color = 'var(--text-dim)';
    link.style.textDecoration = 'underline';
    credit.appendChild(link);
  }else if(source){
    credit.textContent = `Source: ${source}`;
  }
}else{
  document.getElementById('detailTitle').textContent = "Nothing to show here.";
  document.getElementById('detailStatus').textContent = '';
  document.getElementById('detailBody').textContent = "This page needs to be opened from one of the pillar pages' drop cards.";
}
