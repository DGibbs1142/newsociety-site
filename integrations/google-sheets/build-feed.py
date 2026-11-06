# Writes feed.xml (RSS 2.0) from newsletter.html, so the feed can never
# disagree with the archive page. build-archive.py runs this after it
# rewrites newsletter.html; it can also be run on its own:
#   python3 integrations/google-sheets/build-feed.py <repo dir>
import html, io, re, sys
from datetime import datetime, timezone
from email.utils import format_datetime
from html.parser import HTMLParser

REPO = sys.argv[1] if len(sys.argv) > 1 else '.'
SITE = 'https://newsociety.netlify.app/'


class Archive(HTMLParser):
    """Collects each <article class="issue"> and its .nl-block sections."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.issues, self.issue, self.block, self.field = [], None, None, None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get('class') or '').split()
        if tag == 'article' and 'issue' in cls:
            self.issue = {'id': a.get('id', ''), 'no': '', 'date': '', 'subject': '', 'intro': '', 'blocks': []}
        elif self.issue is None:
            return
        elif tag == 'section' and 'nl-block' in cls:
            self.block = {'tag': '', 'page': '', 'head': '', 'body': ''}
        elif self.block is not None and tag == 'a' and 'nl-tag' in cls:
            self.block['page'] = a.get('href', '')
            self.field = (self.block, 'tag')
        elif self.block is not None and 'nl-head' in cls:
            self.field = (self.block, 'head')
        elif self.block is not None and 'nl-body' in cls:
            self.field = (self.block, 'body')
        elif 'issue-no' in cls:
            self.field = (self.issue, 'no')
        elif 'issue-date' in cls:
            self.field = (self.issue, 'date')
        elif 'issue-subject' in cls:
            self.field = (self.issue, 'subject')
        elif 'issue-intro' in cls:
            self.field = (self.issue, 'intro')

    def handle_endtag(self, tag):
        if tag in ('a', 'span', 'h2', 'h3', 'p'):
            self.field = None
        if tag == 'section' and self.block is not None:
            self.issue['blocks'].append(self.block)
            self.block = None
        elif tag == 'article' and self.issue is not None:
            self.issues.append(self.issue)
            self.issue = None

    def handle_data(self, data):
        if self.field:
            obj, key = self.field
            obj[key] += data


def pub_date(dateline):
    # "Sunday, November 1, 2026" -> issues go out Sunday morning US time.
    d = datetime.strptime(dateline.strip(), '%A, %B %d, %Y')
    return format_datetime(d.replace(hour=13, tzinfo=timezone.utc))


def x(s):
    return html.escape(' '.join(s.split()), quote=True)


page = io.open(REPO + '/newsletter.html', encoding='utf-8').read()
parser = Archive()
parser.feed(page)
issues = [i for i in parser.issues if i['id'] and i['date']]

items = []
for i in issues:
    link = SITE + 'newsletter.html#' + i['id']
    body = '<p>%s</p>' % x(i['intro']) + ''.join(
        '<h3>%s: %s</h3><p>%s</p>' % (x(b['tag']), x(b['head']), x(b['body'])) for b in i['blocks'])
    items.append('''    <item>
      <title>%s: %s</title>
      <link>%s</link>
      <guid isPermaLink="true">%s</guid>
      <pubDate>%s</pubDate>
      <description>%s</description>
    </item>
''' % (x(i['no']), x(i['subject']), link, link, pub_date(i['date']), html.escape(body, quote=False)))

latest = pub_date(issues[0]['date']) if issues else format_datetime(datetime.now(timezone.utc))
feed = '''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Week in Culture — NewSociety</title>
    <link>%snewsletter.html</link>
    <atom:link href="%sfeed.xml" rel="self" type="application/rss+xml"/>
    <description>One email every Sunday on sports, anime, pop culture, fashion and music: the handful of stories that actually mattered.</description>
    <language>en-us</language>
    <lastBuildDate>%s</lastBuildDate>
    <image>
      <url>%sicons/icon-192.png</url>
      <title>The Week in Culture — NewSociety</title>
      <link>%snewsletter.html</link>
    </image>
%s  </channel>
</rss>
''' % (SITE, SITE, latest, SITE, SITE, ''.join(items))

io.open(REPO + '/feed.xml', 'w', encoding='utf-8').write(feed)
print('wrote feed.xml — %d issues' % len(issues))
