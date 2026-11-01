import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

async function testImprovedSr() {
  const modelPath = path.resolve(process.cwd(), 'models/real_esrgan_x4plus.onnx');
  console.log('Loading session from:', modelPath);
  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    intraOpNumThreads: Math.max(2, Math.min(8, (await import('os')).cpus().length)),
  });

  const inPath = 'data/test_patches/actual_face_500.png'; // 500x500 real face
  const meta = await sharp(inPath).metadata();
  const inW = meta.width || 500;
  const inH = meta.height || 500;

  const rawInput = await sharp(inPath).removeAlpha().raw().toBuffer();

  const targetW = inW * 4;
  const targetH = inH * 4;

  const tileSize = 128;
  const stride = 96;
  const overlap = tileSize - stride; // 32
  const outTileSize = tileSize * 4;   // 512
  const outOverlap = overlap * 4;     // 128

  const accumRgb = new Float32Array(targetW * targetH * 3);
  const accumWeight = new Float32Array(targetW * targetH);

  // Compute tile positions
  const xPositions: number[] = [];
  for (let x = 0; x < inW; x += stride) {
    if (x + tileSize >= inW) {
      xPositions.push(Math.max(0, inW - tileSize));
      break;
    }
    xPositions.push(x);
  }
  if (xPositions.length === 0) xPositions.push(0);

  const yPositions: number[] = [];
  for (let y = 0; y < inH; y += stride) {
    if (y + tileSize >= inH) {
      yPositions.push(Math.max(0, inH - tileSize));
      break;
    }
    yPositions.push(y);
  }
  if (yPositions.length === 0) yPositions.push(0);

  console.log(`Grid: ${xPositions.length} x ${yPositions.length} = ${xPositions.length * yPositions.length} tiles`);

  let tileCount = 0;
  const t0 = Date.now();

  for (let yi = 0; yi < yPositions.length; yi++) {
    const startY = yPositions[yi];
    const isFirstY = yi === 0;
    const isLastY = yi === yPositions.length - 1;

    for (let xi = 0; xi < xPositions.length; xi++) {
      const startX = xPositions[xi];
      const isFirstX = xi === 0;
      const isLastX = xi === xPositions.length - 1;

      // Extract 128x128 RGB tile normalized to [0, 1]
      const tileInput = new Float32Array(3 * 128 * 128);
      for (let ty = 0; ty < tileSize; ty++) {
        const srcY = Math.min(inH - 1, startY + ty);
        for (let tx = 0; tx < tileSize; tx++) {
          const srcX = Math.min(inW - 1, startX + tx);
          const srcIdx = (srcY * inW + srcX) * 3;
          const dstIdx = ty * tileSize + tx;

          tileInput[dstIdx] = rawInput[srcIdx] / 255.0;
          tileInput[128 * 128 + dstIdx] = rawInput[srcIdx + 1] / 255.0;
          tileInput[2 * 128 * 128 + dstIdx] = rawInput[srcIdx + 2] / 255.0;
        }
      }

      // Run inference
      const tensor = new ort.Tensor('float32', tileInput, [1, 3, 128, 128]);
      const results = await session.run({ image: tensor });
      const outData = results['upscaled_image'].data as Float32Array;

      // Splat with border-aware feathering weights
      const outStartX = startX * 4;
      const outStartY = startY * 4;

      for (let ty = 0; ty < outTileSize; ty++) {
        const destY = outStartY + ty;
        if (destY >= targetH) continue;

        // Vertical weight:
        let wy = 1.0;
        if (!isFirstY && ty < outOverlap) {
          wy = Math.min(wy, ty / outOverlap);
        }
        if (!isLastY && ty > outTileSize - outOverlap) {
          wy = Math.min(wy, (outTileSize - ty) / outOverlap);
        }

        for (let tx = 0; tx < outTileSize; tx++) {
          const destX = outStartX + tx;
          if (destX >= targetW) continue;

          // Horizontal weight:
          let wx = 1.0;
          if (!isFirstX && tx < outOverlap) {
            wx = Math.min(wx, tx / outOverlap);
          }
          if (!isLastX && tx > outTileSize - outOverlap) {
            wx = Math.min(wx, (outTileSize - tx) / outOverlap);
          }

          const w = wx * wy;
          const canvasIdx = destY * targetW + destX;
          const tileIdx = ty * outTileSize + tx;

          accumRgb[canvasIdx * 3] += outData[tileIdx] * w;
          accumRgb[canvasIdx * 3 + 1] += outData[outTileSize * outTileSize + tileIdx] * w;
          accumRgb[canvasIdx * 3 + 2] += outData[2 * outTileSize * outTileSize + tileIdx] * w;
          accumWeight[canvasIdx] += w;
        }
      }

      tileCount++;
      process.stdout.write(`\rTile ${tileCount}/${xPositions.length * yPositions.length} done`);
    }
  }

  console.log(`\nAll tiles done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Normalize by accumWeight
  const finalRgb4x = Buffer.alloc(targetW * targetH * 3);
  for (let i = 0; i < targetW * targetH; i++) {
    const w = accumWeight[i] > 0 ? accumWeight[i] : 1.0;
    finalRgb4x[i * 3] = Math.min(255, Math.max(0, Math.round((accumRgb[i * 3] / w) * 255)));
    finalRgb4x[i * 3 + 1] = Math.min(255, Math.max(0, Math.round((accumRgb[i * 3 + 1] / w) * 255)));
    finalRgb4x[i * 3 + 2] = Math.min(255, Math.max(0, Math.round((accumRgb[i * 3 + 2] / w) * 255)));
  }

  // Save 4x result
  await sharp(finalRgb4x, { raw: { width: targetW, height: targetH, channels: 3 } })
    .png({ compressionLevel: 6 })
    .toFile('data/test_patches/face_x4plus_improved_2000x2000.png');

  // Downscale back to original 500x500 for strict 1:1 comparison against original
  await sharp('data/test_patches/face_x4plus_improved_2000x2000.png')
    .resize(500, 500)
    .toFile('data/test_patches/face_x4plus_downscaled_500.png');

  // Also create Lanczos baseline for comparison
  await sharp(inPath)
    .resize(targetW, targetH, { kernel: sharp.kernel.lanczos3 })
    .toFile('data/test_patches/face_lanczos_2000x2000.png');

  console.log('Test outputs saved.');
}

testImprovedSr().catch(console.error);
