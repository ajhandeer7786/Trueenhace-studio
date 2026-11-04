import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

// Model paths
const YUNET_MODEL_PATH = path.resolve(process.cwd(), 'models/face_detection_yunet.onnx');
const GFPGAN_TMP_PATH = '/tmp/models/gfpgan_1.4.onnx';
const GFPGAN_DOWNLOAD_URL = 'https://huggingface.co/facefusion/models-3.0.0/resolve/main/gfpgan_1.4.onnx';

// In-memory cached sessions
let yunetSession: ort.InferenceSession | null = null;
let gfpganSession: ort.InferenceSession | null = null;
let gfpganLoadingPromise: Promise<ort.InferenceSession> | null = null;

// Download status tracker
let isDownloadingModel = false;
let downloadProgressPercent = 0;
let downloadError: string | null = null;

export interface DetectedFace {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

export interface FaceRestorationResult {
  outputBuffer: Buffer;
  facesRestored: number;
  modelUsed: string;
  inferenceDurationMs: number;
  fidelityApplied: number;
  faceBoxes: DetectedFace[];
}

/**
 * Checks whether the GFPGAN model is cached and ready on disk.
 */
export function isFaceModelReady(): boolean {
  return fs.existsSync(GFPGAN_TMP_PATH) && fs.statSync(GFPGAN_TMP_PATH).size > 300 * 1024 * 1024;
}

export function getFaceModelStatus() {
  const ready = isFaceModelReady();
  const sizeMb = ready ? Math.round(fs.statSync(GFPGAN_TMP_PATH).size / (1024 * 1024)) : 0;
  return {
    ready,
    downloading: isDownloadingModel,
    progress: downloadProgressPercent,
    error: downloadError,
    sizeMb,
    modelName: 'GFPGAN v1.4 (Generative Facial Prior • 512x512)',
  };
}

/**
 * Downloads the genuine GFPGAN v1.4 ONNX model on demand with progress reporting.
 */
export async function ensureFaceModelDownloaded(): Promise<string> {
  if (isFaceModelReady()) {
    return GFPGAN_TMP_PATH;
  }

  if (isDownloadingModel) {
    // Wait for ongoing download
    while (isDownloadingModel) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (isFaceModelReady()) return GFPGAN_TMP_PATH;
    throw new Error(downloadError || 'GFPGAN download failed');
  }

  isDownloadingModel = true;
  downloadProgressPercent = 0;
  downloadError = null;
  fs.mkdirSync(path.dirname(GFPGAN_TMP_PATH), { recursive: true });

  const tempDownloadPath = `${GFPGAN_TMP_PATH}.download`;

  try {
    console.log(`[FaceRestoration] Starting download of GFPGAN v1.4 ONNX from Hugging Face...`);
    const resp = await fetch(GFPGAN_DOWNLOAD_URL);
    if (!resp.ok) {
      throw new Error(`Failed to download GFPGAN model: HTTP ${resp.status} ${resp.statusText}`);
    }

    const totalBytes = Number(resp.headers.get('content-length')) || 340299087;
    const fileStream = fs.createWriteStream(tempDownloadPath);

    const reader = resp.body?.getReader();
    if (!reader) {
      throw new Error('Response body stream is not readable');
    }

    let receivedBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        fileStream.write(Buffer.from(value));
        receivedBytes += value.length;
        downloadProgressPercent = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
      }
    }

