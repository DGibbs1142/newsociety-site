// Populates detail.html from the query params set by buildDetailLink()
// (see detail-link.js). Static site, no backend — the base card data travels
// in the URL itself. When the card carries a lookup ID (espnId, tmdbId,
// anilistId), this page makes its own live fetch for a genuinely deeper
// breakdown instead of just repeating the card's mini-blurb.

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

const params = new URLSearchParams(window.location.search);

const title = params.get('title');
const body = params.get('body');
const status = params.get('status');
const source = params.get('source');
const sourceUrl = params.get('url');
const from = params.get('from');
const pillar = params.get('pillar');
const espnId = params.get('espnId');
const espnPath = params.get('espnPath');
const espnLeague = params.get('espnLeague');
const tmdbId = params.get('tmdbId');
const mediaType = params.get('mediaType');
const anilistId = params.get('anilistId');
const categories = params.get('categories');
const publishedAt = params.get('publishedAt');
const imageUrl = params.get('imageUrl');
const sourceCountry = params.get('sourceCountry');
const espnAthleteId = params.get('espnAthleteId');
const espnTeamId = params.get('espnTeamId');
const espnLeaguePath = params.get('espnLeaguePath');
const deezerId = params.get('deezerId');
const deezerType = params.get('deezerType');

function renderBase(){
  document.title = `${title} — NewSociety`;
  document.getElementById('detailTitle').textContent = title;
  document.getElementById('detailStatus').textContent = status || '';
  document.getElementById('detailBody').textContent = body || '';
  document.getElementById('detailPillar').textContent = pillar || 'NewSociety';

  const backLink = document.getElementById('backLink');
  if(from){
    backLink.href = from;
    backLink.textContent = `← Back to ${pillar || 'Pillar'}`;
  }

  const credit = document.getElementById('detailCredit');
  if(source && sourceUrl){
    credit.textContent = 'Source: ';
    const link = document.createElement('a');
    link.href = sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = source;
    link.style.color = 'var(--text-dim)';
    link.style.textDecoration = 'underline';
    credit.appendChild(link);
  }else if(source){
    credit.textContent = `Source: ${source}`;
  }

  const saveBtn = document.getElementById('saveDetailBtn');
  if(saveBtn){
    const item = { href: window.location.href, title, pillar: pillar || '', status: status || '', imageUrl: imageUrl || '' };
    const sync = () => {
      const saved = isItemSaved(item.href);
      saveBtn.textContent = saved ? '★ Saved' : '☆ Save for later';
    };
    saveBtn.style.display = '';
    sync();
    saveBtn.addEventListener('click', () => {
      toggleSavedItem(item);
      sync();
    });
  }

  const shareXBtn = document.getElementById('shareXBtn');
  if(shareXBtn){
    shareXBtn.href = `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(window.location.href)}`;
    shareXBtn.style.display = '';
  }

  const copyLinkBtn = document.getElementById('copyLinkBtn');
  if(copyLinkBtn){
    copyLinkBtn.style.display = '';
    copyLinkBtn.addEventListener('click', async () => {
      try{
        await navigator.clipboard.writeText(window.location.href);
        copyLinkBtn.textContent = 'Copied!';
      }catch{
        copyLinkBtn.textContent = 'Copy failed';
      }
      setTimeout(() => { copyLinkBtn.textContent = 'Copy Link'; }, 2000);
    });
  }
}

function breakdownLoading(text){
  document.getElementById('detailBreakdown').innerHTML =
    `<p class="mono" style="color:var(--text-dim); font-size:12px; letter-spacing:0.04em;">${escapeHtml(text)}</p>`;
}

