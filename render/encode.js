'use strict';
const ffmpeg = require('fluent-ffmpeg');
const path   = require('path');
const { videoOptions, loadConfig } = require('./video-options');
const CONFIG = loadConfig();
const options = videoOptions(CONFIG);

const outDir = path.resolve(__dirname, CONFIG.outputDir || './frames');
const concatFile = path.join(outDir, 'concat.txt');
const outputFile = path.resolve(__dirname, CONFIG.output || './b30-timelapse.mp4');

console.log(`开始编码: 正在处理序列帧 ${concatFile} ...`);

ffmpeg()
  .input(concatFile)
  .inputOptions(['-f concat', '-safe 0'])
  .videoCodec('libx264')
  .outputOptions([
    `-crf ${options.crf}`,           //数值越大，画质越差，但生成的文件越小
    '-pix_fmt yuv420p',
    `-preset ${options.preset}`,
    `-r ${CONFIG.fps || 30}`,
  ])
  .output(outputFile)
  .on('progress', p => {
    process.stdout.write(`\r编码中: 已处理 ${p.frames} 帧 ...`);
  })
  .on('end', () => console.log('\n✅ 视频导出成功: ', outputFile))
  .on('error', e => console.error('\n❌ 导出失败 (FFmpeg Error):', e))
  .run();
