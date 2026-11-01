import path from 'path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

async function testX4Plus() {
  const modelPath = '/tmp/x4plus/real_esrgan_x4plus-onnx-float/real_esrgan_x4plus.onnx';
  console.log('Loading session from:', modelPath);
  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
    intraOpNumThreads: 4,
  });

  // Extract a 128x128 patch centered on the eye / face
  const crop = await sharp('data/test_patches/face_input.png')
    .extract({ left: 100, top: 180, width: 128, height: 128 })
    .removeAlpha()
    .raw()
    .toBuffer();

  // Save input patch for reference
  await sharp(crop, { raw: { width: 128, height: 128, channels: 3 } })
    .png()
    .toFile('data/test_patches/x4plus_input_patch.png');

  // Input tensor [1, 3, 128, 128] RGB [0, 1]
  const inputTensor = new Float32Array(3 * 128 * 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const s = (y * 128 + x) * 3;
      const d = y * 128 + x;
      inputTensor[d] = crop[s] / 255.0;
      inputTensor[128 * 128 + d] = crop[s + 1] / 255.0;
      inputTensor[2 * 128 * 128 + d] = crop[s + 2] / 255.0;
    }
  }

  const tensor = new ort.Tensor('float32', inputTensor, [1, 3, 128, 128]);
  console.log('Running Real-ESRGAN-x4plus inference...');
  const t0 = Date.now();
  const res = await session.run({ image: tensor });
  const t1 = Date.now();
  console.log(`Inference took ${t1 - t0}ms`);

  const outData = res['upscaled_image'].data as Float32Array;

  // Convert output tensor to image buffer
  const outBuf = Buffer.alloc(512 * 512 * 3);
  for (let i = 0; i < 512 * 512; i++) {
    outBuf[i * 3] = Math.min(255, Math.max(0, Math.round(outData[i] * 255)));
    outBuf[i * 3 + 1] = Math.min(255, Math.max(0, Math.round(outData[512 * 512 + i] * 255)));
    outBuf[i * 3 + 2] = Math.min(255, Math.max(0, Math.round(outData[2 * 512 * 512 + i] * 255)));
  }

  await sharp(outBuf, { raw: { width: 512, height: 512, channels: 3 } })
    .png()
    .toFile('data/test_patches/x4plus_output_patch.png');

  // Downscale back to 128x128 for 1:1 comparison
  await sharp('data/test_patches/x4plus_output_patch.png')
    .resize(128, 128)
    .toFile('data/test_patches/x4plus_output_downscaled.png');

  // Also Lanczos3 baseline
  await sharp(crop, { raw: { width: 128, height: 128, channels: 3 } })
    .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile('data/test_patches/x4plus_lanczos_patch.png');

  console.log('Done generating x4plus patches.');
}

testX4Plus().catch(console.error);
