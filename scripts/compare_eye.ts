import path from 'path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

async function compareModelsOnEye() {
  // Eye crop
  const crop = await sharp('data/test_patches/face_input.png')
    .extract({ left: 50, top: 300, width: 128, height: 128 })
    .removeAlpha()
    .raw()
    .toBuffer();

  await sharp(crop, { raw: { width: 128, height: 128, channels: 3 } })
    .png()
    .toFile('data/test_patches/eye_original_input.png');

  // Input tensor
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

  // 1. Current model (realesrgan_x4.onnx)
  const currentSession = await ort.InferenceSession.create('models/realesrgan_x4.onnx', { executionProviders: ['cpu'] });
  const t1 = new ort.Tensor('float32', inputTensor, [1, 3, 128, 128]);
  const res1 = await currentSession.run({ image: t1 });
  const out1 = res1['upscaled_image'].data as Float32Array;

  const buf1 = Buffer.alloc(512 * 512 * 3);
  for (let i = 0; i < 512 * 512; i++) {
    buf1[i * 3] = Math.min(255, Math.max(0, Math.round(out1[i] * 255)));
    buf1[i * 3 + 1] = Math.min(255, Math.max(0, Math.round(out1[512 * 512 + i] * 255)));
    buf1[i * 3 + 2] = Math.min(255, Math.max(0, Math.round(out1[2 * 512 * 512 + i] * 255)));
  }
  await sharp(buf1, { raw: { width: 512, height: 512, channels: 3 } }).png().toFile('data/test_patches/eye_current_model_512.png');
  await sharp('data/test_patches/eye_current_model_512.png').resize(128, 128).toFile('data/test_patches/eye_current_model_128.png');

  // 2. Real-ESRGAN-x4plus (flagship)
  const x4plusSession = await ort.InferenceSession.create('/tmp/x4plus/real_esrgan_x4plus-onnx-float/real_esrgan_x4plus.onnx', { executionProviders: ['cpu'] });
  const t2 = new ort.Tensor('float32', inputTensor, [1, 3, 128, 128]);
  const res2 = await x4plusSession.run({ image: t2 });
  const out2 = res2['upscaled_image'].data as Float32Array;

  const buf2 = Buffer.alloc(512 * 512 * 3);
  for (let i = 0; i < 512 * 512; i++) {
    buf2[i * 3] = Math.min(255, Math.max(0, Math.round(out2[i] * 255)));
    buf2[i * 3 + 1] = Math.min(255, Math.max(0, Math.round(out2[512 * 512 + i] * 255)));
    buf2[i * 3 + 2] = Math.min(255, Math.max(0, Math.round(out2[2 * 512 * 512 + i] * 255)));
  }
  await sharp(buf2, { raw: { width: 512, height: 512, channels: 3 } }).png().toFile('data/test_patches/eye_x4plus_512.png');
  await sharp('data/test_patches/eye_x4plus_512.png').resize(128, 128).toFile('data/test_patches/eye_x4plus_128.png');

  // 3. Lanczos baseline
  await sharp(crop, { raw: { width: 128, height: 128, channels: 3 } })
    .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile('data/test_patches/eye_lanczos_512.png');

  console.log('Finished eye comparisons.');
}

compareModelsOnEye().catch(console.error);