// Individual player stat lines from ESPN's boxscore.players (batting/pitching,
// passing/rushing, etc. — whatever groups that sport has). Generic across
// sports since it just renders whatever labels/stats ESPN provides. Empty for
// games that haven't started yet (no boxscore.players exists).
function renderPlayerStats(playersData, competitors){
  if(!playersData || !playersData.length) return '';
  const teamNameFor = (teamId) => {
    const c = competitors?.find(c => c.team?.id === teamId);
    return c?.team?.abbreviation || c?.team?.shortDisplayName || '';
  };

  let html = '';
  playersData.forEach(teamBlock => {
    const teamName = teamBlock.team?.abbreviation || teamNameFor(teamBlock.team?.id) || teamBlock.team?.displayName || '';
    (teamBlock.statistics || []).forEach(group => {
      if(!group.athletes?.length || !group.labels?.length) return;
      const groupName = (group.type || group.name || 'stats').replace(/^\w/, c => c.toUpperCase());
      html += `<div class="section-label" style="margin-top:32px;">// ${escapeHtml(teamName)} · ${escapeHtml(groupName)}</div>`;
      const cols = `1.6fr repeat(${group.labels.length}, minmax(38px, 1fr))`;
      html += '<div class="linescore-table" style="margin-top:12px;">';
      html += `<div class="linescore-row header" style="grid-template-columns:${cols}"><div>Player</div>${group.labels.map(l => `<div>${escapeHtml(l)}</div>`).join('')}</div>`;
      group.athletes.slice(0, 6).forEach(a => {
        const name = a.athlete?.shortName || a.athlete?.displayName || '';
        const cells = (a.stats || []).map(s => `<div>${escapeHtml(s)}</div>`).join('');
        html += `<div class="linescore-row" style="grid-template-columns:${cols}"><div>${escapeHtml(name)}</div>${cells}</div>`;
      });
      html += '</div>';
    });
  });
  return html;
}

// Recent play-by-play from ESPN's plays array — most recent first, scoring
// plays highlighted. Present on live and just-finished games; absent (empty
// string) for games that haven't started, which is fine, it's just skipped.
function renderPlayByPlay(plays){
  if(!plays || !plays.length) return '';
  const recent = plays.filter(p => p.text).slice(-12).reverse();
  if(!recent.length) return '';

  let html = '<div class="section-label" style="margin-top:32px;">// play by play</div>';
  html += '<div class="play-feed" style="margin-top:12px;">';
  recent.forEach(p => {
    const period = p.period?.displayValue || '';
    const scoreLine = p.scoringPlay ? ` (${p.awayScore}–${p.homeScore})` : '';
    html += `<div class="play-row${p.scoringPlay ? ' scoring' : ''}"><div class="period">${escapeHtml(period)}</div><div>${escapeHtml(p.text)}${escapeHtml(scoreLine)}</div></div>`;
  });
  html += '</div>';
  return html;
}

// --- Sports: real box score / game info from ESPN, framed as our own live report ---
async function renderSportsBreakdown(){
  breakdownLoading('Pulling the box score…');
  await fetchAndRenderSportsBreakdown();
}

