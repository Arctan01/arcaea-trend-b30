const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

const CONFIG = {
  framesDir: './frames',
  fps: 30,
  output: './b30-timelapse.mp4',
  // 视频质量 0-51，越低越好
  crf: 10,
};

ffmpeg()
  .input(path.join(CONFIG.framesDir, 'frame_%06d.png'))
  .inputFPS(CONFIG.fps)
  .videoCodec('libx264')
  .outputOptions([
    `-crf ${CONFIG.crf}`,
    '-pix_fmt yuv420p',   // 兼容性最好
    '-preset slow',       // 压缩率和速度的平衡
  ])
  .output(CONFIG.output)
  .on('start', cmd => console.log('ffmpeg:', cmd))
  .on('progress', p => process.stdout.write(`\r编码进度: ${Math.round(p.percent || 0)}%`))
  .on('end', () => console.log(`\n完成：${CONFIG.output}`))
  .on('error', err => console.error('ffmpeg error:', err))
  .run();