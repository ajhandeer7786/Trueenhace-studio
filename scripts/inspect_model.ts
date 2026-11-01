import fs from 'fs';
import path from 'path';
import * as ort from 'onnxruntime-node';

async function main() {
  const modelPath = path.resolve(process.cwd(), 'models/realesrgan_x4.onnx');
  console.log('Inspecting model at:', modelPath);
  console.log('Model file size:', fs.statSync(modelPath).size);

  const dataPath = path.resolve(process.cwd(), 'models/model.data');
  if (fs.existsSync(dataPath)) {
    console.log('External data file size:', fs.statSync(dataPath).size);
  } else {
    console.log('No external data file found.');
  }

  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
  });

  console.log('\n--- Model Session Info ---');
  console.log('Input names:', session.inputNames);
  console.log('Output names:', session.outputNames);

  // Run a test tensor through it
  // Try 128x128 constant, gradient, and test pattern
  const inW = 128;
  const inH = 128;
  const inputData = new Float32Array(3 * inH * inW);

  // Fill with a synthetic gradient + edges: 0 to 1
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < inH; y++) {
      for (let x = 0; x < inW; x++) {
        const idx = c * inH * inW + y * inW + x;
        // High contrast step in center
        if (x > 32 && x < 96 && y > 32 && y < 96) {
          inputData[idx] = (c === 0 ? 0.9 : (c === 1 ? 0.2 : 0.5));
        } else {
          inputData[idx] = (x / inW) * 0.5;
        }
      }
    }
  }

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const tensor = new ort.Tensor('float32', inputData, [1, 3, inH, inW]);

  console.log('\nRunning test inference...');
  const start = Date.now();
  const result = await session.run({ [inputName]: tensor });
  const elapsed = Date.now() - start;
  console.log(`Inference took ${elapsed}ms`);

  const outTensor = result[outputName];
  console.log('Output tensor shape:', outTensor.dims);
  console.log('Output tensor type:', outTensor.type);

  const outData = outTensor.data as Float32Array;
  console.log('Output data length:', outData.length, 'expected:', 3 * 512 * 512);

  // Compute statistics: min, max, mean, variance
  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = 0; i < outData.length; i++) {
    const v = outData[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const mean = sum / outData.length;
  let variance = 0;
  for (let i = 0; i < outData.length; i++) {
    variance += (outData[i] - mean) ** 2;
  }
  variance /= outData.length;
  const std = Math.sqrt(variance);

  console.log('\n--- Output Tensor Statistics ---');
  console.log('Min:', min);
  console.log('Max:', max);
  console.log('Mean:', mean);
  console.log('StdDev:', std);

  // Check input statistics
  let inMin = Infinity, inMax = -Infinity, inSum = 0;
  for (let i = 0; i < inputData.length; i++) {
    const v = inputData[i];
    if (v < inMin) inMin = v;
    if (v > inMax) inMax = v;
    inSum += v;
  }
  console.log('\n--- Input Tensor Statistics ---');
  console.log('Min:', inMin, 'Max:', inMax, 'Mean:', inSum / inputData.length);

  // Let's also check if input were scaled 0..255 vs 0..1
  // Real-ESRGAN official models:
  // Usually RealESRGAN expects input in [0, 1] RGB or BGR, outputs in [0, 1].
  // Let's inspect weights by reading the model or external weights data!
}

main().catch(console.error);