// Re-fetches and re-renders itself on a timer while the game is still live —
// a box score frozen at whatever it was when the page loaded would defeat
// the point of a "live report." Stops on its own the moment the game ends
// (no more reschedule), so it never polls a finished game forever.
async function fetchAndRenderSportsBreakdown(){
  try{
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnPath}/summary?event=${espnId}`);
    if(!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    const comp = data.header?.competitions?.[0];
    const competitors = comp?.competitors || [];
    const isLive = comp?.status?.type?.state === 'in';

    let html = '<div class="section-label">// the breakdown</div><div class="breakdown-heading">NewSociety Live Report'
      + (isLive ? ' <span class="live-dot" style="margin-left:10px;"></span><span class="mono" style="font-size:11px; color:var(--live); vertical-align:middle; letter-spacing:0.06em;">UPDATING LIVE</span>' : '')
      + '</div>';

    const periods = Math.max(0, ...competitors.map(c => c.linescores?.length || 0));
    if(periods > 0){
      const cols = `1fr repeat(${periods}, 32px) 44px`;
      html += '<div class="linescore-table">';
      html += `<div class="linescore-row header" style="grid-template-columns:${cols}"><div>Team</div>${Array.from({ length: periods }, (_, i) => `<div>${i + 1}</div>`).join('')}<div>R</div></div>`;
      competitors.forEach(c => {
        const cells = Array.from({ length: periods }, (_, i) => `<div>${c.linescores?.[i]?.displayValue ?? '–'}</div>`).join('');
        html += `<div class="linescore-row" style="grid-template-columns:${cols}"><div>${escapeHtml(c.team?.abbreviation || c.team?.name || '')}</div>${cells}<div>${c.score ?? '–'}</div></div>`;
      });
      html += '</div>';
    }

    html += renderPlayByPlay(data.plays);

    const venue = data.gameInfo?.venue?.fullName;
    const city = data.gameInfo?.venue?.address?.city;
    const records = competitors
      .map(c => `${c.team?.abbreviation || c.team?.name || ''} ${c.record?.find(r => r.type === 'total')?.displayValue || c.record?.[0]?.displayValue || ''}`.trim())
      .filter(Boolean).join(' · ');
    const broadcast = (data.broadcasts || [])
      .map(b => b.media?.shortName || b.station).filter(Boolean).slice(0, 3).join(', ');

    html += '<div class="fact-grid">';
    if(venue) html += `<div class="fact-cell"><div class="label">Venue</div><div class="value">${escapeHtml(venue)}${city ? ', ' + escapeHtml(city) : ''}</div></div>`;
    if(records) html += `<div class="fact-cell"><div class="label">Records</div><div class="value">${escapeHtml(records)}</div></div>`;
    if(broadcast) html += `<div class="fact-cell"><div class="label">Broadcast</div><div class="value">${escapeHtml(broadcast)}</div></div>`;
    if(espnLeague) html += `<div class="fact-cell"><div class="label">League</div><div class="value">${escapeHtml(espnLeague)}</div></div>`;
    html += '</div>';

    html += renderPlayerStats(data.boxscore?.players, competitors);

    document.getElementById('detailBreakdown').innerHTML = html;

    if(isLive){
      setTimeout(fetchAndRenderSportsBreakdown, 20000);
    }
  }catch(err){
    document.getElementById('detailBreakdown').innerHTML = '';
    console.warn('Sports breakdown unavailable:', err.message);
  }
}

// --- Movies/TV: fuller TMDB record (genres, runtime/seasons, cast, tagline) ---
async function renderTitleBreakdown(){
  breakdownLoading('Pulling the full record…');
  try{
    const res = await fetch(`/api/tmdb?op=detail&mediaType=${mediaType}&id=${tmdbId}`);
    if(!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();

    let html = '<div class="section-label">// the breakdown</div><div class="breakdown-heading">NewSociety Rundown</div>';
    if(data.tagline) html += `<p class="about-copy" style="font-style:italic; margin-bottom:24px;">"${escapeHtml(data.tagline)}"</p>`;

    const genres = (data.genres || []).map(g => g.name).join(', ');
    const runtime = mediaType === 'tv'
      ? `${data.number_of_seasons || '?'} season${data.number_of_seasons === 1 ? '' : 's'} · ${data.number_of_episodes || '?'} episodes`
      : (data.runtime ? `${data.runtime} min` : '');
    const cast = (data.credits?.cast || []).slice(0, 5).map(c => c.name).join(', ');
    const status2 = data.status || '';

    html += '<div class="fact-grid">';
    if(genres) html += `<div class="fact-cell"><div class="label">Genres</div><div class="value">${escapeHtml(genres)}</div></div>`;
    if(runtime) html += `<div class="fact-cell"><div class="label">${mediaType === 'tv' ? 'Seasons' : 'Runtime'}</div><div class="value">${escapeHtml(runtime)}</div></div>`;
    if(status2) html += `<div class="fact-cell"><div class="label">Status</div><div class="value">${escapeHtml(status2)}</div></div>`;
    if(cast) html += `<div class="fact-cell"><div class="label">Starring</div><div class="value">${escapeHtml(cast)}</div></div>`;
    html += '</div>';

    document.getElementById('detailBreakdown').innerHTML = html;
  }catch(err){
    document.getElementById('detailBreakdown').innerHTML = '';
    console.warn('Title breakdown unavailable:', err.message);
  }
}

// --- Anime: fuller AniList record (genres, studio, format, trailer) ---
async function renderAnimeBreakdown(){
  breakdownLoading('Pulling the full record…');
  try{
    const query = `query($id:Int){ Media(id:$id, type:ANIME){ genres format episodes duration status studios(isMain:true){ nodes{ name } } trailer{ id site } } }`;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: Number(anilistId) } })
    });
    if(!res.ok) throw new Error(`${res.status}`);
    const { data, errors } = await res.json();
    if(errors) throw new Error(errors[0]?.message || 'AniList error');
    const media = data.Media;

    let html = '<div class="section-label">// the breakdown</div><div class="breakdown-heading">NewSociety Rundown</div>';

    const genres = (media.genres || []).join(', ');
    const studio = (media.studios?.nodes || []).map(s => s.name).join(', ');

    html += '<div class="fact-grid">';
    if(genres) html += `<div class="fact-cell"><div class="label">Genres</div><div class="value">${escapeHtml(genres)}</div></div>`;
    if(studio) html += `<div class="fact-cell"><div class="label">Studio</div><div class="value">${escapeHtml(studio)}</div></div>`;
    if(media.format) html += `<div class="fact-cell"><div class="label">Format</div><div class="value">${escapeHtml(media.format)}</div></div>`;
    if(media.episodes) html += `<div class="fact-cell"><div class="label">Episodes</div><div class="value">${media.episodes}${media.duration ? ` · ${media.duration} min` : ''}</div></div>`;
    if(media.status) html += `<div class="fact-cell"><div class="label">Status</div><div class="value">${escapeHtml(media.status)}</div></div>`;
    html += '</div>';

    if(media.trailer?.site === 'youtube' && media.trailer?.id){
      html += `<p class="mono" style="font-size:12px; margin-bottom:24px;"><a href="https://www.youtube.com/watch?v=${encodeURIComponent(media.trailer.id)}" target="_blank" rel="noopener" style="color:var(--accent);">Watch the trailer →</a></p>`;
    }

    document.getElementById('detailBreakdown').innerHTML = html;
  }catch(err){
    document.getElementById('detailBreakdown').innerHTML = '';
    console.warn('Anime breakdown unavailable:', err.message);
  }
}

// --- Sports search: player bio/stats from ESPN's athlete endpoint ---
async function renderAthleteBreakdown(){
  breakdownLoading('Pulling the player profile…');
  try{
    const res = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/${espnLeaguePath}/athletes/${espnAthleteId}`);
    if(!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    const a = data.athlete;
    if(!a) throw new Error('No athlete data');

    let html = '<div class="section-label">// the breakdown</div><div class="breakdown-heading">NewSociety Player Profile</div>';

    const headshot = a.headshot?.href;
    if(headshot) html += `<img src="${escapeHtml(headshot)}" alt="" style="width:140px; height:140px; object-fit:cover; border:1px solid var(--line); margin-bottom:24px; display:block;" onerror="this.remove()">`;

    html += '<div class="fact-grid">';
    if(a.position?.displayName) html += `<div class="fact-cell"><div class="label">Position</div><div class="value">${escapeHtml(a.position.displayName)}</div></div>`;
    if(a.team?.displayName) html += `<div class="fact-cell"><div class="label">Team</div><div class="value">${escapeHtml(a.team.displayName)}</div></div>`;
    if(a.jersey) html += `<div class="fact-cell"><div class="label">Jersey</div><div class="value">#${escapeHtml(a.jersey)}</div></div>`;
    if(a.displayHeight || a.displayWeight) html += `<div class="fact-cell"><div class="label">Height / Weight</div><div class="value">${escapeHtml(a.displayHeight || '—')} · ${escapeHtml(a.displayWeight || '—')}</div></div>`;
    if(a.age) html += `<div class="fact-cell"><div class="label">Age</div><div class="value">${a.age}</div></div>`;
    html += '</div>';

    document.getElementById('detailBreakdown').innerHTML = html;
  }catch(err){
    document.getElementById('detailBreakdown').innerHTML = '';
    console.warn('Athlete breakdown unavailable:', err.message);
  }
}

