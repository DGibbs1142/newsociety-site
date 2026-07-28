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
}

function breakdownLoading(text){
  document.getElementById('detailBreakdown').innerHTML =
    `<p class="mono" style="color:var(--text-dim); font-size:12px; letter-spacing:0.04em;">${escapeHtml(text)}</p>`;
}

// --- Sports: real box score / game info from ESPN, framed as our own live report ---
async function renderSportsBreakdown(){
  breakdownLoading('Pulling the box score…');
  try{
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnPath}/summary?event=${espnId}`);
    if(!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    const comp = data.header?.competitions?.[0];
    const competitors = comp?.competitors || [];

    let html = '<div class="section-label">// the breakdown</div><div class="breakdown-heading">NewSociety Live Report</div>';

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

    document.getElementById('detailBreakdown').innerHTML = html;
  }catch(err){
    document.getElementById('detailBreakdown').innerHTML = '';
    console.warn('Sports breakdown unavailable:', err.message);
  }
}

// --- Movies/TV: fuller TMDB record (genres, runtime/seasons, cast, tagline) ---
async function renderTitleBreakdown(){
  breakdownLoading('Pulling the full record…');
  try{
    if(typeof TMDB_API_KEY === 'undefined') throw new Error('no TMDB key configured');
    const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
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

if(title){
  renderBase();
  if(espnId && espnPath) renderSportsBreakdown();
  else if(tmdbId && mediaType) renderTitleBreakdown();
  else if(anilistId) renderAnimeBreakdown();
}else{
  document.getElementById('detailTitle').textContent = "Nothing to show here.";
  document.getElementById('detailStatus').textContent = '';
  document.getElementById('detailBody').textContent = "This page needs to be opened from one of the pillar pages' drop cards.";
}
