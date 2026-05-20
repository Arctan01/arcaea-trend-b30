'use strict';
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
registerFont(path.join(ROOT, 'src/Fonts/Exo-Regular.ttf'),  { family: 'Exo-Regular', weight: 'normal' });
registerFont(path.join(ROOT, 'src/Fonts/Exo-Regular.ttf'),  { family: 'Exo-Regular', weight: 'bold' });
registerFont(path.join(ROOT, 'src/Fonts/Exo-Regular.ttf'),  { family: 'Exo-Regular', weight: '600' });
registerFont(path.join(ROOT, 'src/Fonts/L2-Regular.ttf'),   { family: 'L2-Regular', weight: 'normal' });
registerFont(path.join(ROOT, 'src/Fonts/L2-Regular.ttf'),   { family: 'L2-Regular', weight: 'bold' });
registerFont(path.join(ROOT, 'src/Fonts/GeosansLight.ttf'), { family: 'GeosansLight', weight: 'normal' });
registerFont(path.join(ROOT, 'src/Fonts/GeosansLight.ttf'), { family: 'GeosansLight', weight: 'bold' });

const SV = {
  COLS:3, CARD_W:348, CARD_H:82, GAP:8, COVER:82,
  BODY_X:94, R1_Y:20, R2_Y:54, DATE_Y:74,
  BG:'#181b2e', SURF2:'#1e2238',
  TEXT:'#eae8ff', TEXT2:'#9896c8', TEXT3:'#525080',
  NO_COL:'#acaefb',
  P_COL:'#C534A2', F_COL:'#EBB69D', L_COL:'#a94658',
  DATE_COL:'#8d9da4', LS_COL:'#504d8d', ACC2:'#80c4ff',
};

const _mc = createCanvas(1, 1).getContext('2d');
function measureText(text, font) { _mc.font = font; return _mc.measureText(text).width*1.1; }
function truncate(text, maxW, font) {
  if (measureText(text, font) <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    measureText(text.slice(0, mid) + '…', font) <= maxW ? lo = mid : hi = mid - 1;
  }
  return text.slice(0, lo - 1) + '…';
}

function diffStyle(d) {
  if (d===4) return { main:'#8A7AA5', bg:'rgba(203,167,247,0.15)', border:'rgba(138,122,165,.5)' };
  if (d===3) return { main:'#e84060', bg:'rgba(232,64,96,0.15)',   border:'rgba(232,64,96,.5)'   };
  if (d===2) return { main:'#a050f0', bg:'rgba(160,80,240,0.15)',  border:'rgba(160,80,240,.5)'  };
  if (d===1) return { main:'#50d890', bg:'rgba(80,216,144,0.13)',  border:'rgba(80,216,144,.4)'  };
  return     { main:'#4BACCF', bg:'rgba(39,172,255,0.12)',  border:'rgba(75,172,207,.4)'  };
}

function clearCls(ct) {
  if (ct===5) return { lbl:'HC', col:'#9a3753' };
  if (ct===4) return { lbl:'EC', col:'#6a4080' };
  if (ct===3) return { lbl:'PM', col:'#2580A0' };
  if (ct===2) return { lbl:'FR', col:'#773481' };
  if (ct===1) return { lbl:'NC', col:'#774271' };
  if (ct===0) return { lbl:'TL', col:'#992b4c' };
  return { lbl:'', col:'' };
}

function fmtScore(n) { return String(n).padStart(8, '0').replace(/(\d{2})(\d{3})(\d{3})/, "$1'$2'$3"); }
function calculateDaysSince(ts) { return Math.floor(Math.abs(Date.now() - ts) / 86400000); }

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y);
  c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
  c.closePath();
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

