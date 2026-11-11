// Thank-you page (after any form): point new subscribers at this week's
// issue instead of another signup form, and make it easy to pass NewSociety on.
(function(){
  const card = document.getElementById('thanksLatest');
  if(card){
    fetch('/issues/issues.json').then(r => r.ok ? r.json() : []).then(list => {
      const latest = list && list[0];
      if(!latest) return;
      card.href = '/issues/' + latest.slug + '.html';
      document.getElementById('thanksLatestMeta').textContent = latest.issue;
      document.getElementById('thanksLatestHead').textContent = latest.head;
    }).catch(() => {});
  }

  const btn = document.getElementById('thanksShare');
  const status = document.getElementById('thanksShareStatus');
  if(!btn) return;
  btn.addEventListener('click', async () => {
    const data = { title: 'NewSociety', text: 'Culture moves fast. This keeps up: sports, anime, pop culture, fashion and music, plus one email every Sunday.', url: btn.dataset.url };
    if(navigator.share){
      try{ await navigator.share(data); return; }catch(e){ if(e && e.name === 'AbortError') return; }
    }
    try{
      await navigator.clipboard.writeText(data.url);
      if(status) status.textContent = 'Link copied. Send it to a friend.';
    }catch(e){
      if(status) status.textContent = data.url;
    }
  });
})();