// --- Sports search: team record/standing from ESPN's team endpoint ---
async function renderTeamBreakdown(){
  breakdownLoading('Pulling the team record…');
  try{
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnLeaguePath}/teams/${espnTeamId}`);
    if(!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    const t = data.team;
    if(!t) throw new Error('No team data');

    let html = '<div class="section-label">// the breakdown</div><div class="breakdown-heading">NewSociety Team Profile</div>';

    const logo = t.logos?.[0]?.href;
    if(logo) html += `<img src="${escapeHtml(logo)}" alt="" style="width:100px; height:100px; object-fit:contain; margin-bottom:24px; display:block;" onerror="this.remove()">`;

    const record = t.record?.items?.[0]?.summary;
    const nextEvent = t.nextEvent?.[0]?.name;

    html += '<div class="fact-grid">';
    if(t.standingSummary) html += `<div class="fact-cell"><div class="label">Standing</div><div class="value">${escapeHtml(t.standingSummary)}</div></div>`;
    if(record) html += `<div class="fact-cell"><div class="label">Record</div><div class="value">${escapeHtml(record)}</div></div>`;
    if(nextEvent) html += `<div class="fact-cell"><div class="label">Next Game</div><div class="value">${escapeHtml(nextEvent)}</div></div>`;
    html += '</div>';

    document.getElementById('detailBreakdown').innerHTML = html;
  }catch(err){
    document.getElementById('detailBreakdown').innerHTML = '';
    console.warn('Team breakdown unavailable:', err.message);
  }
}

// --- Music: fuller Deezer record (artist, duration/track count, label,
// genre, release date, plus a real 30-second preview clip for tracks) — no
// key needed, but Deezer doesn't send CORS headers for plain fetch(), so
// this uses their JSONP output the same way music.js does. ---
function deezerJsonp(url, timeoutMs = 8000){
  return new Promise((resolve, reject) => {
    const callbackName = 'deezer_cb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    };
    const timer = setTimeout(() => {
      if(settled) return;
      cleanup();
      reject(new Error('Deezer request timed out'));
    }, timeoutMs);

    window[callbackName] = (data) => {
      if(settled) return;
      cleanup();
      if(data?.error){ reject(new Error(data.error.message || 'Deezer error')); return; }
      resolve(data);
    };
    script.onerror = () => {
      if(settled) return;
      cleanup();
      reject(new Error('Deezer request failed'));
    };
    const sep = url.includes('?') ? '&' : '?';
    script.src = `${url}${sep}output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

async function renderMusicBreakdown(){
  breakdownLoading('Pulling the track info…');
  try{
    const data = await deezerJsonp(`https://api.deezer.com/${deezerType}/${deezerId}`);

    let html = '<div class="section-label">// the breakdown</div><div class="breakdown-heading">NewSociety Sound Rundown</div>';

    const durationMin = data.duration ? `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}` : '';
    const genres = (data.genres?.data || []).map(g => g.name).join(', ');

    html += '<div class="fact-grid">';
    if(data.artist?.name) html += `<div class="fact-cell"><div class="label">Artist</div><div class="value">${escapeHtml(data.artist.name)}</div></div>`;
    if(deezerType === 'track' && data.album?.title) html += `<div class="fact-cell"><div class="label">Album</div><div class="value">${escapeHtml(data.album.title)}</div></div>`;
    if(deezerType === 'track' && durationMin) html += `<div class="fact-cell"><div class="label">Duration</div><div class="value">${durationMin}</div></div>`;
    if(deezerType === 'album' && data.nb_tracks) html += `<div class="fact-cell"><div class="label">Tracks</div><div class="value">${data.nb_tracks}</div></div>`;
    if(data.release_date) html += `<div class="fact-cell"><div class="label">Released</div><div class="value">${escapeHtml(data.release_date)}</div></div>`;
    if(genres) html += `<div class="fact-cell"><div class="label">Genre</div><div class="value">${escapeHtml(genres)}</div></div>`;
    if(deezerType === 'album' && data.label) html += `<div class="fact-cell"><div class="label">Label</div><div class="value">${escapeHtml(data.label)}</div></div>`;
    html += '</div>';

    if(data.preview){
      html += `<audio controls src="${escapeHtml(data.preview)}" style="width:100%; max-width:420px; margin-top:24px; display:block;"></audio>`;
    }

    document.getElementById('detailBreakdown').innerHTML = html;
  }catch(err){
    document.getElementById('detailBreakdown').innerHTML = '';
    console.warn('Music breakdown unavailable:', err.message);
  }
}

// --- News/Fashion articles: framed as our own rundown (category, exact
// publish time, lead image) instead of just a snippet + link. No live
// re-fetch needed — TheNewsAPI already gave us everything via the card. ---
function renderNewsBreakdown(){
  if(!categories && !publishedAt && !imageUrl && !sourceCountry) return;

  let html = '<div class="section-label">// the breakdown</div><div class="breakdown-heading">NewSociety Rundown</div>';

  if(imageUrl){
    html += `<img src="${escapeHtml(imageUrl)}" alt="" style="width:100%; max-width:640px; border:1px solid var(--line); margin-bottom:24px; display:block;" onerror="this.remove()">`;
  }

  const publishedDisplay = publishedAt
    ? new Date(publishedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  html += '<div class="fact-grid">';
  if(categories) html += `<div class="fact-cell"><div class="label">Category</div><div class="value">${escapeHtml(categories)}</div></div>`;
  if(publishedDisplay) html += `<div class="fact-cell"><div class="label">Published</div><div class="value">${escapeHtml(publishedDisplay)}</div></div>`;
  if(source) html += `<div class="fact-cell"><div class="label">Outlet</div><div class="value">${escapeHtml(source)}</div></div>`;
  if(sourceCountry) html += `<div class="fact-cell"><div class="label">Origin</div><div class="value">${escapeHtml(sourceCountry.toUpperCase())}</div></div>`;
  html += '</div>';

  document.getElementById('detailBreakdown').innerHTML = html;
}

// --- Related Stories: a few more items from the same pillar, using the
// same live sources each pillar's own page already pulls from — no new
// APIs, just a second lightweight fetch scoped to "what else is here right
// now," with the current item filtered out. ---
async function fetchRelatedSports(){
  if(!espnPath) return [];
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnPath}/scoreboard`);
  if(!res.ok) return [];
  const data = await res.json();
  return (data.events || [])
    .filter(e => String(e.id) !== String(espnId))
    .slice(0, 4)
    .map(e => {
      const st = `${espnLeague || ''} · ${e.status?.type?.shortDetail || e.status?.type?.description || ''}`.trim();
      const comp = e.competitions?.[0];
      const home = comp?.competitors?.find(c => c.homeAway === 'home');
      return {
        title: e.name, status: st, imageUrl: home?.team?.logo || '',
        href: buildDetailLink({
          title: e.name, status: st, source: 'ESPN', url: e.links?.[0]?.href || '',
          espnId: e.id, espnPath, espnLeague, pillar, from
        })
      };
    });
}

async function fetchRelatedAnime(){
  const gqlQuery = `query{ Page(page:1, perPage:8){ media(type:ANIME, sort:TRENDING_DESC){ id title{ romaji english } averageScore seasonYear description(asHtml:false) siteUrl coverImage{ large } } } }`;
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: gqlQuery })
  });
  if(!res.ok) return [];
  const { data } = await res.json();
  return (data?.Page?.media || [])
    .filter(a => String(a.id) !== String(anilistId))
    .slice(0, 4)
    .map(a => {
      const t = a.title.english || a.title.romaji || 'Untitled';
      const st = `${a.seasonYear || '—'} · ${a.averageScore ? a.averageScore + '/100' : 'Unrated'}`;
      const b = (a.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return { title: t, status: st, imageUrl: a.coverImage?.large || '', href: buildDetailLink({ title: t, body: b, status: st, source: 'AniList', url: a.siteUrl, anilistId: a.id, pillar, from }) };
    });
}

async function fetchRelatedPopCulture(){
  const res = await fetch('/api/tmdb?op=trending');
  if(!res.ok) return [];
  const data = await res.json();
  return (data.results || [])
    .filter(item => String(item.id) !== String(tmdbId))
    .slice(0, 4)
    .map(item => {
      const t = item.title || item.name || 'Untitled';
      const year = (item.release_date || item.first_air_date || '').slice(0, 4) || '—';
      const st = `${item.media_type === 'tv' ? 'TV' : 'Movie'} · ${year}`;
      const img = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '';
      return {
        title: t, status: st, imageUrl: img,
        href: buildDetailLink({
          title: t, body: item.overview || '', status: st, source: 'TMDB',
          url: `https://www.themoviedb.org/${item.media_type}/${item.id}`,
          tmdbId: item.id, mediaType: item.media_type, imageUrl: img, pillar, from
        })
      };
    });
}

