'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function createEncoder({ width, height, fps, output, preset, crf, ffmpegPath = 'ffmpeg' }) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temp = path.join(path.dirname(output), `.${path.basename(output)}.${randomUUID()}.partial.mp4`);
  const pixelFormat = 'rgba';
  const child = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pixel_format', pixelFormat, '-video_size', `${width}x${height}`,
    '-framerate', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264',
    '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', temp], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '', failure = null, count = 0;
  child.stderr.on('data', data => { stderr = (stderr + data).slice(-12000); });
  child.stdin.on('error', error => { failure = error; });
  const done = new Promise(resolve => {
    child.on('error', error => { failure = error; });
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  const error = () => new Error(`FFmpeg failed: ${stderr || failure?.message || 'encoder closed'}`);
  return {
    get count() { return count; },
    async write(buffer) {
      if (failure || child.exitCode !== null || child.signalCode) throw error();
      if (buffer.length !== width * height * 4) throw new Error('Raw frame size mismatch');
      // Wait for each write callback: bounded memory and no buffer mutation in flight.
      await new Promise((resolve, reject) => child.stdin.write(buffer, e => e ? reject(error()) : resolve()));
      count++;
    },
    async finish() {
      child.stdin.end();
      const result = await done;
      if (result.code !== 0 || failure) throw error();
      fs.renameSync(temp, output);
    },
    async abort() {
      child.stdin.destroy();
      child.kill();
      await done;
      fs.rmSync(temp, { force: true });
    },
  };
}
module.exports = { createEncoder };
