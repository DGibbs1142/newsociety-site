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
    return (data.events || []).map(event => ({ ...event, leagueLabel: league.label }));
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
    source: 'ESPN', url: event.links?.[0]?.href || '', from, pillar
  });

  const status = document.createElement('span');
  status.className = 'drop-status mono';
  if(live) status.append(Object.assign(document.createElement('span'), { className: 'live-dot' }));
  status.append(document.createTextNode(statusText));

  const h4 = document.createElement('h4');
  h4.textContent = event.name || 'Untitled Matchup';

  const p = document.createElement('p');
  p.textContent = summary;

  card.append(status, h4, p);
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

if(document.getElementById('newsGrid')){
  loadSports();
}
