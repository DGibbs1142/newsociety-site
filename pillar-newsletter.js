// "From the newsletter" card on each pillar page. Reads the same-origin
// newsletter archive, finds the newest issue with a block tagged for this
// page, and shows its headline and opening lines with a link to that issue.
// Stays hidden if the archive can't be read or has nothing for this pillar
// (Current events has never had a block), so it never shows an empty card.
(async function(){
  const section = document.getElementById('fromNewsletter');
  const card = document.getElementById('nlLatest');
  if(!section || !card) return;

  const page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  if(!page) return;

  try{
    const res = await fetch('newsletter.html', { cache: 'no-cache' });
    if(!res.ok) return;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    for(const issue of doc.querySelectorAll('article.issue')){
      const block = [...issue.querySelectorAll('.nl-block')].find(b => {
        const href = b.querySelector('.nl-tag')?.getAttribute('href') || '';
        return href.replace(/^\//, '').replace(/\.html$/, '') === page;
      });
      if(!block) continue;

      const head = block.querySelector('.nl-head')?.textContent.trim() || '';
      const body = block.querySelector('.nl-body')?.textContent.trim() || '';
      if(!head) continue;

      const issueNo = issue.querySelector('.issue-no')?.textContent.trim() || 'The newsletter';
      const date = issue.querySelector('.issue-date')?.textContent.trim() || '';
      const tag = (block.getAttribute('style') || '').match(/--tag:\s*(#[0-9a-fA-F]{3,8})/);

      // Link to the story's own page when the archive has one, else the issue.
      card.href = block.querySelector('.nl-share')?.getAttribute('href') || ('newsletter.html#' + issue.id);
      if(tag) card.style.setProperty('--tag', tag[1]);
      card.querySelector('.nl-latest-meta').textContent = date ? `${issueNo} · ${date}` : issueNo;
      card.querySelector('.nl-latest-head').textContent = head;
      const cut = body.length > 240 ? body.slice(0, body.lastIndexOf(' ', 240)) + '…' : body;
      card.querySelector('.nl-latest-body').textContent = cut;
      section.hidden = false;
      return;
    }
  }catch(e){ /* leave the section hidden */ }
})();
