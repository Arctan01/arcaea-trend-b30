"use strict";
const rating = require('../rating');
// Keep the existing renderer API; the default is now Best 50.
function calcBest30(plays, ts = null, filter = null, size = 50) {
  const result = rating.calcBest(plays, ts, filter, size);
  return { ...result, b30: result.top };
}
function fingerprint(list) {
  return list.map(p => `${p.songId}_${p.diff}_${p.score}_${p.clearType}`).join('|');
}
module.exports = { ...rating, calcBest30, fingerprint };
