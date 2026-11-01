import React, { useState } from 'react';
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  X,
  Minimize2,
  Maximize2,
  Video,
  Image as ImageIcon,
} from 'lucide-react';
import { saveOrDownloadToPhone } from '../utils/mobileDownload.ts';
import type { ProcessingJob } from '../types/index.ts';

interface GlobalProcessingToastProps {
  job: ProcessingJob | null;
  elapsedSeconds: number;
  onViewJob: (job: ProcessingJob) => void;
  onDismiss: () => void;
}

export const GlobalProcessingToast: React.FC<GlobalProcessingToastProps> = ({
  job,
  elapsedSeconds,
  onViewJob,
  onDismiss,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!job) return null;

  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isProcessing = job.status === 'processing' || job.status === 'pending';

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (job.outputUrl) {
      saveOrDownloadToPhone(job.id, job.originalName, job.type);
    }
  };

  // Minimized floating pill
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900/95 border border-cyan-500/40 text-white shadow-2xl shadow-cyan-500/20 backdrop-blur-md cursor-pointer hover:border-cyan-400 transition animate-in fade-in slide-in-from-bottom-2"
        title="Click to expand processing monitor"
      >
        {isProcessing && (
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
        )}
        {isCompleted && (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
        {isFailed && (
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
        )}

        <span className="text-xs font-semibold text-slate-200 truncate max-w-[140px] sm:max-w-[200px]">
          {isProcessing ? `${job.progress}% • ${job.originalName}` : isCompleted ? 'Enhanced!' : 'Failed'}
        </span>

        <Maximize2 className="w-3.5 h-3.5 text-slate-400 hover:text-white ml-1" />
      </div>
    );
  }

  // Expanded Toast Card
  return (
    <aside
      aria-label="Background processing status notification"
      className={`fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 w-[calc(100%-2rem)] sm:w-96 rounded-2xl bg-slate-900/95 border shadow-2xl backdrop-blur-xl p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
        isCompleted
          ? 'border-emerald-500/40 shadow-emerald-500/10'
          : isFailed
          ? 'border-rose-500/40 shadow-rose-500/10'
          : 'border-cyan-500/40 shadow-cyan-500/20'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isCompleted
                ? 'bg-emerald-500/20 text-emerald-400'
                : isFailed
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-cyan-500/20 text-cyan-400'
            }`}
          >
            {job.type === 'video' ? (
              <Video className="w-4 h-4" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate">
                {isProcessing
                  ? 'Background Processing'
                  : isCompleted
                  ? 'Enhancement Completed!'
                  : 'Processing Failed'}
              </span>
              {isProcessing && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-[220px]">
              {job.originalName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Minimize"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDismiss}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body: Progress Bar & Status */}
      <div className="py-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium truncate max-w-[200px]">
            {job.stage || (isProcessing ? 'Processing Neural Model...' : isCompleted ? 'Ready to download' : 'Error')}
          </span>
          <span className="font-mono text-cyan-400 font-bold shrink-0">
            {job.progress}%
          </span>
        </div>

        {/* Real Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-300 ${
              isCompleted
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : isFailed
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
            }`}
            style={{ width: `${Math.max(job.progress, 5)}%` }}
          />
        </div>

        {/* Footer info: elapsed time & options */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
          <span className="truncate max-w-[200px]">
            {job.optionsSummary || 'Real-ESRGAN Model'}
          </span>
          <span className="font-mono text-slate-400 shrink-0">
            {formatTimer(elapsedSeconds)} elapsed
          </span>
        </div>

        {isFailed && job.error && (
          <p className="text-[11px] text-rose-300 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
            {job.error}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
        <button
          onClick={() => onViewJob(job)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
          <span>View Job</span>
        </button>

        {isCompleted && (
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        )}
      </div>
    </aside>
  );
};
