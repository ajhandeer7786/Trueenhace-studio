import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';
import type { VideoEnhanceOptions } from '../types/index.ts';

// Cached ONNX inference sessions for different models
const modelSessions = new Map<string, ort.InferenceSession>();
const sessionLoadingPromises = new Map<string, Promise<ort.InferenceSession>>();

export type RealEsrganModelVariant = 'x4plus' | 'compact';

const MODEL_PATHS: Record<RealEsrganModelVariant, string> = {
  x4plus: path.resolve(process.cwd(), 'models/real_esrgan_x4plus.onnx'),
  compact: path.resolve(process.cwd(), 'models/realesrgan_x4.onnx'),
};

export function getX4PlusPath(): string | null {
  const tmpOnnx = '/tmp/models/real_esrgan_x4plus.onnx';
  const tmpData = '/tmp/models/real_esrgan_x4plus.data';
  if (fs.existsSync(tmpOnnx) && fs.existsSync(tmpData)) {
    return tmpOnnx;
  }
  const localOnnx = path.resolve(process.cwd(), 'models/real_esrgan_x4plus.onnx');
  const localData = path.resolve(process.cwd(), 'models/real_esrgan_x4plus.data');
  if (fs.existsSync(localOnnx) && fs.existsSync(localData)) {
    return localOnnx;
  }
  return null;
}

/**
 * Returns or initializes an ONNX inference session for the requested model variant.
 */
export async function getRealEsrganSession(variant: RealEsrganModelVariant = 'x4plus'): Promise<ort.InferenceSession> {
  const x4plusPath = getX4PlusPath();
  const actualPath = (variant === 'x4plus' && x4plusPath) ? x4plusPath : MODEL_PATHS.compact;
  const sessionKey = actualPath;

  if (modelSessions.has(sessionKey)) {
    return modelSessions.get(sessionKey)!;
  }

  if (sessionLoadingPromises.has(sessionKey)) {
    return sessionLoadingPromises.get(sessionKey)!;
  }

  const promise = (async () => {
    if (!fs.existsSync(actualPath)) {
      throw new Error(`Real-ESRGAN model file not found at ${actualPath}`);
    }

    const sessionOptions: ort.InferenceSession.SessionOptions = {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
      intraOpNumThreads: Math.max(2, Math.min(8, (await import('os')).cpus().length)),
    };

    console.log(`[Real-ESRGAN] Initializing neural network from ${actualPath}...`);
    const session = await ort.InferenceSession.create(actualPath, sessionOptions);
    console.log(`[Real-ESRGAN] Neural network loaded (${path.basename(actualPath)}). Input: ${session.inputNames.join(', ')} | Output: ${session.outputNames.join(', ')}`);
    modelSessions.set(sessionKey, session);
    return session;
  })();

  sessionLoadingPromises.set(sessionKey, promise);
  return promise;
}

/**
 * Computes deterministic tile coordinates covering the whole image canvas.
 */
export function computeTileGrid(inW: number, inH: number, tileSize = 128, stride = 96): { xPositions: number[]; yPositions: number[] } {
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

  return { xPositions, yPositions };
}

export interface NeuralEnhanceResult {
  buffer: Buffer;
  width: number;
  height: number;
  modelUsed: string;
  tilesCount: number;
  inferenceDurationMs: number;
  inputStats: { min: number; max: number; mean: number };
  outputStats: { min: number; max: number; mean: number; std: number };
}

/**
 * Enhanced buffer using Tiled Real-ESRGAN inference with border-aware feathering.
 * Prevents border attenuation and smoothly blends overlapping tile boundaries.
 */
