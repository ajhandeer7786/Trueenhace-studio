import React, { useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  Download,
  AlertCircle,
  Loader2,
  CheckCircle,
  Wand2,
  Sliders,
  RefreshCw,
  FileText,
  Smartphone,
} from 'lucide-react';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider.tsx';
import { formatBytes, validateImageFile } from '../utils/enhancerLogic.ts';
import { enhanceImage, generateSampleAsset } from '../utils/apiClient.ts';
import { triggerDirectDownload, shareMediaToPhone, saveOrDownloadToPhone } from '../utils/mobileDownload.ts';
import type {
  ProcessingJob,
  ImageScale,
  ImageEnhanceOptions,
  SystemCapabilities,
} from '../types/index.ts';

interface ImageEnhancerPageProps {
  onJobCompleted: (job: ProcessingJob) => void;
  capabilities: SystemCapabilities | null;
  activeGlobalJob?: ProcessingJob | null;
  onStartGlobalJob?: (job: ProcessingJob) => void;
  onUpdateGlobalJob?: (job: ProcessingJob) => void;
}

export const ImageEnhancerPage: React.FC<ImageEnhancerPageProps> = ({
  onJobCompleted,
  capabilities,
  activeGlobalJob,
  onStartGlobalJob,
  onUpdateGlobalJob,
}) => {
  // Input state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sampleFilename, setSampleFilename] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageMetadata, setImageMetadata] = useState<{
    width?: number;
    height?: number;
    size?: number;
    name?: string;
  } | null>(null);

  // Options state
  const [scale, setScale] = useState<ImageScale>(4);
  const [denoise, setDenoise] = useState<boolean>(false);
  const [denoiseLevel, setDenoiseLevel] = useState<number>(2);
  const [deblur, setDeblur] = useState<boolean>(true);
  const [deblurLevel, setDeblurLevel] = useState<number>(3);
  const [faceRestore, setFaceRestore] = useState<boolean>(true);
  const [faceFidelity, setFaceFidelity] = useState<number>(70);
  const [faceModel, setFaceModel] = useState<'gfpgan-v1.4' | 'codeformer' | 'auto'>('auto');
  const [engine, setEngine] = useState<'auto' | 'gfpgan' | 'portrait-restorer' | 'realesrgan-x4plus' | 'realesrgan-compact' | 'realesrgan' | 'gemini-ai' | 'neural-lanczos'>('auto');

  // Processing & Result state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [completedJob, setCompletedJob] = useState<ProcessingJob | null>(null);
  const [processingTimeSec, setProcessingTimeSec] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid image file');
      return;
    }

    setError(null);
    setCompletedJob(null);
    setSelectedFile(file);
    setSampleFilename(null);

    // Read image preview and dimensions
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setImageMetadata({
        width: img.naturalWidth,
        height: img.naturalHeight,
        size: file.size,
        name: file.name,
      });
    };
    img.src = url;
  };

  const handleLoadSample = async () => {
    try {
      setError(null);
      setCompletedJob(null);
      const sample = await generateSampleAsset('image');
      setSelectedFile(null);
      setSampleFilename(sample.filename);
      setPreviewUrl(sample.url);
      setImageMetadata({
        width: sample.dimensions.width,
        height: sample.dimensions.height,
        size: sample.size,
        name: sample.originalName,
      });
    } catch (err: any) {
      setError('Could not load sample test image');
    }
  };

  const handleStartEnhance = async () => {
    if (!selectedFile && !sampleFilename) {
      setError('Please upload an image or load a sample image first');
      return;
    }

    setError(null);
    setIsProcessing(true);
    setProcessingTimeSec(0);

    const initialJob: ProcessingJob = {
      id: `img-${Date.now()}`,
      type: 'image',
      filename: selectedFile?.name || sampleFilename || 'image.png',
      originalName: selectedFile?.name || sampleFilename || 'image.png',
      originalSize: selectedFile?.size || 0,
      status: 'processing',
      progress: 20,
      stage: 'Tiled Real-ESRGAN Neural Inference...',
      createdAt: new Date().toISOString(),
      inputUrl: previewUrl || '',
      optionsSummary: `${scale}× Upscale (${engine === 'realesrgan-x4plus' ? 'x4plus Flagship' : 'Real-ESRGAN'})`,
    };
    onStartGlobalJob?.(initialJob);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const sec = Math.round((Date.now() - startTime) / 1000);
      setProcessingTimeSec(sec);
      const dynamicProgress = Math.min(20 + sec * 12, 92);
      onUpdateGlobalJob?.({
        ...initialJob,
        progress: dynamicProgress,
        stage: sec > 2 ? 'Neural Reconstruction & Micro-Denoise' : 'Tiled Real-ESRGAN Neural Inference...',
      });
    }, 500);

    const options: ImageEnhanceOptions = {
      scale,
      denoise,
      denoiseLevel,
      deblur,
      deblurLevel,
      faceRestore,
      faceFidelity,
      faceModel,
      engine,
    };

    try {
      const job = await enhanceImage(selectedFile, sampleFilename, options);
      setCompletedJob(job);
      onJobCompleted(job);
      onUpdateGlobalJob?.(job);
    } catch (err: any) {
      setError(err?.message || 'Image enhancement processing failed. Please try again.');
      onUpdateGlobalJob?.({
        ...initialJob,
        status: 'failed',
        error: err?.message || 'Image enhancement failed',
      });
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSampleFilename(null);
    setPreviewUrl(null);
    setImageMetadata(null);
    setCompletedJob(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ImageIcon className="w-7 h-7 text-cyan-400" />
            <span>AI Image Enhancer</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real 2× and 4× super-resolution, deblurring, denoising, and texture reconstruction.
          </p>
        </div>

        <button
          onClick={handleLoadSample}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Load Test Image</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 flex items-start gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <span className="font-semibold block">Enhancement Notice</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs text-rose-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Upload & Controls on Left, Result / Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Upload & Options (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upload Dropzone */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Source Image</span>
            </h2>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              id="image-file-input"
            />

            {!previewUrl ? (
              <label
                htmlFor="image-file-input"
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl bg-slate-950/60 hover:bg-slate-900/40 transition cursor-pointer group text-center space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 group-hover:bg-slate-800/80 transition">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-slate-200 group-hover:text-cyan-400 block">
                    Click or Drag to Upload
                  </span>
                  <span className="text-xs text-slate-500 block mt-1">
                    JPG, JPEG, PNG, or WebP (up to 50MB)
                  </span>
                </div>
              </label>
            ) : (
              /* Selected Image Info Card */
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
                    <img src={previewUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-200 truncate">
                      {imageMetadata?.name || 'Selected Image'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {imageMetadata?.width && imageMetadata?.height
                        ? `${imageMetadata.width} × ${imageMetadata.height} px`
                        : 'Resolving dimensions...'}
                      {imageMetadata?.size ? ` • ${formatBytes(imageMetadata.size)}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    disabled={isProcessing}
                    className="p-1.5 text-xs text-slate-400 hover:text-rose-400 rounded hover:bg-slate-900 transition"
                    title="Remove Image"
                    aria-label="Remove Image"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Enhancement Controls Panel */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Enhancement Settings</span>
              </h2>
              <span className="text-[11px] text-cyan-400 font-mono">Real Inference</span>
            </div>

            {/* Upscale Factor */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Target Upscale Multiplier
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScale(2)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center cursor-pointer ${
                    scale === 2
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm font-black">2× Scale</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {imageMetadata?.width ? `${imageMetadata.width * 2} × ${imageMetadata.height! * 2}` : 'Double Resolution'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setScale(4)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center cursor-pointer ${
                    scale === 4
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm font-black">4× Super-Res</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {imageMetadata?.width ? `${imageMetadata.width * 4} × ${imageMetadata.height! * 4}` : 'Quadruple Resolution'}
                  </span>
                </button>
              </div>
            </div>

            {/* Deblur & Sharpening */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="deblur-toggle" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                  <span>Deblur &amp; Edge Sharpening</span>
                </label>
                <input
                  id="deblur-toggle"
                  type="checkbox"
                  checked={deblur}
                  onChange={(e) => setDeblur(e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 cursor-pointer rounded"
                />
              </div>
              {deblur && (
                <div className="flex items-center gap-3 pl-2">
                  <span className="text-[10px] text-slate-400 font-medium">Strength:</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={deblurLevel}
                    onChange={(e) => setDeblurLevel(Number(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-cyan-400 cursor-pointer"
                    aria-label="Deblur strength"
                  />
                  <span className="text-[11px] font-mono text-cyan-400 w-5 text-right">{deblurLevel}</span>
                </div>
              )}
            </div>

            {/* Denoise */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="denoise-toggle" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                  <span>Denoise &amp; Artifact Removal</span>
                </label>
                <input
                  id="denoise-toggle"
                  type="checkbox"
                  checked={denoise}
                  onChange={(e) => setDenoise(e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 cursor-pointer rounded"
                />
              </div>
              {denoise && (
                <div className="flex items-center gap-3 pl-2">
                  <span className="text-[10px] text-slate-400 font-medium">Strength:</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={denoiseLevel}
                    onChange={(e) => setDenoiseLevel(Number(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded accent-cyan-400 cursor-pointer"
                    aria-label="Denoise strength"
                  />
                  <span className="text-[11px] font-mono text-cyan-400 w-5 text-right">{denoiseLevel}</span>
                </div>
              )}
            </div>

            {/* Genuine Face Restoration (GFPGAN Prior) */}
            <div className="pt-2 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="face-toggle" className="text-xs font-semibold text-slate-200 block cursor-pointer flex items-center gap-1.5">
                    <span>GFPGAN Face &amp; Portrait AI Restoration</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      MagicHour Quality
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Reconstructs eyes, pupils, lips, skin pores, and facial contours
                  </span>
                </div>
                <input
                  id="face-toggle"
                  type="checkbox"
                  checked={faceRestore}
                  onChange={(e) => setFaceRestore(e.target.checked)}
                  className="w-4 h-4 accent-indigo-400 cursor-pointer rounded"
                />
              </div>

              {faceRestore && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Identity Preservation vs Restoration:
                    </span>
                    <span className="font-mono text-xs font-bold text-indigo-400">
                      {faceFidelity}% Likeness
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="95"
                    step="5"
                    value={faceFidelity}
                    onChange={(e) => setFaceFidelity(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded accent-indigo-400 cursor-pointer"
                    aria-label="Face restoration fidelity balance"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Maximum Sharpening (Heavy Blur)</span>
                    <span className="text-indigo-300 font-semibold">
                      {faceFidelity >= 80 ? 'Subtle (High Likeness)' : faceFidelity >= 60 ? 'MagicHour Balanced' : 'Strong Reconstruction'}
                    </span>
                    <span>Preserve Identity (Natural Skin)</span>
                  </div>
                </div>
              )}
            </div>

            {/* AI Engine Selection */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <label htmlFor="engine-select" className="text-xs font-semibold text-slate-300 block">
                Super-Resolution Neural Engine
              </label>
              <select
                id="engine-select"
                value={engine}
                onChange={(e) => setEngine(e.target.value as any)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="auto">Auto-Select (Real-ESRGAN + GFPGAN Face Prior)</option>
                <option value="gfpgan">GFPGAN v1.4 + Real-ESRGAN (MagicHour Face Restoration)</option>
                <option value="realesrgan-x4plus">Real-ESRGAN-x4plus (Flagship 67MB RRDBNet • Maximum Scene Detail)</option>
                <option value="realesrgan-compact">Real-ESRGAN-General-x4v3 (Compact 4.8MB • Fast)</option>
                <option value="neural-lanczos">Lanczos3 Spatial Resizing (Non-AI Fallback)</option>
                <option value="gemini-ai">Gemini 3.1 Flash Vision Model (Cloud AI)</option>
              </select>
            </div>

            {/* Process Action Button */}
            <button
              onClick={handleStartEnhance}
              disabled={isProcessing || (!selectedFile && !sampleFilename)}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400 hover:via-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Processing Real AI Enhancement ({processingTimeSec}s)...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 text-slate-950" />
                  <span>Enhance to {scale}× Resolution Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Comparison & Results (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {completedJob ? (
            /* Result Area with Before/After Slider */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">Enhancement Succeeded</span>
                  <span className="text-emerald-400/80 hidden sm:inline">• Output ready</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* High Quality JPG Download Button (Default/Recommended for mobile gallery & WhatsApp) */}
                  <button
                    onClick={() => triggerDirectDownload(
                      `/api/download/${completedJob.id}?format=jpg`,
                      `${completedJob.originalName.replace(/\.[^/.]+$/, '')}_enhanced.jpg`
                    )}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-sm cursor-pointer active:scale-95"
                    title="Download optimized JPG (~400-800KB) - Best for Phone Gallery & WhatsApp sharing"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JPG (Phone &amp; Gallery)</span>
                  </button>

                  {/* PNG Download Button */}
                  <button
                    onClick={() => triggerDirectDownload(
                      `/api/download/${completedJob.id}?format=png`,
                      `${completedJob.originalName.replace(/\.[^/.]+$/, '')}_enhanced.png`
                    )}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition shadow-sm cursor-pointer"
                    title="Download uncompressed PNG master file"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>PNG</span>
                  </button>

                  {/* Native Share button */}
                  <button
                    onClick={() => shareMediaToPhone(
                      `/api/download/${completedJob.id}?format=jpg`,
                      `${completedJob.originalName.replace(/\.[^/.]+$/, '')}_enhanced.jpg`,
                      'image/jpeg',
                      'TrueEnhance AI Enhanced Photo'
                    )}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition cursor-pointer"
                    title="Share directly to WhatsApp, Drive, etc."
                  >
                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              {/* Visible Model Name & Inference Status Badge */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="text-slate-400 font-medium">Active AI Model:</span>
                  <span className="font-bold text-white font-mono bg-cyan-950/60 px-2.5 py-0.5 rounded border border-cyan-500/40 text-cyan-300">
                    {completedJob.engineUsed}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-300">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700 font-semibold">
                    Inference Status: Verified Success
                  </span>
                  {completedJob.diagnostics && (
                    <span className="text-slate-400">
                      Tiles: <strong className="text-cyan-300">{completedJob.diagnostics.tilesCount}</strong>
                      {completedJob.diagnostics.faceCount !== undefined && completedJob.diagnostics.faceCount > 0 && (
                        <> • Faces: <strong className="text-indigo-300">{completedJob.diagnostics.faceCount}</strong> ({completedJob.diagnostics.faceFidelityApplied ?? 70}% Likeness)</>
                      )}
                      {' '}• Duration: <strong className="text-cyan-300">{(completedJob.diagnostics.inferenceTimeMs / 1000).toFixed(1)}s</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Before/After Split Interactive View */}
              <BeforeAfterSlider
                originalUrl={completedJob.inputUrl}
                enhancedUrl={completedJob.outputUrl!}
                originalDimensions={completedJob.originalDimensions}
                enhancedDimensions={completedJob.enhancedDimensions}
                originalSize={completedJob.originalSize}
                enhancedSize={completedJob.enhancedSize}
                engineUsed={completedJob.engineUsed}
                diagnostics={completedJob.diagnostics}
              />
            </div>
          ) : previewUrl ? (
            /* Selected Input Image Preview Area */
            <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[440px]">
              <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center relative">
                <img
                  src={previewUrl}
                  alt="Ready to enhance"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs text-slate-300">
                  Input Ready: {imageMetadata?.width}×{imageMetadata?.height}
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Click <strong className="text-cyan-400">Enhance to {scale}× Resolution Now</strong> on the left panel to execute real AI reconstruction.
              </p>
            </div>
          ) : (
            /* Empty State */
            <div className="rounded-2xl bg-slate-900/30 border border-slate-800/80 p-12 flex flex-col items-center justify-center text-center space-y-4 min-h-[440px]">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <ImageIcon className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-300">No Image Selected</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Upload a photo from your phone, tablet, or desktop, or click{' '}
                  <strong className="text-cyan-400">Load Test Image</strong> to see instant 2×/4× super-resolution in action.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
