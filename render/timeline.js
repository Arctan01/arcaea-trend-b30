'use strict';
function buildTimeline(history, config) {
  const fps = config.fps ?? 30, seconds = config.secPerPoint ?? 1.5;
  const transition = config.transitionSecs ?? 0.5;
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new Error('fps must be an integer from 1 to 120');
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds * fps < 1) throw new Error('secPerPoint must be at least one frame');
  if (!Number.isFinite(transition) || transition < 0 || transition > seconds) throw new Error('transitionSecs must be between 0 and secPerPoint');
  const mode = config.mode ?? 'point', points = [];
  const start = config.pttStart ?? -Infinity, end = config.pttEnd ?? Infinity;
  if (start > end) throw new Error('pttStart must not exceed pttEnd');
  if (mode === 'ptt') {
    const step = config.pttStep ?? 0.01;
    if (![start, end, step].every(Number.isFinite) || step < 0.0001)
      throw new Error('ptt mode requires finite bounds and pttStep >= 0.0001');
    let n = 0;
    for (let ri = 0; ri < history.length; ri++) {
      let value = Number((start + n * step).toFixed(6));
      while (value <= end + 1e-9 && value <= history[ri].rating + 1e-9) {
        points.push({ ri, rp: history[ri], displayPtt: value });
        n++; value = Number((start + n * step).toFixed(6));
      }
      if (value > end) break;
    }
  } else if (mode === 'all' || mode === 'point') {
    history.forEach((rp, ri) => {
      if (mode === 'all' || (rp.rating >= start && rp.rating <= end))
        points.push({ ri, rp, displayPtt: rp.rating });
    });
  } else throw new Error(`Unknown mode: ${mode}`);
  return points.map((point, i) => {
    // Round cumulative time so fractional frame durations never accumulate drift.
    const frames = Math.round((i + 1) * seconds * fps) - Math.round(i * seconds * fps);
    return { ...point, frames, transitionFrames: i ? Math.min(frames, Math.round(transition * fps)) : 0 };
  });
}
module.exports = { buildTimeline };
