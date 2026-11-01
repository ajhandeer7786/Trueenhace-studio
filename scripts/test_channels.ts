import path from 'path';
import * as ort from 'onnxruntime-node';

async function testChannels() {
  const modelPath = path.resolve(process.cwd(), 'models/realesrgan_x4.onnx');
  const session = await ort.InferenceSession.create(modelPath);

  // Pure Red: C0=1.0, C1=0.0, C2=0.0
  const redInput = new Float32Array(3 * 128 * 128);
  for (let i = 0; i < 128 * 128; i++) redInput[i] = 1.0;

  const t = new ort.Tensor('float32', redInput, [1, 3, 128, 128]);
  const res = await session.run({ image: t });
  const out = res['upscaled_image'].data as Float32Array;

  // Let's compute average output in channel 0, 1, 2
  const c0Sum = out.slice(0, 512 * 512).reduce((a, b) => a + b, 0) / (512 * 512);
  const c1Sum = out.slice(512 * 512, 2 * 512 * 512).reduce((a, b) => a + b, 0) / (512 * 512);
  const c2Sum = out.slice(2 * 512 * 512, 3 * 512 * 512).reduce((a, b) => a + b, 0) / (512 * 512);

  console.log('Pure C0=1.0, C1=0.0, C2=0.0:');
  console.log('Output C0 avg:', c0Sum.toFixed(4));
  console.log('Output C1 avg:', c1Sum.toFixed(4));
  console.log('Output C2 avg:', c2Sum.toFixed(4));

  // Pure Blue: C0=0.0, C1=0.0, C2=1.0
  const blueInput = new Float32Array(3 * 128 * 128);
  for (let i = 2 * 128 * 128; i < 3 * 128 * 128; i++) blueInput[i] = 1.0;

  const t2 = new ort.Tensor('float32', blueInput, [1, 3, 128, 128]);
  const res2 = await session.run({ image: t2 });
  const out2 = res2['upscaled_image'].data as Float32Array;

  const b0Sum = out2.slice(0, 512 * 512).reduce((a, b) => a + b, 0) / (512 * 512);
  const b1Sum = out2.slice(512 * 512, 2 * 512 * 512).reduce((a, b) => a + b, 0) / (512 * 512);
  const b2Sum = out2.slice(2 * 512 * 512, 3 * 512 * 512).reduce((a, b) => a + b, 0) / (512 * 512);

  console.log('\nPure C0=0.0, C1=0.0, C2=1.0:');
  console.log('Output C0 avg:', b0Sum.toFixed(4));
  console.log('Output C1 avg:', b1Sum.toFixed(4));
  console.log('Output C2 avg:', b2Sum.toFixed(4));
}

testChannels().catch(console.error);
