'use strict';
const fs = require('node:fs');
const path = require('node:path');
const PROFILES = {
  draft: { preset: 'ultrafast', crf: 26 },
  fast: { preset: 'veryfast', crf: 23 },
  balanced: { preset: 'fast', crf: 20 },
  quality: { preset: 'slow', crf: 17 },
  archival: { preset: 'veryslow', crf: 14 },
};
function videoOptions(config) {
  const o = config.video || {};
  const profile = o.profile ?? 'balanced';
  if (!PROFILES[profile]) throw new Error(`Unknown video.profile: ${profile}`);
  const result = { scale: o.scale ?? 1, ...PROFILES[profile], ...o, profile };
  if (!Number.isFinite(result.scale) || result.scale < 0.25 || result.scale > 4)
    throw new Error('video.scale must be between 0.25 and 4');
  if (!Number.isFinite(result.crf) || result.crf < 0 || result.crf > 51)
    throw new Error('video.crf must be between 0 and 51');
  if (!['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'].includes(result.preset))
    throw new Error(`Invalid video.preset: ${result.preset}`);
  return result;
}
function loadConfig(args = process.argv.slice(2)) {
  if (args.length && (args.length !== 2 || args[0] !== '--config'))
    throw new Error('Usage: node render/video.js [--config path/to/config.json]');
  const file = args.length ? path.resolve(args[1]) : path.join(__dirname, 'config.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Existing config paths are relative to render/, including custom config files.
  return config;
}
module.exports = { PROFILES, videoOptions, loadConfig };