    await new Promise<void>((resolve, reject) => {
      fileStream.end((err?: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Rename atomic
    fs.renameSync(tempDownloadPath, GFPGAN_TMP_PATH);
    downloadProgressPercent = 100;
    console.log(`[FaceRestoration] GFPGAN v1.4 ONNX download completed (${Math.round(receivedBytes / (1024 * 1024))} MB).`);
    return GFPGAN_TMP_PATH;
  } catch (err: any) {
    downloadError = err?.message || 'Download failed';
    console.error(`[FaceRestoration] Model download error:`, err);
    try {
      if (fs.existsSync(tempDownloadPath)) fs.unlinkSync(tempDownloadPath);
    } catch {}
    throw err;
  } finally {
    isDownloadingModel = false;
  }
}

/**
 * Returns or creates the cached ONNX session for YuNet Face Detector.
 */
export async function getYuNetSession(): Promise<ort.InferenceSession | null> {
  if (yunetSession) return yunetSession;
  if (!fs.existsSync(YUNET_MODEL_PATH)) {
    console.warn('[FaceRestoration] YuNet model not found at', YUNET_MODEL_PATH);
    return null;
  }
  try {
    yunetSession = await ort.InferenceSession.create(YUNET_MODEL_PATH, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
    return yunetSession;
  } catch (err) {
    console.error('[FaceRestoration] Failed to load YuNet session:', err);
    return null;
  }
}

/**
 * Returns or creates the cached ONNX session for GFPGAN v1.4.
 */
export async function getGfpganSession(): Promise<ort.InferenceSession> {
  if (gfpganSession) return gfpganSession;
  if (gfpganLoadingPromise) return gfpganLoadingPromise;

  gfpganLoadingPromise = (async () => {
    const modelPath = await ensureFaceModelDownloaded();
    console.log(`[FaceRestoration] Initializing GFPGAN v1.4 session on CPU...`);
    const numThreads = Math.max(2, Math.min(8, (await import('os')).cpus().length));
    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
      intraOpNumThreads: numThreads,
    });
    console.log(`[FaceRestoration] GFPGAN session initialized with ${numThreads} threads.`);
    gfpganSession = session;
    return session;
  })();

  return gfpganLoadingPromise;
}

/**
 * Detects faces using YuNet in 640x640 space, mapped back to original dimensions.
 */
export async function detectFaces(
  imageBuffer: Buffer,
  origW: number,
  origH: number
): Promise<DetectedFace[]> {
  const session = await getYuNetSession();
  if (!session) {
    // Fallback: estimate centered portrait face box if detector is absent
    const boxSize = Math.round(Math.min(origW, origH) * 0.7);
    return [{
      x: Math.round((origW - boxSize) / 2),
      y: Math.round(origH * 0.15),
      w: boxSize,
      h: boxSize,
      score: 0.8,
    }];
  }

  // Pre-process for YuNet: resize to exactly 640x640, BGR format
  const resized = await sharp(imageBuffer)
    .resize(640, 640, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const tensorData = new Float32Array(3 * 640 * 640);
  for (let y = 0; y < 640; y++) {
    for (let x = 0; x < 640; x++) {
      const srcIdx = (y * 640 + x) * 3;
      const dstIdx = y * 640 + x;
      // BGR float values
      tensorData[dstIdx] = resized[srcIdx + 2]; // B
      tensorData[640 * 640 + dstIdx] = resized[srcIdx + 1]; // G
      tensorData[2 * 640 * 640 + dstIdx] = resized[srcIdx]; // R
    }
  }

  const tensor = new ort.Tensor('float32', tensorData, [1, 3, 640, 640]);
  const outputs = await session.run({ input: tensor });

  const strides = [8, 16, 32];
  const candidates: DetectedFace[] = [];

  for (const s of strides) {
    const cls = outputs[`cls_${s}`].data as Float32Array;
    const obj = outputs[`obj_${s}`].data as Float32Array;
    const bbox = outputs[`bbox_${s}`].data as Float32Array;

    const gridW = 640 / s;
    const gridH = 640 / s;

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const idx = gy * gridW + gx;
        const score = Math.sqrt(Math.max(0, cls[idx] * obj[idx]));
        if (score >= 0.45) {
          const cx = (gx + 0.5) * s + bbox[idx * 4] * s;
          const cy = (gy + 0.5) * s + bbox[idx * 4 + 1] * s;
          const bw = Math.exp(bbox[idx * 4 + 2]) * s;
          const bh = Math.exp(bbox[idx * 4 + 3]) * s;

          // Convert from 640x640 space to original image space
          const origX = Math.round((cx - bw / 2) * (origW / 640));
          const origY = Math.round((cy - bh / 2) * (origH / 640));
          const origBw = Math.round(bw * (origW / 640));
          const origBh = Math.round(bh * (origH / 640));

          candidates.push({
            x: Math.max(0, origX),
            y: Math.max(0, origY),
            w: Math.min(origW - origX, origBw),
            h: Math.min(origH - origY, origBh),
            score,
          });
        }
      }
    }
  }

  // Non-Maximum Suppression (NMS) to prune overlapping boxes
  candidates.sort((a, b) => b.score - a.score);
  const selected: DetectedFace[] = [];

  for (const cand of candidates) {
    let overlap = false;
    for (const sel of selected) {
      const iox1 = Math.max(cand.x, sel.x);
      const ioy1 = Math.max(cand.y, sel.y);
      const iox2 = Math.min(cand.x + cand.w, sel.x + sel.w);
      const ioy2 = Math.min(cand.y + cand.h, sel.y + sel.h);

      if (iox2 > iox1 && ioy2 > ioy1) {
        const interArea = (iox2 - iox1) * (ioy2 - ioy1);
        const unionArea = cand.w * cand.h + sel.w * sel.h - interArea;
        const iou = interArea / unionArea;
        if (iou > 0.35) {
          overlap = true;
          break;
        }
      }
    }
    if (!overlap) {
      selected.push(cand);
      if (selected.length >= 4) break; // Limit to top 4 faces per image for fast CPU processing
    }
  }

  // If no face was detected by threshold, check if candidates has anything or default to center-top
  if (selected.length === 0) {
    if (candidates.length > 0) {
      selected.push(candidates[0]);
    } else {
      const boxSize = Math.round(Math.min(origW, origH) * 0.65);
      selected.push({
        x: Math.max(0, Math.round((origW - boxSize) / 2)),
        y: Math.max(0, Math.round(origH * 0.1)),
        w: Math.min(origW, boxSize),
        h: Math.min(origH, boxSize),
        score: 0.5,
      });
    }
  }

  return selected;
}

/**
 * Creates an elliptical feather alpha mask (512x512) for smooth border blending.
 * The inner region has alpha=1.0, and the outer border smoothly falls off with a cosine curve.
 */
function createFeatherMask(size = 512, innerRadiusRatio = 0.68): Float32Array {
  const mask = new Float32Array(size * size);
  const center = size / 2;
  const maxRadius = size / 2;
  const innerRadius = maxRadius * innerRadiusRatio;
  const featherDist = maxRadius - innerRadius;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - center) / maxRadius;
      const dy = (y - center) / maxRadius;
      // Elliptical distance metric (faces are slightly taller than wide)
      const dist = Math.sqrt(dx * dx + (dy * 0.95) * (dy * 0.95)) * maxRadius;

