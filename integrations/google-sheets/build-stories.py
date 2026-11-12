# Writes one page per newsletter story into stories/, from newsletter.html,
# and lists them in sitemap.xml. Each page has its own title, summary and
# pillar share image, so a single story can be posted as a link. Pages for
# stories no longer in the archive are removed. build-archive.py runs this
# after it rewrites newsletter.html; it can also be run on its own:
#   python3 integrations/google-sheets/build-stories.py <repo dir>
import glob, hashlib, html, io, json, os, re, sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from newsletter_lib import parse_archive, story_slugs

REPO = sys.argv[1] if len(sys.argv) > 1 else '.'
SITE = 'https://newsociety.netlify.app/'
PILLAR_IMAGES = {'sports', 'anime', 'pop-culture', 'fashion', 'music', 'current-events'}

page = io.open(os.path.join(REPO, 'newsletter.html'), encoding='utf-8').read()
issues = parse_archive(page)

# Shell pieces come from the live newsletter page so fonts, scripts and
# security settings always match the rest of the site.
head = page[page.index('<head>') + len('<head>'):page.index('</head>')]
nav = page[page.index('<header class="nav">'):page.index('</header>') + len('</header>')]
foot = page[page.index('<footer>'):page.index('</footer>') + len('</footer>')]
# Cloudflare Web Analytics, copied from the newsletter page so story-page
# visits are counted like every other page's.
_cf = page.find('<!-- Cloudflare Web Analytics -->')
analytics = page[_cf:page.index('<!-- End Cloudflare Web Analytics -->', _cf) + len('<!-- End Cloudflare Web Analytics -->')] + '\n' if _cf != -1 else ''


def rooted(fragment):
    # Story pages live one folder down, so relative links in the shared
    # shell are made root-relative. Absolute, hash-only and mailto links stay.
    return re.sub(r'(\s(?:href|src)=")(?!https?:|/|#|mailto:|tel:|data:)([^"]*)"', r'\1/\2"', fragment)


def a(s):
    return html.escape(' '.join(s.split()), quote=True)


def t(s):
    return html.escape(' '.join(s.split()), quote=False)


def summary(body, n=200):
    body = ' '.join(body.split())
    return body if len(body) <= n else body[:body.rfind(' ', 0, n)] + '…'


def card_version(slug, folder='stories'):
    # Short fingerprint of a share card's bytes, added to its address
    # (?v=...). Browsers cache /icons/* for a week, so a redrawn card would
    # otherwise keep showing the old picture; a new fingerprint means a new
    # address, while unchanged cards keep theirs and stay cached.
    with open(os.path.join(REPO, 'icons', folder, slug + '.jpg'), 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:8]


def set_meta(h, attr, key, value):
    pat = r'(<meta %s="%s" content=")[^"]*(">)' % (attr, re.escape(key))
    return re.sub(pat, lambda m: m.group(1) + value + m.group(2), h)


stories = [(i, b) for i in issues for b in i['blocks']]
slugs = story_slugs([(re.sub(r'\D', '', i['no']) or 0, b['head']) for i, b in stories])
os.makedirs(os.path.join(REPO, 'stories'), exist_ok=True)
written = set()


def related(idx, n=3):
    # Other stories from the same pillar, newest first (the archive is
    # already newest first); topped up from the same issue if there are
    # fewer than n.
    issue, b = stories[idx]
    same = [k for k, (_, ob) in enumerate(stories) if k != idx and ob['page'] == b['page']]
    issue_mates = [k for k, (oi, _) in enumerate(stories) if k != idx and oi is issue and k not in same]
    return (same + issue_mates)[:n]


def related_html(idx):
    items = related(idx)
    if not items:
        return ''
    cards = ''.join('''      <a class="story-more-card" href="/stories/%s.html" style="--tag:%s">
        <span class="story-more-meta mono">%s &middot; %s</span>
        <span class="story-more-head">%s</span>
      </a>
''' % (slugs[k], a(stories[k][1]['color'] or '#6e56ff'), t(stories[k][1]['tag']), t(stories[k][0]['no']),
       t(stories[k][1]['head'])) for k in items)
    return '''    <section class="story-more" aria-labelledby="storyMoreTitle">
      <h2 class="section-label" id="storyMoreTitle">// more from the newsletter</h2>
      <div class="story-more-grid">
%s      </div>
    </section>
''' % cards

