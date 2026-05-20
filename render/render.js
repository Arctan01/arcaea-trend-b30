'use strict';
const fs   = require('fs');
const path = require('path');
const { parseRatingCSV, parsePlayCSV, calcBest30, fingerprint } = require('./parse');
const { renderFrame } = require('./draw');
const { createCanvas } = require('canvas');

const ROOT = path.join(__dirname, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

const ratingHistory = parseRatingCSV(fs.readFileSync(path.resolve(__dirname, CONFIG.ratingCSV), 'utf-8'));
const playHistory   = parsePlayCSV(fs.readFileSync(path.resolve(__dirname, CONFIG.playCSV), 'utf-8'));

let songMap = {};
for (const p of ['src/songs/songlist', 'src/songs/songlist.json', 'src/songlist']) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf-8'));
    for (const s of data.songs || []) songMap[s.id] = s.title_localized?.en || s.id;
    console.log(`[Songlist] loaded ${Object.keys(songMap).length} songs`);
    break;
  } catch {}
}

const OUT = path.resolve(__dirname, CONFIG.outputDir || './frames');
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const settings = {
    profile:      CONFIG.profile || { name: 'Player' },
    showLS:       CONFIG.display?.showLS       ?? true,
    maxPureStyle: CONFIG.display?.maxPureStyle ?? 'plus',
    filter:       CONFIG.display?.filter       ?? 'b30',
  };

  const FILTERS = { b30: null, p30: p => p.far === 0 && p.lost === 0, ls0: p => p.ls === 0 && p.diff >= 2, max: p => p.pure === p.maxPure };
  const filter = FILTERS[settings.filter] || null;

  const SEC_PER_POINT   = CONFIG.secPerPoint   ?? 1.5;
  const TRANSITION_SECS = CONFIG.transitionSecs ?? 0.5;
  const FPS             = CONFIG.fps           ?? 30;
  const INCLUDE_CHART   = CONFIG.includeChart  ?? true;
  const INCLUDE_HEADER  = CONFIG.includeHeader ?? true;

  // 提前计算全局最高统计信息（供 Header 静态展示）
  const globalStats = calcBest30(playHistory, null, filter);

  // ── 构建生成关键帧列表 ──
  const keyframes = [];
  if (CONFIG.mode === 'ptt') {
    let currentTarget = CONFIG.pttStart;
    for (let ri = 0; ri < ratingHistory.length; ri++) {
      const rp = ratingHistory[ri];
      if (currentTarget > CONFIG.pttEnd) break;
      
      // 当实际 ptt 达到或超过当前目标时，生成该目标的画面，并且如果跨越了多个目标，就连续生成（保证动画滴答向上跳动）
      if (rp.rating >= currentTarget) {
        while (currentTarget <= rp.rating && currentTarget <= CONFIG.pttEnd) {
          keyframes.push({
            ri, rp,
            displayPtt: currentTarget // 视频面板展示不断跳动的整齐 PTT (如 12.01, 12.02)
          });
          currentTarget = parseFloat((currentTarget + CONFIG.pttStep).toFixed(4));
        }
      }
    }
  } else if(CONFIG.mode === 'all') {
    
    for (let ri = 0; ri < ratingHistory.length; ri++) {
      keyframes.push({ ri, rp: ratingHistory[ri], displayPtt: ratingHistory[ri].rating });
    }
  } else{
        // 默认 point 模式，一比一渲染 rating 节点，但是加上了start 和 end 的过滤，方便控制渲染范围
    for (let ri = 0; ri < ratingHistory.length; ri++) {
      const rp = ratingHistory[ri];
      if (rp.rating < CONFIG.pttStart) continue;
      if (rp.rating > CONFIG.pttEnd) break;
      keyframes.push({ ri, rp, displayPtt: rp.rating });
    }
  }
  const concatLines = ['ffconcat version 1.0'];
  let prevFp = '';
  let imgIdx = 0;
  let totalSecs = 0;
  let prevCanvas = null; 
  let mixCanvas = null;
  let mixCtx = null;

  console.log(`生成计划: ${keyframes.length} 帧...`);

  for (let k = 0; k < keyframes.length; k++) {
    const { ri, rp, displayPtt } = keyframes[k];
    const { b30 } = calcBest30(playHistory, rp.ts, filter);
    const fp = fingerprint(b30);

    process.stdout.write(`\r${k+1}/${keyframes.length}  帧:${imgIdx} PTT:${displayPtt.toFixed(2)}`);

    if (fp === prevFp && k !== 0 && displayPtt === keyframes[k-1].displayPtt) {
      // 没有任何变化时，只延长持续时间
      const lastLineIdx = concatLines.length - 1;
      const currentDur = parseFloat(concatLines[lastLineIdx].replace('duration ', ''));
      concatLines[lastLineIdx] = `duration ${(currentDur + SEC_PER_POINT).toFixed(3)}`;
      totalSecs += SEC_PER_POINT;
      continue;
    }

    const canvas = await renderFrame({
      ratingHistory, b30, ratingIdx: ri, displayPtt, globalStats,
      chartData: ratingHistory, songMap, settings,
      includeChart: INCLUDE_CHART, includeHeader: INCLUDE_HEADER
    });

    if (prevCanvas && TRANSITION_SECS > 0) {
      const transFrames = Math.round(TRANSITION_SECS * FPS);
      const frameDur = 1 / FPS;

      if (!mixCanvas) {
        mixCanvas = createCanvas(canvas.width, canvas.height);
        mixCtx = mixCanvas.getContext('2d');
      }

      for (let t = 1; t <= transFrames; t++) {
        mixCtx.globalAlpha = 1; mixCtx.drawImage(prevCanvas, 0, 0);
        mixCtx.globalAlpha = t / transFrames; mixCtx.drawImage(canvas, 0, 0);
        const tFilename = `frame_${String(imgIdx).padStart(6,'0')}.png`;
        fs.writeFileSync(path.join(OUT, tFilename), mixCanvas.toBuffer('image/png'));
        concatLines.push(`file '${path.join(OUT, tFilename).replace(/\\/g, '/')}'`);
        concatLines.push(`duration ${frameDur.toFixed(3)}`);
        imgIdx++; totalSecs += frameDur;
      }
    }

    const mainFilename = `frame_${String(imgIdx).padStart(6,'0')}.png`;
    fs.writeFileSync(path.join(OUT, mainFilename), canvas.toBuffer('image/png'));
    concatLines.push(`file '${path.join(OUT, mainFilename).replace(/\\/g, '/')}'`);
    
    const holdSecs = k === 0 ? SEC_PER_POINT : (SEC_PER_POINT - TRANSITION_SECS);
    concatLines.push(`duration ${Math.max(0.1, holdSecs).toFixed(3)}`);

    prevCanvas = canvas; prevFp = fp; imgIdx++; totalSecs += holdSecs;
  }

  if (imgIdx > 0) {
    const lastFile = `frame_${String(imgIdx-1).padStart(6,'0')}.png`;
    concatLines.push(`file '${path.join(OUT, lastFile).replace(/\\/g, '/')}'`);
  }

  const concatPath = path.join(OUT, 'concat.txt');
  fs.writeFileSync(concatPath, concatLines.join('\n'));
  console.log(`\n完成：共生成 ${imgIdx} 张图片，总时长预计 ${totalSecs.toFixed(1)}s`);
}

main().catch(console.error);