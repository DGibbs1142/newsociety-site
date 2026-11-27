/* Tonight's debate: renders the latest NewSociety debate and recent results
   into any [data-debate] block. Reads the live copy from the repo's `debates`
   branch (updated by the posting routine without a site deploy), falling back
   to the /debates.json bundled with the deploy. Values are set as text only. */
(function () {
  var LIVE = 'https://raw.githubusercontent.com/DGibbs1142/newsociety-site/debates/debates.json';
  var blocks = document.querySelectorAll('[data-debate]');
  if (!blocks.length) return;
  var NAMES = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', x: 'X' };

  function get(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  function safeUrl(u) { return typeof u === 'string' && /^https:\/\//.test(u) ? u : null; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function render(block, d) {
    var L = d && d.latest;
    if (!L || !L.title) return;
    var body = block.querySelector('.debate-body');
    body.replaceChildren();
    body.append(el('span', 'debate-series mono', [L.series, L.pillar].filter(Boolean).join(' · ')));
    body.append(el('h3', 'debate-title', L.title));
    if (L.question) body.append(el('p', 'debate-q', L.question));
    var actions = el('div', 'debate-actions');
    ['tiktok', 'instagram', 'youtube', 'x'].forEach(function (k) {
      var u = safeUrl(L.links && L.links[k]);
      if (!u) return;
      var a = el('a', 'btn ' + (actions.children.length ? 'btn-ghost' : 'btn-primary'), (actions.children.length ? '' : 'Vote on ') + NAMES[k]);
      a.href = u; a.target = '_blank'; a.rel = 'noopener';
      actions.append(a);
    });
    if (actions.children.length) body.append(actions);
    if (L.vote) body.append(el('p', 'debate-vote mono', L.vote));
    var res = Array.isArray(d.results) ? d.results.slice(0, 3) : [];
    var list = block.querySelector('.debate-results');
    if (list) {
      list.replaceChildren();
      res.forEach(function (r) {
        if (!r || !r.title) return;
        var li = el('li');
        li.append(el('span', 'mono debate-res-series', r.series || 'Result'));
        li.append(el('span', 'debate-res-title', r.title));
        li.append(el('strong', 'debate-res-winner', r.summary || r.winner || ''));
        list.append(li);
      });
      list.hidden = !list.children.length;
      var head = block.querySelector('.debate-results-head');
      if (head) head.hidden = list.hidden;
      var empty = block.querySelector('.debate-side-empty');
      if (empty) empty.hidden = !list.hidden;
    }
    block.hidden = false;
  }
  get(LIVE).catch(function () { return get('/debates.json'); })
    .then(function (d) { blocks.forEach(function (b) { render(b, d); }); })
    .catch(function () { /* leave the block hidden */ });
})();
