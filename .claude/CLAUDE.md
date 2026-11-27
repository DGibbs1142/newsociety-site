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
- Before EVERY deploy, run `python3 integrations/check-site.py .` from main
  (links, script syntax, JSON, netlify.toml, page basics, sw.js version bump).
  Deploy only if it says "All good". A broken deploy costs credits twice.
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

## Open items (as of Nov 27, 2026)
- Site was offline Nov 19-27 (Netlify credits ran out). Daniel bought credits
  Nov 27 (auto recharge: Usage & billing > Configure auto recharge, 500 credits
  for $5 on Personal). The batch (#54-#60, #62-#66) went out in one deploy on
  Nov 27 and the site returns 200 again.
- DEPLOY IN BATCHES from now on: about one deploy a day at most, unless
  something on the live site is broken. Both Claude sessions burned the credits
  with a deploy per PR (team plan: Personal).
- Issue 09 (Sun Nov 29) MERGED Nov 27: Issues 08, the old 09 and 10 never sent
  (subscribers' last email was Issue 07, Nov 8). One standalone Issue 09 is in
  `integrations/google-sheets/issue-09-draft.js`; the Issue 10 draft was removed.
  Issue 08 stays on the site as web-only. Since Nov 27 Code.gs itself holds
  Issue 09 (Daniel pastes the whole file into Apps Script). After 09 SENDS:
  `python3 integrations/google-sheets/add-issue.py .`
- Issue 09 social kit (#64): cards + Reels in `social/issue-09/`, captions in
  `integrations/social/issue-09-captions.md`. Post only AFTER Issue 09 sends.
  Sports and Fashion were remade Nov 27 (Bears, Fashion Awards); skip Pop culture.
  Post Fashion by MONDAY MORNING Nov 30 (the awards are that night); plan is in
  the captions file. Instagram posting by
  URL works from raw.githubusercontent.com (main). Check recent media first so
  nothing posts twice.
- Issue 08 (Wed Nov 18) was drafted (#51), archived (#52) and deployed the same
  day at Daniel's request, but it NEVER SENT (confirmed Nov 27), so it is a
  web-only issue. Facts and sources: `integrations/google-sheets/issue-08-notes.md`.
  No emails went out Nov 15 or Nov 22.
- Instagram Reels from the Nov 6 cards: all five are posted (Fashion went up
  Nov 11, 10:31 PM ET, after a session restart delayed it).
  Windsor's cached Instagram data lags on the free plan; if a post call times
  out, ask Daniel to check Instagram rather than retrying.
- Issue pages (issues/<id>.html, #40-#44) have their own share cards, older/
  newer links, and are linked from the archive, RSS, /links and the 404 rescue.
- Daniel chose to keep the homepage as the front page and point social bios at
  `/links` (TikTok and X now; Instagram needs a custom domain first).

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
- Member accounts (discussed Nov 7, not wanted yet): there are none; "Saved"
  lives in one browser's localStorage. When Daniel wants them, the agreed
  first version is email magic-link sign-in (no passwords) through a hosted
  auth service (Supabase, Clerk or Auth0 free tier; confirm Netlify's own
  options are still supported before using them), syncing saved stories and
  pillar preferences. Needs a privacy policy and account deletion; keys go in
  through request_credential, never chat. Comments would add moderation work.
  Advice given: wait until there are regular readers.
- Lighthouse (Nov 7): every page scored 97-100 performance, 100 accessibility
  and 100 SEO (search and 404 are noindex on purpose).
- Facts in posts and the newsletter must come from checked sources; the notes
  in `integrations/google-sheets/issue-07-draft.js` record what was verified.

## Home base (Nov 27, 2026)
- Handles are now @TheNewSocietyHQ on TikTok, Instagram, X and YouTube (old
  @newsociety22 / @newsociety1142 / @NewSociety11 are gone). YouTube links sit
  next to X everywhere; Code.gs SOCIALS has YouTube too (Daniel re-pastes it).
- "Tonight's debate" block on the homepage and /links (`debate.js`, styles at
  the end of styles.css). It reads `debates.json` from the `debates` branch on
  raw.githubusercontent.com (CSP connect-src allows it), falling back to the
  deployed /debates.json. The posting routine updates only that branch, so a
  new nightly debate or results never needs a deploy or a merge to main.
  Schema: {updated, latest:{series, pillar, title, question, vote, posted,
  links:{tiktok, instagram, youtube, x}}, results:[{series, title, summary}]}.
