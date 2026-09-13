// Renders whatever's in the localStorage "saved" list (see attachSaveButton
// / getSavedItems in detail-link.js) as a normal drops-grid. No fetch of any
// kind — everything needed to redisplay a saved item was captured at
// save-time, which is also why this page works fully offline.

function renderSaved(){
  const grid = document.getElementById('savedGrid');
  const empty = document.getElementById('savedEmpty');
  const count = document.getElementById('savedCount');
  if(!grid) return;

  const items = getSavedItems();
  grid.innerHTML = '';

  if(count) count.textContent = items.length ? `${items.length} saved` : 'Nothing saved yet.';

  if(!items.length){
    grid.style.display = 'none';
    if(empty) empty.style.display = '';
    return;
  }

  grid.style.display = '';
  if(empty) empty.style.display = 'none';

  items.forEach(item => {
    const card = document.createElement('a');
    card.className = 'drop-card';
    card.href = item.href;

    const status = document.createElement('span');
    status.className = 'drop-status mono';
    status.textContent = item.status || item.pillar || '';

    const h4 = document.createElement('h3');
    h4.textContent = item.title || 'Untitled';

    card.append(status, h4);
    attachCardImage(card, item.imageUrl);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'save-btn saved';
    removeBtn.textContent = '★';
    removeBtn.setAttribute('aria-label', 'Remove from saved');
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSavedItem(item);
      renderSaved();
    });
    card.appendChild(removeBtn);

    grid.appendChild(card);
  });
}

renderSaved();
