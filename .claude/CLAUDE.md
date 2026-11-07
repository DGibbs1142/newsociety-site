# NewSociety site: working notes

Notes from earlier sessions so the next one starts with the context.
Owner: Daniel. Live site: https://newsociety.netlify.app (Netlify site id
`d4ea566d-ca37-4b29-973d-e20bf69d7195`). Repo: DGibbs1142/newsociety-site.
`.claude/` is 404'd on the live site by netlify.toml, so this file is private.

## How changes ship
- Work on a branch, open a PR, merge only when Daniel says so ("merge N").
  The permission check blocks merges he hasn't explicitly approved.
- Netlify is NOT linked to GitHub: merging does not deploy. Deploy only when
  asked ("deploy it"): get a command from the Netlify MCP `deploy-site`
  operation and run it from the repo with
  `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.
  Each deploy costs Netlify credits (they ran out once on Nov 6 and Daniel
  upgraded the plan), so batch changes into one deploy where possible.
- The cloud environment "newsociety-site" allows `netlify-mcp.netlify.app`
  and `newsociety.netlify.app`; the Default environment does not.
- Another Claude session also works on this site and on social posting.
  Pull main before starting; don't duplicate its work.
- Bump `CACHE_VERSION` in `sw.js` when changing CSS/JS. The service worker
  precaches only the app shell and caches the rest as visitors browse.

## Newsletter (The Week in Culture, every Sunday)
- Written and sent from Google Apps Script: `integrations/google-sheets/Code.gs`
  (`NEWSLETTER_ISSUE`, then `previewNewsletter()` / `sendNewsletter()`).
- After an issue SENDS (never before): `python3 integrations/google-sheets/add-issue.py .`
  rebuilds `newsletter.html`, `feed.xml`, `stories/`, `sitemap.xml` and the
  share cards in `icons/stories/` (needs Playwright: set
  `NODE_PATH=/opt/node-tools/node_modules`). Then PR, merge, deploy.
  Full routine: `integrations/google-sheets/README.md`.
- Homepage "This week's issue", `/links` "This week", pillar-page cards and
  site search all read the archive, so they update with no other change.
- The welcome email includes the latest issue via `UrlFetchApp` (PR #17).
  Daniel has to paste `Code.gs` into Apps Script, re-authorize and publish a
  new deployment version for that to take effect.

## Open items (as of Nov 7, 2026)
- Issue 07 sends Sun Nov 8. When Daniel says "archive Issue 07", run
  `add-issue.py` on a fresh branch from main and open a new PR, then close
  PR #25 (an older Issue 07 build whose story pages lack analytics; do not
  merge it).
- Four Instagram Reels were scheduled for 7:30 PM ET, Nov 7-10, by scheduled
  tasks in the original session; the Sports Reel posted Nov 6.

## Things to know
- Analytics: the Cloudflare Web Analytics beacon is on every page. Private
  dashboard: dash.cloudflare.com → Analytics & Logs → Web Analytics. Netlify
  Observability only keeps 24 hours on this plan. Real traffic was tiny
  (about 6 homepage views a day on Nov 7), so growth matters more than features.
- Domain: none yet. Instagram rejects netlify.app links in bios, so a custom
  domain is needed for the Instagram bio. When one is bought: set it as primary
  in Netlify, run `integrations/retarget-domain.py <domain> --apply`, also
  update `build-story-images.mjs` (.mjs is not in that script's file list),
  and regenerate the story cards and Reels (the old domain is printed on them).
- Lighthouse (Nov 7): every page scored 97-100 performance, 100 accessibility
  and 100 SEO (search and 404 are noindex on purpose).
- Facts in posts and the newsletter must come from checked sources; the notes
  in `integrations/google-sheets/issue-07-draft.js` record what was verified.
