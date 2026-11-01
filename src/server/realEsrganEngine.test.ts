import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTileGrid } from './realEsrganEngine.ts';

test('computeTileGrid on 128x128 image produces exactly 1 tile', () => {
  const { xPositions, yPositions } = computeTileGrid(128, 128, 128, 96);
  assert.deepEqual(xPositions, [0]);
  assert.deepEqual(yPositions, [0]);
});

test('computeTileGrid on smaller 64x64 image clamps safely to [0]', () => {
  const { xPositions, yPositions } = computeTileGrid(64, 64, 128, 96);
  assert.deepEqual(xPositions, [0]);
  assert.deepEqual(yPositions, [0]);
});

test('computeTileGrid covers entire canvas for arbitrary non-tile-multiple sizes', () => {
  const w = 317;
  const h = 241;
  const tileSize = 128;
  const stride = 96;

  const { xPositions, yPositions } = computeTileGrid(w, h, tileSize, stride);

  // Must have multiple tiles
  assert.ok(xPositions.length >= 3);
  assert.ok(yPositions.length >= 2);

  // First tile starts at 0
  assert.equal(xPositions[0], 0);
  assert.equal(yPositions[0], 0);

  // Last tile covers up to the rightmost/bottommost pixel
  const lastX = xPositions[xPositions.length - 1];
  const lastY = yPositions[yPositions.length - 1];

  assert.ok(lastX + tileSize >= w, `Last X (${lastX} + ${tileSize}) must cover w (${w})`);
  assert.ok(lastY + tileSize >= h, `Last Y (${lastY} + ${tileSize}) must cover h (${h})`);
});

test('computeTileGrid stride ensures continuous overlap', () => {
  const { xPositions } = computeTileGrid(500, 500, 128, 96);
  for (let i = 0; i < xPositions.length - 1; i++) {
    const gap = xPositions[i + 1] - xPositions[i];
    assert.ok(gap <= 96, `Step ${gap} must not exceed stride 96`);
    assert.ok(xPositions[i] + 128 > xPositions[i + 1], 'Adjacent tiles must overlap');
  }
});
