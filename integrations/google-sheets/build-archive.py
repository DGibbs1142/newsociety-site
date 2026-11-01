# Renders newsletter.html from the issues recovered out of Code.gs history.
# Re-run after writing a new issue; it is the whole page, not a patch.
import json, html, io, re, sys

SP, REPO = sys.argv[1], sys.argv[2]
issues = json.load(open(SP + '/issues.json'))
issues.sort(key=lambda i: i['number'], reverse=True)

def esc(s): return html.escape(s, quote=False)
def headline(subject): return re.sub(r'^The Week in Culture\s*[—-]\s*', '', subject)
def num(n): return '%02d' % n

SHELL_HEAD = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="theme-init.js"></script>
<title>The Week in Culture — NewSociety</title>
<meta name="description" content="Every issue of The Week in Culture, the NewSociety newsletter: one email every Sunday on sports, anime, pop culture, fashion and music. Read them all, then join the list.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="NewSociety">
<meta property="og:url" content="https://newsociety.netlify.app/newsletter.html">
<link rel="canonical" href="https://newsociety.netlify.app/newsletter.html">
<meta property="og:title" content="The Week in Culture — NewSociety">
<meta property="og:description" content="Every issue of the NewSociety newsletter. One email every Sunday on sports, anime, pop culture, fashion and music.">
<meta property="og:image" content="https://newsociety.netlify.app/icons/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="NewSociety — Culture moves fast. We move faster.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="The Week in Culture — NewSociety">
<meta name="twitter:description" content="Every issue of the NewSociety newsletter. One email every Sunday on sports, anime, pop culture, fashion and music.">
<meta name="twitter:image" content="https://newsociety.netlify.app/icons/og-image.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" media="print" data-font>
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"></noscript>
<link rel="stylesheet" href="styles.css">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0a0a0c">
<link rel="icon" href="icons/icon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="icons/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="icons/icon-180.png">
</head>
<body data-page="newsletter.html">
<a class="skip-link" href="#main">Skip to content</a>
'''

NAV = io.open(REPO + '/press.html', encoding='utf-8').read()
NAV = NAV[NAV.index('<header class="nav">'):NAV.index('</header>') + len('</header>')]

FOOT = io.open(REPO + '/press.html', encoding='utf-8').read()
FOOT = FOOT[FOOT.index('<footer>'):]

parts = [SHELL_HEAD, NAV, '''
<main id="main">

<section class="page-hero">
  <div class="wrap">
    <a href="index.html" class="breadcrumb">&larr; Back to NewSociety</a>
    <div class="eyebrow"><span class="live-dot"></span>The Week in Culture</div>
    <h1 class="page-title display">Every issue. Free.</h1>
    <p class="page-sub">One email every Sunday on sports, anime, pop culture, fashion and music &mdash; the handful of stories that actually mattered, written like someone watched them happen. Read the whole run below, then decide.</p>
  </div>
</section>

<section class="wrap nl-join">
  <div class="nl-join-inner">
    <div>
      <div class="section-label">// the list</div>
      <p class="nl-join-copy">Next issue lands Sunday. No filler, no daily firehose, nothing you have to keep up with.</p>
    </div>
    <form class="signup-form" name="newsletter" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field">
      <input type="hidden" name="form-name" value="newsletter">
      <p class="hp-field"><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <label for="nl-join-email" class="visually-hidden">Email address</label>
      <input id="nl-join-email" type="email" name="email" placeholder="you@email.com" autocomplete="email" required>
      <button type="submit" class="btn btn-primary">Get Sunday&rsquo;s issue &rarr;</button>
    </form>
  </div>
</section>

<section class="wrap nl-archive">
  <div class="section-label">// the archive</div>
  <nav class="nl-index mono" aria-label="Jump to an issue">
''']

for i in issues:
    parts.append('    <a href="#issue-%s">Issue %s<span>%s</span></a>\n'
                 % (num(i['number']), num(i['number']),
                    esc(i['dateline'].replace('Sunday, ', '').rsplit(',', 1)[0])))

parts.append('  </nav>\n\n')

for i in issues:
    n = num(i['number'])
    parts.append('''  <article class="issue" id="issue-%s">
    <header class="issue-head">
      <span class="mono issue-no">Issue %s</span>
      <span class="mono issue-date">%s</span>
    </header>
    <h2 class="display issue-subject">%s</h2>
    <p class="issue-intro">%s</p>
    <div class="issue-blocks">
''' % (n, n, esc(i['dateline']), esc(headline(i['subject'])), esc(i['intro'])))

    for b in i['blocks']:
        # --tag goes on the block, not the tag link: the coloured left rule is
        # drawn by the parent, and a custom property set on a child does not
        # travel back up to it.
        parts.append('''      <section class="nl-block" style="--tag:%s">
        <a class="nl-tag mono" href="%s">%s</a>
        <h3 class="nl-head">%s</h3>
        <p class="nl-body">%s</p>
      </section>
''' % (esc(b['color']), esc(b['page']), esc(b['tag']), esc(b['head']), esc(b['body'])))

    parts.append('    </div>\n  </article>\n\n')

parts.append('''</section>

</main>

''')
parts.append(FOOT)

io.open(REPO + '/newsletter.html', 'w', encoding='utf-8').write(''.join(parts))
print('wrote newsletter.html — %d issues, %d blocks'
      % (len(issues), sum(len(i['blocks']) for i in issues)))
