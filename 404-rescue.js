// Runs on the 404 page only. Links shared on social often arrive cut short
// ("/stories/issue-05-new-y") or with junk pasted on the end ("...html)").
// When the broken address still points clearly at one story, issue or page,
// send the visitor there; when it could be a few, list them.
(function () {
  var path = decodeURIComponent(location.pathname).toLowerCase();
  var box = document.getElementById('rescue');
  // Strip a (possibly partial) .html ending and trailing punctuation.
  var clean = function (s) { return s.replace(/\.h?t?m?l?$/, '').replace(/[^a-z0-9]+$/, ''); };
  var go = function (url) { location.replace(url + location.search + location.hash); };
  var pick = function (given, slugs) {
    if (given.length < 3) return [];
    var exact = slugs.filter(function (s) { return s === given; });
    if (exact.length) return exact;
    // Cut-off links: the slug starts with what arrived. Padded links: what
    // arrived starts with the slug (longest wins, so issue-07 beats issue-0).
    var cut = slugs.filter(function (s) { return s.indexOf(given) === 0; });
    if (cut.length) return cut;
    return slugs.filter(function (s) { return given.indexOf(s) === 0; })
      .sort(function (a, b) { return b.length - a.length; }).slice(0, 1);
  };
  var offer = function (items) {
    if (!box || !items.length) return;
    box.innerHTML = '<p class="rescue-lead mono">Were you looking for one of these?</p><div class="story-more-grid"></div>';
    var grid = box.querySelector('.story-more-grid');
    items.slice(0, 6).forEach(function (it) {
      var a = document.createElement('a');
      a.className = 'story-more-card';
      a.href = it.url;
      if (it.color) a.style.setProperty('--tag', it.color);
      var meta = document.createElement('span');
      meta.className = 'story-more-meta mono';
      meta.textContent = it.meta;
      var head = document.createElement('span');
      head.className = 'story-more-head';
      head.textContent = it.head;
      a.append(meta, head);
      grid.append(a);
    });
    box.hidden = false;
  };

  var m = path.match(/^\/(stories|issues)\/([^/]+)\/?$/);
  if (m) {
    var dir = m[1], given = clean(m[2]);
    // "/stories/issue-07" is a whole issue, not one of its stories.
    if (dir === 'stories' && /^issue-\d+$/.test(given)) { dir = 'issues'; }
    fetch('/' + dir + '/' + dir + '.json').then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        var hits = pick(given, list.map(function (s) { return s.slug; }));
        if (hits.length === 1) return go('/' + dir + '/' + hits[0] + '.html');
        offer(list.filter(function (s) { return hits.indexOf(s.slug) > -1; }).map(function (s) {
          return { url: '/' + dir + '/' + s.slug + '.html', meta: dir === 'issues' ? s.issue : s.tag + ' · ' + s.issue, head: s.head, color: s.color };
        }));
      }).catch(function () {});
    return;
  }
  var page = path.match(/^\/([^/]+)\/?$/);
  if (page) {
    var pages = ['sports', 'anime', 'pop-culture', 'fashion', 'music', 'current-events', 'newsletter',
      'links', 'live', 'about', 'faq', 'press', 'get-involved', 'careers', 'search', 'saved'];
    var aliases = { news: 'current-events', events: 'current-events', home: 'index', newsletters: 'newsletter' };
    var want = clean(page[1]);
    if (aliases[want]) return go('/' + aliases[want] + '.html');
    var hit = pick(want, pages);
    if (hit.length === 1) go('/' + hit[0] + '.html');
  }
})();
