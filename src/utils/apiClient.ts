import type {
  ProcessingJob,
  SystemCapabilities,
  RemoteGpuConfig,
  ImageEnhanceOptions,
  VideoEnhanceOptions,
} from '../types/index.ts';

async function parseJsonResponse<T = any>(res: Response, fallbackErrorMessage: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || fallbackErrorMessage);
    }
    const text = await res.text().catch(() => '');
    if (res.status === 504 || res.status === 502 || text.includes('Gateway Timeout') || text.includes('Bad Gateway')) {
      throw new Error('Enhancement processing timed out on server. Please try using the Fast Compact engine or a slightly smaller image.');
    }
    throw new Error(`Server returned HTTP ${res.status}: ${fallbackErrorMessage}`);
  }

  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    if (text.trim().startsWith('<') || text.includes('<!doctype') || text.includes('<!DOCTYPE')) {
      throw new Error('Server connection was interrupted. The server may be restarting or the session timed out. Please try again.');
    }
    throw new Error('Unexpected response format from server.');
  }

  return res.json();
}

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 1): Promise<Response> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }
  const isFailedToFetch =
    lastError?.name === 'TypeError' ||
    String(lastError?.message || '').includes('Failed to fetch');
  if (isFailedToFetch) {
    throw new Error('Connection to processing server was temporarily interrupted. Please try again.');
  }
  throw lastError;
}

export async function fetchCapabilities(): Promise<SystemCapabilities> {
  const res = await fetchWithRetry('/api/capabilities');
  return parseJsonResponse<SystemCapabilities>(res, 'Failed to fetch capabilities');
}

export async function fetchHistory(): Promise<ProcessingJob[]> {
  const res = await fetch('/api/history');
  return parseJsonResponse<ProcessingJob[]>(res, 'Failed to fetch history');
}

export async function deleteHistoryJob(jobId: string): Promise<{ success: boolean; deletedFiles: number }> {
  const res = await fetch(`/api/history/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });
  return parseJsonResponse<{ success: boolean; deletedFiles: number }>(res, 'Failed to delete job');
}

export async function clearAllHistory(): Promise<{ success: boolean; deletedFiles: number }> {
  const res = await fetch('/api/history/clear-all', {
    method: 'POST',
  });
  return parseJsonResponse<{ success: boolean; deletedFiles: number }>(res, 'Failed to clear history');
}

export async function generateSampleAsset(type: 'image' | 'video'): Promise<{
  filename: string;
  originalName: string;
  size: number;
  dimensions: { width: number; height: number };
  duration?: number;
  url: string;
}> {
  const res = await fetchWithRetry('/api/sample/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
  return parseJsonResponse(res, 'Failed to generate sample asset');
}

export async function enhanceImage(
  file: File | null,
  sampleFilename: string | null,
  options: ImageEnhanceOptions
): Promise<ProcessingJob> {
  const formData = new FormData();
  if (file) {
    formData.append('image', file);
  } else if (sampleFilename) {
    formData.append('sampleFilename', sampleFilename);
  } else {
    throw new Error('Please select an image file or load a sample');
  }

  formData.append('scale', String(options.scale));
  formData.append('denoise', String(options.denoise));
  if (options.denoiseLevel) formData.append('denoiseLevel', String(options.denoiseLevel));
  formData.append('deblur', String(options.deblur));
  if (options.deblurLevel) formData.append('deblurLevel', String(options.deblurLevel));
  formData.append('faceRestore', String(options.faceRestore));
  if (options.faceFidelity !== undefined) formData.append('faceFidelity', String(options.faceFidelity));
  if (options.faceModel) formData.append('faceModel', options.faceModel);
  formData.append('engine', options.engine);

  const res = await fetchWithRetry('/api/enhance/image', {
    method: 'POST',
    body: formData,
  });

  return parseJsonResponse<ProcessingJob>(res, 'Image enhancement failed');
}

export async function fetchFaceModelStatus(): Promise<{
  ready: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  sizeMb: number;
  modelName: string;
}> {
  const res = await fetch('/api/models/face-status');
  return parseJsonResponse(res, 'Failed to fetch face model status');
}

export async function triggerFaceModelDownload(): Promise<{
  message: string;
  ready: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  sizeMb: number;
  modelName: string;
}> {
  const res = await fetch('/api/models/face-download', { method: 'POST' });
  return parseJsonResponse(res, 'Failed to initiate model download');
}

export async function startVideoEnhance(
  file: File | null,
  sampleFilename: string | null,
  options: VideoEnhanceOptions
): Promise<ProcessingJob> {
  const formData = new FormData();
  if (file) {
    formData.append('video', file);
  } else if (sampleFilename) {
    formData.append('sampleFilename', sampleFilename);
  } else {
    throw new Error('Please select a video file or load a sample');
  }

  formData.append('resolution', options.resolution);
  formData.append('stabilize', String(options.stabilize));
  formData.append('denoise', String(options.denoise));
  formData.append('sharpen', String(options.sharpen));
  formData.append('fps', String(options.fps));
  formData.append('preserveAudio', String(options.preserveAudio));
  formData.append('quality', options.quality);

  const res = await fetchWithRetry('/api/enhance/video', {
    method: 'POST',
    body: formData,
  });

  return parseJsonResponse<ProcessingJob>(res, 'Video enhancement failed to start');
}

export async function checkVideoStatus(jobId: string): Promise<ProcessingJob> {
  const res = await fetch(`/api/enhance/video-status/${encodeURIComponent(jobId)}`);
  return parseJsonResponse<ProcessingJob>(res, 'Failed to check video status');
}

export async function getRemoteGpuConfig(): Promise<RemoteGpuConfig> {
  const res = await fetch('/api/settings/remote-gpu');
  return parseJsonResponse<RemoteGpuConfig>(res, 'Failed to get remote GPU configuration');
}

export async function saveRemoteGpuConfig(config: RemoteGpuConfig): Promise<{ success: boolean; config: RemoteGpuConfig }> {
  const res = await fetch('/api/settings/remote-gpu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return parseJsonResponse<{ success: boolean; config: RemoteGpuConfig }>(res, 'Failed to save remote GPU configuration');
}
