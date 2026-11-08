/* Shared card geometry and Canvas drawing for web PNGs and local video. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArcaeaCanvas = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
'use strict';
const SV = {
  CARD_W:348, CARD_H:82, GAP:8, COVER:82,
  BODY_X:94, R1_Y:20, R2_Y:54, DATE_Y:74,
  BG:'#181b2e', SURF2:'#1e2238',
  TEXT:'#eae8ff', TEXT2:'#9896c8', TEXT3:'#525080',
  NO_COL:'#acaefb',
  P_COL:'#C534A2', F_COL:'#EBB69D', L_COL:'#a94658',
  DATE_COL:'#8d9da4', LS_COL:'#504d8d', ACC2:'#80c4ff',
};

function measureText(c, text, font) { c.save(); c.font = font; const width = c.measureText(text).width; c.restore(); return width; }
function truncate(c, text, maxW, font) {
  if (measureText(c, text, font) * 1.1 <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    measureText(c, text.slice(0, mid) + '…', font) * 1.1 <= maxW ? lo = mid : hi = mid - 1;
  }
  return text.slice(0, Math.max(0, lo - 1)) + '…';
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

function drawCard(c, p, i, x0, y0, settings, img) {
  const ds = diffStyle(p.diff);
  const cl = clearCls(p.clearType);
  const R = 10, bx = x0 + SV.BODY_X;
  const scoreColor = p.pure === p.maxPure ? SV.ACC2 : SV.TEXT2;
  const mpStr = settings.maxPureStyle === 'plus' ? `(+${p.maxPure})` : `(-${p.pure - p.maxPure})`;
  const titleStr = truncate(c, settings.songMap[p.songId] || p.songId, SV.CARD_W - SV.BODY_X - 84, 'bold 15px L2-Regular');

  c.fillStyle = SV.BG; roundRect(c, x0, y0, SV.CARD_W, SV.CARD_H, R); c.fill();
  c.strokeStyle = ds.border; c.lineWidth = 1; roundRect(c, x0, y0, SV.CARD_W, SV.CARD_H, R); c.stroke();

  c.save(); roundRect(c, x0, y0, SV.COVER + 3, SV.CARD_H, R); c.clip();
  c.fillStyle = ds.main; c.fillRect(x0, y0, 3, SV.CARD_H);
  c.fillStyle = SV.SURF2; c.fillRect(x0 + 3, y0, SV.COVER, SV.CARD_H);
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
    c.shadowBlur = 8; c.shadowColor = 'rgba(100,180,255,0.7)'; 
  } else { 
    c.shadowBlur = 4; c.shadowColor = 'rgba(152,150,200,0.5)'; 
  }
  c.font = 'bold 26px Exo-Regular'; c.fillStyle = scoreColor; c.fillText(fmtScore(p.score), bx, y0 + SV.R2_Y - 2);
  c.shadowBlur = 0; c.shadowColor = 'transparent';

  if (cl.lbl) {
    c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    if (p.clearType === 3) { c.shadowBlur = 4; c.shadowColor = 'rgba(100,180,255,0.5)'; }
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
    const lw = measureText(c, l + '/', '12px Exo-Regular');
    c.font = 'bold 12px Exo-Regular'; c.fillText(String(v), x + lw, y0 + SV.DATE_Y);
    if (e) { c.font = '12px Exo-Regular'; c.fillText(` ${e}`, x + lw + measureText(c, String(v), 'bold 12px Exo-Regular'), y0 + SV.DATE_Y); }
  };
  c.fillStyle = SV.P_COL; drawPFL('P', p.pure, mpStr, bx);
  c.fillStyle = SV.F_COL; drawPFL('F', p.far, null, bx + 90);
  c.fillStyle = SV.L_COL; drawPFL('L', p.lost, null, bx + 120);
  if (settings.showLS) { c.fillStyle = SV.LS_COL; drawPFL('LS', p.ls.toFixed(1), null, bx + 152); }
  c.font = 'bold 12px Exo-Regular'; c.fillStyle = SV.DATE_COL; c.textAlign = 'right';
  c.fillText(`${calculateDaysSince(p.ts)}d`, x0 + SV.CARD_W - 8, y0 + SV.DATE_Y);
}


return { SV, drawCard, measureText, truncate };
});
