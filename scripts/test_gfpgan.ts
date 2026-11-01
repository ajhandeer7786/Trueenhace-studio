import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import fs from 'fs';

async function testGfpgan() {
  const modelPath = '/tmp/gfpgan_1.4.onnx';
  console.log('Loading GFPGAN model from:', modelPath, 'size:', fs.statSync(modelPath).size);

  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
    intraOpNumThreads: 4,
  });

  console.log('GFPGAN Input names:', session.inputNames);
  console.log('GFPGAN Output names:', session.outputNames);

  // In GFPGAN v1.4 ONNX:
  // Usually expects input face aligned or resized to 512x512, normalized to [-1, 1] or [0, 1], RGB or BGR.
  // Let's test on data/test_patches/face_input.png!
  // Resize face_input to 512x512
  const face512 = await sharp('data/test_patches/face_input.png')
    .resize(512, 512, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  // Try [-1, 1] RGB: (val / 127.5) - 1.0 (standard GFPGAN / StyleGAN2 normalization)
  const normInput = new Float32Array(3 * 512 * 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const srcIdx = (y * 512 + x) * 3;
      const dstIdx = y * 512 + x;
      // standard GFPGAN PyTorch: (x - 0.5) / 0.5 -> [-1, 1]
      normInput[dstIdx] = (face512[srcIdx] / 255.0 - 0.5) / 0.5;
      normInput[512 * 512 + dstIdx] = (face512[srcIdx + 1] / 255.0 - 0.5) / 0.5;
      normInput[2 * 512 * 512 + dstIdx] = (face512[srcIdx + 2] / 255.0 - 0.5) / 0.5;
    }
  }

  const tensor = new ort.Tensor('float32', normInput, [1, 3, 512, 512]);
  console.log('Running GFPGAN inference on face...');
  const t0 = Date.now();
  const res = await session.run({ [inputName]: tensor });
  const t1 = Date.now();
  console.log(`GFPGAN inference took ${t1 - t0}ms`);

  const outTensor = res[outputName];
  console.log('Output dims:', outTensor.dims);
  const outData = outTensor.data as Float32Array;

  let min = Infinity, max = -Infinity;
  for (let i = 0; i < outData.length; i++) {
    if (outData[i] < min) min = outData[i];
    if (outData[i] > max) max = outData[i];
  }
  console.log('Output min:', min, 'max:', max);

  // Convert output: if [-1, 1], map (v + 1) * 127.5; if [0, 1], map v * 255
  const isNegOneToOne = min < -0.1;
  const outBuf = Buffer.alloc(512 * 512 * 3);
  for (let i = 0; i < 512 * 512; i++) {
    const r = isNegOneToOne ? (outData[i] + 1) * 127.5 : outData[i] * 255;
    const g = isNegOneToOne ? (outData[512 * 512 + i] + 1) * 127.5 : outData[512 * 512 + i] * 255;
    const b = isNegOneToOne ? (outData[2 * 512 * 512 + i] + 1) * 127.5 : outData[2 * 512 * 512 + i] * 255;
    outBuf[i * 3] = Math.min(255, Math.max(0, Math.round(r)));
    outBuf[i * 3 + 1] = Math.min(255, Math.max(0, Math.round(g)));
    outBuf[i * 3 + 2] = Math.min(255, Math.max(0, Math.round(b)));
  }

  await sharp(outBuf, { raw: { width: 512, height: 512, channels: 3 } })
    .png()
    .toFile('data/test_patches/face_gfpgan_output.png');

  console.log('Saved data/test_patches/face_gfpgan_output.png successfully.');
}

testGfpgan().catch(console.error);