async function drawCard(c, p, i, x0, y0, settings) {
  const ds = diffStyle(p.diff);
  const cl = clearCls(p.clearType);
  const R = 10, bx = x0 + SV.BODY_X;
  const scoreColor = p.pure === p.maxPure ? SV.ACC2 : SV.TEXT2;
  const mpStr = settings.maxPureStyle === 'plus' ? `(+${p.maxPure})` : `(-${p.pure - p.maxPure})`;
  const titleStr = truncate(settings.songMap[p.songId] || p.songId, SV.CARD_W - SV.BODY_X - 84, 'bold 15px L2-Regular');

  c.fillStyle = SV.BG; roundRect(c, x0, y0, SV.CARD_W, SV.CARD_H, R); c.fill();
  c.strokeStyle = ds.border; c.lineWidth = 1; roundRect(c, x0, y0, SV.CARD_W, SV.CARD_H, R); c.stroke();

  c.save(); roundRect(c, x0, y0, SV.COVER + 3, SV.CARD_H, R); c.clip();
  c.fillStyle = ds.main; c.fillRect(x0, y0, 3, SV.CARD_H);
  c.fillStyle = SV.SURF2; c.fillRect(x0 + 3, y0, SV.COVER, SV.CARD_H);
  const img = await loadCover(p.songId, p.diff);
  if (img) {
    const scale = Math.max(SV.COVER / img.width, SV.CARD_H / img.height);
    const sw = SV.COVER / scale, sh = SV.CARD_H / scale;
    c.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x0 + 3, y0, SV.COVER, SV.CARD_H);
  }
  c.restore();

  c.textAlign = 'left';
  c.font = 'bold 17px Exo-Regular'; c.fillStyle = SV.NO_COL; c.fillText(`#${i + 1}`, bx, y0 + SV.R1_Y);
  c.font = 'bold 15px L2-Regular'; c.fillStyle = SV.TEXT; c.fillText(titleStr, bx + 34, y0 + SV.R1_Y);
  c.font = 'bold 16px Exo-Regular'; c.fillStyle = ds.main; c.textAlign = 'right'; c.fillText(p.potential.toFixed(4), x0 + SV.CARD_W - 8, y0 + SV.R1_Y);

  // ── 修复 Glow (发光) 特效 ──
  c.textAlign = 'left';
  // 强制偏移归零，避免部分环境错位
  c.shadowOffsetX = 0; c.shadowOffsetY = 0; 
  if (p.pure === p.maxPure) { 
    c.shadowBlur = 12; c.shadowColor = 'rgba(100,180,255,0.7)'; 
  } else { 
    c.shadowBlur = 6; c.shadowColor = 'rgba(152,150,200,0.5)'; 
  }
  c.font = 'bold 26px Exo-Regular'; c.fillStyle = scoreColor; c.fillText(fmtScore(p.score), bx, y0 + SV.R2_Y - 2);
  c.shadowBlur = 0; c.shadowColor = 'transparent';

  if (cl.lbl) {
    c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    if (p.clearType === 3) { c.shadowBlur = 8; c.shadowColor = 'rgba(100,180,255,0.5)'; }
    c.font = 'bold 20px Exo-Regular'; c.fillStyle = cl.col; c.fillText(cl.lbl, bx + 155, y0 + SV.R2_Y - 3);
    c.shadowBlur = 0; c.shadowColor = 'transparent';
  }

  c.fillStyle = ds.bg; roundRect(c, x0 + SV.CARD_W - 48, y0 + SV.R2_Y - 19, 38, 17, 3); c.fill();
  c.strokeStyle = ds.border; c.lineWidth = 0.5; roundRect(c, x0 + SV.CARD_W - 48, y0 + SV.R2_Y - 19, 38, 17, 3); c.stroke();
  c.font = 'bold 13px Exo-Regular'; c.fillStyle = ds.main; c.textAlign = 'center';
  c.fillText(p.constant.toFixed(1), x0 + SV.CARD_W - 29, y0 + SV.R2_Y - 6);

  c.textAlign = 'left';
  const drawPFL = (l, v, e, x) => {
    c.font = '12px Exo-Regular'; c.fillText(l + '/', x, y0 + SV.DATE_Y);
    const lw = measureText(l + '/', '12px Exo-Regular');
    c.font = 'bold 12px Exo-Regular'; c.fillText(String(v), x + lw, y0 + SV.DATE_Y);
    if (e) { c.font = '12px Exo-Regular'; c.fillText(` ${e}`, x + lw + measureText(String(v), 'bold 12px Exo-Regular'), y0 + SV.DATE_Y); }
  };
  c.fillStyle = SV.P_COL; drawPFL('P', p.pure, mpStr, bx);
  c.fillStyle = SV.F_COL; drawPFL('F', p.far, null, bx + 90);
  c.fillStyle = SV.L_COL; drawPFL('L', p.lost, null, bx + 120);
  if (settings.showLS) { c.fillStyle = SV.LS_COL; drawPFL('LS', p.ls.toFixed(1), null, bx + 152); }
  c.font = 'bold 12px Exo-Regular'; c.fillStyle = SV.DATE_COL; c.textAlign = 'right';
  c.fillText(`${calculateDaysSince(p.ts)}d`, x0 + SV.CARD_W - 8, y0 + SV.DATE_Y);
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
  const SCALE = 2, PAD = 20;
  const svgW = SV.COLS * SV.CARD_W + (SV.COLS - 1) * SV.GAP;
  const rows = Math.ceil(b30.length / SV.COLS);
  const PLAYER_H = includeHeader ? 74 : 0;
  const CHART_H = includeChart && chartData.length ? 210 + 44 : 0;
  const totalH = PAD + PLAYER_H + CHART_H + 30 + 8 + (rows * SV.CARD_H + (rows - 1) * SV.GAP) + PAD;
  const totalW = PAD * 2 + svgW;

  const canvas = createCanvas(totalW * SCALE, totalH * SCALE);
  const c = canvas.getContext('2d');
  c.scale(SCALE, SCALE);

  // ──【重要】利用原型链劫持，为所有加了 bold/600/700 的文字自动附加一层描边，实现完美的“伪加粗” ──
  const origFillText = c.fillText;
  c.fillText = function(text, x, y, maxWidth) {
    // 正常填充
    origFillText.call(this, text, x, y, maxWidth);
    
    // 如果当前字体设定需要加粗
    if (this.font && /(bold|600|700)/.test(this.font)) {
      const origLw = this.lineWidth;
      const origSs = this.strokeStyle;
      
      // 动态计算补字重所需的线宽，例如 26px 对应 ~1.0px 线宽
      let lw = 0.5;
      const match = this.font.match(/(\d+)px/);
      if (match) lw = parseInt(match[1]) * 0.04; 
      
      this.lineWidth = lw;
      this.strokeStyle = this.fillStyle; // 让外边框和文字同色
      this.strokeText(text, x, y, maxWidth);
      
      // 恢复原属性
      this.lineWidth = origLw;
      this.strokeStyle = origSs;
    }
  };

  c.fillStyle = '#0b0c18'; c.fillRect(0, 0, totalW, totalH);

  let y = PAD;

  // ── Profile Header ──
  if (includeHeader) {
    const name = settings.profile?.name || 'Arcaea Best 30';
    const pttStr = `PTT ${displayPtt.toFixed(2)}`;
    
    c.font = 'bold 22px GeosansLight'; c.fillStyle = '#eae8ff'; c.textAlign = 'left';
    c.fillText(name, PAD, y + 22);
    
    const pillX = PAD + measureText(name, 'bold 22px GeosansLight') + 12;
    const pttW = measureText(pttStr, 'bold 13px Exo-Regular');
    
    c.fillStyle = '#5020a0'; roundRect(c, pillX, y + 6, pttW + 20, 22, 5)*0.95; c.fill();
    c.strokeStyle = '#a060ff'; c.lineWidth = 1; roundRect(c, pillX, y + 6, pttW + 20, 22, 5)*0.95; c.stroke();
    
    c.font = 'bold 13px Exo-Regular'; c.fillStyle = '#fff'; c.fillText(pttStr, pillX + 10, y + 21);
    y += 42;

    const statsItems = [
      { label:'BEST30 Avg ', val: globalStats.avg.toFixed(4) },
      { label:'TOP10 Avg ', val: globalStats.t10avg.toFixed(4) },
      { label:'Date Range ', val: `${chartData[0]?.dateStr.split(' ')[0]} ~ ${chartData[chartData.length-1]?.dateStr.split(' ')[0]}` }
    ];
    let sx = PAD;
    for (const { label, val } of statsItems) {
      c.font = '12px Exo-Regular'; c.fillStyle = '#525080'; c.fillText(label, sx, y + 14);
      sx += measureText(label, '12px Exo-Regular');
      c.font = 'bold 12px Exo-Regular'; c.fillStyle = '#c8a0ff'; c.fillText(val, sx, y + 14);
      sx += measureText(val, 'bold 12px Exo-Regular') + 16;
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
  const mxptt = (avg * 3 + t10) / 4;
  const dateLabel = ratingHistory[ratingIdx]?.dateStr || '';
  const COL = { title:PAD, date:PAD+40, avg:PAD+220, t10:PAD+320, mx:PAD+410 };

  c.font = 'bold 11px Exo-Regular'; c.fillStyle = '#525080'; c.textAlign = 'left'; c.fillText('B30', COL.title, y + 18);
  c.font = 'bold 13px Exo-Regular'; c.fillStyle = '#80c4ff'; c.fillText(dateLabel, COL.date, y + 19);
  if (avg) {
    const stats = [
      { l:'B30Avg ', v:avg.toFixed(4), x:COL.avg },
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
    await drawCard(c, b30[i], i, PAD + (i % SV.COLS) * (SV.CARD_W + SV.GAP), y + Math.floor(i / SV.COLS) * (SV.CARD_H + SV.GAP), mergedSettings);
  }

  return canvas;
}

module.exports = { renderFrame };