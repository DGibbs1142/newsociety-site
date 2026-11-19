#!/usr/bin/env python3
# Quick checks to run before every deploy:
#   python3 integrations/check-site.py [repo dir]
# Each deploy costs Netlify credits, and a broken one costs twice (the bad
# deploy, then the fix), so this catches the cheap mistakes first. It needs
# only Python and Node, no browser, and finishes in a few seconds.
#
#   1. Every internal link and #anchor in the site's pages points somewhere real.
#   2. Every browser script and the service worker parse as JavaScript.
#   3. The data files the pages read (stories, issues, manifest...) are valid JSON.
#   4. netlify.toml parses.
#   5. Every page has a <title>, exactly one <h1>, and the analytics beacon.
#   6. sw.js has a CACHE_VERSION, and it was bumped if CSS/JS changed since the
#      last commit on origin/main (only checked when git can tell).
#
# Exits 1 and lists the problems if anything fails, 0 if all is well.
import glob, json, os, re, subprocess, sys, tomllib, urllib.parse

REPO = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
os.chdir(REPO)
problems = []

pages = sorted(glob.glob('*.html') + glob.glob('stories/*.html') + glob.glob('issues/*.html'))
# Utility pages that aren't meant to be full, analytics-tracked site pages.
SKIP_PAGE_RULES = {'offline.html', 'admin-push.html'}
SKIP_PAGE_RULES |= {p for p in pages if re.fullmatch(r'google[0-9a-f]+\.html', p)}

# 1. Links and anchors
ids = {p: set(re.findall(r'\bid="([^"]+)"', open(p, encoding='utf-8').read())) for p in pages}
for p in pages:
    for ref in re.findall(r'(?:href|src)="([^"]+)"', open(p, encoding='utf-8').read()):
        if re.match(r'(https?:|mailto:|tel:|data:|javascript:|#$)', ref) or '${' in ref:
            continue
        u = urllib.parse.urlparse(ref)
        if not u.path:
            if u.fragment and u.fragment not in ids[p]:
                problems.append('%s: anchor #%s is not on the page' % (p, u.fragment))
            continue
        target = u.path.lstrip('/') if u.path.startswith('/') else os.path.normpath(os.path.join(os.path.dirname(p), u.path))
        if target in ('', '.') or target.endswith('/'):
            target = os.path.join(target, 'index.html')
        if not (os.path.exists(target) or os.path.exists(target + '.html')):
            problems.append('%s: link to missing %s' % (p, ref))
        elif u.fragment and target in ids and u.fragment not in ids[target]:
            problems.append('%s: %s has no #%s' % (p, target, u.fragment))

# 2. JavaScript syntax
for js in sorted(glob.glob('*.js')):
    r = subprocess.run(['node', '--check', js], capture_output=True, text=True)
    if r.returncode:
        err = [l for l in r.stderr.splitlines() if 'Error' in l] or ['syntax error']
        problems.append('%s: %s' % (js, err[0].strip()))

# 3. JSON data
for f in ['stories/stories.json', 'issues/issues.json', 'manifest.webmanifest',
          'integrations/google-sheets/story-updates.json']:
    if os.path.exists(f):
        try:
            json.load(open(f, encoding='utf-8'))
        except ValueError as e:
            problems.append('%s: invalid JSON (%s)' % (f, e))

# 4. netlify.toml
try:
    tomllib.load(open('netlify.toml', 'rb'))
except Exception as e:
    problems.append('netlify.toml: %s' % e)

# 5. Page basics
for p in pages:
    if p in SKIP_PAGE_RULES:
        continue
    s = open(p, encoding='utf-8').read()
    if not re.search(r'<title>[^<]+</title>', s):
        problems.append('%s: no <title>' % p)
    h1 = len(re.findall(r'<h1[\s>]', s))
    if h1 != 1:
        problems.append('%s: %d <h1> elements (expected 1)' % (p, h1))
    if 'cloudflareinsights.com/beacon' not in s:
        problems.append('%s: missing the analytics beacon' % p)

# 6. Service worker cache version
sw = open('sw.js', encoding='utf-8').read()
m = re.search(r"CACHE_VERSION\s*=\s*'([^']+)'", sw)
if not m:
    problems.append('sw.js: no CACHE_VERSION')
else:
    try:
        changed = subprocess.run(['git', 'diff', '--name-only', 'origin/main', '--'],
                                 capture_output=True, text=True, check=True).stdout.split()
        assets = [f for f in changed if f.endswith(('.css', '.js')) and f != 'sw.js' and '/' not in f]
        if assets and 'sw.js' not in changed:
            problems.append('sw.js: %s changed but CACHE_VERSION was not bumped' % ', '.join(assets))
    except Exception:
        pass  # no git or no origin/main: skip this one

problems = list(dict.fromkeys(problems))  # same broken link twice on a page: list it once
print('Checked %d pages, %d scripts.' % (len(pages), len(glob.glob('*.js'))))
if problems:
    print('%d problem(s):' % len(problems))
    for line in problems:
        print('  - ' + line)
    sys.exit(1)
print('All good: safe to deploy.')
