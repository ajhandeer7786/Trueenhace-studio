import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  formatDuration,
  calculateTargetDimensions,
  validateImageFile,
  validateVideoFile,
  buildFfmpegFilterChain,
} from './enhancerLogic.ts';

test('formatBytes formats file sizes correctly', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1024 * 1024 * 2.5), '2.5 MB');
  assert.equal(formatBytes(1024 * 1024 * 1024), '1 GB');
});

test('formatDuration formats seconds to MM:SS and HH:MM:SS', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(65), '01:05');
  assert.equal(formatDuration(3665), '01:01:05');
});

test('calculateTargetDimensions handles image scales', () => {
  const scaled2x = calculateTargetDimensions(800, 600, 2);
  assert.equal(scaled2x.width, 1600);
  assert.equal(scaled2x.height, 1200);

  const scaled4x = calculateTargetDimensions(500, 500, 4);
  assert.equal(scaled4x.width, 2000);
  assert.equal(scaled4x.height, 2000);
});

test('calculateTargetDimensions ensures even numbers for video resolutions', () => {
  // 16:9 standard video
  const res1080p = calculateTargetDimensions(640, 360, '1080p');
  assert.equal(res1080p.height, 1080);
  assert.equal(res1080p.width, 1920);
  assert.equal(res1080p.width % 2, 0);
  assert.equal(res1080p.height % 2, 0);

  // Non-standard aspect ratio video (e.g. 719x405)
  const oddRes = calculateTargetDimensions(719, 405, '1080p');
  assert.equal(oddRes.width % 2, 0);
  assert.equal(oddRes.height % 2, 0);
});

test('validateImageFile checks supported formats and sizes', () => {
  const validJpg = validateImageFile({ name: 'photo.jpg', size: 1024 * 500, type: 'image/jpeg' });
  assert.equal(validJpg.valid, true);

  const validWebp = validateImageFile({ name: 'pic.webp', size: 1024 * 100, type: 'image/webp' });
  assert.equal(validWebp.valid, true);

  const invalidBmp = validateImageFile({ name: 'sample.bmp', size: 1024, type: 'image/bmp' });
  assert.equal(invalidBmp.valid, false);

  const tooBig = validateImageFile({ name: 'huge.png', size: 60 * 1024 * 1024, type: 'image/png' });
  assert.equal(tooBig.valid, false);

  const empty = validateImageFile({ name: 'empty.png', size: 0, type: 'image/png' });
  assert.equal(empty.valid, false);
});

test('validateVideoFile checks supported formats and sizes', () => {
  const validMp4 = validateVideoFile({ name: 'clip.mp4', size: 5 * 1024 * 1024, type: 'video/mp4' });
  assert.equal(validMp4.valid, true);

  const validWebm = validateVideoFile({ name: 'anim.webm', size: 10 * 1024 * 1024, type: 'video/webm' });
  assert.equal(validWebm.valid, true);

  const invalidAvi = validateVideoFile({ name: 'old.avi', size: 1024 * 1024, type: 'video/x-msvideo' });
  assert.equal(invalidAvi.valid, false);

  const tooBig = validateVideoFile({ name: 'huge.mp4', size: 300 * 1024 * 1024, type: 'video/mp4' });
  assert.equal(tooBig.valid, false);
});

test('buildFfmpegFilterChain creates correct filter string list', () => {
  const filters = buildFfmpegFilterChain(
    {
      resolution: '1080p',
      stabilize: true,
      denoise: true,
      sharpen: true,
      fps: 60,
      preserveAudio: true,
      quality: 'balanced',
    },
    { width: 1920, height: 1080 },
    '/tmp/transforms.trf'
  );

  assert.ok(filters.some((f) => f.includes('vidstabtransform')));
  assert.ok(filters.some((f) => f.includes('hqdn3d')));
  assert.ok(filters.some((f) => f.includes('unsharp')));
  assert.ok(filters.some((f) => f.includes('scale=1920:1080')));
  assert.ok(filters.some((f) => f.includes('minterpolate=fps=60')));
});
