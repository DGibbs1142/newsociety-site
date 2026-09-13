// Populates the Sports page with live scores/schedules from ESPN's public
// scoreboard API (no key needed) instead of generic news headlines — real games,
// not articles about games. Combines multiple leagues so there's always enough
// to show even when one league is between seasons. Games currently in progress
// get their own "live now" strip above the general drops grid.

const LEAGUES = [
  { path: 'basketball/nba', label: 'NBA' },
  { path: 'football/nfl', label: 'NFL' },
  { path: 'baseball/mlb', label: 'MLB' },
  { path: 'hockey/nhl', label: 'NHL' },
  { path: 'soccer/eng.1', label: 'Premier League' },
  { path: 'soccer/uefa.champions', label: 'Champions League' }
];

async function fetchLeague(league){
  try{
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league.path}/scoreboard`);
    if(!res.ok) return [];
    const data = await res.json();
    return (data.events || []).map(event => ({ ...event, leagueLabel: league.label, leaguePath: league.path }));
  }catch{
    return [];
  }
}

function describeGame(event){
  const comp = event.competitions?.[0];
  const state = event.status?.type?.state;
  const home = comp?.competitors?.find(c => c.homeAway === 'home');
  const away = comp?.competitors?.find(c => c.homeAway === 'away');

  if(state === 'in' || state === 'post'){
    return `${away?.team?.shortDisplayName || 'Away'} ${away?.score ?? '–'} · ${home?.team?.shortDisplayName || 'Home'} ${home?.score ?? '–'}`;
  }
  const venue = comp?.venue?.fullName;
  const when = event.status?.type?.detail || '';
  return venue ? `${venue} · ${when}` : when;
}

function pickBalanced(pool, count){
  const byLeague = {};
  pool.forEach(e => {
    (byLeague[e.leagueLabel] ||= []).push(e);
  });
  const leagues = Object.keys(byLeague);
  const picked = [];
  let i = 0;
  while(picked.length < count && leagues.some(l => byLeague[l].length)){
    const league = leagues[i % leagues.length];
    if(byLeague[league].length) picked.push(byLeague[league].shift());
    i++;
  }
  return picked;
}

function gameCard(event, { live = false } = {}){
  const statusText = `${event.leagueLabel} · ${event.status?.type?.shortDetail || event.status?.type?.description || ''}`;
  const summary = describeGame(event);
  const { from, pillar } = currentPillarInfo();

  const card = document.createElement('a');
  card.className = 'drop-card';
  card.href = buildDetailLink({
    title: event.name, body: summary, status: statusText,
    source: 'ESPN', url: event.links?.[0]?.href || '', from, pillar,
    espnId: event.id, espnPath: event.leaguePath, espnLeague: event.leagueLabel
  });

  const status = document.createElement('span');
  status.className = 'drop-status mono';
  if(live) status.append(Object.assign(document.createElement('span'), { className: 'live-dot' }));
  status.append(document.createTextNode(statusText));

  const h4 = document.createElement('h3');
  h4.textContent = event.name || 'Untitled Matchup';

  const p = document.createElement('p');
  p.textContent = summary;

  card.append(status, h4, p);

  const comp = event.competitions?.[0];
  const away = comp?.competitors?.find(c => c.homeAway === 'away');
  const home = comp?.competitors?.find(c => c.homeAway === 'home');
  attachMatchupLogos(card, away?.team?.logo, home?.team?.logo);
  attachSaveButton(card, { href: card.href, title: event.name || 'Untitled Matchup', pillar, status: statusText, imageUrl: home?.team?.logo || away?.team?.logo || '' });
  attachExpandToggle(card, p);

  return card;
}

function renderGames(events, gridId, titleId, liveTitleText){
  const grid = document.getElementById(gridId);
  const title = document.getElementById(titleId);
  if(!grid) return;

  grid.innerHTML = '';
  events.forEach(event => grid.appendChild(gameCard(event, { live: event.status?.type?.state === 'in' })));
  if(title) title.textContent = liveTitleText;
}

function renderEmptyLive(){
  const grid = document.getElementById('liveScoresGrid');
  const title = document.getElementById('liveScoresTitle');
  if(title) title.textContent = 'Nothing live right now.';
  if(!grid) return;
  grid.innerHTML = '<div class="drop-card"><span class="drop-status mono">Standing by</span><h4>No games in progress</h4><p>Check the latest drops below for what\'s scheduled and what just wrapped.</p></div>';
}

const DEMO_GAMES = [
  { leagueLabel: 'NBA', status: { type: { description: 'Scheduled' } }, name: 'Sample Matchup A', competitions: [{ venue: { fullName: 'Sample Arena' } }], links: [{ href: '#' }] },
  { leagueLabel: 'NFL', status: { type: { description: 'Scheduled' } }, name: 'Sample Matchup B', competitions: [{ venue: { fullName: 'Sample Stadium' } }], links: [{ href: '#' }] },
  { leagueLabel: 'Premier League', status: { type: { description: 'Scheduled' } }, name: 'Sample Matchup C', competitions: [{ venue: { fullName: 'Sample Ground' } }], links: [{ href: '#' }] }
];

function renderError(message){
  renderGames(DEMO_GAMES, 'newsGrid', 'newsSectionTitle', 'Live from the scoreboard. (demo preview)');
  const liveTitle = document.getElementById('liveScoresTitle');
  const liveGrid = document.getElementById('liveScoresGrid');
  if(liveTitle) liveTitle.textContent = 'Live now. (demo preview)';
  if(liveGrid) liveGrid.innerHTML = '';
  console.warn('Sports feed error, showing demo content:', message);
}

async function loadSports(){
  try{
    const results = await Promise.all(LEAGUES.map(fetchLeague));
    const pool = results.flat();
    if(!pool.length) throw new Error('No games returned');

    const firstTeam = pool[0]?.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home') || pool[0]?.competitions?.[0]?.competitors?.[0];
    setPillarAboutImage(firstTeam?.team?.logo);

    const liveGames = pool.filter(e => e.status?.type?.state === 'in');
    const rest = pool.filter(e => e.status?.type?.state !== 'in');

    if(liveGames.length){
      renderGames(pickBalanced(liveGames, 6), 'liveScoresGrid', 'liveScoresTitle', 'Live right now.');
    }else{
      renderEmptyLive();
    }

    renderGames(pickBalanced(rest, 6), 'newsGrid', 'newsSectionTitle', 'Live from the scoreboard.');
  }catch(err){
    renderError(err.message);
  }
}

function initGameSearch(){
  const form = document.getElementById('gameSearchForm');
  if(!form) return;

  const dateInput = document.getElementById('searchDate');
  dateInput.value = new Date().toISOString().slice(0, 10);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const leagueSelect = document.getElementById('searchLeague');
    const league = leagueSelect.value;
    const leagueLabel = leagueSelect.selectedOptions[0].textContent;
    const dateStr = dateInput.value.replaceAll('-', '');
    const status = document.getElementById('searchStatus');
    const grid = document.getElementById('searchResultsGrid');

    status.textContent = 'Searching…';
    grid.style.display = 'none';
    grid.innerHTML = '';

    try{
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard?dates=${dateStr}`);
      if(!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const events = (data.events || []).map(ev => ({ ...ev, leagueLabel, leaguePath: league }));

      if(!events.length){
        status.textContent = `No ${leagueLabel} games found on that date.`;
        return;
      }
      status.textContent = `${events.length} game${events.length === 1 ? '' : 's'} found.`;
      grid.style.display = '';
      events.forEach(ev => grid.appendChild(gameCard(ev, { live: ev.status?.type?.state === 'in' })));
    }catch(err){
      status.textContent = 'Search failed — try again.';
      console.warn('Game search error:', err.message);
    }
  });
}

