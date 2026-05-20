'use strict';
const ffmpeg = require('fluent-ffmpeg');
const path   = require('path');
const CONFIG = require('./config.json');

const outDir = path.resolve(__dirname, CONFIG.outputDir || './frames');
const concatFile = path.join(outDir, 'concat.txt');
const outputFile = path.resolve(__dirname, CONFIG.output || './b30-timelapse.mp4');

console.log(`开始编码: 正在处理序列帧 ${concatFile} ...`);

ffmpeg()
  .input(concatFile)
  .inputOptions(['-f concat', '-safe 0'])
  .videoCodec('libx264')
  .outputOptions([
    '-crf 14',           //数值越大，画质越差，但生成的文件越小 
    '-pix_fmt yuv420p',
    '-preset slow',
    `-r ${CONFIG.fps || 30}`,  
  ])
  .output(outputFile)
  .on('progress', p => {
    process.stdout.write(`\r编码中: 已处理 ${p.frames} 帧 ...`);
  })
  .on('end', () => console.log('\n✅ 视频导出成功: ', outputFile))
  .on('error', e => console.error('\n❌ 导出失败 (FFmpeg Error):', e))
  .run();