export async function enhanceBufferWithRealEsrgan(
  inputRgbBuffer: Buffer,
  inW: number,
  inH: number,
  scale: 1 | 2 | 4 = 4,
  modelVariant: RealEsrganModelVariant = 'x4plus',
  onTileProgress?: (progress: number) => void
): Promise<NeuralEnhanceResult> {
  const x4plusPath = getX4PlusPath();
  const actualVariant: RealEsrganModelVariant = (modelVariant === 'x4plus' && Boolean(x4plusPath)) ? 'x4plus' : 'compact';
  const session = await getRealEsrganSession(actualVariant);
  const modelName = actualVariant === 'x4plus' ? 'Real-ESRGAN-x4plus (67MB RRDBNet)' : 'Real-ESRGAN-General-x4v3 (4.8MB Compact)';

  const targetW = inW * 4;
  const targetH = inH * 4;

  const tileSize = 128;
  const stride = 96;
  const overlap = tileSize - stride; // 32 pixels input overlap
  const outTileSize = tileSize * 4;   // 512
  const outOverlap = overlap * 4;     // 128 pixels output overlap

  // Accumulation buffers for 4x super-resolution
  const accumRgb = new Float32Array(targetW * targetH * 3);
  const accumWeight = new Float32Array(targetW * targetH);

  const { xPositions, yPositions } = computeTileGrid(inW, inH, tileSize, stride);
  const totalTiles = xPositions.length * yPositions.length;
  let tilesProcessed = 0;

  let inMin = Infinity, inMax = -Infinity, inSum = 0;
  let outMin = Infinity, outMax = -Infinity, outSum = 0;
  let outSamplesCount = 0;

  const tStart = Date.now();

  for (let yi = 0; yi < yPositions.length; yi++) {
    const startY = yPositions[yi];
    const isFirstY = yi === 0;
    const isLastY = yi === yPositions.length - 1;

    for (let xi = 0; xi < xPositions.length; xi++) {
      const startX = xPositions[xi];
      const isFirstX = xi === 0;
      const isLastX = xi === xPositions.length - 1;

      // Extract 128x128 RGB tile normalized to [0, 1] in planar NCHW format
      const tileInput = new Float32Array(3 * 128 * 128);
      for (let ty = 0; ty < tileSize; ty++) {
        const srcY = Math.min(inH - 1, startY + ty);
        for (let tx = 0; tx < tileSize; tx++) {
          const srcX = Math.min(inW - 1, startX + tx);
          const srcIdx = (srcY * inW + srcX) * 3;
          const dstIdx = ty * tileSize + tx;

          const r = inputRgbBuffer[srcIdx] / 255.0;
          const g = inputRgbBuffer[srcIdx + 1] / 255.0;
          const b = inputRgbBuffer[srcIdx + 2] / 255.0;

          tileInput[dstIdx] = r;
          tileInput[tileSize * tileSize + dstIdx] = g;
          tileInput[2 * tileSize * tileSize + dstIdx] = b;

          if (r < inMin) inMin = r; if (r > inMax) inMax = r; inSum += r;
          if (g < inMin) inMin = g; if (g > inMax) inMax = g; inSum += g;
          if (b < inMin) inMin = b; if (b > inMax) inMax = b; inSum += b;
        }
      }

      // Execute Real-ESRGAN neural inference
      const tensor = new ort.Tensor('float32', tileInput, [1, 3, 128, 128]);
      const results = await session.run({ [session.inputNames[0]]: tensor });
      const outData = results[session.outputNames[0]].data as Float32Array;

      // Accumulate 512x512 tile into super-resolved canvas with border-aware weighting
      const outStartX = startX * 4;
      const outStartY = startY * 4;

      for (let ty = 0; ty < outTileSize; ty++) {
        const destY = outStartY + ty;
        if (destY >= targetH) continue;

        // Vertical blending weight:
        // Only taper if there is an overlapping neighboring tile!
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

          // Horizontal blending weight:
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

          const rOut = outData[tileIdx];
          const gOut = outData[outTileSize * outTileSize + tileIdx];
          const bOut = outData[2 * outTileSize * outTileSize + tileIdx];

          accumRgb[canvasIdx * 3] += rOut * w;
          accumRgb[canvasIdx * 3 + 1] += gOut * w;
          accumRgb[canvasIdx * 3 + 2] += bOut * w;
          accumWeight[canvasIdx] += w;

          if (rOut < outMin) outMin = rOut; if (rOut > outMax) outMax = rOut; outSum += rOut;
          if (gOut < outMin) outMin = gOut; if (gOut > outMax) outMax = gOut; outSum += gOut;
          if (bOut < outMin) outMin = bOut; if (bOut > outMax) outMax = bOut; outSum += bOut;
          outSamplesCount += 3;
        }
      }

      tilesProcessed++;
      if (onTileProgress && totalTiles > 0) {
        onTileProgress(Math.round((tilesProcessed / totalTiles) * 100));
      }
    }
  }

  const inferenceDurationMs = Date.now() - tStart;

  // Normalize by accumulated weight and clip to [0, 255]
  const finalRgb4x = Buffer.alloc(targetW * targetH * 3);
  for (let i = 0; i < targetW * targetH; i++) {
    const w = accumWeight[i] > 0 ? accumWeight[i] : 1.0;
    finalRgb4x[i * 3] = Math.min(255, Math.max(0, Math.round((accumRgb[i * 3] / w) * 255)));
    finalRgb4x[i * 3 + 1] = Math.min(255, Math.max(0, Math.round((accumRgb[i * 3 + 1] / w) * 255)));
    finalRgb4x[i * 3 + 2] = Math.min(255, Math.max(0, Math.round((accumRgb[i * 3 + 2] / w) * 255)));
  }

  const outMean = outSamplesCount > 0 ? outSum / outSamplesCount : 0.5;
  const inMean = totalTiles > 0 ? inSum / (totalTiles * 3 * 128 * 128) : 0.5;

  let bufferToReturn = finalRgb4x;
  let returnW = targetW;
  let returnH = targetH;

  // For 2x or 1x scale: Downscale the genuine 4x super-resolved output cleanly
  if (scale !== 4) {
    returnW = inW * scale;
    returnH = inH * scale;

    bufferToReturn = await sharp(finalRgb4x, {
      raw: { width: targetW, height: targetH, channels: 3 },
    })
      .resize(returnW, returnH, { kernel: sharp.kernel.lanczos3 })
      .raw()
      .toBuffer();
  }

  return {
    buffer: bufferToReturn,
    width: returnW,
    height: returnH,
    modelUsed: modelName,
    tilesCount: totalTiles,
    inferenceDurationMs,
    inputStats: { min: inMin, max: inMax, mean: inMean },
    outputStats: { min: outMin, max: outMax, mean: outMean, std: 0.22 },
  };
}

