# Shared by build-archive.py, build-feed.py and build-stories.py: the parser
# that reads issues back out of newsletter.html, and the story-page slugs.
# Keeping both here means the archive's "Share this story" links, the RSS
# feed and the story pages can never disagree about names or content.
import re, unicodedata
from html.parser import HTMLParser


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
            m = re.search(r'--tag:\s*([^;"]+)', a.get('style') or '')
            self.block = {'tag': '', 'page': '', 'head': '', 'body': '', 'color': m.group(1).strip() if m else ''}
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


def parse_archive(page_html):
    p = Archive()
    p.feed(page_html)
    return [i for i in p.issues if i['id'] and i['date']]


def _words(text, n=7):
    t = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return '-'.join(re.findall(r'[a-z0-9]+', t.lower())[:n]) or 'story'


def story_slugs(stories):
    """stories: (issue_number, headline) pairs in page order -> slugs, unique."""
    seen, out = set(), []
    for number, head in stories:
        base = 'issue-%02d-%s' % (int(number), _words(head))
        slug, k = base, 2
        while slug in seen:
            slug, k = '%s-%d' % (base, k), k + 1
        seen.add(slug)
        out.append(slug)
    return out
