// Engagement layer: story reactions, share, live polls and the homepage
// "Trending on NewSociety" strip. Backed by netlify/functions/react.mts,
// poll.mts and trending.mts (Netlify Blobs). Everything here fails quietly —
// if the API is down the page just looks the way it did before.
//
// Each block only switches on when its container exists on the page:
//   #reactionBar     (detail.html)  — 🔥 😂 🤯 with live counts
//   #shareDetailBtn  (detail.html)  — phone share sheet, copy-link fallback
//   #pollSection     (homepage + pillar pages)
//   #trendingSection (homepage)
// Card share buttons are added by attachSaveButton() in detail-link.js.

(function(){
  const REACTIONS = [
    { key: 'fire',  emoji: '🔥', label: 'Fire' },
    { key: 'laugh', emoji: '😂', label: 'Funny' },
    { key: 'mind',  emoji: '🤯', label: 'Mind blown' }
  ];
  const MINE_KEY = 'ns-reactions';
  const VOTES_KEY = 'ns-poll-votes';

  const store = {
    read(key){ try{ return JSON.parse(localStorage.getItem(key)) || {}; }catch{ return {}; } },
    write(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch{ /* optional */ } }
  };

  async function sha256(text){
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // A story's identity is its source URL when it has one (stable across
  // re-fetches), otherwise its title within its pillar.
  function storyKeyFromParams(params){
    const url = params.get('url');
    if(url) return 'url:' + url;
    return 'title:' + (params.get('pillar') || '') + '|' + (params.get('title') || '');
  }

  function storyIdFromHref(href){
    try{
      const params = new URL(href, location.href).searchParams;
      if(!params.get('title')) return Promise.resolve(null);
      return sha256(storyKeyFromParams(params));
    }catch{ return Promise.resolve(null); }
  }

  // Stored hrefs are kept relative ("detail.html?…") so they work on any
  // domain the site is served from.
  function relativeDetailHref(href){
    try{
      const u = new URL(href, location.href);
      return u.pathname.replace(/^.*\//, '') + u.search;
    }catch{ return ''; }
  }

  function send(id, reaction, action, meta){
    return fetch('/api/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reaction, action, meta }),
      keepalive: true
    }).then(r => r.ok ? r.json() : null).catch(() => null);
  }

  // ---------- Share ----------
  async function share({ title, url }, button){
    const absolute = new URL(url, location.href).href;
    if(navigator.share){
      try{ await navigator.share({ title, text: title, url: absolute }); return; }
      catch(err){ if(err && err.name === 'AbortError') return; }
    }
    try{
      await navigator.clipboard.writeText(absolute);
      flash(button, 'Link copied');
    }catch{
      flash(button, 'Copy failed');
    }
  }

  function flash(button, text){
    if(!button) return;
    const original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = text;
    setTimeout(() => { button.textContent = original; }, 1800);
  }

  function attachCardShare(card, item){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'share-btn';
    btn.setAttribute('aria-label', 'Share');
    btn.title = 'Share';
    btn.textContent = '↗';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      share({ title: item.title, url: item.href }, null);
    });
    card.appendChild(btn);
  }

  // ---------- Saves feed trending too ----------
  async function trackSave(item, saved){
    const id = await storyIdFromHref(item.href);
    if(!id) return;
    send(id, 'save', saved ? 'add' : 'remove', {
      title: item.title, pillar: item.pillar, href: relativeDetailHref(item.href), imageUrl: item.imageUrl || ''
    });
  }

  // ---------- Reactions (detail page) ----------
  async function initReactions(){
    const bar = document.getElementById('reactionBar');
    if(!bar) return;
    const params = new URLSearchParams(location.search);
    const title = params.get('title');
    if(!title) return;

    const id = await sha256(storyKeyFromParams(params));
    const meta = {
      title,
      pillar: params.get('pillar') || '',
      href: 'detail.html' + location.search,
      imageUrl: params.get('imageUrl') || ''
    };
    const mine = store.read(MINE_KEY);
    let counts = { fire: 0, laugh: 0, mind: 0 };

    const buttons = REACTIONS.map(r => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reaction-btn';
      btn.dataset.reaction = r.key;
      btn.innerHTML = `<span class="reaction-emoji" aria-hidden="true">${r.emoji}</span><span class="reaction-count mono">0</span>`;
      btn.addEventListener('click', () => toggle(r.key));
      bar.appendChild(btn);
      return { r, btn };
    });

    function paint(){
      buttons.forEach(({ r, btn }) => {
        const on = !!mine[id]?.[r.key];
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.setAttribute('aria-label', `${r.label}: ${counts[r.key] || 0}`);
        btn.querySelector('.reaction-count').textContent = counts[r.key] || 0;
      });
    }

    async function toggle(key){
      const on = !mine[id]?.[key];
      mine[id] = { ...(mine[id] || {}), [key]: on };
      if(!on) delete mine[id][key];
      if(!Object.keys(mine[id]).length) delete mine[id];
      store.write(MINE_KEY, mine);
      counts[key] = Math.max(0, (counts[key] || 0) + (on ? 1 : -1));
      paint();
      if(on){
        const btn = buttons.find(b => b.r.key === key)?.btn;
        btn?.classList.remove('pop'); void btn?.offsetWidth; btn?.classList.add('pop');
      }
      const res = await send(id, key, on ? 'add' : 'remove', meta);
      if(res?.counts){ counts = res.counts; paint(); }
    }

    bar.hidden = false;
    paint();
    const res = await fetch(`/api/react?ids=${id}`).then(r => r.ok ? r.json() : null).catch(() => null);
    if(res?.counts?.[id]){ counts = res.counts[id]; paint(); }
  }

  function initDetailShare(){
    const btn = document.getElementById('shareDetailBtn');
    if(!btn) return;
    const title = new URLSearchParams(location.search).get('title');
    if(!title) return;
    btn.style.display = '';
    btn.addEventListener('click', () => share({ title, url: location.href }, btn));
  }

  // ---------- Polls ----------
  async function initPoll(){
    const section = document.getElementById('pollSection');
    if(!section) return;
    const page = (document.body.dataset.page || 'index.html').replace(/\.html$/, '');
    const poll = await fetch(`/api/poll?page=${encodeURIComponent(page)}`)
      .then(r => r.ok ? r.json() : null).catch(() => null);
    if(!poll) return;

    const votes = store.read(VOTES_KEY);
    const question = section.querySelector('#pollQuestion');
    const list = section.querySelector('#pollOptions');
    const note = section.querySelector('#pollNote');
    question.textContent = poll.question;

    function render(data){
      const voted = votes[data.id];
      list.innerHTML = '';
      list.classList.toggle('voted', voted !== undefined);
      data.options.forEach((label, i) => {
        const pct = data.total ? Math.round((data.counts[i] / data.total) * 100) : 0;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'poll-option' + (voted === i ? ' chosen' : '');
        btn.disabled = voted !== undefined;
        btn.style.setProperty('--pct', voted !== undefined ? pct + '%' : '0%');
        const text = document.createElement('span');
        text.className = 'poll-label';
        text.textContent = label;
        btn.appendChild(text);
        if(voted !== undefined){
          const p = document.createElement('span');
          p.className = 'poll-pct mono';
          p.textContent = pct + '%';
          btn.appendChild(p);
        }
        btn.addEventListener('click', () => vote(data, i));
        list.appendChild(btn);
      });
      note.textContent = voted !== undefined
        ? `${data.total} ${data.total === 1 ? 'vote' : 'votes'} so far`
        : 'Tap one to vote and see the results.';
    }

    async function vote(data, i){
      votes[data.id] = i;
      store.write(VOTES_KEY, votes);
      const optimistic = { ...data, counts: data.counts.slice(), total: data.total + 1 };
      optimistic.counts[i]++;
      render(optimistic);
      const res = await fetch('/api/poll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id, option: i })
      }).then(r => r.ok ? r.json() : null).catch(() => null);
      if(res) render(res);
    }

    render(poll);
    section.hidden = false;
  }

  // ---------- Trending (homepage) ----------
  async function initTrending(){
    const section = document.getElementById('trendingSection');
    const grid = document.getElementById('trendingGrid');
    if(!section || !grid) return;
    const data = await fetch('/api/trending?limit=6').then(r => r.ok ? r.json() : null).catch(() => null);
    const items = (data?.items || []).filter(i => i.title && /^detail\.html\?/.test(i.href));
    if(items.length < 3) return; // not enough activity yet to be worth a section

    grid.innerHTML = '';
    items.forEach((item, rank) => {
      const card = document.createElement('a');
      card.className = 'drop-card';
      card.href = item.href;
      const status = document.createElement('span');
      status.className = 'drop-status mono';
      status.textContent = `#${rank + 1} · ${item.pillar || 'NewSociety'}`;
      const h3 = document.createElement('h3');
      h3.textContent = item.title;
      card.append(status, h3);
      if(typeof attachCardImage === 'function') attachCardImage(card, item.imageUrl);
      if(typeof attachSaveButton === 'function'){
        attachSaveButton(card, { href: card.href, title: item.title, pillar: item.pillar, status: '', imageUrl: item.imageUrl || '' });
      }
      grid.appendChild(card);
    });
    section.hidden = false;
  }

  window.nsEngagement = { share, attachCardShare, trackSave };

  const start = () => { initReactions(); initDetailShare(); initPoll(); initTrending(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
