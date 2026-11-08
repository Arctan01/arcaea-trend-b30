const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createCanvas } = require('@napi-rs/canvas');
const { videoOptions, PROFILES } = require('../render/video-options');
const { buildTimeline } = require('../render/timeline');
const { createEncoder } = require('../render/stream-encoder');
const { renderFrame } = require('../render/draw');

test('B30/B50 keep fixed canvas dimensions across sparse history and fractional scales', async () => {
  const play = { songId: 'aegleseeker', diff: 2, score: 10000000, constant: 11.2,
    potential: 13.4, clearType: 3, pure: 1568, maxPure: 1498, far: 0, lost: 0, ls: 0, ts: 1 };
  for (const [rankSize, scale] of [[50, 0.75], [30, 1.25], [50, 2]]) {
    for (const b30 of [[], [play]]) {
      const canvas = await renderFrame({ ratingHistory: [], b30, ratingIdx: -1,
        displayPtt: 0, globalStats: {}, chartData: [], songMap: {},
        settings: { rankSize, scale, maxPureStyle: 'minus', showLS: false },
        includeChart: false, includeHeader: false });
      const logicalWidth = rankSize === 50 ? 1812 : 1100;
      assert.equal(canvas.width, Math.ceil(logicalWidth * scale / 2) * 2);
      assert.equal(canvas.height, Math.ceil(970 * scale / 2) * 2);
      assert.equal(canvas.data().length, canvas.width * canvas.height * 4);
    }
  }
});

test('video profiles allow fractional scales and explicit overrides', () => {
  for (const profile of Object.keys(PROFILES)) assert.ok(videoOptions({ video: { profile } }).preset);
  assert.deepEqual(videoOptions({ video: { scale: 1.25, profile: 'fast', crf: 18 } }),
    { scale: 1.25, profile: 'fast', crf: 18, preset: 'veryfast' });
  for (const video of [{ scale: 0 }, { scale: 5 }, { profile: 'typo' }, { crf: 99 }, { preset: 'typo' }])
    assert.throws(() => videoOptions({ video }));
});

test('timeline preserves dates, bounds and frame-accurate hold/transition durations', () => {
  const history = Array.from({ length: 100 }, (_, i) => ({ ts: i, rating: 12 + i / 100 }));
  const timeline = buildTimeline(history, { mode: 'all', fps: 30, secPerPoint: 0.35, transitionSecs: 0.1 });
  assert.equal(timeline.reduce((n, p) => n + p.frames, 0), 1050);
  assert.equal(timeline[0].transitionFrames, 0);
  assert.equal(timeline[1].transitionFrames, 3);
  const selected = buildTimeline(history, { mode: 'ptt', pttStart: 12.9, pttEnd: 12.99, pttStep: 0.03 });
  assert.deepEqual(selected.map(p => p.displayPtt), [12.9, 12.93, 12.96, 12.99]);
  assert.equal(buildTimeline(history, { mode: 'point', pttStart: 14 }).length, 0);
  assert.throws(() => buildTimeline(history, { pttStep: 0, mode: 'ptt', pttStart: 12, pttEnd: 13 }));
  assert.throws(() => buildTimeline(history, { secPerPoint: 0.2, transitionSecs: 0.3 }));
});

const hasFFmpeg = spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status === 0;
test('raw RGBA streaming encodes exact frames, colors and duration without PNGs', { skip: !hasFFmpeg }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcaea-video-'));
  const output = path.join(dir, 'test.mp4');
  const encoder = createEncoder({ width: 64, height: 32, fps: 10, output, preset: 'ultrafast', crf: 0 });
  try {
    const canvas = createCanvas(64, 32), c = canvas.getContext('2d');
    for (const color of ['#ff0000', '#0000ff']) {
      c.fillStyle = color; c.fillRect(0, 0, 64, 32);
      const data = canvas.data();
      for (let i = 0; i < 5; i++) await encoder.write(data);
    }
    await encoder.finish();
    assert.deepEqual(fs.readdirSync(dir), ['test.mp4']);
    const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', output, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { windowsHide: true });
    assert.equal(decoded.status, 0);
    assert.equal(decoded.stdout.length, 64 * 32 * 3 * 10);
    assert.ok(decoded.stdout[0] > 240 && decoded.stdout[2] < 15, 'red channel must not be swapped');
    const last = 64 * 32 * 3 * 9;
    assert.ok(decoded.stdout[last] < 15 && decoded.stdout[last + 2] > 240);
  } finally { await encoder.abort(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('missing encoder fails cleanly and preserves existing output', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcaea-video-error-'));
  const output = path.join(dir, 'existing.mp4'); fs.writeFileSync(output, 'original');
  const encoder = createEncoder({ width: 2, height: 2, fps: 30, output, preset: 'fast', crf: 20,
    ffmpegPath: path.join(dir, 'does-not-exist') });
  try {
    await assert.rejects(async () => { await encoder.write(Buffer.alloc(16)); await encoder.finish(); });
  } finally {
    await encoder.abort();
    assert.equal(fs.readFileSync(output, 'utf8'), 'original');
    assert.deepEqual(fs.readdirSync(dir), ['existing.mp4']);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
