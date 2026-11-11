# Writes feed.xml (RSS 2.0) from newsletter.html, so the feed can never
# disagree with the archive page. build-archive.py runs this after it
# rewrites newsletter.html; it can also be run on its own:
#   python3 integrations/google-sheets/build-feed.py <repo dir>
import html, io, re, sys
from datetime import datetime, timezone
from email.utils import format_datetime
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from newsletter_lib import parse_archive

REPO = sys.argv[1] if len(sys.argv) > 1 else '.'
SITE = 'https://newsociety.netlify.app/'


def pub_date(dateline):
    # "Sunday, November 1, 2026" -> issues go out Sunday morning US time.
    d = datetime.strptime(dateline.strip(), '%A, %B %d, %Y')
    return format_datetime(d.replace(hour=13, tzinfo=timezone.utc))


def x(s):
    return html.escape(' '.join(s.split()), quote=True)


page = io.open(REPO + '/newsletter.html', encoding='utf-8').read()
issues = parse_archive(page)

items = []
for i in issues:
    # <link> opens the issue's own page; the guid keeps its original value so
    # feed readers don't show every past issue again as new.
    link = SITE + 'issues/%s.html' % i['id']
    guid = SITE + 'newsletter.html#' + i['id']
    body = '<p>%s</p>' % x(i['intro']) + ''.join(
        '<h3>%s: %s</h3><p>%s</p>' % (x(b['tag']), x(b['head']), x(b['body'])) for b in i['blocks'])
    items.append('''    <item>
      <title>%s: %s</title>
      <link>%s</link>
      <guid isPermaLink="true">%s</guid>
      <pubDate>%s</pubDate>
      <description>%s</description>
    </item>
''' % (x(i['no']), x(i['subject']), link, guid, pub_date(i['date']), html.escape(body, quote=False)))

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
