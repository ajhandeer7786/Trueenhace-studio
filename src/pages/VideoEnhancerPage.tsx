import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Video,
  Sparkles,
  AlertCircle,
  Loader2,
  CheckCircle,
  Activity,
  Layers,
  Wand2,
  Music,
  Download,
} from 'lucide-react';
import { VideoComparePlayer } from '../components/VideoComparePlayer.tsx';
import { formatBytes, validateVideoFile } from '../utils/enhancerLogic.ts';
import { startVideoEnhance, checkVideoStatus, generateSampleAsset } from '../utils/apiClient.ts';
import { exportMediaToPhone } from '../utils/mobileDownload.ts';
import type {
  ProcessingJob,
  VideoResolution,
  VideoFps,
  VideoEnhanceOptions,
  SystemCapabilities,
} from '../types/index.ts';

interface VideoEnhancerPageProps {
  onJobCompleted: (job: ProcessingJob) => void;
  capabilities: SystemCapabilities | null;
  activeGlobalJob?: ProcessingJob | null;
  onStartGlobalJob?: (job: ProcessingJob) => void;
  onUpdateGlobalJob?: (job: ProcessingJob) => void;
}

export const VideoEnhancerPage: React.FC<VideoEnhancerPageProps> = ({
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
  const [videoMetadata, setVideoMetadata] = useState<{
    width?: number;
    height?: number;
    size?: number;
    name?: string;
    duration?: number;
  } | null>(null);

  // Options state - Simplified AI Auto Modes
  const [resolution, setResolution] = useState<VideoResolution>('1080p');
  const [aiAutoEnhance, setAiAutoEnhance] = useState<boolean>(true);
  const [stabilize, setStabilize] = useState<boolean>(true);
  const [denoise, setDenoise] = useState<boolean>(true);
  const [sharpen, setSharpen] = useState<boolean>(true);
  const [fps, setFps] = useState<VideoFps>('original');
  const [preserveAudio, setPreserveAudio] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [quality] = useState<'fast' | 'balanced' | 'high'>('balanced');

  // Job & Progress tracking state
  const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(
    activeGlobalJob?.type === 'video' ? activeGlobalJob : null
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(
    activeGlobalJob?.type === 'video' && activeGlobalJob?.status === 'processing'
  );
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize when activeGlobalJob updates from background polling in App.tsx
  useEffect(() => {
    if (activeGlobalJob && activeGlobalJob.type === 'video') {
      setCurrentJob(activeGlobalJob);
      if (activeGlobalJob.status === 'processing') {
        setIsProcessing(true);
      } else if (activeGlobalJob.status === 'completed') {
        setIsProcessing(false);
      } else if (activeGlobalJob.status === 'failed') {
        setIsProcessing(false);
        setError(activeGlobalJob.error || 'Video processing failed');
      }
    }
  }, [activeGlobalJob]);

  // Clean up polling timers on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid video file');
      return;
    }

    setError(null);
    setCurrentJob(null);
    setSelectedFile(file);
    setSampleFilename(null);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Read video metadata from video element
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.onloadedmetadata = () => {
      setVideoMetadata({
        width: tempVideo.videoWidth,
        height: tempVideo.videoHeight,
        duration: tempVideo.duration,
        size: file.size,
        name: file.name,
      });
    };
    tempVideo.src = url;
  };

  const handleLoadSample = async () => {
    try {
      setError(null);
      setCurrentJob(null);
      const sample = await generateSampleAsset('video');
      setSelectedFile(null);
      setSampleFilename(sample.filename);
      setPreviewUrl(sample.url);
      setVideoMetadata({
        width: sample.dimensions.width,
        height: sample.dimensions.height,
        duration: sample.duration,
        size: sample.size,
        name: sample.originalName,
      });
    } catch (err: any) {
      setError('Could not generate sample video');
    }
  };

  const handleStartEnhance = async () => {
    if (!selectedFile && !sampleFilename) {
      setError('Please select or upload a video file first');
      return;
    }

    setError(null);
    setIsProcessing(true);
    setElapsedSeconds(0);

    const startTime = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - startTime) / 1000));
    }, 1000);

    const options: VideoEnhanceOptions = {
      resolution,
      stabilize: aiAutoEnhance ? stabilize : false,
      denoise: aiAutoEnhance ? denoise : false,
      sharpen: aiAutoEnhance ? sharpen : false,
      fps,
      preserveAudio,
      quality,
    };

    try {
      const initialJob = await startVideoEnhance(selectedFile, sampleFilename, options);
      setCurrentJob(initialJob);
      onStartGlobalJob?.(initialJob);

      // Start polling for real FFmpeg progress
      pollTimerRef.current = setInterval(async () => {
        try {
          const status = await checkVideoStatus(initialJob.id);
          setCurrentJob(status);
          onUpdateGlobalJob?.(status);

          if (status.status === 'completed') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
            setIsProcessing(false);
            onJobCompleted(status);
          } else if (status.status === 'failed') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
            setIsProcessing(false);
            setError(status.error || 'Video processing encountered a failure');
          }
        } catch (pollErr: any) {
          console.warn('Status poll warning:', pollErr);
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit video for processing');
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setSelectedFile(null);
    setSampleFilename(null);
    setPreviewUrl(null);
    setVideoMetadata(null);
    setCurrentJob(null);
    setIsProcessing(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Video className="w-7 h-7 text-indigo-400" />
            <span>AI Video Enhancer &amp; Stabilizer</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            2-pass vid.stab motion stabilization, 3D denoising, sharpening, upscaling, and audio synchronization.
          </p>
        </div>

        <button
          onClick={handleLoadSample}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Load Shaky Test Video</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 flex items-start gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <span className="font-semibold block">Video Processing Notice</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs text-rose-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Upload & Options (5 cols) vs Result/Player (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upload Dropzone */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>Source Video</span>
            </h2>

            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
              onChange={handleFileChange}
              className="hidden"
              id="video-file-input"
            />

            {!previewUrl ? (
              <label
                htmlFor="video-file-input"
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl bg-slate-950/60 hover:bg-slate-900/40 transition cursor-pointer group text-center space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 group-hover:bg-slate-800/80 transition">
                  <Video className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-slate-200 group-hover:text-indigo-400 block">
                    Click or Drag Video to Upload
                  </span>
                  <span className="text-xs text-slate-500 block mt-1">
                    MP4, MOV, or WebM (up to 250MB)
                  </span>
                </div>
              </label>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center">
                    <Video className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-200 truncate">
                      {videoMetadata?.name || 'Selected Video'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {videoMetadata?.width && videoMetadata?.height
                        ? `${videoMetadata.width} × ${videoMetadata.height} px`
                        : 'Checking format...'}
                      {videoMetadata?.size ? ` • ${formatBytes(videoMetadata.size)}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    disabled={isProcessing}
                    className="p-1.5 text-xs text-slate-400 hover:text-rose-400 rounded hover:bg-slate-900 transition"
                    title="Remove Video"
                    aria-label="Remove Video"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Simplified AI Auto Video Options Panel */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>AI Video Enhancement Settings</span>
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                AI Auto Active
              </span>
            </div>

            {/* 1. AI Auto UHD Upscale */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">AI Auto UHD Upscale</span>
                  <span className="text-[11px] text-slate-400 block leading-snug">
                    Real-ESRGAN neural frame upscaling with synced original audio
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {(['original', '1080p', '2k', '4k'] as const).map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setResolution(res)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center cursor-pointer ${
                      resolution === res
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="uppercase">{res}</span>
                    <span className="text-[9px] font-normal text-slate-500">
                      {res === 'original' ? 'Native' : res === '1080p' ? 'Full HD' : res === '2k' ? '1440p' : '2160p'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. AI Auto Enhance */}
            <div className={`p-4 rounded-xl border transition-all ${aiAutoEnhance ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm' : 'bg-slate-950/40 border-slate-800/80'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3 cursor-pointer select-none" onClick={() => setAiAutoEnhance(!aiAutoEnhance)}>
                  <div className={`p-2 rounded-lg mt-0.5 ${aiAutoEnhance ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                    <Wand2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">AI Auto Enhance</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Auto Clean
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5 leading-snug">
                      Stabilizes camera shake, removes grain &amp; sharpens video frames automatically
                    </span>
                  </div>
                </div>
                <input
                  id="video-auto-enhance-toggle"
                  type="checkbox"
                  checked={aiAutoEnhance}
                  onChange={(e) => setAiAutoEnhance(e.target.checked)}
                  className="w-5 h-5 accent-emerald-500 cursor-pointer rounded ml-2"
                />
              </div>
            </div>

            {/* Optional Advanced Controls */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition flex items-center gap-1 cursor-pointer"
              >
                <span>{showAdvanced ? '− Hide Advanced Video Settings' : '+ Show Advanced Video Settings'}</span>
              </button>

              {showAdvanced && (
                <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <label htmlFor="stabilize-toggle" className="text-slate-300 font-medium cursor-pointer">
                      Camera Shake Stabilization (vid.stab)
                    </label>
                    <input
                      id="stabilize-toggle"
                      type="checkbox"
                      checked={stabilize}
                      onChange={(e) => setStabilize(e.target.checked)}
                      className="w-4 h-4 accent-indigo-400 cursor-pointer rounded"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                    <label className="flex items-center justify-between cursor-pointer text-slate-300">
                      <span>3D Denoising</span>
                      <input
                        type="checkbox"
                        checked={denoise}
                        onChange={(e) => setDenoise(e.target.checked)}
                        className="w-4 h-4 accent-indigo-400 cursor-pointer rounded"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer text-slate-300">
                      <span>Edge Sharpen</span>
                      <input
                        type="checkbox"
                        checked={sharpen}
                        onChange={(e) => setSharpen(e.target.checked)}
                        className="w-4 h-4 accent-indigo-400 cursor-pointer rounded"
                      />
                    </label>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-300 block">Frame Rate (FPS)</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'original', label: 'Original' },
                        { id: 30, label: '30 FPS' },
                        { id: 60, label: '60 FPS' },
                      ].map((item) => (
                        <button
                          key={String(item.id)}
                          type="button"
                          onClick={() => setFps(item.id as any)}
                          className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition cursor-pointer text-center ${
                            fps === item.id
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <label htmlFor="audio-toggle" className="text-slate-300 flex items-center gap-1.5 cursor-pointer">
                      <Music className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Preserve Synced Audio</span>
                    </label>
                    <input
                      id="audio-toggle"
                      type="checkbox"
                      checked={preserveAudio}
                      onChange={(e) => setPreserveAudio(e.target.checked)}
                      className="w-4 h-4 accent-indigo-400 cursor-pointer rounded"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Start Processing Action */}
            <button
              onClick={handleStartEnhance}
              disabled={isProcessing || (!selectedFile && !sampleFilename)}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-600 to-cyan-500 hover:from-indigo-400 hover:via-violet-500 hover:to-cyan-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Processing Video ({currentJob?.progress || 10}%)...</span>
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 text-slate-950" />
                  <span>Execute Real Video Enhancement</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Player & Progress (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Job Real Progress Bar */}
          {isProcessing && currentJob && (
            <div className="rounded-2xl bg-slate-900/80 border border-indigo-500/40 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <span className="font-bold text-slate-200">
                    {currentJob.stage || 'Enhancing Video...'}
                  </span>
                </div>
                <span className="font-mono font-bold text-indigo-400">{currentJob.progress}%</span>
              </div>

              {/* Progress bar track */}
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, currentJob.progress)}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Elapsed: {elapsedSeconds}s</span>
                <span>Engine: Native FFmpeg 4.4 Engine</span>
              </div>
            </div>
          )}

          {/* Completed Job Player */}
          {currentJob && currentJob.status === 'completed' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">Video Enhancement Succeeded</span>
                  <span className="text-emerald-400/80 hidden sm:inline">• Audio Synchronized</span>
                </div>

                <div>
                  <button
                    onClick={() => exportMediaToPhone(
                      currentJob.id,
                      currentJob.originalName,
                      'video'
                    )}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm transition shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95"
                    title="Export and save video directly to phone gallery and file manager"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export (Save to Gallery / Storage)</span>
                  </button>
                </div>
              </div>

              <VideoComparePlayer
                originalUrl={currentJob.inputUrl}
                enhancedUrl={currentJob.outputUrl!}
                originalDimensions={currentJob.originalDimensions}
                enhancedDimensions={currentJob.enhancedDimensions}
                originalSize={currentJob.originalSize}
                enhancedSize={currentJob.enhancedSize}
                optionsSummary={currentJob.optionsSummary}
                downloadUrl={`/api/download/${currentJob.id}`}
                jobId={currentJob.id}
              />
            </div>
          ) : previewUrl ? (
            /* Selected Input Video Preview */
            <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[440px]">
              <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center relative">
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-xs text-slate-400">
                Input video ready. Click <strong className="text-indigo-400">Execute Real Video Enhancement</strong> to run FFmpeg processing.
              </p>
            </div>
          ) : (
            /* Empty State */
            <div className="rounded-2xl bg-slate-900/30 border border-slate-800/80 p-12 flex flex-col items-center justify-center text-center space-y-4 min-h-[440px]">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <Video className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-300">No Video Loaded</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Upload a shaky or standard-resolution video, or click{' '}
                  <strong className="text-indigo-400">Load Shaky Test Video</strong> to test motion stabilization, 3D denoising, and 1080p upscaling.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
