'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas } = require('@napi-rs/canvas');
const { parseRatingCSV, parsePlayCSV, calcBest30 } = require('./parse');
const { renderFrame } = require('./draw');
const { loadConfig, videoOptions } = require('./video-options');
const { buildTimeline } = require('./timeline');
const { createEncoder } = require('./stream-encoder');

async function exportVideo(config) {
  const started = performance.now(), options = videoOptions(config);
  const resolve = value => path.resolve(__dirname, value);
  const ratingFile = resolve(config.ratingCSV), playFile = resolve(config.playCSV);
  const output = resolve(config.output ?? './b50-timelapse.mp4');
  if ([ratingFile, playFile].includes(output)) throw new Error('Output must not overwrite input CSV');
  const ratings = parseRatingCSV(fs.readFileSync(ratingFile, 'utf8'));
  const plays = parsePlayCSV(fs.readFileSync(playFile, 'utf8'));
  const points = buildTimeline(ratings, config);
  if (!points.length) throw new Error('No rating records in the selected range');
  const songMap = {};
  const songs = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/songs/songlist'), 'utf8'));
  for (const song of songs.songs || []) songMap[song.id] = song.title_localized?.en || song.id;
  const settings = { rankSize: config.display?.rankSize === 30 ? 30 : 50,
    showLS: config.display?.showLS ?? true, maxPureStyle: config.display?.maxPureStyle ?? 'plus',
    profile: config.profile || {}, filter: config.display?.filter ?? 'b30', scale: options.scale };
  const filters = { b30: null, p30: p => p.far === 0 && p.lost === 0,
    ls0: p => p.ls === 0 && p.diff >= 2, max: p => p.pure === p.maxPure };
  if (!(settings.filter in filters)) throw new Error(`Unknown filter: ${settings.filter}`);
  const filter = filters[settings.filter];
  const globalStats = calcBest30(plays, null, filter, settings.rankSize);
  let encoder, previous, mix, ctx;
  try {
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const { b30 } = calcBest30(plays, point.rp.ts, filter, settings.rankSize);
      const canvas = await renderFrame({ ratingHistory: ratings, b30, ratingIdx: point.ri,
        displayPtt: point.displayPtt, globalStats, chartData: ratings, songMap, settings,
        includeChart: config.includeChart ?? true, includeHeader: config.includeHeader ?? true });
      if (!encoder) {
        encoder = createEncoder({ width: canvas.width, height: canvas.height,
          fps: config.fps ?? 30, output, ...options });
        mix = createCanvas(canvas.width, canvas.height); ctx = mix.getContext('2d');
        console.log(`${canvas.width}×${canvas.height}, ${options.profile}, ${points.length} keyframes; streaming directly to MP4`);
      }
      if (previous && point.transitionFrames) {
        for (let t = 1; t <= point.transitionFrames; t++) {
          ctx.globalAlpha = 1; ctx.drawImage(previous, 0, 0);
          ctx.globalAlpha = t / point.transitionFrames; ctx.drawImage(canvas, 0, 0);
          await encoder.write(mix.data());
        }
      }
      const raw = canvas.data();
      for (let j = point.transitionFrames; j < point.frames; j++) await encoder.write(raw);
      previous = canvas;
      process.stdout.write(`\r${i + 1}/${points.length} keyframes, ${encoder.count} video frames`);
    }
    await encoder.finish();
    const elapsed = (performance.now() - started) / 1000;
    console.log(`\nSaved ${output}\n${(encoder.count / (config.fps ?? 30)).toFixed(2)}s video in ${elapsed.toFixed(2)}s; no frame files`);
    return { output, frames: encoder.count, elapsed };
  } catch (error) {
    if (encoder) await encoder.abort();
    throw error;
  }
}
if (require.main === module) {
  Promise.resolve().then(() => exportVideo(loadConfig())).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
module.exports = { exportVideo };