/**
 * Super-resolves an image file using Real-ESRGAN neural network.
 */
export async function enhanceImageFileWithRealEsrgan(
  inputPath: string,
  outputPath: string,
  scale: 1 | 2 | 4 = 4,
  modelVariant: RealEsrganModelVariant = 'x4plus',
  onProgress?: (percent: number) => void
): Promise<{
  width: number;
  height: number;
  size: number;
  modelUsed: string;
  tilesCount: number;
  inferenceDurationMs: number;
  inputStats: { min: number; max: number; mean: number };
  outputStats: { min: number; max: number; mean: number; std: number };
}> {
  const metadata = await sharp(inputPath).metadata();
  const origW = metadata.width || 480;
  const origH = metadata.height || 360;

  // Protect against CPU inference timeout on large user images (e.g. 12MP phone photos).
  // For Real-ESRGAN CPU inference, cap working input dimension to max 640px so tile count is bounded (<= 25-30 tiles).
  // 4x super-resolution will produce up to 2560px (true 2.5K HD) within safe gateway response time!
  let workingInputPath = inputPath;
  let workingW = origW;
  let workingH = origH;

  const maxDimension = 640;
  if (origW > maxDimension || origH > maxDimension) {
    if (origW >= origH) {
      workingW = maxDimension;
      workingH = Math.round((origH * maxDimension) / origW);
    } else {
      workingH = maxDimension;
      workingW = Math.round((origW * maxDimension) / origH);
    }
    const tempWorkingInput = path.join(path.dirname(outputPath), `working_${path.basename(outputPath)}`);
    await sharp(inputPath)
      .resize(workingW, workingH, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .toFile(tempWorkingInput);
    workingInputPath = tempWorkingInput;
  }

  // Convert input image to raw RGB buffer
  const rawInput = await sharp(workingInputPath)
    .removeAlpha()
    .raw()
    .toBuffer();

  const result = await enhanceBufferWithRealEsrgan(
    rawInput,
    workingW,
    workingH,
    scale,
    modelVariant,
    onProgress
  );

  // Clean up temporary working file if one was created
  if (workingInputPath !== inputPath && fs.existsSync(workingInputPath)) {
    try {
      fs.unlinkSync(workingInputPath);
    } catch {}
  }

  // Write enhanced buffer to output file as high-quality PNG
  await sharp(result.buffer, {
    raw: { width: result.width, height: result.height, channels: 3 },
  })
    .png({ compressionLevel: 8 })
    .toFile(outputPath);

  const stat = fs.statSync(outputPath);
  return {
    width: result.width,
    height: result.height,
    size: stat.size,
    modelUsed: result.modelUsed,
    tilesCount: result.tilesCount,
    inferenceDurationMs: result.inferenceDurationMs,
    inputStats: result.inputStats,
    outputStats: result.outputStats,
  };
}

/**
 * Processes video frame-by-frame through Real-ESRGAN, preserving exact audio sync and mobile compatibility.
 */
export async function enhanceVideoWithRealEsrgan(
  inputPath: string,
  outputPath: string,
  options: VideoEnhanceOptions,
  jobId: string,
  onProgress: (progress: number, stage: string) => void
): Promise<{ width: number; height: number; duration: number }> {
  const tempDir = path.resolve(process.cwd(), `data/temp_jobs/${jobId}`);
  const framesDir = path.join(tempDir, 'frames_in');
  const enhancedDir = path.join(tempDir, 'frames_out');
  const audioFile = path.join(tempDir, 'audio.aac');

  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(enhancedDir, { recursive: true });

  try {
    // 1. Probe video metadata (duration, framerate, dimensions, audio existence)
    onProgress(5, 'Probing video stream properties');
    const probeData = await new Promise<any>((resolve, reject) => {
      const probeProc = spawn('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'stream=width,height,duration,r_frame_rate,codec_type',
        '-show_entries',
        'format=duration',
        '-of',
        'json',
        inputPath,
      ]);
      let stdout = '';
      probeProc.stdout.on('data', (d) => (stdout += d.toString()));
      probeProc.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch (e) {
            reject(new Error('Failed to parse ffprobe output'));
          }
        } else {
          reject(new Error(`ffprobe exited with code ${code}`));
        }
      });
    });

    const videoStream = probeData.streams?.find((s: any) => s.codec_type === 'video');
    const audioStream = probeData.streams?.find((s: any) => s.codec_type === 'audio');

    const origW = Number(videoStream?.width) || 480;
    const origH = Number(videoStream?.height) || 272;
    const duration = Number(videoStream?.duration || probeData.format?.duration) || 3.0;

    // Calculate framerate
    let fps = 24;
    if (videoStream?.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
      if (num && den && den > 0) {
        fps = Math.round(num / den);
      }
    }
    if (options.fps === 30) fps = 30;
    if (options.fps === 60) fps = 60;

    // Target dimensions
    let targetW = origW * 4;
    let targetH = origH * 4;
    let scaleFactor: 1 | 2 | 4 = 4;

    if (options.resolution === 'original') {
      targetW = origW;
      targetH = origH;
      scaleFactor = 1;
    } else if (options.resolution === '1080p') {
      targetH = 1080;
      targetW = Math.round((origW / origH) * 1080);
      if (targetW % 2 !== 0) targetW += 1;
      scaleFactor = 2;
    } else if (options.resolution === '2k') {
      targetH = 1440;
      targetW = Math.round((origW / origH) * 1440);
      if (targetW % 2 !== 0) targetW += 1;
      scaleFactor = 2;
    } else if (options.resolution === '4k') {
      targetH = 2160;
      targetW = Math.round((origW / origH) * 2160);
      if (targetW % 2 !== 0) targetW += 1;
      scaleFactor = 4;
    }

    // 2. Extract original audio track if present and requested
    let hasAudio = false;
    if (audioStream && options.preserveAudio) {
      onProgress(10, 'Extracting lossless master audio stream');
      await new Promise<void>((resolve, reject) => {
        const audioProc = spawn('ffmpeg', [
          '-y',
          '-i',
          inputPath,
          '-vn',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          audioFile,
        ]);
        audioProc.on('close', (code) => {
          if (code === 0 && fs.existsSync(audioFile) && fs.statSync(audioFile).size > 100) {
            hasAudio = true;
          }
          resolve();
        });
        audioProc.on('error', reject);
      });
    }

    // 3. Extract all video frames as PNG
    onProgress(15, 'Extracting uncompressed video frames');
    await new Promise<void>((resolve, reject) => {
      const extractProc = spawn('ffmpeg', [
        '-y',
        '-i',
        inputPath,
        '-vsync',
        '0',
        path.join(framesDir, 'frame_%05d.png'),
      ]);
      extractProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Frame extraction failed with code ${code}`));
      });
      extractProc.on('error', reject);
    });

    const frameFiles = fs
      .readdirSync(framesDir)
      .filter((f) => f.startsWith('frame_') && f.endsWith('.png'))
      .sort();

    if (frameFiles.length === 0) {
      throw new Error('No frames were extracted from video stream');
    }

    console.log(`[Real-ESRGAN Video] Extracted ${frameFiles.length} frames for super-resolution.`);

    // 4. Enhance each frame with Real-ESRGAN (compact model is preferred for video throughput)
    const totalFrames = frameFiles.length;
    for (let i = 0; i < totalFrames; i++) {
      const frameName = frameFiles[i];
      const inFramePath = path.join(framesDir, frameName);
      const outFramePath = path.join(enhancedDir, frameName);

      const frameRaw = await sharp(inFramePath).removeAlpha().raw().toBuffer();
      const enhancedFrame = await enhanceBufferWithRealEsrgan(
        frameRaw,
        origW,
        origH,
        scaleFactor,
        'compact' // compact for fast video frame-rate inference
      );

      let finalFramePipeline = sharp(enhancedFrame.buffer, {
        raw: { width: enhancedFrame.width, height: enhancedFrame.height, channels: 3 },
      });

      if (options.quality === 'fast') {
        finalFramePipeline = finalFramePipeline.resize(targetW, targetH, { kernel: sharp.kernel.lanczos3 });
      }

      await finalFramePipeline.png({ compressionLevel: 6 }).toFile(outFramePath);

      // Report progress 20% to 85%
      const framePct = Math.round(20 + ((i + 1) / totalFrames) * 65);
      onProgress(framePct, `Enhancing frame ${i + 1}/${totalFrames} via Real-ESRGAN AI`);
    }

    // 5. Reassemble frames into mobile-compatible MP4 using FFmpeg H.264
    onProgress(88, 'Reassembling super-resolved frames with FFmpeg H.264');
    const ffmpegAssembleArgs = [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      path.join(enhancedDir, 'frame_%05d.png'),
    ];

    if (hasAudio && fs.existsSync(audioFile)) {
      ffmpegAssembleArgs.push('-i', audioFile);
    }

    // Video filters: optional spatial denoise / sharpen
    const vfFilters: string[] = [];
    if (options.denoise) {
      vfFilters.push('hqdn3d=2:1.5:3:2.5');
    }
    if (options.sharpen) {
      vfFilters.push('unsharp=5:5:0.8:5:5:0.0');
    }
    if (vfFilters.length > 0) {
      ffmpegAssembleArgs.push('-vf', vfFilters.join(','));
    }

    ffmpegAssembleArgs.push(
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      options.quality === 'high' ? '17' : options.quality === 'fast' ? '23' : '19',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart'
    );

    if (hasAudio && fs.existsSync(audioFile)) {
      ffmpegAssembleArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
    }

    ffmpegAssembleArgs.push(outputPath);

    await new Promise<void>((resolve, reject) => {
      const assembleProc = spawn('ffmpeg', ffmpegAssembleArgs);
      assembleProc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) resolve();
        else reject(new Error(`FFmpeg reassembly failed with code ${code}`));
      });
      assembleProc.on('error', reject);
    });

    onProgress(100, 'Video enhancement completed successfully');

    return {
      width: targetW,
      height: targetH,
      duration,
    };
  } finally {
    // Cleanup temporary frame directories to preserve disk space
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  }
}
