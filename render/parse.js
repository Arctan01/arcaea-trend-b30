'use strict';
const toMs = t => t < 1e12 ? t * 1000 : t;

function parseRatingCSV(txt) {
  return txt.trim().split('\n').slice(1).map(l => {
    const p = l.split(',');
    if (p.length < 3) return null;
    const ts      = toMs(parseInt(p[0].trim()));
    const dateStr = p[1].trim().replace(/^"|"$/g, '');
    const rating  = parseFloat(p[2].trim());
    return isNaN(ts) || isNaN(rating) ? null : { ts, dateStr, rating };
  }).filter(Boolean).sort((a, b) => a.ts - b.ts);
}

function parsePlayCSV(txt) {
  return txt.trim().split('\n').slice(1).map(l => {
    const p     = l.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || l.split(',');
    const clean = p.map(x => x.replace(/^"|"$/g, '').trim());
    if (clean.length < 12) return null;
    const ts        = toMs(parseInt(clean[11]));
    const constant  = parseFloat(clean[3]);
    const potential = parseFloat(clean[4]);
    const score     = parseInt(clean[2]);
    if (isNaN(ts) || isNaN(constant) || isNaN(potential)) return null;
    return {
      songId: clean[0], diff: parseInt(clean[1] || '0'),
      score, constant, potential,
      ls:        parseFloat(clean[5]) || 0,
      maxPure:   parseInt(clean[6]) || 0,
      pure:      parseInt(clean[7]) || 0,
      far:       parseInt(clean[8]) || 0,
      lost:      parseInt(clean[9]) || 0,
      clearType: parseInt(clean[10]) || 0,
      ts, dateStr: clean[12] || '',
    };
  }).filter(Boolean);
}

function calcBest30(playHistory, ts = null, filter = null) {
  const EPS  = 0.000001;
  const best = new Map();
  for (const p of playHistory) {
    if (ts !== null && p.ts > ts) continue;
    const k  = p.songId + '_' + p.diff;
    const ex = best.get(k);
    if (!ex ||
        p.potential > ex.potential + EPS ||
        (Math.abs(p.potential - ex.potential) <= EPS && p.score > ex.score))
      best.set(k, p);
  }
  const all = [...best.values()]
    .filter(p => filter ? filter(p) : true)
    .sort((a, b) => {
      const d = b.potential - a.potential;
      return Math.abs(d) > EPS ? d : b.score - a.score;
    });
  const top    = all.slice(0, 30);
  const avg    = top.length ? top.reduce((s, x) => s + x.potential, 0) / top.length : 0;
  const t10avg = top.slice(0, 10).reduce((s, x) => s + x.potential, 0) / Math.min(10, top.length) || 0;
  return { b30: top, avg, t10avg };
}

function fingerprint(b30) {
  return b30.map(p => `${p.songId}_${p.diff}_${p.score}`).join('|');
}

module.exports = { parseRatingCSV, parsePlayCSV, calcBest30, fingerprint };