// Maps the league abbreviation ESPN's search returns (item.description) to
// the sport/league path segment its site API expects. Not exhaustive — covers
// the common cases; anything unmapped just skips the extra detail fetch and
// falls back to a plain link, same as before.
const ESPN_LEAGUE_PATHS = {
  'NBA': 'basketball/nba',
  'NFL': 'football/nfl',
  'MLB': 'baseball/mlb',
  'NHL': 'hockey/nhl',
  'MLS': 'soccer/usa.1',
  'NCAAF': 'football/college-football',
  'NCAAM': 'basketball/mens-college-basketball',
  'NCAAW': 'basketball/womens-college-basketball',
  'WNBA': 'basketball/wnba'
};

// ESPN's search endpoint doesn't actually paginate (page=2 returns the same
// results as page=1), so this fetches one larger batch and the shared widget
// is configured with a resultsPerPage high enough that "Load More" never shows.
async function fetchSportsKeywordSearch(query){
  const res = await fetch(`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(query)}&type=player,team&limit=10`);
  if(!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();

  return (data.results || []).flatMap(result => result.contents.map(item => {
    // Players: description = league, subtitle = team. Teams: description is
    // null, subtitle = league. Check both so either shape resolves the league.
    const league = item.description || item.subtitle;
    const leaguePath = ESPN_LEAGUE_PATHS[league];
    const uidMatch = item.uid?.match(/([ta]):(\d+)$/);
    const card = {
      title: item.displayName || 'Untitled',
      body: [item.description, item.subtitle].filter(Boolean).join(' · '),
      status: [item.description, item.subtitle].filter(Boolean).join(' · ') || 'ESPN',
      source: 'ESPN', url: item.link?.web || '',
      imageUrl: item.image?.default || ''
    };
    if(leaguePath && uidMatch){
      card.espnLeaguePath = leaguePath;
      if(uidMatch[1] === 'a') card.espnAthleteId = uidMatch[2];
      else card.espnTeamId = uidMatch[2];
    }
    return card;
  }));
}

if(document.getElementById('newsGrid')){
  loadSports();
  // Scores actually move while someone's sitting on this page — refresh
  // periodically so "Live Now" stays live instead of freezing at whatever
  // the score was on page load.
  setInterval(loadSports, 30000);
  initGameSearch();
  initSearchWidget({
    formId: 'keywordSearchForm', inputId: 'keywordSearchInput', gridId: 'keywordSearchResultsGrid',
    statusId: 'keywordSearchStatus', moreBtnId: null,
    fetchPage: (query, page) => page === 1 ? fetchSportsKeywordSearch(query) : [],
    resultsPerPage: 999
  });
}