async function fetchRelatedFashion(){
  const res = await fetch('/api/gnews?op=search&q=fashion&max=8');
  if(!res.ok) return [];
  const data = await res.json();
  return (data.articles || [])
    .filter(a => a.title !== title)
    .slice(0, 4)
    .map(a => ({
      title: a.title, status: a.source?.name || 'Wire', imageUrl: a.image || '',
      href: buildDetailLink({
        title: a.title, body: a.content || a.description || '', status: a.source?.name || 'Wire',
        source: a.source?.name || 'Wire', url: a.url, publishedAt: a.publishedAt, imageUrl: a.image || '',
        sourceCountry: a.source?.country, pillar, from
      })
    }));
}

async function fetchRelatedMusic(){
  const data = await deezerJsonp('https://api.deezer.com/chart/0/tracks?limit=8');
  return (data?.data || [])
    .filter(t => String(t.id) !== String(deezerId))
    .slice(0, 4)
    .map(t => {
      const artist = t.artist?.name || 'Unknown Artist';
      const st = `${artist} · Trending`;
      return {
        title: t.title, status: st, imageUrl: t.album?.cover_medium || '',
        href: buildDetailLink({
          title: t.title, body: `From "${t.album?.title || 'Unknown Album'}" by ${artist}.`, status: st,
          source: 'Deezer', url: t.link, imageUrl: t.album?.cover_medium || '',
          deezerId: t.id, deezerType: 'track', pillar, from
        })
      };
    });
}

