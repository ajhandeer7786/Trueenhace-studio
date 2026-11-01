export type ProcessingType = 'image' | 'video';

export type ImageScale = 1 | 2 | 4;

export type VideoResolution = 'original' | '1080p' | '2k' | '4k';

export type VideoFps = 'original' | 30 | 60;

export interface ImageEnhanceOptions {
  scale: ImageScale;
  denoise: boolean;
  denoiseLevel?: number; // 1 to 5
  deblur: boolean;
  deblurLevel?: number; // 1 to 5
  faceRestore: boolean;
  engine: 'auto' | 'portrait-restorer' | 'realesrgan-x4plus' | 'realesrgan-compact' | 'realesrgan' | 'gemini-ai' | 'neural-lanczos' | 'remote-gpu';
}

export interface VideoEnhanceOptions {
  resolution: VideoResolution;
  stabilize: boolean;
  denoise: boolean;
  sharpen: boolean;
  fps: VideoFps;
  preserveAudio: boolean;
  quality: 'fast' | 'balanced' | 'high';
}

export interface ProcessingJob {
  id: string;
  type: ProcessingType;
  filename: string;
  originalName: string;
  originalSize: number;
  originalDimensions?: { width: number; height: number };
  enhancedDimensions?: { width: number; height: number };
  enhancedSize?: number;
  duration?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0 to 100
  stage?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
  inputUrl: string;
  outputUrl?: string;
  optionsSummary: string;
  engineUsed?: string;
  diagnostics?: {
    modelName: string;
    tilesCount: number;
    inferenceTimeMs: number;
    inputStats?: { min: number; max: number; mean: number };
    outputStats?: { min: number; max: number; mean: number };
    edgeGainPercent?: number;
  };
}

export interface ModelInfo {
  id: string;
  name: string;
  filename: string;
  dataFile?: string;
  architecture: string;
  sizeMb: number;
  isFlagship: boolean;
  status: 'active' | 'available' | 'missing';
  inputResolution: string;
  upscaleFactor: string;
}

export interface ActiveImageModelInfo {
  id: string;
  name: string;
  filename: string;
  architecture: string;
  sizeMb: number;
  tensorsCount: string;
  executionProvider: string;
}

export interface SystemCapabilities {
  ffmpegAvailable: boolean;
  ffmpegVersion: string;
  vidstabSupported: boolean;
  cpuCores: number;
  totalMemoryMb: number;
  freeMemoryMb: number;
  geminiApiConfigured: boolean;
  realEsrganModelAvailable: boolean;
  activeImageModel?: ActiveImageModelInfo;
  availableModels?: ModelInfo[];
  gpuAvailable: boolean;
  gpuName?: string;
  remoteGpuConfigured: boolean;
}

export interface RemoteGpuConfig {
  enabled: boolean;
  endpointUrl: string;
  apiKey?: string;
}
