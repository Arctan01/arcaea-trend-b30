const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { potential, parsePlayCSV, parseRatingCSV, calcBest } = require('../rating');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('clear bonus, score boundaries, legacy formula and floor', () => {
  close(potential(10001234, 11.2, 3), 13.4);
  close(potential(9800000, 11.2, 0), 12.2);
  for (const clear of [1, 2, 3, 4, 5]) close(potential(9800000, 11.2, clear), 12.4);
  close(potential(9500000, 11.2, 1), 11.4);
  close(potential(10001234, 11.2, 3, true), 13.2);
  close(potential(0, 1, 0), 0);
});

test('rank distinct charts by potential, respect history and pad missing slots', () => {
  const plays = Array.from({ length: 60 }, (_, i) => ({ songId: `s${i}`, diff: 2,
    score: 10000000, constant: 10 - i / 10, clearType: 3, ts: 10 }));
  plays.push({ ...plays[0], score: 9800000, ts: 5 });
  assert.equal(calcBest(plays, 9).top.length, 1);
  close(calcBest(plays, 9).maxPtt, 22.4 / 60);
  assert.equal(calcBest(plays).top.length, 50);
  assert.equal(calcBest(plays, null, null, 30).top.length, 30);
  const best = calcBest(plays);
  close(best.maxPtt, (best.avg * 50 + best.t10avg * 10) / 60);
  const old = calcBest(plays, null, null, 30);
  close(old.maxPtt, (old.avg * 30 + old.t10avg * 10) / 40);
});

const sample = path.join(__dirname, '../data/example/new');
test('new sample: every single-play potential and latest PTT match exports',
  { skip: !fs.existsSync(path.join(sample, 'all_scores.csv')) }, () => {
    const csv = fs.readFileSync(path.join(sample, 'all_scores.csv'), 'utf8');
    const plays = parsePlayCSV(csv);
    const rows = csv.trim().split('\n').slice(1);
    assert.equal(plays.length, rows.length);
    plays.forEach((p, i) => close(p.potential, Number(rows[i].split(',')[4])));
    const ratings = parseRatingCSV(fs.readFileSync(path.join(sample, 'ratings.csv'), 'utf8'));
    const last = ratings.at(-1);
    close(last.rating, 13.053);
    for (const record of ratings.slice(-5)) {
      close(Math.floor(calcBest(plays, record.ts).maxPtt * 1000) / 1000, record.rating);
    }
    close(calcBest(plays, last.ts).maxPtt, 13.053263833333338);
  });
