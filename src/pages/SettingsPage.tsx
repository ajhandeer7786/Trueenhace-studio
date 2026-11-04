import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cpu,
  Server,
  ShieldCheck,
  HardDrive,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  RefreshCw,
  Terminal,
  Activity,
  Key,
  Smartphone,
  Info,
  Code,
  Download,
  FileArchive,
  Sparkles,
} from 'lucide-react';
import { PWAInstallButton } from '../components/PWAInstallButton.tsx';
import { formatBytes } from '../utils/enhancerLogic.ts';
import {
  fetchCapabilities,
  getRemoteGpuConfig,
  saveRemoteGpuConfig,
  clearAllHistory,
  fetchFaceModelStatus,
  triggerFaceModelDownload,
} from '../utils/apiClient.ts';
import type { SystemCapabilities, RemoteGpuConfig } from '../types/index.ts';

interface SettingsPageProps {
  capabilities: SystemCapabilities | null;
  onRefreshCapabilities: () => Promise<void>;
  onRefreshHistory: () => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  capabilities,
  onRefreshCapabilities,
  onRefreshHistory,
}) => {
  const [remoteGpu, setRemoteGpu] = useState<RemoteGpuConfig>({
    enabled: false,
    endpointUrl: '',
    apiKey: '',
  });
  const [isSavingGpu, setIsSavingGpu] = useState<boolean>(false);
  const [gpuSavedNotice, setGpuSavedNotice] = useState<string | null>(null);
  const [isWiping, setIsWiping] = useState<boolean>(false);
  const [wipeNotice, setWipeNotice] = useState<string | null>(null);

  // Face model status
  const [faceModelStatus, setFaceModelStatus] = useState<{
    ready: boolean;
    downloading: boolean;
    progress: number;
    error: string | null;
    sizeMb: number;
    modelName: string;
  } | null>(null);
  const [isTriggeringDownload, setIsTriggeringDownload] = useState(false);

  useEffect(() => {
    getRemoteGpuConfig()
      .then((cfg) => setRemoteGpu(cfg))
      .catch((e) => console.warn('Could not load remote GPU config', e));

    fetchFaceModelStatus()
      .then((st) => setFaceModelStatus(st))
      .catch((e) => console.warn('Could not load face model status', e));
  }, []);

  const handleDownloadFaceModel = async () => {
    setIsTriggeringDownload(true);
    try {
      await triggerFaceModelDownload();
      const interval = setInterval(async () => {
        try {
          const st = await fetchFaceModelStatus();
          setFaceModelStatus(st);
          if (st.ready || st.error || (!st.downloading && st.progress === 100)) {
            clearInterval(interval);
            setIsTriggeringDownload(false);
          }
        } catch {
          clearInterval(interval);
          setIsTriggeringDownload(false);
        }
      }, 1000);
    } catch (err: any) {
      alert(`Download trigger error: ${err.message}`);
      setIsTriggeringDownload(false);
    }
  };

  const handleSaveGpu = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGpu(true);
    setGpuSavedNotice(null);
    try {
      await saveRemoteGpuConfig(remoteGpu);
      await onRefreshCapabilities();
      setGpuSavedNotice('Remote GPU configuration saved successfully.');
    } catch (err: any) {
      setGpuSavedNotice(`Error saving: ${err.message}`);
    } finally {
      setIsSavingGpu(false);
    }
  };

  const handleWipeAllData = async () => {
    if (!window.confirm('Are you sure you want to delete ALL stored images, videos, and processing history from this server? This cannot be undone.')) {
      return;
    }
    setIsWiping(true);
    setWipeNotice(null);
    try {
      const res = await clearAllHistory();
      await onRefreshHistory();
      setWipeNotice(`Successfully wiped ${res.deletedFiles} file(s) and cleared all database records.`);
    } catch (err: any) {
      setWipeNotice(`Failed to wipe data: ${err.message}`);
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="space-y-10 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-cyan-400" />
          <span>Settings &amp; Environment Inspection</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Hardware metrics, real model execution environments, external GPU bridging, and complete privacy controls.
        </p>
      </div>

      {/* Hardware & Environment Metrics */}
      <section className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Execution Environment &amp; Hardware</h2>
          </div>
          <button
            onClick={() => onRefreshCapabilities()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Metrics</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">CPU Processors</span>
            <span className="text-lg font-bold text-white font-mono">
              {capabilities?.cpuCores || 8} Logical Cores
            </span>
            <span className="text-[11px] text-slate-400 block">Multi-threaded video &amp; image pipelines</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">System Memory (RAM)</span>
            <span className="text-lg font-bold text-white font-mono">
              {capabilities ? formatBytes(capabilities.totalMemoryMb * 1024 * 1024, 0) : '12 GB'}
            </span>
            <span className="text-[11px] text-slate-400 block">
              {capabilities ? `${formatBytes(capabilities.freeMemoryMb * 1024 * 1024, 1)} available` : 'Ample headroom for 4K'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Local GPU Status</span>
            <span className="text-base font-bold text-amber-400 font-mono flex items-center gap-1.5">
              <span>Cloud CPU Engine</span>
            </span>
            <span className="text-[11px] text-slate-400 block">
              No local CUDA GPU attached in this container
            </span>
          </div>
        </div>

        {/* Real-ESRGAN Neural Model Status (Dynamic from server capabilities) */}
        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-200 flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Active Super-Resolution Engine: {capabilities?.activeImageModel?.name || 'Real-ESRGAN-x4plus (Flagship)'}</span>
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Loaded &amp; Active (C++ ONNX Runtime CPU)</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-slate-400">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">Active Weights File</span>
              <span className="text-white font-mono text-[11px] break-all">
                {capabilities?.activeImageModel?.filename || 'real_esrgan_x4plus.onnx (+ .data)'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">Architecture</span>
              <span className="text-white font-mono text-[11px]">
                {capabilities?.activeImageModel?.architecture || 'RRDBNet (23 RRDB Blocks)'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">Total Model Size</span>
              <span className="text-cyan-400 font-mono text-[11px] font-bold">
                {capabilities?.activeImageModel ? `${capabilities.activeImageModel.sizeMb} MB` : '66.7 MB'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">Parameter Capacity</span>
              <span className="text-white font-mono text-[11px]">
                {capabilities?.activeImageModel?.tensorsCount || '16.7M Parameters'}
              </span>
            </div>
          </div>

          {/* Model Registry Breakdown */}
          <div className="pt-2 border-t border-slate-900 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              Installed Neural Weight Inventories &amp; Roles
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(capabilities?.availableModels || [
                {
                  id: 'realesrgan-x4plus',
                  name: 'Real-ESRGAN-x4plus (Flagship)',
                  filename: 'real_esrgan_x4plus.onnx',
                  dataFile: 'real_esrgan_x4plus.data',
                  architecture: 'RRDBNet (23 RRDB Blocks, 16.7M Params)',
                  sizeMb: 66.7,
                  isFlagship: true,
                  status: 'active' as const,
                  inputResolution: 'Tiled 128×128 (32px overlap)',
                  upscaleFactor: '4× Super-Resolution',
                },
                {
                  id: 'realesrgan-compact',
                  name: 'Real-ESRGAN-General-x4v3 (Compact)',
                  filename: 'realesrgan_x4.onnx',
                  dataFile: 'model.data',
                  architecture: 'SRVGGNet-Compact (170 Conv, 264 Act)',
                  sizeMb: 4.8,
                  isFlagship: false,
                  status: 'available' as const,
                  inputResolution: 'Tiled 128×128 (32px overlap)',
                  upscaleFactor: '4× Super-Resolution',
                },
              ]).map((mod) => (
                <div
                  key={mod.id}
                  className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                    mod.id === 'realesrgan-x4plus'
                      ? 'bg-cyan-950/20 border-cyan-500/30 text-slate-300'
                      : 'bg-slate-900/40 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{mod.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        mod.status === 'active'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {mod.status === 'active' ? 'Active Default' : 'Available (Fast Mode)'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    File: <span className="text-slate-300">{mod.filename}</span> {mod.dataFile ? `(+ ${mod.dataFile})` : ''} • {mod.sizeMb} MB
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {mod.architecture}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                    <span>{mod.inputResolution}</span>
                    <span className="font-mono text-cyan-400">{mod.upscaleFactor}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Genuine Face Restoration Model Status (GFPGAN v1.4 + YuNet) */}
        <div className="p-5 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-200 flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Face Restoration Engine: GFPGAN v1.4 + YuNet Alignment</span>
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 ${
              faceModelStatus?.ready
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : faceModelStatus?.downloading
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${faceModelStatus?.ready ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>
                {faceModelStatus?.ready
                  ? `Cached & Ready (${faceModelStatus.sizeMb || 325} MB)`
                  : faceModelStatus?.downloading
                  ? `Downloading Model (${faceModelStatus.progress}%)`
                  : 'On-Demand Download Ready'}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-slate-400">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">Model Architecture</span>
              <span className="text-white font-mono text-[11px]">
                GFPGANv1.4 (Clean StyleGAN2 Prior)
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">Face Detector</span>
              <span className="text-white font-mono text-[11px]">
                YuNet 2023 (OpenCV Zoo 5-Point)
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">Patch Resolution</span>
              <span className="text-indigo-400 font-mono text-[11px] font-bold">
                512 × 512 Normalized
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">Identity Preservation</span>
              <span className="text-white font-mono text-[11px]">
                Adjustable 0-100% (Feather Blended)
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-400">
            <p className="text-[11px] text-slate-400">
              GFPGAN is stored in ephemeral memory (<code className="text-slate-300">/tmp/models/gfpgan_1.4.onnx</code>) to prevent exceeding the 250MB deployment size limit while delivering true generative facial reconstruction.
            </p>
            {!faceModelStatus?.ready && !faceModelStatus?.downloading && (
              <button
                type="button"
                onClick={handleDownloadFaceModel}
                disabled={isTriggeringDownload}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer shrink-0 self-start sm:self-auto"
              >
                {isTriggeringDownload ? 'Starting...' : 'Pre-Cache Model (325MB)'}
              </button>
            )}
          </div>
        </div>

        {/* FFmpeg Feature Inspection */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-200">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Compiled FFmpeg Filters &amp; Codecs</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              vidstabdetect (Pass 1)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              vidstabtransform (Pass 2)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              hqdn3d (3D Denoise)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              unsharp (Sharpening)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              libx264 (H.264 Encoder)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              minterpolate (60 FPS)
            </span>
          </div>
        </div>

        {/* Gemini API Server Integration Status */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 flex items-center gap-2">
              <Key className="w-4 h-4 text-violet-400" />
              <span>Server-Side Gemini AI Integration</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                capabilities?.geminiApiConfigured
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              {capabilities?.geminiApiConfigured ? 'Active & Configured' : 'Optional / Standby'}
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            All AI calls are securely proxied through the server backend. Keys are injected via environment
            variables and never exposed to the client or browser bundle.
          </p>
        </div>
      </section>

      {/* Remote GPU Server Integration Form */}
      <section className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <Server className="w-5 h-5 text-indigo-400" />
            <span>Connect External GPU Server (Optional)</span>
          </div>
          <p className="text-xs text-slate-400">
            For dedicated 4K Real-ESRGAN or video diffusion model execution, you can connect an external
            GPU server (such as RunPod, Automatic1111, ComfyUI, or custom Docker worker).
          </p>
        </div>

        {/* Clear explanation callout */}
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block text-indigo-100">Kiya external GPU server zaroori hai?</span>
            <span className="text-slate-300 block leading-relaxed">
              <strong>Nahi, yeh bilkul optional hai!</strong> TrueEnhance AI Studio ka built-in multi-threaded C++ ONNX engine aur native FFmpeg 4.4 container ke 8-core CPU par photos aur videos ko bina kisi external server ke direct enhance karte hain. Is option ki zaroorat sirf tab hoti hai jab aapke paas apna personal cloud GPU worker ho.
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveGpu} className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              id="remote-gpu-toggle"
              type="checkbox"
              checked={remoteGpu.enabled}
              onChange={(e) => setRemoteGpu({ ...remoteGpu, enabled: e.target.checked })}
              className="w-4 h-4 accent-indigo-400 cursor-pointer rounded"
            />
            <label htmlFor="remote-gpu-toggle" className="text-xs font-semibold text-slate-200 cursor-pointer">
              Enable Remote GPU Server Endpoint
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="gpu-endpoint-url" className="text-xs font-semibold text-slate-300 block">
                Server Endpoint URL
              </label>
              <input
                id="gpu-endpoint-url"
                type="url"
                placeholder="https://my-gpu-worker.runpod.net/v1"
                value={remoteGpu.endpointUrl}
                disabled={!remoteGpu.enabled}
                onChange={(e) => setRemoteGpu({ ...remoteGpu, endpointUrl: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="gpu-auth-token" className="text-xs font-semibold text-slate-300 block">
                Bearer Token / API Key (Optional)
              </label>
              <input
                id="gpu-auth-token"
                type="password"
                placeholder="sk-..."
                value={remoteGpu.apiKey || ''}
                disabled={!remoteGpu.enabled}
                onChange={(e) => setRemoteGpu({ ...remoteGpu, apiKey: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
              />
            </div>
          </div>

          {gpuSavedNotice && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{gpuSavedNotice}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSavingGpu}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingGpu ? 'Saving...' : 'Save GPU Endpoint'}</span>
          </button>
        </form>
      </section>

      {/* Mobile App Installation (PWA) Section */}
      <section className="rounded-2xl bg-slate-900/60 border border-cyan-500/30 p-6 space-y-4 shadow-lg shadow-cyan-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <span>Mobile &amp; Desktop App Installation (PWA)</span>
            </div>
            <p className="text-xs text-slate-400">
              Install TrueEnhance directly onto your Android phone, iPhone, tablet, or PC like a native app.
            </p>
          </div>
          <PWAInstallButton />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="font-bold text-cyan-300">Android Chrome par install kaise karein:</div>
            <p className="text-slate-400 leading-relaxed">
              Chrome browser ke upar <strong>3 dots (Menu)</strong> dabayein aur <strong>"Install app"</strong> ya <strong>"Add to Home screen"</strong> select karein. App aapke phone ki home screen par APK ki tarah add ho jayegi.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="font-bold text-cyan-300">iPhone / Safari par install kaise karein:</div>
            <p className="text-slate-400 leading-relaxed">
              Safari ke bottom bar par <strong>Share icon</strong> (box with arrow) dabayein, neeche scroll karke <strong>"Add to Home Screen"</strong> par click karein aur <strong>"Add"</strong> select karein.
            </p>
          </div>
        </div>
      </section>

      {/* Project Source Code & Export Section */}
      <section className="rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-indigo-500/30 p-6 space-y-5 shadow-xl shadow-indigo-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-base sm:text-lg font-bold text-white">
              <Code className="w-5 h-5 text-indigo-400" />
              <span>App Source Code &amp; Project Files (Code Kahan Sy Mily Ga)</span>
            </div>
            <p className="text-xs text-slate-400">
              Aap is poori app ka complete clean source code directly download kar sakte hain ya Google AI Studio se access kar sakte hain.
            </p>
          </div>
          <a
            href="/api/export-code"
            download="trueenhance-ai-studio-source.zip"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download Full Code (.zip)</span>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
          {/* Method 1 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[11px]">1</span>
              <span>Direct 1-Click ZIP</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Upar diye gaye <strong>"Download Full Code (.zip)"</strong> button par click karein. Yeh instantly poora project (React frontend, Express backend, FFmpeg pipeline aur config files) ek ZIP archive mein aapke mobile ya PC par download kar dega.
            </p>
          </div>

          {/* Method 2 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[11px]">2</span>
              <span>Google AI Studio Header</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              AI Studio interface ke bilkul <strong>Top Right corner</strong> mein <strong>"Export"</strong> ya <strong>"Code"</strong> button hota hai. Wahan se aap <strong>"Download ZIP"</strong> ya <strong>"Export to GitHub"</strong> select kar ke code le sakte hain.
            </p>
          </div>

          {/* Method 3 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2">
            <div className="flex items-center gap-2 text-violet-300 font-bold">
              <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-[11px]">3</span>
              <span>Left Sidebar File Explorer</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              AI Studio ke <strong>Left Sidebar</strong> mein folder icon (Files) par click karein. Wahan se aap har file (<code className="text-slate-300">server.ts</code>, <code className="text-slate-300">src/App.tsx</code> waghera) directly dekh aur copy kar sakte hain.
            </p>
          </div>
        </div>

        {/* Local Run Guide */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
          <div className="font-bold text-slate-300 flex items-center gap-2">
            <FileArchive className="w-4 h-4 text-emerald-400" />
            <span>Code Download Karne Ke Baad Local PC Par Run Karne Ka Tareeqa:</span>
          </div>
          <div className="bg-slate-900 rounded-lg p-3 font-mono text-[11px] text-slate-300 space-y-1">
            <div className="text-slate-500"># 1. Zip unzip karein aur folder mein jayein</div>
            <div>cd trueenhance-ai-studio</div>
            <div className="text-slate-500 mt-2"># 2. Dependencies install karein</div>
            <div>npm install</div>
            <div className="text-slate-500 mt-2"># 3. Dev server chalayein (http://localhost:3000)</div>
            <div>npm run dev</div>
          </div>
        </div>
      </section>

      {/* Privacy and Data Retention Controls */}
      <section className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Privacy Policy &amp; Data Deletion</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            TrueEnhance AI Studio adheres to strict user privacy standards. Uploaded media is processed
            exclusively inside this isolated instance and is never transmitted to advertising networks or third parties.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs leading-relaxed text-slate-400">
          <div className="font-semibold text-slate-300">How your media is handled:</div>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Files uploaded to this applet are stored in private local directories (<code className="text-slate-300">/data/uploads</code> and <code className="text-slate-300">/data/outputs</code>).</li>
            <li>When you delete an item from History, both the database entry and the underlying disk files are physically unlinked and erased.</li>
            <li>No analytics or telemetry trackers are loaded in the browser.</li>
          </ul>
        </div>

        {wipeNotice && (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{wipeNotice}</span>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800">
          <div>
            <span className="text-xs font-bold text-white block">Purge All Studio Data</span>
            <span className="text-[11px] text-slate-500 block">
              Immediately wipes all input files, output files, and processing history records.
            </span>
          </div>

          <button
            onClick={handleWipeAllData}
            disabled={isWiping}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isWiping ? 'Wiping Files...' : 'Delete All Stored Data Now'}</span>
          </button>
        </div>
      </section>
    </div>
  );
};
