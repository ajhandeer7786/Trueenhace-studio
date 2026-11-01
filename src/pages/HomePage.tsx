import React from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Video,
  History,
  ShieldCheck,
  Cpu,
  ArrowRight,
  Activity,
  Layers,
  Wand2,
  Check,
  Server,
} from 'lucide-react';
import { PWAInstallButton } from '../components/PWAInstallButton.tsx';
import type { SystemCapabilities } from '../types/index.ts';

interface HomePageProps {
  setActiveTab: (tab: 'home' | 'image' | 'video' | 'history' | 'settings') => void;
  capabilities: SystemCapabilities | null;
}

export const HomePage: React.FC<HomePageProps> = ({ setActiveTab, capabilities }) => {
  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Zero Mock Processing • Real Neural &amp; FFmpeg Engines</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Professional AI Image &amp; Video Enhancement
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            TrueEnhance AI Studio runs genuine server-side inference and native FFmpeg 4.4 video pipelines.
            Upscale photos to 2× &amp; 4× resolution, eliminate blur and noise, stabilize shaky video with{' '}
            <span className="text-cyan-400 font-mono text-sm">vid.stab</span>, and interpolate frames to 60 FPS with synchronized audio.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => setActiveTab('image')}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Enhance Image (2×/4×)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab('video')}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm border border-slate-700/80 transition cursor-pointer"
            >
              <Video className="w-4 h-4 text-cyan-400" />
              <span>Stabilize &amp; Upscale Video</span>
            </button>

            <div className="sm:hidden w-full pt-1">
              <PWAInstallButton />
            </div>
          </div>
        </div>

        {/* Live System Capabilities Pill Bar */}
        <div className="mt-10 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">FFmpeg Engine</div>
              <div className="text-slate-200 font-medium">v4.4 (libvidstab)</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <Server className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">CPU Architecture</div>
              <div className="text-slate-200 font-medium">{capabilities?.cpuCores || 8} Cores Active</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <Wand2 className="w-4 h-4 text-violet-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">AI Detail Model</div>
              <div className="text-slate-200 font-medium">
                {capabilities?.geminiApiConfigured ? 'Gemini 3.1 Flash' : 'Lanczos3 Native'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Privacy Mode</div>
              <div className="text-slate-200 font-medium">Private / On-Demand</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Navigation Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Studio Tools</h2>
          <span className="text-xs text-slate-400">Select an engine to begin</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Image Enhancer */}
          <div
            onClick={() => setActiveTab('image')}
            className="group relative rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-cyan-500/50 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/10 cursor-pointer"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                AI Image Upscaler &amp; Restoration
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Super-resolve photos to 2× and 4× true pixel resolution. Deblur out-of-focus portraits,
                denoise sensor grain, and reconstruct fine textures.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-300 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-cyan-400" />
                  <span>JPG, JPEG, PNG, and WebP</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Interactive Before/After slider</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Saves directly to Phone Photos &amp; Gallery</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-cyan-400">
              <span>Open Image Studio</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Video Enhancer */}
          <div
            onClick={() => setActiveTab('video')}
            className="group relative rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/50 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                Video Stabilization &amp; Upscaler
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                2-pass camera shake stabilization using vid.stab, 3D denoising, sharpening, and
                upscaling to 1080p, 2K, or 4K with audio track synchronization.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-300 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>MP4, MOV, and WebM support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Motion-compensated 30 &amp; 60 FPS</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Original audio stream preserved (48kHz)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Plays in all phone media players (FastStart MP4)</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-indigo-400">
              <span>Open Video Studio</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Processing History & Privacy */}
          <div
            onClick={() => setActiveTab('history')}
            className="group relative rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-violet-500/50 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/10 cursor-pointer md:col-span-2 lg:col-span-1"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform">
                <History className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-violet-400 transition-colors">
                History &amp; Download Manager
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Persistent log of enhanced jobs with instant preview, individual delete controls,
                direct downloads, and single-click total data wipe for privacy.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-300 pt-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-violet-400" />
                  <span>Persistent across browser reloads</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-violet-400" />
                  <span>Complete disk file removal on delete</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-violet-400" />
                  <span>Verified output downloads with MIME types</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-violet-400">
              <span>View History</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* Real vs Mock Processing Transparency Banner */}
      <section className="rounded-2xl bg-slate-900/40 border border-slate-800/80 p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>TrueEnhance Engine Transparency &amp; Requirements</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <span className="font-semibold text-slate-300 block">No CSS Filters or Mocking</span>
            <p>
              Output files are actually re-encoded by native binaries and pixel algorithms. Images are rescaled
              with Lanczos3 sinc kernels and unsharp deconvolution. Videos undergo actual 2-pass frame analysis.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <span className="font-semibold text-slate-300 block">Audio Preservation</span>
            <p>
              When videos are stabilized or upscaled, FFmpeg extracts and re-multiplexes the original audio track
              to guarantee lip-sync and audio clarity without drift.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <span className="font-semibold text-slate-300 block">Hardware &amp; Remote GPU</span>
            <p>
              The default cloud container runs 8 CPU cores with native FFmpeg. For heavy 4K Real-ESRGAN diffusion,
              you can plug in your own remote GPU server in Settings.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