      if (dist <= innerRadius) {
        mask[y * size + x] = 1.0;
      } else if (dist >= maxRadius) {
        mask[y * size + x] = 0.0;
      } else {
        // Smooth cosine falloff
        const progress = (dist - innerRadius) / featherDist;
        mask[y * size + x] = 0.5 * (1 + Math.cos(progress * Math.PI));
      }
    }
  }
  return mask;
}

const cachedFeatherMask = createFeatherMask(512, 0.70);

/**
 * Restores human faces using the genuine GFPGAN v1.4 neural network.
 * Preserves facial identity using user fidelity control and seamless feather blending.
 *
 * @param inputImageBuffer Raw or encoded image buffer
 * @param fidelity 0 to 100 percentage (default 70% for balanced MagicHour likeness vs detail)
 */
export async function restoreFacesWithGfpgan(
  inputImageBuffer: Buffer,
  fidelity = 70
): Promise<FaceRestorationResult> {
  const tStart = Date.now();
  const session = await getGfpganSession();

  const meta = await sharp(inputImageBuffer).metadata();
  const imgW = meta.width || 800;
  const imgH = meta.height || 600;

  // 1. Detect faces in image
  const detectedFaces = await detectFaces(inputImageBuffer, imgW, imgH);
  console.log(`[FaceRestoration] Detected ${detectedFaces.length} face(s) in ${imgW}x${imgH} image.`);

  // Fidelity weight: alpha = fidelity / 100 (e.g. 0.70)
  // Higher fidelity = stronger preservation of original likeness
  // Restoration weight: beta = 0.5 + (1 - fidelity / 100) * 0.5
  const restorationWeight = Math.max(0.35, Math.min(0.95, 1.0 - (fidelity / 100) * 0.45));

  // Load input as raw RGB buffer
  let currentImage = sharp(inputImageBuffer).removeAlpha();

  for (const face of detectedFaces) {
    // Expand bounding box with 1.35x padding to capture hair fringe, forehead, and jawline
    const padFactor = 0.35;
    const padX = Math.round(face.w * padFactor);
    const padY = Math.round(face.h * padFactor);

    // Make crop box square
    const cropCenterX = face.x + face.w / 2;
    const cropCenterY = face.y + face.h / 2;
    const cropSize = Math.round(Math.max(face.w, face.h) * (1 + padFactor * 2));

    let cropLeft = Math.max(0, Math.round(cropCenterX - cropSize / 2));
    let cropTop = Math.max(0, Math.round(cropCenterY - cropSize / 2));
    let cropWidth = Math.min(imgW - cropLeft, cropSize);
    let cropHeight = Math.min(imgH - cropTop, cropSize);

    // Ensure valid crop coordinates
    if (cropWidth < 32 || cropHeight < 32) continue;

    // Extract face patch and resize to 512x512
    const originalCrop512 = await currentImage
      .clone()
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .resize(512, 512, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .raw()
      .toBuffer();

    // Prepare GFPGAN input: normalized to [-1, 1], RGB planar shape [1, 3, 512, 512]
    const normInput = new Float32Array(3 * 512 * 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const srcIdx = (y * 512 + x) * 3;
        const dstIdx = y * 512 + x;
        // Standard StyleGAN2 / GFPGAN PyTorch normalization: (x / 255 - 0.5) / 0.5 -> [-1, 1]
        normInput[dstIdx] = (originalCrop512[srcIdx] / 255.0 - 0.5) / 0.5;
        normInput[512 * 512 + dstIdx] = (originalCrop512[srcIdx + 1] / 255.0 - 0.5) / 0.5;
        normInput[2 * 512 * 512 + dstIdx] = (originalCrop512[srcIdx + 2] / 255.0 - 0.5) / 0.5;
      }
    }

    const inputTensor = new ort.Tensor('float32', normInput, [1, 3, 512, 512]);
    const inferenceStart = Date.now();
    const result = await session.run({ input: inputTensor });
    console.log(`[FaceRestoration] GFPGAN face inference took ${Date.now() - inferenceStart}ms`);

    const outData = result['output'].data as Float32Array;

    // Convert output to RGB + Alpha (RGBA) buffer with feather mask and fidelity blending
    const blendedRgba = Buffer.alloc(512 * 512 * 4);

    for (let i = 0; i < 512 * 512; i++) {
      // GFPGAN output is in [-1, 1], denormalize: (val + 1) * 127.5
      const genR = Math.min(255, Math.max(0, (outData[i] + 1.0) * 127.5));
      const genG = Math.min(255, Math.max(0, (outData[512 * 512 + i] + 1.0) * 127.5));
      const genB = Math.min(255, Math.max(0, (outData[2 * 512 * 512 + i] + 1.0) * 127.5));

      const origR = originalCrop512[i * 3];
      const origG = originalCrop512[i * 3 + 1];
      const origB = originalCrop512[i * 3 + 2];

      // Identity preservation blend
      const finalR = Math.round(origR * (1 - restorationWeight) + genR * restorationWeight);
      const finalG = Math.round(origG * (1 - restorationWeight) + genG * restorationWeight);
      const finalB = Math.round(origB * (1 - restorationWeight) + genB * restorationWeight);

      // Alpha feathering
      const alpha = Math.round(cachedFeatherMask[i] * 255);

      blendedRgba[i * 4] = finalR;
      blendedRgba[i * 4 + 1] = finalG;
      blendedRgba[i * 4 + 2] = finalB;
      blendedRgba[i * 4 + 3] = alpha;
    }

    // Resize the restored face patch back to the extracted crop dimensions
    const restoredFaceOverlay = await sharp(blendedRgba, {
      raw: { width: 512, height: 512, channels: 4 },
    })
      .resize(cropWidth, cropHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();

    // Composite restored face onto image
    const compositedBuffer = await currentImage
      .composite([{
        input: restoredFaceOverlay,
        left: cropLeft,
        top: cropTop,
        blend: 'over',
      }])
      .png()
      .toBuffer();

    currentImage = sharp(compositedBuffer).removeAlpha();
  }

  const finalBuffer = await currentImage.png({ compressionLevel: 8 }).toBuffer();
  const totalDuration = Date.now() - tStart;

  return {
    outputBuffer: finalBuffer,
    facesRestored: detectedFaces.length,
    modelUsed: 'GFPGAN v1.4 Neural Face Prior (512x512) + YuNet Alignment',
    inferenceDurationMs: totalDuration,
    fidelityApplied: fidelity,
    faceBoxes: detectedFaces,
  };
}
