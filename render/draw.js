"use strict";
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const { maxPotential } = require('../rating');
const { SV, drawCard, measureText: measure } = require('../canvas-style');
const ROOT = path.resolve(__dirname, '..');
for (const family of ['Exo-Regular', 'L2-Regular', 'GeosansLight']) {
  GlobalFonts.registerFromPath(path.join(ROOT, 'src/Fonts', family + '.ttf'), family);
}
const mc = createCanvas(1, 1).getContext('2d');
const measureText = (text, font) => measure(mc, text, font);
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
}
const imgBmpCache = new Map();
async function loadCover(songId, diff) {
  const key = songId + '_' + diff;
  if (imgBmpCache.has(key)) return imgBmpCache.get(key);
  const candidates = diff === 3
    ? [`src/songs/${songId}/1080_3_256.jpg`, `src/songs/${songId}/1080_base_256.jpg`, `src/songs/${songId}/base_256.jpg`]
    : [`src/songs/${songId}/1080_base_256.jpg`, `src/songs/${songId}/base_256.jpg`];
  for (const rel of candidates) {
    try { const img = await loadImage(path.join(ROOT, rel)); imgBmpCache.set(key, img); return img; } catch {}
  }
  imgBmpCache.set(key, null); return null;
}

function drawChart(c, W, H, chartData) {
  if (!chartData.length) return;
  const P = { t:14, r:24, b:42, l:45 };
  const CW = W - P.l - P.r, CH = H - P.t - P.b;
  const vals = chartData.map(d => d.rating);
  const mn = Math.min(...vals) - .08, mx = Math.max(...vals) + .08;
  const xOf = i => P.l + (i / (chartData.length - 1 || 1)) * CW;
  const yOf = v => P.t + (1 - (v - mn) / (mx - mn)) * CH;

  for (let g = 0; g <= 4; g++) {
    const v = mn + (mx - mn) * g / 4, y = yOf(v);
    c.strokeStyle = '#1e2238'; c.lineWidth = 1; c.setLineDash([3, 4]);
    c.beginPath(); c.moveTo(P.l, y); c.lineTo(W - P.r, y); c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#8886b8'; c.font = 'bold 11px Exo-Regular'; c.textAlign = 'right'; c.fillText(v.toFixed(2), P.l - 6, y + 4);
  }

  const gr = c.createLinearGradient(0, P.t, 0, H - P.b);
  gr.addColorStop(0, 'rgba(160,80,240,.28)'); gr.addColorStop(1, 'rgba(160,80,240,0)');
  c.beginPath(); c.moveTo(xOf(0), yOf(chartData[0].rating));
  for (let i = 1; i < chartData.length; i++) c.lineTo(xOf(i), yOf(chartData[i].rating));
  c.lineTo(xOf(chartData.length - 1), H - P.b); c.lineTo(xOf(0), H - P.b);
  c.closePath(); c.fillStyle = gr; c.fill();

  c.beginPath(); c.moveTo(xOf(0), yOf(chartData[0].rating));
  for (let i = 1; i < chartData.length; i++) c.lineTo(xOf(i), yOf(chartData[i].rating));
  c.strokeStyle = '#b070ff'; c.lineWidth = 2; c.stroke();

  const step = Math.max(1, Math.floor(chartData.length / 6));
  c.fillStyle = '#9896c8'; c.font = 'bold 11px Exo-Regular'; c.setLineDash([]);
  for (let i = 0; i < chartData.length; i += step) {
    const x = xOf(i);
    c.strokeStyle = '#3a3860'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, H - P.b); c.lineTo(x, H - P.b + 4); c.stroke();
    c.textAlign = (i === 0) ? 'left' : ((i + step >= chartData.length) ? 'right' : 'center');
    const parts = chartData[i].dateStr.split(' ');
    c.fillText(parts[0], x, H - P.b + 16);
    if (parts[1]) c.fillText(parts[1], x, H - P.b + 28);
  }
}