for idx, ((issue, b), slug) in enumerate(zip(stories, slugs)):
    pillar = b['page'].replace('.html', '').strip('/')
    # A per-story card (headline on it) when build-story-images.mjs has made
    # one, otherwise the pillar's card.
    if os.path.exists(os.path.join(REPO, 'icons', 'stories', slug + '.jpg')):
        image = SITE + 'icons/stories/%s.jpg?v=%s' % (slug, card_version(slug))
    else:
        image = SITE + 'icons/og-%s.png' % (pillar if pillar in PILLAR_IMAGES else 'newsletter')
    url = SITE + 'stories/%s.html' % slug
    title = '%s — NewSociety' % ' '.join(b['head'].split())
    desc = summary(b['body'], 160)
    published = datetime.strptime(issue['date'].strip(), '%A, %B %d, %Y').strftime('%Y-%m-%d')

    h = head
    h = re.sub(r'<title>.*?</title>', '<title>%s</title>' % t(title), h, flags=re.S)
    h = set_meta(h, 'name', 'description', a(desc))
    h = set_meta(h, 'property', 'og:type', 'article')
    h = set_meta(h, 'property', 'og:url', url)
    h = set_meta(h, 'property', 'og:title', a(title))
    h = set_meta(h, 'property', 'og:description', a(desc))
    h = set_meta(h, 'property', 'og:image', image)
    h = set_meta(h, 'property', 'og:image:alt', a('NewSociety %s' % b['tag']))
    h = set_meta(h, 'name', 'twitter:title', a(title))
    h = set_meta(h, 'name', 'twitter:description', a(desc))
    h = set_meta(h, 'name', 'twitter:image', image)
    h = set_meta(h, 'name', 'twitter:image:alt', a('NewSociety %s' % b['tag']))
    h = re.sub(r'(<link rel="canonical" href=")[^"]*', lambda m: m.group(1) + url, h)
    ld = {
        '@context': 'https://schema.org', '@type': 'NewsArticle',
        'headline': ' '.join(b['head'].split()), 'description': desc,
        'datePublished': published, 'image': image, 'url': url,
        'isPartOf': {'@type': 'PublicationIssue', 'issueNumber': re.sub(r'\D', '', issue['no']),
                     'url': SITE + 'issues/%s.html' % issue['id']},
        'publisher': {'@type': 'NewsMediaOrganization', 'name': 'NewSociety', 'url': SITE,
                      'logo': SITE + 'icons/icon-512.png'},
    }
    h = h.rstrip() + '\n<script type="application/ld+json">%s</script>\n' % json.dumps(ld, ensure_ascii=False)

    body = '''<body data-page="newsletter.html">
<a class="skip-link" href="#main">Skip to content</a>
%s

<main id="main">
<article class="story" style="--tag:%s">
  <div class="wrap story-wrap">
    <a href="/issues/%s.html" class="breadcrumb">&larr; %s &middot; %s</a>
    <a class="nl-tag mono story-tag" href="/%s">%s</a>
    <h1 class="story-title">%s</h1>
    <p class="story-body">%s</p>
    <div class="story-actions">
      <button type="button" class="btn btn-primary" id="storyShare" data-title="%s" data-url="%s">Share this story</button>
      <a class="btn btn-ghost" href="/issues/%s.html">Read the full issue</a>
      <a class="btn btn-ghost" href="/%s">More %s</a>
    </div>
    <p class="story-status mono" id="storyShareStatus" aria-live="polite"></p>
    <div class="story-signup">
      <p class="story-signup-copy"><strong>Get stories like this every Sunday.</strong> The Week in Culture is one email with the handful of stories that actually mattered.</p>
      <form class="signup-form" name="newsletter" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field">
        <input type="hidden" name="form-name" value="newsletter">
        <p class="hp-field"><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
        <label for="story-signup-email" class="visually-hidden">Email address</label>
        <input id="story-signup-email" type="email" name="email" placeholder="you@email.com" autocomplete="email" required>
        <button type="submit" class="btn btn-primary">Get Sunday’s issue →</button>
      </form>
    </div>
%s  </div>
</article>
</main>

%s
<script src="/story.js" defer></script>
<script src="/site.js" defer></script>
%s</body>
</html>
''' % (rooted(nav), a(b['color'] or '#6e56ff'), issue['id'], t(issue['no']), t(issue['date']),
       a(b['page'].lstrip('/')), t(b['tag']), t(b['head']), t(b['body']),
       a(' '.join(b['head'].split())), url, issue['id'], a(b['page'].lstrip('/')), t(b['tag'].lower()),
       related_html(idx), rooted(foot), analytics)

    out = '<!DOCTYPE html>\n<html lang="en">\n<head>%s</head>\n%s' % (rooted(h), body)
    io.open(os.path.join(REPO, 'stories', slug + '.html'), 'w', encoding='utf-8').write(out)
    written.add(slug + '.html')

