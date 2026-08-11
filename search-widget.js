// Shared keyword-search-with-pagination widget, used by Anime, Pop Culture,
// Fashion, and Current Events. Each page supplies its own fetchPage(query,
// page) that hits its own API and returns normalized card objects — this
// file just owns the form wiring, "load more" pagination, and card
// rendering (via buildDetailLink, so search results get the same on-site
// detail page + breakdown treatment as everything else).

function initSearchWidget({ formId, inputId, gridId, statusId, moreBtnId, fetchPage, resultsPerPage = 10 }){
  const form = document.getElementById(formId);
  if(!form) return;
  const input = document.getElementById(inputId);
  const grid = document.getElementById(gridId);
  const status = document.getElementById(statusId);
  const moreBtn = document.getElementById(moreBtnId);

  let query = '';
  let page = 1;
  let loading = false;

  function renderCard(card){
    const { from, pillar } = currentPillarInfo();
    // cardBody (if a fetcher provides one) is a short preview for the card
    // itself; the full `body` still goes to the detail page either way —
    // it's stripped out of the link data since detail.js never reads it.
    const { cardBody, ...linkData } = card;
    const el = document.createElement('a');
    el.className = 'drop-card';
    el.href = buildDetailLink({ ...linkData, from, pillar });

    const statusEl = document.createElement('span');
    statusEl.className = 'drop-status mono';
    statusEl.textContent = card.status || '';

    const h4 = document.createElement('h4');
    h4.textContent = card.title || 'Untitled';

    const p = document.createElement('p');
    p.textContent = cardBody || card.body || '';

    el.append(statusEl, h4, p);
    attachCardImage(el, card.imageUrl);
    attachSaveButton(el, { href: el.href, title: card.title || 'Untitled', pillar, status: card.status || '', imageUrl: card.imageUrl || '' });
    grid.appendChild(el);
  }

  async function loadMore(){
    if(loading || !query) return;
    loading = true;
    if(moreBtn) moreBtn.disabled = true;
    status.textContent = page === 1 ? 'Searching…' : 'Loading more…';

    try{
      const results = await fetchPage(query, page);

      if(page === 1){
        grid.innerHTML = '';
        if(!results.length){
          status.textContent = `No results for "${query}".`;
          grid.style.display = 'none';
          if(moreBtn) moreBtn.style.display = 'none';
          return;
        }
      }

      grid.style.display = '';
      results.forEach(renderCard);
      status.textContent = `Showing ${grid.children.length} result${grid.children.length === 1 ? '' : 's'} for "${query}".`;
      if(moreBtn) moreBtn.style.display = results.length >= resultsPerPage ? '' : 'none';
      page++;
    }catch(err){
      status.textContent = 'Search failed — try again.';
      console.warn('Search error:', err.message);
    }finally{
      loading = false;
      if(moreBtn) moreBtn.disabled = false;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if(!value) return;
    query = value;
    page = 1;
    loadMore();
  });

  if(moreBtn) moreBtn.addEventListener('click', loadMore);
}
