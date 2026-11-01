import sharp from 'sharp';
import * as ort from 'onnxruntime-node';
import fs from 'fs';

async function testAlignedFaceGFPGAN() {
  const inImage = 'data/uploads/upload-1793112383109-754490357.png';
  
  // Crop a square containing the face: center x=200, y=660, size=460x460
  const cropBox = { left: 0, top: 430, width: 440, height: 440 };

  const faceCrop = await sharp(inImage)
    .extract(cropBox)
    .resize(512, 512, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  await sharp(faceCrop, { raw: { width: 512, height: 512, channels: 3 } })
    .png()
    .toFile('data/test_patches/face_box_input.png');

  const session = await ort.InferenceSession.create('/tmp/gfpgan_1.4.onnx', {
    executionProviders: ['cpu'],
    intraOpNumThreads: 4,
  });

  const normInput = new Float32Array(3 * 512 * 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const srcIdx = (y * 512 + x) * 3;
      const dstIdx = y * 512 + x;
      // GFPGAN expects RGB in [-1, 1]
      normInput[dstIdx] = (faceCrop[srcIdx] / 255.0 - 0.5) / 0.5;
      normInput[512 * 512 + dstIdx] = (faceCrop[srcIdx + 1] / 255.0 - 0.5) / 0.5;
      normInput[2 * 512 * 512 + dstIdx] = (faceCrop[srcIdx + 2] / 255.0 - 0.5) / 0.5;
    }
  }

  const tensor = new ort.Tensor('float32', normInput, [1, 3, 512, 512]);
  const res = await session.run({ input: tensor });
  const outData = res['output'].data as Float32Array;

  const outBuf = Buffer.alloc(512 * 512 * 3);
  for (let i = 0; i < 512 * 512; i++) {
    const r = (outData[i] + 1) * 127.5;
    const g = (outData[512 * 512 + i] + 1) * 127.5;
    const b = (outData[2 * 512 * 512 + i] + 1) * 127.5;
    outBuf[i * 3] = Math.min(255, Math.max(0, Math.round(r)));
    outBuf[i * 3 + 1] = Math.min(255, Math.max(0, Math.round(g)));
    outBuf[i * 3 + 2] = Math.min(255, Math.max(0, Math.round(b)));
  }

  await sharp(outBuf, { raw: { width: 512, height: 512, channels: 3 } })
    .png()
    .toFile('data/test_patches/face_box_gfpgan_restored.png');

  console.log('Saved data/test_patches/face_box_gfpgan_restored.png');
}

testAlignedFaceGFPGAN().catch(console.error);