async function fetchRelatedNews(){
  const res = await fetch('/api/gnews?op=headlines&category=general&max=8');
  if(!res.ok) return [];
  const data = await res.json();
  return (data.articles || [])
    .filter(a => a.title !== title)
    .slice(0, 4)
    .map(a => ({
      title: a.title, status: a.source?.name || 'Wire', imageUrl: a.image || '',
      href: buildDetailLink({
        title: a.title, body: a.content || a.description || '', status: a.source?.name || 'Wire',
        source: a.source?.name || 'Wire', url: a.url, publishedAt: a.publishedAt, imageUrl: a.image || '',
        sourceCountry: a.source?.country, pillar, from
      })
    }));
}

async function renderRelated(){
  const fetchers = {
    'Sports': fetchRelatedSports, 'Anime': fetchRelatedAnime, 'Pop Culture': fetchRelatedPopCulture,
    'Fashion': fetchRelatedFashion, 'Music': fetchRelatedMusic, 'Current Events': fetchRelatedNews
  };
  const fetcher = fetchers[pillar];
  if(!fetcher) return;

  try{
    const items = await fetcher();
    if(!items.length) return;

    const section = document.getElementById('relatedSection');
    const heading = document.getElementById('relatedHeading');
    const grid = document.getElementById('relatedGrid');
    if(!section || !grid) return;

    if(heading) heading.textContent = `More from ${pillar}.`;
    items.forEach(item => {
      const card = document.createElement('a');
      card.className = 'drop-card';
      card.href = item.href;

      const statusEl = document.createElement('span');
      statusEl.className = 'drop-status mono';
      statusEl.textContent = item.status || '';

      const h4 = document.createElement('h3');
      h4.textContent = item.title || 'Untitled';

      card.append(statusEl, h4);
      attachCardImage(card, item.imageUrl);
      attachSaveButton(card, { href: card.href, title: item.title || 'Untitled', pillar, status: item.status || '', imageUrl: item.imageUrl || '' });
      grid.appendChild(card);
    });

    section.style.display = '';
  }catch(err){
    console.warn('Related content unavailable:', err.message);
  }
}

if(title){
  renderBase();
  if(espnId && espnPath) renderSportsBreakdown();
  else if(tmdbId && mediaType) renderTitleBreakdown();
  else if(anilistId) renderAnimeBreakdown();
  else if(espnAthleteId && espnLeaguePath) renderAthleteBreakdown();
  else if(espnTeamId && espnLeaguePath) renderTeamBreakdown();
  else if(deezerId && deezerType) renderMusicBreakdown();
  else renderNewsBreakdown();
  renderRelated();
}else{
  document.getElementById('detailTitle').textContent = "Nothing to show here.";
  document.getElementById('detailStatus').textContent = '';
  document.getElementById('detailBody').textContent = "This page needs to be opened from one of the pillar pages' drop cards.";
}
