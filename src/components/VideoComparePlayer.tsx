import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Download,
  Film,
  Sparkles,
  Smartphone,
  Maximize,
} from 'lucide-react';
import { formatBytes, formatDuration } from '../utils/enhancerLogic.ts';
import { saveOrDownloadToPhone } from '../utils/mobileDownload.ts';

interface VideoComparePlayerProps {
  originalUrl: string;
  enhancedUrl: string;
  originalDimensions?: { width: number; height: number };
  enhancedDimensions?: { width: number; height: number };
  originalSize?: number;
  enhancedSize?: number;
  optionsSummary?: string;
  downloadUrl: string;
  jobId?: string;
}

export const VideoComparePlayer: React.FC<VideoComparePlayerProps> = ({
  originalUrl,
  enhancedUrl,
  originalDimensions,
  enhancedDimensions,
  originalSize,
  enhancedSize,
  optionsSummary,
  downloadUrl,
  jobId,
}) => {
  const [activeTab, setActiveTab] = useState<'enhanced' | 'original' | 'split'>('enhanced');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const enhancedVideoRef = useRef<HTMLVideoElement>(null);

  // Synchronize play / pause across both video elements
  const togglePlay = () => {
    const orig = originalVideoRef.current;
    const enh = enhancedVideoRef.current;

    if (isPlaying) {
      orig?.pause();
      enh?.pause();
      setIsPlaying(false);
    } else {
      orig?.play().catch(() => {});
      enh?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (originalVideoRef.current) originalVideoRef.current.currentTime = time;
    if (enhancedVideoRef.current) enhancedVideoRef.current.currentTime = time;
  };

  const handleRestart = () => {
    setCurrentTime(0);
    if (originalVideoRef.current) originalVideoRef.current.currentTime = 0;
    if (enhancedVideoRef.current) enhancedVideoRef.current.currentTime = 0;
    if (!isPlaying) {
      originalVideoRef.current?.play().catch(() => {});
      enhancedVideoRef.current?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    if (originalVideoRef.current) originalVideoRef.current.muted = newMute;
    if (enhancedVideoRef.current) enhancedVideoRef.current.muted = newMute;
  };

  // Keep duration and time updated
  const onTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setCurrentTime(video.currentTime);
    if (!duration && video.duration) {
      setDuration(video.duration);
    }
  };

  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSaveToPhone = async () => {
    setIsSaving(true);
    try {
      await saveOrDownloadToPhone(
        downloadUrl,
        `enhanced_video_${jobId || Date.now()}.mp4`,
        'video/mp4',
        'Enhanced Video'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleFullscreen = () => {
    const targetVideo =
      activeTab === 'enhanced'
        ? enhancedVideoRef.current
        : originalVideoRef.current;
    if (targetVideo) {
      if (targetVideo.requestFullscreen) {
        targetVideo.requestFullscreen().catch(() => {});
      } else if ((targetVideo as any).webkitEnterFullscreen) {
        // iOS Safari native fullscreen player
        (targetVideo as any).webkitEnterFullscreen();
      }
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* View Switcher and Download Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs font-medium">
          <button
            onClick={() => setActiveTab('enhanced')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
              activeTab === 'enhanced'
                ? 'bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Enhanced Video</span>
          </button>
          <button
            onClick={() => setActiveTab('original')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
              activeTab === 'original'
                ? 'bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-slate-400" />
            <span>Original Source</span>
          </button>
          <button
            onClick={() => setActiveTab('split')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
              activeTab === 'split'
                ? 'bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Side-by-Side</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveToPhone}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            title="Save directly to phone camera roll or share to apps"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving to Phone...' : 'Save to Phone / Gallery'}</span>
          </button>

          <a
            href={downloadUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition"
            download
            title="Direct file download to Downloads folder"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download MP4</span>
          </a>
        </div>
      </div>

      {/* Video Screens */}
      {activeTab === 'split' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Original View */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="font-semibold text-slate-300">Original Source</span>
              <span>{originalDimensions && `${originalDimensions.width}×${originalDimensions.height}`}</span>
            </div>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
              <video
                ref={originalVideoRef}
                src={originalUrl}
                playsInline
                muted={isMuted}
                onTimeUpdate={onTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Enhanced View */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-cyan-400 px-1">
              <span className="font-semibold">TrueEnhance Result</span>
              <span>{enhancedDimensions && `${enhancedDimensions.width}×${enhancedDimensions.height}`}</span>
            </div>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-cyan-500/30">
              <video
                ref={enhancedVideoRef}
                src={enhancedUrl}
                playsInline
                muted={isMuted}
                onTimeUpdate={onTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Single Focused View with hidden background sync video */
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center">
          {/* Active Player */}
          <video
            ref={activeTab === 'enhanced' ? enhancedVideoRef : originalVideoRef}
            src={activeTab === 'enhanced' ? enhancedUrl : originalUrl}
            playsInline
            muted={isMuted}
            onTimeUpdate={onTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            className="w-full h-full object-contain"
          />

          {/* Hidden companion video for synchronization */}
          <video
            ref={activeTab === 'enhanced' ? originalVideoRef : enhancedVideoRef}
            src={activeTab === 'enhanced' ? originalUrl : enhancedUrl}
            playsInline
            muted={true}
            className="hidden"
          />

          {/* Top Overlay Badge */}
          <div className="absolute top-3 left-3 pointer-events-none">
            <span
              className={`px-3 py-1 rounded-md text-xs font-bold backdrop-blur-md border shadow-lg ${
                activeTab === 'enhanced'
                  ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-950/80 border-slate-700 text-slate-300'
              }`}
            >
              {activeTab === 'enhanced'
                ? `Enhanced: ${enhancedDimensions?.width || 1920}×${enhancedDimensions?.height || 1080}`
                : `Original: ${originalDimensions?.width || 640}×${originalDimensions?.height || 480}`}
            </span>
          </div>

          {/* Center Play Overlay when paused */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-slate-950/80 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shadow-xl hover:scale-105 transition cursor-pointer"
              aria-label="Play video"
            >
              <Play className="w-8 h-8 ml-1" />
            </button>
          )}
        </div>
      )}

      {/* Synchronized Player Control Bar */}
      <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={duration || 10}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            aria-label="Video seek bar"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={handleRestart}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              aria-label="Restart video"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <span className="font-mono text-[11px] text-slate-400 pl-1">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            {optionsSummary && (
              <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-cyan-400">
                {optionsSummary}
              </span>
            )}
            <span>
              {enhancedSize ? formatBytes(enhancedSize) : ''}
            </span>

            <button
              onClick={handleFullscreen}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer ml-1"
              title="Fullscreen Native Phone Player"
              aria-label="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <span className="flex items-center gap-1.5 text-emerald-400/90 font-medium">
          <Smartphone className="w-3.5 h-3.5" />
          <span>Universal Mobile Playback (H.264 FastStart + 48kHz Stereo AAC)</span>
        </span>
        <span className="hidden sm:inline">Compatible with Android Gallery, Google Photos &amp; iOS</span>
      </div>
    </div>
  );
};
