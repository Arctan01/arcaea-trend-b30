const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ── 配置 ──────────────────────────────────────────
const CONFIG = {
  url: 'http://localhost:8080',       // 本地服务器地址
  ratingCSV: './data/ratings.csv',     // 两个 CSV 文件路径
  playCSV:   './data/all_scores.csv',
  outputDir: './frames',
  
  viewport:  { width: 1200, height: 1600 },  // 页面尺寸，影响截图分辨率
  fps: 30,
  // 每个 rating history 点停留多少帧
  // 例如 60帧/30fps = 2秒每个点
  framesPerPoint: 60,
  // 或者按 PTT 步长生成关键帧（二选一）
  pttStep: 0.1,  // 设为 0.01 则按步长，null 则用每个 rating 点
  transitionFrames: 5,   // 淡入帧数
};

async function main() {
  // 准备输出目录
  fs.rmSync(CONFIG.outputDir, { recursive: true, force: true });
  fs.mkdirSync(CONFIG.outputDir);

  const ratingCSV = fs.readFileSync(CONFIG.ratingCSV, 'utf-8');
  const playCSV   = fs.readFileSync(CONFIG.playCSV,   'utf-8');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport(CONFIG.viewport);

  // 导航到页面
    await page.goto(CONFIG.url, { waitUntil: 'networkidle0' });

  // 确认页面 JS 已执行
  const pageReady = await page.evaluate(() => {
    return {
      hasAPI:    typeof window.__RenderAPI !== 'undefined',
      hasSongMap: typeof window.songMap !== 'undefined',
      hasHistory: typeof window.ratingHistory !== 'undefined',
    };
  });
  console.log('页面状态:', pageReady);

  // 注入数据
  const loadResult = await page.evaluate((rc, pc) => {
    try {
      window.__RenderAPI.loadData(rc, pc);
      return {
        ok: true,
        ratingLen: window.ratingHistory?.length ?? -1,
        playLen:   window.playHistory?.length   ?? -1,
        hasAPI:    typeof window.__RenderAPI !== 'undefined',
      };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  }, ratingCSV, playCSV);

  console.log('loadData result:', loadResult);

  if (!loadResult.ok || loadResult.ratingLen <= 0) {
    console.error('数据加载失败，终止');
    await browser.close();
    process.exit(1);
  }

  // 等待 songlist 加载
  await page.waitForFunction(() => Object.keys(window.songMap).length > 0, { timeout: 10000 })
    .catch(() => console.warn('songlist timeout, continuing without titles'));

  // 生成时间轴帧列表
  const frames = await page.evaluate((cfg) => {
    const history = window.ratingHistory;
    if (!history.length) return [];

    if (cfg.pttStep) {
      // 按 PTT 步长插值
      const minPtt = history[0].rating;
      const maxPtt = history[history.length - 1].rating;
      const result = [];
      for (let ptt = minPtt; ptt <= maxPtt + cfg.pttStep; ptt += cfg.pttStep) {
        // 找到最近的时间点
        const point = history.reduce((prev, cur) =>
          Math.abs(cur.rating - ptt) < Math.abs(prev.rating - ptt) ? cur : prev
        );
        result.push({ ts: point.ts, dateStr: point.dateStr, rating: point.rating });
      }
      return result;
    } else {
      // 直接用每个 rating 点
      return history.map(d => ({ ts: d.ts, dateStr: d.dateStr, rating: d.rating }));
    }
  }, CONFIG);

  console.log(`frames 数量: ${frames.length}`);
  if (!frames.length) {
    console.error('帧列表为空，终止');
    await browser.close();
    process.exit(1);
  }

  let frameIndex = 0;
  let prevFingerprint = null;

  // 辅助：截一帧并保存
  async function captureFrame() {
    const filename = path.join(
      CONFIG.outputDir,
      `frame_${String(frameIndex).padStart(6, '0')}.png`
    );
    await page.screenshot({ path: filename, type: 'png' });
    frameIndex++;
  }

  // 辅助：设置透明度
  async function setOpacity(val) {
    await page.evaluate(v => window.__RenderAPI.setOpacity(v), val);
  }

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    process.stdout.write(`\r渲染进度: ${i+1}/${frames.length} (${frame.dateStr})`);

    // 跳转到该时间点（先不截图）
    await page.evaluate(ts => window.__RenderAPI.seekTo(ts), frame.ts);
    await page.evaluate(() => window.__RenderAPI.waitForImages());
    await new Promise(r => setTimeout(r, 300));

    const fingerprint = await page.evaluate(() => window.__RenderAPI.getFingerprint());
    const changed = fingerprint !== prevFingerprint;

    if (changed && prevFingerprint !== null) {
      // 透明度到0时切换内容（此时屏幕全黑，看不出切换）
      await setOpacity(0);

      // ── 淡入新内容 ────────────────────────────
      for (let f = 0; f < CONFIG.transitionFrames; f++) {
        const opacity = (f + 1) / CONFIG.transitionFrames;
        await setOpacity(opacity);
        await captureFrame();
      }
    }

    // 恢复完全不透明
    await setOpacity(1);

    // ── 停留帧 ────────────────────────────────
    for (let f = 0; f < CONFIG.framesPerPoint; f++) {
      await captureFrame();
    }

    prevFingerprint = fingerprint;
  }

  // 最后恢复透明度（防止最后一帧残留）
  await setOpacity(1);
  console.log(`\n截图完成，共 ${frameIndex} 张`);
  await browser.close();
}
main().catch(console.error);