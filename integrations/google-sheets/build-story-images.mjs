// Renders a 1200x630 share card for each newsletter story that doesn't have
// one yet, into icons/stories/<slug>.jpg, from stories/stories.json (written
// by build-stories.py). Optional: story pages use the pillar card until an
// image exists. Needs Node and Playwright with Chromium:
//   node integrations/google-sheets/build-story-images.mjs <repo dir>
// then re-run build-stories.py so the pages point at the new images.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// ESM imports ignore NODE_PATH and global installs; require() honours both,
// so a globally installed Playwright works too.
const { chromium } = createRequire(import.meta.url)('playwright');

const repo = path.resolve(process.argv[2] || '.');
const stories = JSON.parse(fs.readFileSync(path.join(repo, 'stories', 'stories.json'), 'utf8'));
const outDir = path.join(repo, 'icons', 'stories');
fs.mkdirSync(outDir, { recursive: true });

const font = f => fs.readFileSync(path.join(repo, 'fonts', f)).toString('base64');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const css = `
@font-face{font-family:Anton;src:url(data:font/woff2;base64,${font('anton-latin.woff2')}) format('woff2')}
@font-face{font-family:Inter;font-weight:400 700;src:url(data:font/woff2;base64,${font('inter-latin.woff2')}) format('woff2')}
@font-face{font-family:JBM;font-weight:400 500;src:url(data:font/woff2;base64,${font('jetbrains-mono-latin.woff2')}) format('woff2')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0a0a0c;color:#f4f3ef;position:relative;overflow:hidden;font-family:Inter,sans-serif}
.bar{position:absolute;left:0;top:0;bottom:0;width:14px;background:var(--c)}
.glow{position:absolute;right:-240px;top:-280px;width:720px;height:720px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--c) 22%,transparent),transparent 65%)}
.in{position:absolute;inset:70px 90px 64px 104px;display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;align-items:center;font-family:JBM,monospace;font-size:22px;letter-spacing:.14em;text-transform:uppercase}
.tag{color:var(--c);border:2px solid var(--c);padding:7px 14px}
.brand{display:flex;align-items:center;gap:14px;color:#d9d9e0}
.brand svg{width:44px;height:44px}
h1{margin-top:auto;font-weight:700;line-height:1.12;letter-spacing:-.01em;text-wrap:balance}
.meta{margin-top:26px;font-family:JBM,monospace;font-size:21px;letter-spacing:.06em;text-transform:uppercase;color:#9a9aa6}`;

const page = s => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body style="--c:${s.color}"><div class="bar"></div><div class="glow"></div><div class="in">
<div class="top"><span class="tag">${esc(s.tag)}</span><span class="brand"><svg viewBox="0 0 100 100"><path d="M20 84V22l60 62V44" fill="none" stroke="#f4f3ef" stroke-width="13" stroke-linejoin="round" stroke-linecap="round"/><circle cx="80" cy="21" r="9" fill="${s.color}"/></svg>NewSociety</span></div>
<h1 id="h">${esc(s.head)}</h1>
<div class="meta">${esc(s.issue)} · newsociety.netlify.app</div></div></body></html>`;

const browser = await chromium.launch();
const tab = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
let made = 0;
for (const s of stories) {
  const file = path.join(outDir, s.slug + '.jpg');
  if (fs.existsSync(file)) continue;
  await tab.setContent(page(s), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  // Largest headline size that fits the space above the meta line.
  await tab.evaluate(() => {
    const h = document.getElementById('h'), box = document.querySelector('.in');
    for (let px = 68; px >= 36; px -= 2) {
      h.style.fontSize = px + 'px';
      if (box.scrollHeight <= box.clientHeight) break;
    }
  });
  await tab.screenshot({ path: file, type: 'jpeg', quality: 86 });
  made++;
}
await browser.close();
console.log(`made ${made} story images (${stories.length - made} already existed)`);
