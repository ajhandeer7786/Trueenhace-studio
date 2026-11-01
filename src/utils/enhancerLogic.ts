import type { ImageScale, VideoResolution, VideoEnhanceOptions } from '../types/index.ts';

/**
 * Format bytes into human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format seconds into mm:ss or hh:mm:ss
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Calculate scaled dimensions ensuring even width & height (FFmpeg / H.264 compatibility)
 */
export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  scaleOrResolution: ImageScale | VideoResolution
): { width: number; height: number } {
  if (origWidth <= 0 || origHeight <= 0) {
    return { width: 1920, height: 1080 };
  }

  const aspectRatio = origWidth / origHeight;

  if (typeof scaleOrResolution === 'number') {
    // Image scale multiplier
    const rawW = Math.round(origWidth * scaleOrResolution);
    const rawH = Math.round(origHeight * scaleOrResolution);
    return {
      width: rawW,
      height: rawH,
    };
  }

  // Video resolution target
  let targetHeight: number;
  switch (scaleOrResolution) {
    case '1080p':
      targetHeight = 1080;
      break;
    case '2k':
      targetHeight = 1440;
      break;
    case '4k':
      targetHeight = 2160;
      break;
    case 'original':
    default:
      targetHeight = origHeight;
      break;
  }

  // If original is already higher or equal to target, keep or upscale based on intent
  let targetWidth = Math.round(targetHeight * aspectRatio);

  // Ensure even dimensions for H.264 / H.265 video codecs
  if (targetWidth % 2 !== 0) targetWidth += 1;
  if (targetHeight % 2 !== 0) targetHeight += 1;

  return { width: targetWidth, height: targetHeight };
}

/**
 * Validate image file
 */
export function validateImageFile(file: { name: string; size: number; type: string }): { valid: boolean; error?: string } {
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  const validExt = allowedExts.includes(ext);
  const validMime = allowedMime.includes(file.type.toLowerCase()) || validExt;

  if (!validMime) {
    return {
      valid: false,
      error: `Unsupported image format (${ext || file.type}). Please upload a JPG, PNG, or WebP image.`,
    };
  }

  const maxBytes = 50 * 1024 * 1024; // 50MB
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Image exceeds maximum allowed size of 50MB (${formatBytes(file.size)}).`,
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: 'File appears to be empty (0 bytes).',
    };
  }

  return { valid: true };
}

/**
 * Validate video file
 */
export function validateVideoFile(file: { name: string; size: number; type: string }): { valid: boolean; error?: string } {
  const allowedMime = ['video/mp4', 'video/quicktime', 'video/webm'];
  const allowedExts = ['.mp4', '.mov', '.webm'];

  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  const validExt = allowedExts.includes(ext);
  const validMime = allowedMime.includes(file.type.toLowerCase()) || validExt;

  if (!validMime) {
    return {
      valid: false,
      error: `Unsupported video format (${ext || file.type}). Please upload an MP4, MOV, or WebM video.`,
    };
  }

  const maxBytes = 250 * 1024 * 1024; // 250MB
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Video exceeds maximum allowed size of 250MB (${formatBytes(file.size)}).`,
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: 'File appears to be empty (0 bytes).',
    };
  }

  return { valid: true };
}

/**
 * Construct FFmpeg video filter chain based on options
 */
export function buildFfmpegFilterChain(
  options: VideoEnhanceOptions,
  targetDimensions?: { width: number; height: number },
  transformsPath?: string
): string[] {
  const filters: string[] = [];

  // Pass 2 stabilization if transform file is supplied
  if (options.stabilize && transformsPath) {
    filters.push(`vidstabtransform=input='${transformsPath}':zoom=1:smoothing=12:interpol=bicubic`);
  }

  // 3D Denoising (hqdn3d: luma_spatial:chroma_spatial:luma_tmp:chroma_tmp)
  if (options.denoise) {
    filters.push('hqdn3d=4.0:3.0:6.0:4.5');
  }

  // Unsharp sharpening
  if (options.sharpen) {
    filters.push('unsharp=5:5:1.0:5:5:0.0');
  }

  // Scaling with high quality Lanczos filter
  if (targetDimensions && options.resolution !== 'original') {
    filters.push(`scale=${targetDimensions.width}:${targetDimensions.height}:flags=lanczos`);
  }

  // Frame rate interpolation
  if (options.fps === 30 || options.fps === 60) {
    // minterpolate with motion compensation
    filters.push(`minterpolate=fps=${options.fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`);
  }

  return filters;
}
