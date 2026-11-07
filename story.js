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
