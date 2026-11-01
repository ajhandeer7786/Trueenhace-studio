import path from 'path';
import sharp from 'sharp';
import { enhanceImageFileWithRealEsrgan } from '../src/server/realEsrganEngine.ts';

async function testFace() {
  const inPath = 'data/test_patches/face_input.png';
  const outPath = 'data/test_patches/face_raw_realesrgan_4x.png';

  console.log('Running Real-ESRGAN on face_input.png...');
  const start = Date.now();
  const res = await enhanceImageFileWithRealEsrgan(inPath, outPath, 4);
  console.log(`Finished in ${Date.now() - start}ms:`, res);

  // Also downscale back to original dimensions (400x500) for fair 1:1 inspection
  await sharp(outPath)
    .resize(400, 500)
    .toFile('data/test_patches/face_raw_realesrgan_downscaled.png');

  console.log('Downscaled comparison ready.');
}

testFace().catch(console.error);
