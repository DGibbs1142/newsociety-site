// Ticker items — shared across every page. Each links to its own page now.
const TICKER_ITEMS = [
  { label: 'Sports', href: 'sports.html' },
  { label: 'Anime', href: 'anime.html' },
  { label: 'Pop Culture', href: 'pop-culture.html' },
  { label: 'Fashion', href: 'fashion.html' },
  { label: 'Current Events', href: 'current-events.html' },
  { label: 'New Drop Daily', href: 'index.html#follow' },
  { label: 'Follow the Feed', href: 'index.html#follow' }
];

function buildTicker(){
  const track = document.getElementById('tickerTrack');
  if(!track) return;
  const currentPage = document.body.getAttribute('data-page') || '';
  const full = [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS];
  full.forEach(item => {
    const a = document.createElement('a');
    a.textContent = item.label;
    a.href = item.href;
    if(currentPage && item.href.startsWith(currentPage)){
      a.classList.add('current');
    }
    track.appendChild(a);
  });
}

function initReveal(){
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('in');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

buildTicker();
document.addEventListener('DOMContentLoaded', initReveal);
