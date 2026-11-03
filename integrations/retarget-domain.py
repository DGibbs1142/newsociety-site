#!/usr/bin/env python3
"""Point the whole site at a new domain.

One-time migration for moving off newsociety.netlify.app. The free
netlify.app subdomain is silently rejected by Instagram's bio-link field
(verified 2026-11-02: a google.com link saved from the same device and
account, the netlify.app one did not), so the link-in-bio only works once
the site lives on a domain of its own.

Dry run by default - nothing is written without --apply:

    python3 integrations/retarget-domain.py newsociety.tv
    python3 integrations/retarget-domain.py newsociety.tv --apply

Both forms of the old domain are handled in one pass, because they are not
interchangeable:

  * https://newsociety.netlify.app/...  - real URLs (canonical, og:url,
    og:image, twitter:image, sitemap <loc>, Code.gs link hrefs)
  * newsociety.netlify.app              - bare display TEXT, e.g. the label
    on the /links page and the "you signed up at ..." line in the
    newsletter footers. These are read by humans, so they have to match the
    new domain too, but they must NOT gain a protocol.

Run build-archive.py afterwards only if you also regenerate the archive;
this script already rewrites newsletter.html and the builder template
together, so they stay in sync on their own.
"""
import io, os, re, sys

OLD = 'newsociety.netlify.app'

# Extensions worth rewriting. .webmanifest and netlify.toml are included
# because they are cheap to check, even though neither mentions the domain
# today - that changes the moment someone adds an og:image or a redirect.
EXTS = ('.html', '.xml', '.js', '.toml', '.py', '.gs', '.webmanifest')
SKIP_DIRS = {'.git', 'node_modules', '.netlify', 'social-drafts'}

# Keeps any protocol that is already there and leaves bare text bare.
PATTERN = re.compile(r'(https?://)?' + re.escape(OLD))


SELF = os.path.abspath(__file__)


def walk(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            path = os.path.join(dirpath, name)
            # This script spells out the old domain on purpose, in the
            # docstring and in OLD. Rewriting itself would both corrupt the
            # match pattern and destroy the note explaining why the move
            # happened.
            if name.endswith(EXTS) and os.path.abspath(path) != SELF:
                yield path


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    apply_changes = '--apply' in sys.argv

    if len(args) != 1:
        sys.exit('usage: retarget-domain.py NEW_DOMAIN [--apply]\n'
                 '   e.g. retarget-domain.py newsociety.tv')

    new = args[0].strip().rstrip('/')
    # Accept a pasted URL as well as a bare domain, then normalise to bare.
    new = re.sub(r'^https?://', '', new)
    if not re.fullmatch(r'[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+', new, re.I):
        sys.exit('refusing to run: %r does not look like a domain' % new)
    if new == OLD:
        sys.exit('refusing to run: that is already the current domain')

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    total_urls = total_text = 0
    touched = []

    for path in sorted(walk(root)):
        try:
            src = io.open(path, encoding='utf-8').read()
        except (UnicodeDecodeError, OSError):
            continue
        if OLD not in src:
            continue

        urls = text = 0

        def sub(m):
            nonlocal urls, text
            if m.group(1):
                urls += 1
                return m.group(1) + new
            text += 1
            return new

        out = PATTERN.sub(sub, src)
        rel = os.path.relpath(path, root)
        touched.append((rel, urls, text))
        total_urls += urls
        total_text += text

        if apply_changes and out != src:
            io.open(path, 'w', encoding='utf-8').write(out)

    if not touched:
        print('Nothing to do - no file mentions %s' % OLD)
        return 0

    width = max(len(r) for r, _, _ in touched)
    print('%s  %s -> %s' % ('APPLIED' if apply_changes else 'DRY RUN', OLD, new))
    print()
    print('%-*s  %5s  %5s' % (width, 'file', 'urls', 'text'))
    print('%-*s  %5s  %5s' % (width, '-' * width, '-----', '-----'))
    for rel, urls, text in touched:
        print('%-*s  %5d  %5d' % (width, rel, urls, text))
    print()
    print('%d files, %d URLs, %d bare text mentions (%d total)'
          % (len(touched), total_urls, total_text, total_urls + total_text))

    if not apply_changes:
        print('\nNothing was written. Re-run with --apply to make these changes.')
        return 0

    # Verify rather than trust: re-read every file and fail loudly if the old
    # domain survived anywhere.
    left = []
    for path in walk(root):
        try:
            if OLD in io.open(path, encoding='utf-8').read():
                left.append(os.path.relpath(path, root))
        except (UnicodeDecodeError, OSError):
            continue
    if left:
        print('\nWARNING - %s still present in: %s' % (OLD, ', '.join(left)))
        return 1

    print('\nVerified: no occurrence of %s remains.' % OLD)
    print('\nStill to do by hand:')
    print('  1. Add the domain in Netlify and wait for DNS + SSL to go green.')
    print('  2. Code.gs is NOT deployed from this repo - paste the updated file')
    print('     into the Apps Script editor, or the newsletter keeps sending the')
    print('     old links. It binds `const site` separately in 5 functions.')
    print('  3. Add the bio link on Instagram (mobile app only) and check it saves.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
