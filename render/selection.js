'use strict';
const { calcBest30, queryConstants } = require('./parse');
const FILTERS = { b30: null, p30: p => p.far === 0 && p.lost === 0,
  ls0: p => p.ls === 0 && p.diff >= 2, max: p => p.pure === p.maxPure };

function createSelection(config) {
  const display = config.display || {};
  const displayMode = display.mode ?? 'b30';
  if (!['b30', 'cq'].includes(displayMode)) throw new Error(`Unknown display.mode: ${displayMode}`);
  const filterName = display.filter ?? 'b30';
  if (!Object.hasOwn(FILTERS, filterName)) throw new Error(`Unknown filter: ${filterName}`);
  const filter = FILTERS[filterName], rankSize = display.rankSize === 30 ? 30 : 50;
  const cq = config.cq || {};
  if (displayMode === 'cq') queryConstants([], null, filter, rankSize, cq);
  return { displayMode, filterName, rankSize,
    select(plays, ts = null) {
      if (displayMode === 'cq') {
        const query = queryConstants(plays, ts, filter, rankSize, cq);
        return { b30: query.top, query };
      }
      return calcBest30(plays, ts, filter, rankSize);
    },
    globalStats(plays) { return calcBest30(plays, null, filter, rankSize); },
  };
}
module.exports = { createSelection };
