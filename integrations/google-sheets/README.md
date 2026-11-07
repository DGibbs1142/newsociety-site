# Newsletter and archive: the weekly routine

The Week in Culture is written and sent from Google Apps Script (`Code.gs`,
pasted into the script attached to the NewSociety Live sheet). The website's
archive, RSS feed, story pages and share cards are all built from it with the
scripts in this folder. The homepage, links page, pillar pages and site search
read the archive, so they update by themselves.

## Every week

1. **Write the issue** in `Code.gs`: replace `NEWSLETTER_ISSUE` (number,
   dateline, subject, intro, blocks, and the closing lines). Commit it here too,
   so the repo matches what sends.
2. **Preview and send** from the Apps Script editor: run `previewNewsletter()`
   (mails you a copy and reports how many subscribers would get it), then
   `sendNewsletter()`. Each subscriber is stamped, so re-running only reaches
   people who joined since.
3. **Archive it, only after it has sent:**

   ```bash
   python3 integrations/google-sheets/add-issue.py .
   ```

   This adds the issue to `newsletter.html`, `feed.xml`, `sitemap.xml` and
   `stories/`, makes its share cards in `icons/stories/` (needs Node and
   Playwright; without them the pages use the pillar card), and refreshes the
   "More from the newsletter" lists on older story pages. It refuses to add an
   issue number that is already archived.
4. **Commit, merge and deploy** in one go. Each Netlify deploy uses credits, so
   batch other changes into the same deploy where you can.

## What each script does

| Script | Reads | Writes |
|---|---|---|
| `add-issue.py` | `newsletter.html`, `Code.gs` | everything below, via the other scripts |
| `build-archive.py` | an `issues.json` of every issue | `newsletter.html`, then runs the next two |
| `build-feed.py` | `newsletter.html` | `feed.xml` |
| `build-stories.py` | `newsletter.html` | `stories/*.html`, `stories/stories.json`, the stories block in `sitemap.xml` |
| `build-story-images.mjs` | `stories/stories.json` | `icons/stories/<slug>.jpg` for stories without one |
| `newsletter_lib.py` | — | shared parser and story-slug rules |

`build-archive.py` copies the page `<head>` from the current
`newsletter.html` and the nav and footer from `press.html`, so site-wide
changes to those are kept on every rebuild.

## Other things in Code.gs

- **Welcome email**: every newsletter signup gets one straight away
  (`SEND_NEWSLETTER_WELCOME`), including the latest archived issue read from
  `feed.xml`. `sendMissingWelcomes()` catches up anyone who was missed.
- **Launch party**: `previewLaunchAnnouncement()` and
  `sendLaunchAnnouncement()` mail RSVPs once `LAUNCH_DETAILS` has a date, time,
  venue and address.
- **After editing Code.gs** in the Apps Script editor: if a change uses a new
  Google service (for example `UrlFetchApp`), run any function once to
  re-authorize, then Deploy → Manage deployments → edit → New version, or the
  web app keeps running the old code.
