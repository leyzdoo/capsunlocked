'use strict';
// Fixed public game feed. No API key, visitor data, or arbitrary upstream URLs.
const EVENT = '401917527';
const UPSTREAM = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=' + EVENT;
const GAMECAST = 'https://www.espn.com/mens-college-basketball/game/_/gameId/' + EVENT + '/east-texas-am-portland';

function normalize(raw) {
  const game = raw.header?.competitions?.[0];
  if (!game || !Array.isArray(game.competitors)) throw new Error('Game not available');
  const status = game.status || {};
  const phase = status.type?.state || 'pre';
  // Pregame boxscore.teams contains SEASON averages, not tonight's statistics.
  const hasBox = phase !== 'pre' && game.boxscoreAvailable !== false;
  const teams = game.competitors.map(c => ({
    id: String(c.id), name: c.team?.displayName || '', shortName: c.team?.abbreviation || '',
    homeAway: c.homeAway, score: c.score == null || c.score === '' ? null : String(c.score),
    winner: c.winner === true,
    linescores: (c.linescores || []).map(s => s.displayValue ?? String(s.value ?? '—')),
    statistics: hasBox ? (raw.boxscore?.teams || []).find(t => String(t.team?.id) === String(c.id))?.statistics?.map(s => ({
      name: s.name, label: s.label || s.abbreviation || s.name, value: s.displayValue ?? '—'
    })) || [] : []
  })).sort((a,b) => (a.id === '2501' ? -1 : b.id === '2501' ? 1 : 0));
  const players = hasBox ? (raw.boxscore?.players || []).map(t => ({
    teamId: String(t.team?.id), name: t.team?.displayName || '',
    groups: (t.statistics || []).map(g => ({
      labels: g.labels || g.names || [], descriptions: g.descriptions || g.labels || [], totals: g.totals || [],
      athletes: (g.athletes || []).map(p => ({
        id: p.athlete?.id, name: p.athlete?.displayName || '', jersey: p.athlete?.jersey ?? '',
        starter: p.starter === true, didNotPlay: p.didNotPlay === true, reason: p.reason || '', stats: p.stats || []
      }))
    }))
  })) : [];
  return {
    eventId: String(raw.header.id), provider: 'ESPN', fetchedAt: new Date().toISOString(),
    sourceTime: raw.plays?.slice(-1)[0]?.wallclock || null,
    date: game.date, phase, completed: status.type?.completed === true,
    detail: status.type?.shortDetail || status.type?.detail || status.type?.description || 'Scheduled',
    clock: status.displayClock || '', period: status.period || 0, hasBox, teams, players,
    plays: phase === 'pre' ? [] : (raw.plays || []).slice(-18).reverse().map(p => ({
      id: p.id, text: p.text || '', period: p.period?.displayValue || '', clock: p.clock?.displayValue || '',
      homeScore: p.homeScore, awayScore: p.awayScore, scoring: p.scoringPlay === true
    })),
    links: {gamecast: GAMECAST, official: 'https://stats.statbroadcast.com/broadcast/?id=682844'}
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error: 'GET only'});
  }
  try {
    const response = await fetch(UPSTREAM, {signal: AbortSignal.timeout(9000), headers: {'Accept': 'application/json'}});
    if (!response.ok) throw new Error('Upstream unavailable');
    const raw = await response.json();
    const ids = raw.header?.competitions?.[0]?.competitors?.map(t => String(t.id)) || [];
    if (String(raw.header?.id) !== EVENT || !ids.includes('2501') || !ids.includes('2837')) throw new Error('Wrong game');
    const data = normalize(raw);
    // No stale-while-revalidate: the UI explicitly detects an old cached payload.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15');
    return res.status(200).json(data);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({error: 'Live feed temporarily unavailable. Use official live stats.', provider: 'ESPN'});
  }
};
module.exports.normalize = normalize;
