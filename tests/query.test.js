const { test } = require('node:test');
const assert = require('node:assert/strict');
const { queryConstants } = require('../rating');
const { createSelection } = require('../render/selection');
const { renderFrame } = require('../render/draw');

const play = (songId, overrides = {}) => ({ songId, diff: 2, score: 9800000,
  constant: 9.5, clearType: 1, far: 0, lost: 0, ls: 0, pure: 1000, maxPure: 999, ts: 1,
  ...overrides });

test('constant query filters inclusive bounds and historical best per chart before truncating', () => {
  const plays = Array.from({ length: 65 }, (_, i) => play(`s${i}`, { score: 9800000 + i * 100 }));
  plays.push(play('low', { constant: 9 }), play('high', { constant: 9.9 }),
    play('outside', { constant: 10 }), play('future', { ts: 100 }));
  plays.push(play('s0', { score: 10000000, ts: 2 }));
  const result = queryConstants(plays, 2, null, 50, { min: 9, max: 9.9 });
  assert.equal(result.total, 67);
  assert.equal(result.top.length, 50);
  assert.equal(result.all.filter(p => p.songId === 's0').length, 1);
  assert.equal(result.top[0].songId, 's0');
  assert.ok(result.all.some(p => p.songId === 'low'));
  assert.ok(result.all.some(p => p.songId === 'high'));
  assert.equal(result.avg, result.all.reduce((s, p) => s + p.potential, 0) / 67);
  assert.equal(queryConstants(plays, 0).total, 0);
});

test('all four sorts match web order and chart filters use the selected best record', () => {
  const plays = [play('highConstant', { constant: 9.9 }),
    play('highScore', { constant: 9, score: 9999999, ts: 2 }),
    play('latest', { ts: 3, constant: 9.1 })];
  const expected = { potential: 'highScore', score: 'highScore', constant: 'highConstant', recent: 'latest' };
  for (const [sort, id] of Object.entries(expected)) {
    assert.equal(queryConstants(plays, null, null, 50, { min: 9, max: 9.9, sort }).top[0].songId, id);
  }
  plays.push(play('latest', { ts: 4, score: 10000000, far: 1 }));
  const pSelection = createSelection({ display: { mode: 'cq', filter: 'p30' } });
  assert.ok(!pSelection.select(plays).b30.some(p => p.songId === 'latest'));
  for (const filter of ['b30', 'p30', 'ls0', 'max']) {
    const selection = createSelection({ display: { mode: 'cq', filter } });
    const result = selection.select(plays);
    if (filter === 'max') assert.equal(result.b30.length, 0);
    if (filter === 'ls0') assert.equal(result.b30.length, 3);
  }
  const modern = createSelection({ display: { mode: 'cq' } }).select(plays);
  const legacy = createSelection({ display: { mode: 'cq', rankSize: 30 } }).select(plays);
  assert.ok(Math.abs(modern.b30[0].potential - legacy.b30[0].potential - 0.2) < 1e-8);
});

test('query configuration rejects invalid ranges and sort names', () => {
  for (const cq of [{ min: 10, max: 9 }, { min: -1 }, { max: 100 }, { min: '9' }, { sort: 'typo' }]) {
    assert.throws(() => createSelection({ display: { mode: 'cq' }, cq }));
  }
  assert.equal(createSelection({}).displayMode, 'b30');
  assert.throws(() => createSelection({ display: { mode: 'typo' } }));
});

test('CQ always renders a 5 by 10 canvas and discards entries after 50, including legacy and empty queries', async () => {
  const plays = Array.from({ length: 65 }, (_, i) => play(`s${i}`));
  const selection = createSelection({ display: { mode: 'cq', rankSize: 30 } });
  const { b30, query } = selection.select(plays);
  assert.equal(b30.length, 50);
  const args = { ratingHistory: [], ratingIdx: -1, displayPtt: 0, globalStats: {}, chartData: [], songMap: {},
    settings: { displayMode: 'cq', rankSize: 30, filter: 'b30', scale: 1 }, includeChart: false };
  const first50 = await renderFrame({ ...args, b30, query });
  const withExtra = await renderFrame({ ...args, b30: [...b30, ...b30], query });
  const empty = await renderFrame({ ...args, b30: [], query: { ...query, total: 0, avg: 0 } });
  assert.equal(first50.width, 1812);
  assert.equal(first50.height, 970);
  assert.equal(empty.width, first50.width);
  assert.equal(empty.height, first50.height);
  assert.deepEqual(first50.data(), withExtra.data());
});
