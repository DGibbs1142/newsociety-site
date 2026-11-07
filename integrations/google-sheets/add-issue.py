# Adds the issue currently in Code.gs (NEWSLETTER_ISSUE) to the archive and
# rebuilds everything that comes from it, in one step:
#   python3 integrations/google-sheets/add-issue.py [repo dir]
#
# 1. Reads the issues already archived back out of newsletter.html.
# 2. Reads NEWSLETTER_ISSUE from Code.gs (evaluated with Node, since it is a
#    JavaScript object literal).
# 3. Runs build-archive.py, which rewrites newsletter.html and then runs
#    build-feed.py and build-stories.py.
# 4. Runs build-story-images.mjs for the new stories' share cards if Node
#    and Playwright are available, then build-stories.py again so the new
#    pages use them. Without Playwright the pages use the pillar card.
#
# Refuses to add an issue number that is already archived. Run it only
# after the issue has been sent.
import io, json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from newsletter_lib import parse_archive

REPO = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
CODE = os.path.join(HERE, 'Code.gs')

page = io.open(os.path.join(REPO, 'newsletter.html'), encoding='utf-8').read()
archived = [{
    'number': int(re.sub(r'\D', '', i['no'])), 'dateline': i['date'], 'subject': i['subject'], 'intro': i['intro'],
    'blocks': [{k: b[k] for k in ('color', 'page', 'tag', 'head', 'body')} for b in i['blocks']],
} for i in parse_archive(page)]

js = r"""
const src = require('fs').readFileSync(process.argv[1], 'utf8');
const m = src.match(/const NEWSLETTER_ISSUE = (\{[\s\S]*?\n\});/);
if (!m) { console.error('NEWSLETTER_ISSUE not found in Code.gs'); process.exit(1); }
process.stdout.write(JSON.stringify(Function('return (' + m[1] + ')')()));
"""
current = json.loads(subprocess.run(['node', '-e', js, CODE], check=True, capture_output=True, text=True).stdout)
if current['number'] in [i['number'] for i in archived]:
    sys.exit('Issue %02d is already in the archive; nothing to do.' % current['number'])
if not current.get('blocks'):
    sys.exit('NEWSLETTER_ISSUE has no blocks.')

new = {'number': current['number'], 'dateline': current['dateline'], 'subject': current['subject'],
       'intro': current['intro'],
       'blocks': [{k: b[k] for k in ('color', 'page', 'tag', 'head', 'body')} for b in current['blocks']]}
issues = sorted([new] + archived, key=lambda i: i['number'], reverse=True)

tmp = tempfile.mkdtemp()
try:
    json.dump(issues, io.open(os.path.join(tmp, 'issues.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    subprocess.run([sys.executable, os.path.join(HERE, 'build-archive.py'), tmp, REPO], check=True)
finally:
    shutil.rmtree(tmp)

try:
    subprocess.run(['node', os.path.join(HERE, 'build-story-images.mjs'), REPO], check=True)
    subprocess.run([sys.executable, os.path.join(HERE, 'build-stories.py'), REPO], check=True)
except (subprocess.CalledProcessError, FileNotFoundError):
    print('Share cards not made (needs Node + Playwright); the new story pages use the pillar card.')

print('Added Issue %02d. Review the changes, commit them, then deploy.' % new['number'])
