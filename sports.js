// Populates the Sports drops-grid with live scores/schedules from ESPN's public
// scoreboard API (no key needed) instead of generic news headlines — real games,
// not articles about games. Combines multiple leagues so there's always enough
// to show even when one league is between seasons.

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

function renderGames(events){
  const grid = document.getElementById('newsGrid');
  const title = document.getElementById('newsSectionTitle');
  if(!grid) return;

  grid.innerHTML = '';
  events.forEach(event => {
    const card = document.createElement('a');
    card.className = 'drop-card';
    card.href = event.links?.[0]?.href || '#';
    card.target = '_blank';
    card.rel = 'noopener';

    const status = document.createElement('span');
    status.className = 'drop-status mono';
    status.textContent = `${event.leagueLabel} · ${event.status?.type?.description || ''}`;

    const h4 = document.createElement('h4');
    h4.textContent = event.name || 'Untitled Matchup';

    const p = document.createElement('p');
    p.textContent = describeGame(event);

    card.append(status, h4, p);
    grid.appendChild(card);
  });

  if(title) title.textContent = 'Live from the scoreboard.';
}

const DEMO_GAMES = [
  { leagueLabel: 'NBA', status: { type: { description: 'Scheduled' } }, name: 'Sample Matchup A', competitions: [{ venue: { fullName: 'Sample Arena' } }], links: [{ href: '#' }] },
  { leagueLabel: 'NFL', status: { type: { description: 'Scheduled' } }, name: 'Sample Matchup B', competitions: [{ venue: { fullName: 'Sample Stadium' } }], links: [{ href: '#' }] },
  { leagueLabel: 'Premier League', status: { type: { description: 'Scheduled' } }, name: 'Sample Matchup C', competitions: [{ venue: { fullName: 'Sample Ground' } }], links: [{ href: '#' }] }
];

function renderError(message){
  renderGames(DEMO_GAMES);
  const title = document.getElementById('newsSectionTitle');
  if(title) title.textContent = 'Live from the scoreboard. (demo preview)';
  console.warn('Sports feed error, showing demo content:', message);
}

async function loadSports(){
  try{
    const results = await Promise.all(LEAGUES.map(fetchLeague));
    const pool = results.flat();
    if(!pool.length) throw new Error('No games returned');
    const picked = pickBalanced(pool, 6);
    renderGames(picked);
  }catch(err){
    renderError(err.message);
  }
}

if(document.getElementById('newsGrid')){
  loadSports();
}
