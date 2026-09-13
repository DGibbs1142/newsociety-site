// Ticker items — shared across every page. Each links to its own page now.
const TICKER_ITEMS = [
  { label: 'Sports', href: '/sports.html' },
  { label: 'Anime', href: '/anime.html' },
  { label: 'Pop Culture', href: '/pop-culture.html' },
  { label: 'Fashion', href: '/fashion.html' },
  { label: 'Music', href: '/music.html' },
  { label: 'Current Events', href: '/current-events.html' },
  { label: 'NewSociety Live', href: '/live.html' },
  { label: 'New Drop Daily', href: '/index.html#follow' },
  { label: 'Follow the Feed', href: '/index.html#follow' }
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
    // Links are root-absolute so the ticker still works on the 404 page,
    // which Netlify can serve from any depth; compare without the slash.
    if(currentPage && item.href.replace(/^\//, '').startsWith(currentPage)){
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


// Below 1140px the nav links don't fit beside the search box, so they
// collapse behind a menu button. The panel closes on link tap, Escape, or
// when the window grows back to desktop width.
function initMenu(){
  const header = document.querySelector('header.nav');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('siteNav');
  if(!header || !toggle || !nav) return;

  const setOpen = (open) => {
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  toggle.addEventListener('click', () => setOpen(!header.classList.contains('menu-open')));
  nav.addEventListener('click', (e) => { if(e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && header.classList.contains('menu-open')){
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 1141px)').addEventListener('change', (e) => { if(e.matches) setOpen(false); });
}

buildTicker();
initMenu();
document.addEventListener('DOMContentLoaded', initReveal);

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker registration failed:', err));
  });
}