# Manifest the image script reads (it can't parse the archive itself).
# Also read by global-search.js, which matches queries against head + body.
def story_image(slug, b):
    if os.path.exists(os.path.join(REPO, 'icons', 'stories', slug + '.jpg')):
        return '/icons/stories/%s.jpg?v=%s' % (slug, card_version(slug))
    pillar = b['page'].replace('.html', '').strip('/')
    return '/icons/og-%s.png' % (pillar if pillar in PILLAR_IMAGES else 'newsletter')


manifest = [{'slug': slug, 'tag': b['tag'].strip(), 'head': ' '.join(b['head'].split()),
             'body': ' '.join(b['body'].split()), 'image': story_image(slug, b),
             'color': b['color'] or '#6e56ff', 'issue': '%s · %s' % (i['no'].strip(), i['date'].strip())}
            for (i, b), slug in zip(stories, slugs)]
io.open(os.path.join(REPO, 'stories', 'stories.json'), 'w', encoding='utf-8').write(
    json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')

for old in glob.glob(os.path.join(REPO, 'stories', '*.html')):
    if os.path.basename(old) not in written:
        os.remove(old)

# ---- One page per issue (issues/<issue-id>.html) ----
# A shareable home for a whole issue: its subject, intro and stories (each
# linking to its story page), with its own share card (icons/issues/, made by
# build-story-images.mjs from issues/issues.json).
os.makedirs(os.path.join(REPO, 'issues'), exist_ok=True)
issue_manifest = []
issue_written = set()
slug_of = {id(b): slug for (i, b), slug in zip(stories, slugs)}
ISSUE_CARD = """      <a class="story-more-card" href="/stories/%s.html" style="--tag:%s">
        <span class="story-more-meta mono">%s</span>
        <span class="story-more-head">%s</span>
      </a>
"""
ISSUE_BODY = """<body data-page="newsletter.html">
<a class="skip-link" href="#main">Skip to content</a>
%s

<main id="main">
<article class="story issue-page">
  <div class="wrap story-wrap">
    <a href="/newsletter.html" class="breadcrumb">&larr; The Week in Culture</a>
    <span class="nl-tag mono story-tag">%s &middot; %s</span>
    <h1 class="story-title">%s</h1>
    <p class="story-body">%s</p>
    <div class="story-more-grid issue-stories">
%s    </div>
    <div class="story-actions">
      <button type="button" class="btn btn-primary" id="storyShare" data-title="%s" data-url="%s">Share this issue</button>
      <a class="btn btn-ghost" href="/newsletter.html">All issues</a>
    </div>
    <p class="story-status mono" id="storyShareStatus" aria-live="polite"></p>
    <div class="story-signup">
      <p class="story-signup-copy"><strong>Get stories like this every Sunday.</strong> The Week in Culture is one email with the handful of stories that actually mattered.</p>
      <form class="signup-form" name="newsletter" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field">
        <input type="hidden" name="form-name" value="newsletter">
        <p class="hp-field"><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
        <label for="story-signup-email" class="visually-hidden">Email address</label>
        <input id="story-signup-email" type="email" name="email" placeholder="you@email.com" autocomplete="email" required>
        <button type="submit" class="btn btn-primary">Get Sunday’s issue →</button>
      </form>
    </div>
%s  </div>
</article>
</main>

%s
<script src="/story.js" defer></script>
<script src="/site.js" defer></script>
%s</body>
</html>
"""
ISSUE_STEP = """      <a class="issue-step issue-step-%s" href="/issues/%s.html" rel="%s">
        <span class="story-more-meta mono">%s</span>
        <span class="story-more-head">%s</span>
      </a>
"""


def issue_steps(k):
    """Older and newer issue links for issues[k] (issues run newest first)."""
    out = ''
    for j, side, rel, label in ((k + 1, 'older', 'prev', '&larr; Older'), (k - 1, 'newer', 'next', 'Newer &rarr;')):
        if 0 <= j < len(issues):
            o = issues[j]
            subj = ' '.join(o['subject'].split())
            no = t(o['no'].strip())
            meta = '%s &middot; %s' % (label, no) if side == 'older' else '%s &middot; %s' % (no, label)
            out += ISSUE_STEP % (side, o['id'], rel, meta,
                                 t(subj[:1].upper() + subj[1:]))
    return '    <nav class="issue-steps" aria-label="More issues">\n%s    </nav>\n' % out if out else ''


for k, issue in enumerate(issues):
    iid = issue['id']
    subject = ' '.join(issue['subject'].split())
    nice = subject[:1].upper() + subject[1:]
    url = SITE + 'issues/%s.html' % iid
    title = 'The Week in Culture, %s: %s — NewSociety' % (issue['no'].strip(), nice)
    desc = summary(issue['intro'], 160)
    published = datetime.strptime(issue['date'].strip(), '%A, %B %d, %Y').strftime('%Y-%m-%d')
    if os.path.exists(os.path.join(REPO, 'icons', 'issues', iid + '.jpg')):
        image = SITE + 'icons/issues/%s.jpg?v=%s' % (iid, card_version(iid, 'issues'))
    else:
        image = SITE + 'icons/og-newsletter.png'
    alt = 'The Week in Culture, %s' % issue['no'].strip()
    h = head
    h = re.sub(r'<title>.*?</title>', '<title>%s</title>' % t(title), h, flags=re.S)
    for attr, key, val in (('name', 'description', a(desc)), ('property', 'og:type', 'article'),
                           ('property', 'og:url', url), ('property', 'og:title', a(title)),
                           ('property', 'og:description', a(desc)), ('property', 'og:image', image),
                           ('property', 'og:image:alt', a(alt)), ('name', 'twitter:title', a(title)),
                           ('name', 'twitter:description', a(desc)), ('name', 'twitter:image', image),
                           ('name', 'twitter:image:alt', a(alt))):
        h = set_meta(h, attr, key, val)
    h = re.sub(r'(<link rel="canonical" href=")[^"]*', lambda m: m.group(1) + url, h)
    ld = {'@context': 'https://schema.org', '@type': 'PublicationIssue',
          'issueNumber': re.sub(r'\D', '', issue['no']), 'name': title, 'description': desc,
          'datePublished': published, 'image': image, 'url': url,
          'isPartOf': {'@type': 'Periodical', 'name': 'The Week in Culture', 'url': SITE + 'newsletter.html'},
          'publisher': {'@type': 'NewsMediaOrganization', 'name': 'NewSociety', 'url': SITE,
                        'logo': SITE + 'icons/icon-512.png'}}
    h = h.rstrip() + '\n<script type="application/ld+json">%s</script>\n' % json.dumps(ld, ensure_ascii=False)
    cards = ''.join(ISSUE_CARD % (slug_of[id(b)], a(b['color'] or '#6e56ff'), t(b['tag']), t(b['head']))
                    for b in issue['blocks'])
    body = ISSUE_BODY % (rooted(nav), t(issue['no']), t(issue['date']), t(nice), t(issue['intro']), cards,
                         a(title.replace(' — NewSociety', '')), url, issue_steps(k), rooted(foot), analytics)
    out = '<!DOCTYPE html>\n<html lang="en">\n<head>%s</head>\n%s' % (rooted(h), body)
    io.open(os.path.join(REPO, 'issues', iid + '.html'), 'w', encoding='utf-8').write(out)
    issue_written.add(iid + '.html')
    issue_manifest.append({'slug': iid, 'tag': 'The Week in Culture', 'head': nice, 'color': '#6e56ff',
                           'issue': '%s · %s' % (issue['no'].strip(), issue['date'].strip())})

io.open(os.path.join(REPO, 'issues', 'issues.json'), 'w', encoding='utf-8').write(
    json.dumps(issue_manifest, ensure_ascii=False, indent=1) + '\n')
for old in glob.glob(os.path.join(REPO, 'issues', '*.html')):
    if os.path.basename(old) not in issue_written:
        os.remove(old)

# Sitemap: replace the generated block, or add it before </urlset>.
sm_path = os.path.join(REPO, 'sitemap.xml')
sm = io.open(sm_path, encoding='utf-8').read()
entries = ''.join('''  <url>
    <loc>%sstories/%s.html</loc>
    <lastmod>%s</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>
''' % (SITE, slug, datetime.strptime(i['date'].strip(), '%A, %B %d, %Y').strftime('%Y-%m-%d'))
    for (i, _), slug in zip(stories, slugs))
issue_entries = ''.join('  <url>\n    <loc>%sissues/%s.html</loc>\n    <lastmod>%s</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.7</priority>\n  </url>\n'
                        % (SITE, i['id'], datetime.strptime(i['date'].strip(), '%A, %B %d, %Y').strftime('%Y-%m-%d')) for i in issues)
block = '  <!-- stories:start (generated by build-stories.py) -->\n%s%s  <!-- stories:end -->\n' % (issue_entries, entries)
if '<!-- stories:start' in sm:
    sm = re.sub(r'  <!-- stories:start.*?<!-- stories:end -->\n', lambda m: block, sm, flags=re.S)
else:
    sm = sm.replace('</urlset>', block + '</urlset>')
io.open(sm_path, 'w', encoding='utf-8').write(sm)

print('wrote %d story pages and %d issue pages' % (len(written), len(issue_written)))
