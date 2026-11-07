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
  if(!document.documentElement.classList.contains('js-reveal')) return;
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

  // A one-line hint rather than a card with a button: it used to cover the
  // bottom of the screen on phones until tapped. It now counts as seen the
  // moment it appears, closes itself after 8 seconds (unless the visitor is
  // pointing at or focused on it), and has a small close button.
  setTimeout(() => {
    if(!document.querySelector('.nav-search input')) return;
    const tip = document.createElement('div');
    tip.className = 'onboarding-tip';
    tip.setAttribute('role', 'status');
    tip.innerHTML = '<p>Tip: search up top, or tap <span class="onboarding-star" aria-hidden="true">☆</span><span class="visually-hidden">the star</span> on a card to save it.</p><button type="button" class="onboarding-tip-dismiss" aria-label="Dismiss tip">×</button>';
    document.body.appendChild(tip);
    markOnboardingSeen();
    tip.querySelector('.onboarding-tip-dismiss').addEventListener('click', dismissOnboardingTip);
    requestAnimationFrame(() => tip.classList.add('in'));
    let held = false;
    tip.addEventListener('pointerenter', () => { held = true; });
    tip.addEventListener('pointerleave', () => { held = false; });
    tip.addEventListener('focusin', () => { held = true; });
    tip.addEventListener('focusout', () => { held = false; });
    const close = () => { if(held) setTimeout(close, 2000); else dismissOnboardingTip(); };
    setTimeout(close, 8000);
  }, 1500);
}

// Newsletter archive: the page grows by a full issue every week, so on the
// archive only the newest issue is shown in full. Older issues show their
// subject and story headlines with a button to open the rest. Jumping to an
// issue (the index, a shared #issue-NN link) opens it. A back-to-top button
// appears once the reader is well down the page. Done here, not in the
// generated markup, so newsletter.html and build-archive.py are untouched.
function initArchive(){
  if(document.body.getAttribute('data-page') !== 'newsletter.html') return;
  const issues = [...document.querySelectorAll('article.issue')];
  if(issues.length < 2) return;

  const open = (issue) => {
    if(!issue || !issue.classList.contains('issue-collapsed')) return;
    issue.classList.remove('issue-collapsed');
    const btn = issue.querySelector('.issue-expand');
    if(btn) btn.remove();
  };

  issues.slice(1).forEach(issue => {
    issue.classList.add('issue-collapsed');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost issue-expand';
    btn.textContent = 'Read the full issue';
    btn.addEventListener('click', () => open(issue));
    issue.appendChild(btn);
  });

  const openFromHash = () => {
    const target = location.hash && document.getElementById(location.hash.slice(1));
    const issue = target && target.closest('article.issue');
    if(issue && issue.classList.contains('issue-collapsed')){
      open(issue);
      issue.scrollIntoView();
    }
  };
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  const top = document.createElement('a');
  top.href = '#main';
  top.className = 'back-to-top mono';
  top.textContent = '↑ Top';
  top.hidden = true;
  (document.getElementById('main') || document.body).appendChild(top);
  const onScroll = () => { top.hidden = window.scrollY < window.innerHeight * 1.5; };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Follow pillars. Stored in this browser only (like Saved), so no account
// is needed: a Follow button on each pillar page, and on the homepage the
// followed pillars move to the front of the pillar grid (marked
// "Following") and their cards lead the live strip (homepage-live.js reads
// getFollowedPillars()).
const FOLLOW_KEY = 'newsociety_following';
const PILLAR_PAGES = {
  'sports.html': 'Sports', 'anime.html': 'Anime', 'pop-culture.html': 'Pop Culture',
  'fashion.html': 'Fashion', 'music.html': 'Music', 'current-events.html': 'Current Events'
};

function getFollowedPillars(){
  try{
    const list = JSON.parse(localStorage.getItem(FOLLOW_KEY) || '[]');
    return Array.isArray(list) ? list.filter(p => p in PILLAR_PAGES) : [];
  }catch(e){ return []; }
}

function setFollowedPillars(list){
  try{ localStorage.setItem(FOLLOW_KEY, JSON.stringify(list)); }catch(e){}
}

function initFollow(){
  const page = document.body.getAttribute('data-page') || '';

  if(PILLAR_PAGES[page]){
    const hero = document.querySelector('.page-hero .wrap');
    if(!hero) return;
    const name = PILLAR_PAGES[page];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost follow-btn';
    const paint = () => {
      const on = getFollowedPillars().includes(page);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'Following ' + name + ' ✓' : 'Follow ' + name;
    };
    btn.addEventListener('click', () => {
      const list = getFollowedPillars();
      const on = list.includes(page);
      setFollowedPillars(on ? list.filter(p => p !== page) : list.concat(page));
      paint();
    });
    paint();
    const note = document.createElement('p');
    note.className = 'follow-note mono';
    note.textContent = 'Followed pillars show up first on the homepage. Saved in this browser.';
    hero.append(btn, note);
    return;
  }

  if(page === 'index.html'){
    const grid = document.querySelector('.pillars-grid');
    if(!grid) return;
    const followed = getFollowedPillars();
    const cards = [...grid.querySelectorAll('a.pillar')];
    followed.slice().reverse().forEach(p => {
      const card = cards.find(c => c.getAttribute('href') === p);
      if(!card) return;
      grid.prepend(card);
      const tag = card.querySelector('.pillar-tag');
      if(tag && !card.querySelector('.pillar-following')){
        const badge = document.createElement('span');
        badge.className = 'pillar-following mono';
        badge.textContent = 'Following';
        tag.after(badge);
      }
    });
    if(!followed.length){
      const hint = document.createElement('p');
      hint.className = 'follow-note mono pillars-hint';
      hint.textContent = 'Tip: follow a pillar from its page and it shows up first here.';
      grid.after(hint);
    }
  }
}

buildTicker();
initMenu();
initThemeToggle();
initSiteNotice();
initOnboardingTip();
initArchive();
initFollow();
document.addEventListener('DOMContentLoaded', initReveal);

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker registration failed:', err));
  });
}
