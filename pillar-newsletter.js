// "From the newsletter" card on each pillar page. Reads the same-origin
// newsletter archive, finds the newest issue with a block tagged for this
// page, and shows its headline and opening lines with a link to that issue.
// Stays hidden if the archive can't be read or has nothing for this pillar
// (Current events has never had a block), so it never shows an empty card.
// On the homepage the same archive read fills "This week's issue" instead:
// the newest issue's subject plus its first three stories.
async function readArchive(){
  const res = await fetch('/newsletter.html', { cache: 'no-cache' });
  if(!res.ok) return null;
  return new DOMParser().parseFromString(await res.text(), 'text/html');
}

(async function(){
  const section = document.getElementById('homeIssue');
  if(!section) return;
  try{
    const doc = await readArchive();
    const issue = doc && doc.querySelector('article.issue');
    if(!issue) return;
    const no = issue.querySelector('.issue-no')?.textContent.trim() || '';
    const date = issue.querySelector('.issue-date')?.textContent.trim() || '';
    const subject = issue.querySelector('.issue-subject')?.textContent.trim() || '';
    if(!subject) return;
    document.getElementById('homeIssueLead').href = 'newsletter.html#' + issue.id;
    document.getElementById('homeIssueMeta').textContent = [no, date].filter(Boolean).join(' · ');
    document.getElementById('homeIssueSubject').textContent = subject;
    const list = document.getElementById('homeIssueStories');
    [...issue.querySelectorAll('.nl-block')].slice(0, 3).forEach(b => {
      const a = document.createElement('a');
      a.className = 'story-more-card';
      a.href = b.querySelector('.nl-share')?.getAttribute('href') || ('newsletter.html#' + issue.id);
      const tag = (b.getAttribute('style') || '').match(/--tag:\s*(#[0-9a-fA-F]{3,8})/);
      if(tag) a.style.setProperty('--tag', tag[1]);
      const meta = document.createElement('span');
      meta.className = 'story-more-meta mono';
      meta.textContent = b.querySelector('.nl-tag')?.textContent.trim() || '';
      const head = document.createElement('span');
      head.className = 'story-more-head';
      head.textContent = b.querySelector('.nl-head')?.textContent.trim() || '';
      a.append(meta, head);
      list.appendChild(a);
    });
    section.hidden = false;
  }catch(e){ /* leave the section hidden */ }
})();

// Link-in-bio page (/links): the newest issue's first three stories as
// link buttons, so someone arriving from a social profile sees what we
// covered this week before the standing links.
(async function(){
  const section = document.getElementById('linksLatest');
  const list = document.getElementById('linksLatestList');
  if(!section || !list) return;
  try{
    const doc = await readArchive();
    const issue = doc && doc.querySelector('article.issue');
    if(!issue) return;
    const no = issue.querySelector('.issue-no')?.textContent.trim() || '';
    [...issue.querySelectorAll('.nl-block')].slice(0, 3).forEach(b => {
      const head = b.querySelector('.nl-head')?.textContent.trim();
      if(!head) return;
      const a = document.createElement('a');
      a.className = 'links-item links-item-story';
      a.href = '/' + (b.querySelector('.nl-share')?.getAttribute('href') || 'newsletter.html#' + issue.id);
      const label = document.createElement('span');
      label.className = 'links-item-label';
      label.textContent = head;
      const meta = document.createElement('span');
      meta.className = 'mono links-item-meta';
      meta.textContent = [b.querySelector('.nl-tag')?.textContent.trim(), no].filter(Boolean).join(' · ');
      a.append(label, meta);
      list.appendChild(a);
    });
    if(list.children.length) section.hidden = false;
  }catch(e){ /* leave the section hidden */ }
})();

(async function(){
  const section = document.getElementById('fromNewsletter');
  const card = document.getElementById('nlLatest');
  if(!section || !card) return;

  const page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  if(!page) return;

  try{
    const doc = await readArchive();
    if(!doc) return;

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
