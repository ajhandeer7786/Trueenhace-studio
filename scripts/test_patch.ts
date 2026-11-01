import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

async function testRawInference() {
  const modelPath = path.resolve(process.cwd(), 'models/realesrgan_x4.onnx');
  const session = await ort.InferenceSession.create(modelPath);

  // Take a 128x128 crop from upload-1793112383109-754490357.png
  const inCrop = await sharp('data/uploads/upload-1793112383109-754490357.png')
    .extract({ left: 300, top: 500, width: 128, height: 128 })
    .removeAlpha()
    .raw()
    .toBuffer();

  // Test 1: RGB in [0, 1]
  const rgbInput = new Float32Array(3 * 128 * 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const srcIdx = (y * 128 + x) * 3;
      const dstIdx = y * 128 + x;
      rgbInput[dstIdx] = inCrop[srcIdx] / 255.0; // R
      rgbInput[128 * 128 + dstIdx] = inCrop[srcIdx + 1] / 255.0; // G
      rgbInput[2 * 128 * 128 + dstIdx] = inCrop[srcIdx + 2] / 255.0; // B
    }
  }

  // Test 2: BGR in [0, 1]
  const bgrInput = new Float32Array(3 * 128 * 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const srcIdx = (y * 128 + x) * 3;
      const dstIdx = y * 128 + x;
      bgrInput[dstIdx] = inCrop[srcIdx + 2] / 255.0; // B
      bgrInput[128 * 128 + dstIdx] = inCrop[srcIdx + 1] / 255.0; // G
      bgrInput[2 * 128 * 128 + dstIdx] = inCrop[srcIdx] / 255.0; // R
    }
  }

  // Run RGB
  const tRgb = new ort.Tensor('float32', rgbInput, [1, 3, 128, 128]);
  const resRgb = await session.run({ image: tRgb });
  const outRgb = resRgb['upscaled_image'].data as Float32Array;

  // Run BGR
  const tBgr = new ort.Tensor('float32', bgrInput, [1, 3, 128, 128]);
  const resBgr = await session.run({ image: tBgr });
  const outBgr = resBgr['upscaled_image'].data as Float32Array;

  // Compare with bicubic / bilinear upsampling of the 128x128 crop to 512x512
  const bicubicCrop = await sharp(inCrop, { raw: { width: 128, height: 128, channels: 3 } })
    .resize(512, 512, { kernel: sharp.kernel.cubic })
    .raw()
    .toBuffer();

  const lanczosCrop = await sharp(inCrop, { raw: { width: 128, height: 128, channels: 3 } })
    .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();

  // Convert outRgb to Buffer (assuming RGB)
  const outRgbBuf = Buffer.alloc(512 * 512 * 3);
  for (let i = 0; i < 512 * 512; i++) {
    outRgbBuf[i * 3] = Math.min(255, Math.max(0, Math.round(outRgb[i] * 255)));
    outRgbBuf[i * 3 + 1] = Math.min(255, Math.max(0, Math.round(outRgb[512 * 512 + i] * 255)));
    outRgbBuf[i * 3 + 2] = Math.min(255, Math.max(0, Math.round(outRgb[2 * 512 * 512 + i] * 255)));
  }

  // Convert outBgr to Buffer (assuming model returned BGR, converting back to RGB)
  const outBgrBuf = Buffer.alloc(512 * 512 * 3);
  for (let i = 0; i < 512 * 512; i++) {
    outBgrBuf[i * 3] = Math.min(255, Math.max(0, Math.round(outBgr[2 * 512 * 512 + i] * 255))); // R is channel 2
    outBgrBuf[i * 3 + 1] = Math.min(255, Math.max(0, Math.round(outBgr[512 * 512 + i] * 255))); // G
    outBgrBuf[i * 3 + 2] = Math.min(255, Math.max(0, Math.round(outBgr[i] * 255))); // B is channel 0
  }

  // Save the patches to test_patches/
  fs.mkdirSync('data/test_patches', { recursive: true });
  await sharp(outRgbBuf, { raw: { width: 512, height: 512, channels: 3 } }).png().toFile('data/test_patches/test_model_rgb.png');
  await sharp(outBgrBuf, { raw: { width: 512, height: 512, channels: 3 } }).png().toFile('data/test_patches/test_model_bgr.png');
  await sharp(bicubicCrop, { raw: { width: 512, height: 512, channels: 3 } }).png().toFile('data/test_patches/test_bicubic.png');
  await sharp(lanczosCrop, { raw: { width: 512, height: 512, channels: 3 } }).png().toFile('data/test_patches/test_lanczos.png');

  // Compute stats between outRgb and lanczos
  let diffSum = 0;
  for (let i = 0; i < outRgbBuf.length; i++) {
    diffSum += Math.abs(outRgbBuf[i] - lanczosCrop[i]);
  }
  console.log('Direct model RGB vs Lanczos mean diff:', diffSum / outRgbBuf.length);

  // Compute stats between outBgr and lanczos
  let diffBgrSum = 0;
  for (let i = 0; i < outBgrBuf.length; i++) {
    diffBgrSum += Math.abs(outBgrBuf[i] - lanczosCrop[i]);
  }
  console.log('Direct model BGR vs Lanczos mean diff:', diffBgrSum / outBgrBuf.length);

  // Compare high frequency energy: Laplacian / Sobel or variance of difference
  // Let's compute high frequency variance
  function laplacianVariance(buf: Buffer, w: number, h: number): number {
    let sum = 0, sumSq = 0, count = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const c = buf[(y * w + x) * 3]; // luminance or R
        const up = buf[((y - 1) * w + x) * 3];
        const down = buf[((y + 1) * w + x) * 3];
        const left = buf[(y * w + x - 1) * 3];
        const right = buf[(y * w + x + 1) * 3];
        const lap = 4 * c - up - down - left - right;
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }
    const mean = sum / count;
    return sumSq / count - mean * mean;
  }

  console.log('Laplacian Variance (sharpness/texture detail metric):');
  console.log(' - Lanczos3:', laplacianVariance(lanczosCrop, 512, 512));
  console.log(' - Bicubic:', laplacianVariance(bicubicCrop, 512, 512));
  console.log(' - Model RGB:', laplacianVariance(outRgbBuf, 512, 512));
  console.log(' - Model BGR:', laplacianVariance(outBgrBuf, 512, 512));
}

testRawInference().catch(console.error);
