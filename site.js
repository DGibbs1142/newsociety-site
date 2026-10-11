// The font stylesheet is requested with media="print" so it never blocks the
// first paint, then promoted here once the page is parsed. This used to be an
// inline onload attribute; moving it into a file is what lets the site send a
// Content-Security-Policy that blocks inline script.
document.querySelectorAll('link[data-font]').forEach(link => { link.media = 'all'; });

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

// theme-init.js already set data-theme before paint if the visitor had
// picked a theme before; this just wires up the button and keeps the
// browser-chrome theme-color meta tag in sync with whichever mode is
// actually showing (explicit choice, falling back to the OS preference).
function initThemeToggle(){
  const btn = document.querySelector('.theme-toggle');
  if(!btn) return;
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  const currentTheme = () => {
    const explicit = document.documentElement.getAttribute('data-theme');
    if(explicit) return explicit;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  };
  const sync = (theme) => {
    if(metaTheme) metaTheme.content = theme === 'light' ? '#ffffff' : '#0a0a0c';
    btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  };

  sync(currentTheme());

  btn.addEventListener('click', () => {
    try{
      const next = currentTheme() === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try{ localStorage.setItem('newsociety-theme', next); }catch(e){}
      sync(next);
    }catch(err){
      redirectHome('The theme switch hit a snag, so we sent you back to the homepage.');
    }
  });
}

// Used by initThemeToggle (and anything else that wants a safe fallback
// instead of leaving the page in a broken state): shows the reason on the
// homepage directly, or carries it there as a query param from anywhere
// else, where initSiteNotice picks it up.
function redirectHome(reason){
  const onIndex = (document.body.getAttribute('data-page') || '') === 'index.html';
  if(onIndex){
    showSiteNotice(reason);
  }else{
    window.location.href = '/?reason=' + encodeURIComponent(reason);
  }
}

function showSiteNotice(message){
  const notice = document.getElementById('siteNotice');
  const text = document.getElementById('siteNoticeText');
  if(!notice || !text) return;
  text.textContent = message;
  notice.hidden = false;
}

// Only present on index.html. Surfaces a ?reason= param left by
// redirectHome(), then strips it from the URL so refreshing or sharing the
// link doesn't re-show the notice.
function initSiteNotice(){
  const notice = document.getElementById('siteNotice');
  if(!notice) return;
  const closeBtn = document.getElementById('siteNoticeClose');
  if(closeBtn) closeBtn.addEventListener('click', () => { notice.hidden = true; });

  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason');
  if(reason){
    showSiteNotice(reason);
    params.delete('reason');
    const query = params.toString();
    history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
  }
}

// A one-time nudge pointing new visitors at search and save-for-later —
// both are easy to miss since neither has any onboarding of its own.
// Built entirely in JS (rather than markup added to every page) so it
// doesn't need touching all 21 HTML files, and shown at most once ever per
// visitor via localStorage. Skipped on 404.html (not a real landing
// moment) and links.html (no header/search there at all).
const ONBOARDING_KEY = 'newsociety_onboarding_seen';

function markOnboardingSeen(){
  try{ localStorage.setItem(ONBOARDING_KEY, '1'); }catch(e){}
}

function dismissOnboardingTip(){
  const tip = document.querySelector('.onboarding-tip');
  if(tip){
    tip.classList.remove('in');
    setTimeout(() => tip.remove(), 300);
  }
  markOnboardingSeen();
}

function initOnboardingTip(){
  let alreadySeen;
  try{ alreadySeen = localStorage.getItem(ONBOARDING_KEY); }catch(e){ return; }
  if(alreadySeen) return;

  const page = document.body.getAttribute('data-page') || '';
  if(page === '404.html' || page === 'links.html') return;

  // Using the feature at all — before the tip even appears — counts as
  // discovering it, so stop watching rather than interrupt them mid-task.
  document.addEventListener('focusin', (e) => {
    if(e.target.closest && e.target.closest('.nav-search')) dismissOnboardingTip();
  });
  document.addEventListener('click', (e) => {
    if(e.target.closest && e.target.closest('.save-btn')) dismissOnboardingTip();
  });

  setTimeout(() => {
    if(document.querySelector('.nav-search input')){
      const tip = document.createElement('div');
      tip.className = 'onboarding-tip';
      tip.setAttribute('role', 'status');
      tip.innerHTML = '<p>Search anything up top, and tap <span class="onboarding-star">☆</span> on any card to save it for later.</p><button type="button" class="btn btn-ghost onboarding-tip-dismiss">Got it</button>';
      document.body.appendChild(tip);
      tip.querySelector('.onboarding-tip-dismiss').addEventListener('click', dismissOnboardingTip);
      requestAnimationFrame(() => tip.classList.add('in'));
    }
  }, 1500);
}

buildTicker();
initMenu();
initThemeToggle();
initSiteNotice();
initOnboardingTip();
document.addEventListener('DOMContentLoaded', initReveal);

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker registration failed:', err));
  });
}
