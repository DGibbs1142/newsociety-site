// Share button on newsletter story pages (stories/*.html): the phone's share
// sheet where there is one, otherwise copy the link.
(function(){
  const btn = document.getElementById('storyShare');
  const status = document.getElementById('storyShareStatus');
  if(!btn) return;
  btn.addEventListener('click', async () => {
    const data = { title: btn.dataset.title, url: btn.dataset.url };
    if(navigator.share){
      try{ await navigator.share(data); return; }catch(e){ if(e && e.name === 'AbortError') return; }
    }
    try{
      await navigator.clipboard.writeText(data.url);
      if(status) status.textContent = 'Link copied.';
    }catch(e){
      if(status) status.textContent = data.url;
    }
  });
})();

// Save for later on story and issue pages. Uses the same localStorage list as
// the cards elsewhere (detail-link.js, key newsociety_saved), so saved
// newsletter stories show up on saved.html beside everything else. Kept
// self-contained because these pages don't load detail-link.js.
(function(){
  const share = document.getElementById('storyShare');
  const status = document.getElementById('storyShareStatus');
  if(!share) return;
  const KEY = 'newsociety_saved';
  const read = () => { try{ return JSON.parse(localStorage.getItem(KEY)) || []; }catch(e){ return []; } };
  const write = items => { try{ localStorage.setItem(KEY, JSON.stringify(items)); return true; }catch(e){ return false; } };
  const tag = document.querySelector('.story-tag')?.textContent.trim() || '';
  const crumb = document.querySelector('.breadcrumb')?.textContent.replace(/^\s*←\s*/, '').split('·')[0].trim() || '';
  const item = {
    href: location.pathname,
    title: document.querySelector('.story-title')?.textContent.trim() || document.title,
    pillar: tag.split('·')[0].trim() || 'Newsletter',
    status: tag.includes('·') ? tag : [tag, crumb].filter(Boolean).join(' · '),
    imageUrl: document.querySelector('meta[property="og:image"]')?.content || ''
  };
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-ghost story-save';
  const isSaved = () => read().some(i => i.href === item.href);
  const sync = () => {
    const saved = isSaved();
    btn.textContent = saved ? '★ Saved' : '☆ Save';
    btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
  };
  btn.addEventListener('click', () => {
    const items = read();
    const idx = items.findIndex(i => i.href === item.href);
    if(idx >= 0) items.splice(idx, 1); else items.unshift(item);
    if(!write(items)){ if(status) status.textContent = 'Saving isn’t available in this browser.'; return; }
    sync();
    if(status){
      status.innerHTML = '';
      if(idx < 0){
        status.append('Saved. ');
        const a = document.createElement('a');
        a.href = '/saved.html';
        a.textContent = 'See everything you’ve saved →';
        status.append(a);
      }else{
        status.textContent = 'Removed from saved.';
      }
    }
  });
  sync();
  share.after(btn);
})();
