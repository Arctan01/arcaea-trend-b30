/* Shared by the browser and the local video renderer. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArcaeaRating = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const toMs = t => t < 1e12 ? t * 1000 : t;
  function potential(score, constant, clearType, legacy = false) {
    const base = score >= 10000000 ? constant + 2
      : score >= 9800000 ? constant + 1 + (score - 9800000) / 200000
      : Math.max(0, constant + (score - 9500000) / 300000);
    return base + (!legacy && clearType !== 0 ? 0.2 : 0);
  }
  function parseRatingCSV(txt) {
    return txt.trim().split(/\r?\n/).slice(1).map(line => {
      const p = line.split(',');
      if (p.length < 3) return null;
      const ts = toMs(Number(p[0])), raw = Number(p[2]);
      // New bot exports store PTT in tenths (130.53 = 13.053).
      const rating = raw > 20 ? Number((raw / 10).toFixed(6)) : raw;
      return Number.isFinite(ts) && Number.isFinite(rating)
        ? { ts, dateStr: p[1].replace(/^"|"$/g, '').trim(), rating } : null;
    }).filter(Boolean).sort((a, b) => a.ts - b.ts);
  }
  function parsePlayCSV(txt) {
    return txt.trim().split(/\r?\n/).slice(1).map(line => {
      const p = (line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || [])
        .map(x => x.replace(/^"|"$/g, '').trim());
      if (p.length < 12) return null;
      const ts = toMs(Number(p[11])), score = Number(p[2]), constant = Number(p[3]);
      const clearType = Number(p[10]) || 0;
      if (![ts, score, constant].every(Number.isFinite)) return null;
      return { songId: p[0], diff: Number(p[1]), score, constant, clearType,
        potential: potential(score, constant, clearType),
        ls: Number(p[5]) || 0, maxPure: Number(p[6]) || 0, pure: Number(p[7]) || 0,
        far: Number(p[8]) || 0, lost: Number(p[9]) || 0, ts, dateStr: p[12] || '' };
    }).filter(Boolean);
  }
  function calcBest(plays, ts = null, filter = null, size = 50) {
    const best = new Map(), EPS = 1e-6;
    for (const source of plays) {
      if (ts !== null && source.ts > ts) continue;
      const p = { ...source, potential: potential(source.score, source.constant, source.clearType, size === 30) };
      const key = p.songId + '_' + p.diff, ex = best.get(key);
      if (!ex || p.potential > ex.potential + EPS ||
          (Math.abs(p.potential - ex.potential) <= EPS && p.score > ex.score)) best.set(key, p);
    }
    const all = [...best.values()].filter(p => !filter || filter(p)).sort((a, b) => {
      const d = b.potential - a.potential;
      return Math.abs(d) > EPS ? d : b.score - a.score;
    });
    const top = all.slice(0, size), sum = top.reduce((s, p) => s + p.potential, 0);
    const t10sum = top.slice(0, 10).reduce((s, p) => s + p.potential, 0);
    return { top, all, total: all.length, avg: top.length ? sum / top.length : 0,
      t10avg: top.length ? t10sum / Math.min(10, top.length) : 0,
      maxPtt: (sum + t10sum) / (size + 10) };
  }
  function maxPotential(list, size = 50) {
    return (list.reduce((s, p) => s + p.potential, 0) +
      list.slice(0, 10).reduce((s, p) => s + p.potential, 0)) / (size + 10);
  }
  function queryConstants(plays, ts = null, filter = null, size = 50, query = {}) {
    const { min = 9, max = 9.9, sort = 'potential' } = query;
    if (![min, max].every(Number.isFinite) || min < 0 || max > 99 || min > max)
      throw new Error('cq.min / cq.max must be between 0 and 99, with min <= max');
    const comparators = {
      potential: (a, b) => b.potential - a.potential,
      score: (a, b) => b.score - a.score,
      constant: (a, b) => b.constant - a.constant,
      recent: (a, b) => b.ts - a.ts,
    };
    if (!Object.hasOwn(comparators, sort)) throw new Error(`Unknown cq.sort: ${sort}`);
    // Match the web: choose each chart's best record before applying query filters.
    const all = calcBest(plays, ts, null, size).all
      .filter(p => (!filter || filter(p)) && p.constant >= min && p.constant <= max)
      .sort(comparators[sort]);
    return { all, top: all.slice(0, 50), total: all.length,
      avg: all.length ? all.reduce((s, p) => s + p.potential, 0) / all.length : 0,
      min, max, sort };
  }
  return { potential, parseRatingCSV, parsePlayCSV, calcBest, maxPotential, queryConstants };
});