async function renderFrame({ ratingHistory, b30, ratingIdx, displayPtt, globalStats, chartData, songMap, settings, includeChart = true, includeHeader = false }) {
  const rankSize = settings.rankSize === 30 ? 30 : 50;
  const cols = rankSize === 50 ? 5 : 3;
  const SCALE = settings.scale ?? 1, PAD = 20;
  const svgW = cols * SV.CARD_W + (cols - 1) * SV.GAP;
  const rows = Math.max(10, Math.ceil(b30.length / cols));
  const PLAYER_H = includeHeader ? 74 : 0;
  const CHART_H = includeChart && chartData.length ? 210 + 44 : 0;
  const totalH = PAD + PLAYER_H + CHART_H + 30 + 8 + (rows * SV.CARD_H + (rows - 1) * SV.GAP) + PAD;
  const totalW = PAD * 2 + svgW;

  const canvas = createCanvas(Math.ceil(totalW * SCALE / 2) * 2, Math.ceil(totalH * SCALE / 2) * 2);
  const c = canvas.getContext('2d');
  c.scale(SCALE, SCALE);

  c.fillStyle = '#0b0c18'; c.fillRect(0, 0, canvas.width / SCALE, canvas.height / SCALE);

  let y = PAD;

  // ── Profile Header ──
  if (includeHeader) {
    const name = settings.profile?.name || `Arcaea Best ${rankSize}`;
    const pttStr = `PTT ${displayPtt.toFixed(3)}`;
    
    c.font = 'bold 22px GeosansLight'; c.fillStyle = '#eae8ff'; c.textAlign = 'left';
    c.fillText(name, PAD, y + 22);
    
    const pillX = PAD + measureText(name, 'bold 22px GeosansLight') + 12;
    const pttW = measureText(pttStr, 'bold 13px Exo-Regular');
    
    c.fillStyle = '#5020a0'; roundRect(c, pillX, y + 6, pttW + 20, 22, 5); c.fill();
    c.strokeStyle = '#a060ff'; c.lineWidth = 1; roundRect(c, pillX, y + 6, pttW + 20, 22, 5); c.stroke();
    
    c.font = 'bold 13px Exo-Regular'; c.fillStyle = '#fff'; c.fillText(pttStr, pillX + 10, y + 21);
    y += 42;

    const statsItems = [
      { label:`BEST${rankSize} Avg `, val: globalStats.avg.toFixed(4), valW: 52 },
      { label:'TOP10 Avg ', val: globalStats.t10avg.toFixed(4), valW: 52 },
      { label:'Date Range ', val: `${chartData[0]?.dateStr.split(' ')[0]} ~ ${chartData[chartData.length-1]?.dateStr.split(' ')[0]}` }
    ];
    let sx = PAD;
    for (const { label, val, valW } of statsItems) {
      c.font = '12px Exo-Regular'; c.fillStyle = '#525080'; c.fillText(label, sx, y + 14);
      sx += measureText(label, '12px Exo-Regular');
      c.font = 'bold 12px Exo-Regular'; c.fillStyle = '#c8a0ff'; c.fillText(val, sx, y + 14);
      sx += (valW ?? 160) + 16;
    }
    y += 20;
  }

  // ── Chart ──
  if (includeChart && chartData.length) {
    c.font = 'bold 10px Exo-Regular'; c.fillStyle = '#525080'; c.textAlign = 'left';
    c.fillText('RATING HISTORY', PAD, y + 14);
    y += 20;
    c.fillStyle = '#181b2e'; roundRect(c, PAD, y, svgW, 210, 10); c.fill();
    c.strokeStyle = '#272b48'; c.lineWidth = 1; roundRect(c, PAD, y, svgW, 210, 10); c.stroke();
    
    c.save(); c.translate(PAD, y); drawChart(c, svgW, 210, chartData);
    if (ratingIdx >= 0) {
      const P = { t:14, r:24, b:42, l:45 };
      const CW = svgW - P.l - P.r, CH = 210 - P.t - P.b;
      const vals = chartData.map(d => d.rating);
      const mn = Math.min(...vals) - .08, mx = Math.max(...vals) + .08;
      const hx = P.l + (ratingIdx / (chartData.length - 1 || 1)) * CW;
      const hy = P.t + (1 - (chartData[ratingIdx].rating - mn) / (mx - mn)) * CH;
      c.beginPath(); c.moveTo(hx, P.t); c.lineTo(hx, 210 - P.b);
      c.strokeStyle = 'rgba(180,120,255,.25)'; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.arc(hx, hy, 5, 0, Math.PI * 2);
      c.fillStyle = '#c080ff'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.stroke();
    }
    c.restore();
    y += 210 + 16;
  }

  // ── B30 Header ──
  const avg = b30.length ? b30.reduce((s, x) => s + x.potential, 0) / b30.length : 0;
  const t10 = b30.length ? b30.slice(0, 10).reduce((s, x) => s + x.potential, 0) / Math.min(10, b30.length) : 0;
  const mxptt = maxPotential(b30, rankSize);
  const dateLabel = ratingHistory[ratingIdx]?.dateStr || '';
  const COL = { title:PAD, date:PAD+40, avg:PAD+220, t10:PAD+320, mx:PAD+410 };

  c.font = 'bold 11px Exo-Regular'; c.fillStyle = '#525080'; c.textAlign = 'left'; c.fillText(({ p30: `P${rankSize}`, ls0: `LS0·${rankSize}`, max: `MAX·${rankSize}` })[settings.filter] || `B${rankSize}`, COL.title, y + 18);
  c.font = 'bold 13px Exo-Regular'; c.fillStyle = '#80c4ff'; c.fillText(dateLabel, COL.date, y + 19);
  if (avg) {
    const stats = [
      { l:`B${rankSize}Avg `, v:avg.toFixed(4), x:COL.avg },
      { l:'T10Avg ', v:t10.toFixed(4), x:COL.t10 },
      { l:'Max ', v:mxptt.toFixed(4), x:COL.mx }
    ];
    for (const { l, v, x } of stats) {
      c.font = '11px Exo-Regular'; c.fillStyle = '#9896c8'; c.fillText(l, x, y + 18);
      c.font = 'bold 11px Exo-Regular'; c.fillStyle = '#c8a0ff'; c.fillText(v, x + measureText(l, '11px Exo-Regular'), y + 18);
    }
  }
  y += 30;

  const mergedSettings = { ...settings, songMap };
  for (let i = 0; i < b30.length; i++) {
    drawCard(c, b30[i], i, PAD + (i % cols) * (SV.CARD_W + SV.GAP), y + Math.floor(i / cols) * (SV.CARD_H + SV.GAP), mergedSettings, await loadCover(b30[i].songId, b30[i].diff));
  }

  return canvas;
}

module.exports = { renderFrame };