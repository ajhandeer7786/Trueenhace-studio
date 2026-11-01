import React, { useState } from 'react';
import {
  History,
  Trash2,
  Download,
  Eye,
  Image as ImageIcon,
  Video,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  Search,
  Filter,
  X,
  FileQuestion,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider.tsx';
import { VideoComparePlayer } from '../components/VideoComparePlayer.tsx';
import { formatBytes } from '../utils/enhancerLogic.ts';
import { deleteHistoryJob, clearAllHistory } from '../utils/apiClient.ts';
import { triggerDirectDownload, shareMediaToPhone, saveOrDownloadToPhone } from '../utils/mobileDownload.ts';
import type { ProcessingJob } from '../types/index.ts';

interface HistoryPageProps {
  history: ProcessingJob[];
  onRefreshHistory: () => Promise<void>;
  setActiveTab: (tab: 'home' | 'image' | 'video' | 'history' | 'settings') => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  history,
  onRefreshHistory,
  setActiveTab,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewJob, setPreviewJob] = useState<ProcessingJob | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const filteredHistory = history.filter((job) => {
    if (filterType !== 'all' && job.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        job.originalName.toLowerCase().includes(q) ||
        job.optionsSummary.toLowerCase().includes(q) ||
        (job.engineUsed && job.engineUsed.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleDeleteItem = async (jobId: string) => {
    setDeletingId(jobId);
    setNotice(null);
    try {
      const result = await deleteHistoryJob(jobId);
      if (previewJob?.id === jobId) {
        setPreviewJob(null);
      }
      await onRefreshHistory();
      setNotice({
        type: 'success',
        message: `Job and ${result.deletedFiles} associated server disk file(s) permanently deleted.`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to delete job',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    setIsClearingAll(true);
    setNotice(null);
    try {
      const result = await clearAllHistory();
      setPreviewJob(null);
      setShowClearConfirm(false);
      await onRefreshHistory();
      setNotice({
        type: 'success',
        message: `History cleared and all ${result.deletedFiles} disk files permanently deleted.`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to clear history',
      });
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <History className="w-7 h-7 text-cyan-400" />
            <span>Processing History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Persistent log of enhanced images and videos. Every delete action removes the physical files from disk.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={isClearingAll}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All History</span>
          </button>
        )}
      </div>

      {/* Confirmation Modal for Clear All */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Permanently Clear All History?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will remove all {history.length} jobs and permanently delete their associated uploaded
              and enhanced output files from server storage. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={isClearingAll}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition flex items-center gap-2 cursor-pointer"
              >
                {isClearingAll ? 'Deleting All Files...' : 'Yes, Permanently Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notice Message */}
      {notice && (
        <div
          className={`rounded-xl p-4 flex items-start gap-3 text-sm ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          )}
          <span className="flex-1 text-xs">{notice.message}</span>
          <button onClick={() => setNotice(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1 w-full sm:w-auto">
          {(['all', 'image', 'video'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                filterType === type
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {type === 'all' ? 'All Formats' : type === 'image' ? 'Images' : 'Videos'}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by filename or option..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* History Items List / Grid */}
      {filteredHistory.length > 0 ? (
        <div className="space-y-4">
          {filteredHistory.map((job) => {
            const isImage = job.type === 'image';
            const Icon = isImage ? ImageIcon : Video;
            const dateStr = new Date(job.createdAt).toLocaleString();

            return (
              <div
                key={job.id}
                className="rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
              >
                {/* Left: Type Icon & Info */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                      isImage
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                        : 'indigo-500/10 border-indigo-500/30 text-indigo-400'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">
                        {job.originalName}
                      </span>
                      <StatusBadge status={job.status} stage={job.stage} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {dateStr}
                      </span>
                      <span>•</span>
                      <span className="text-cyan-400 font-medium">
                        {job.optionsSummary}
                      </span>
                      {job.enhancedDimensions && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-slate-300">
                            {job.originalDimensions
                              ? `${job.originalDimensions.width}×${job.originalDimensions.height} → `
                              : ''}
                            {job.enhancedDimensions.width}×{job.enhancedDimensions.height}
                          </span>
                        </>
                      )}
                      {job.enhancedSize && (
                        <>
                          <span>•</span>
                          <span>{formatBytes(job.enhancedSize)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions (Preview, Download, Delete) */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {job.status === 'completed' && job.outputUrl && (
                    <>
                      <button
                        onClick={() => setPreviewJob(job)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                        title="Inspect comparison"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Preview</span>
                      </button>

                      {isImage ? (
                        <>
                          <button
                            onClick={() => triggerDirectDownload(
                              `/api/download/${job.id}?format=jpg`,
                              `${job.originalName.replace(/\.[^/.]+$/, '')}_enhanced.jpg`
                            )}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
                            title="Download JPG (compact ~500KB - phone gallery ready)"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download JPG</span>
                          </button>

                          <button
                            onClick={() => triggerDirectDownload(
                              `/api/download/${job.id}?format=png`,
                              `${job.originalName.replace(/\.[^/.]+$/, '')}_enhanced.png`
                            )}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition cursor-pointer"
                            title="Download PNG (uncompressed)"
                          >
                            <Download className="w-3.5 h-3.5 text-cyan-400" />
                            <span>PNG</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => triggerDirectDownload(
                            `/api/download/${job.id}`,
                            `${job.originalName.replace(/\.[^/.]+$/, '')}_enhanced.mp4`
                          )}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
                          title="Download MP4 video"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download MP4</span>
                        </button>
                      )}

                      <button
                        onClick={() => shareMediaToPhone(
                          `/api/download/${job.id}${isImage ? '?format=jpg' : ''}`,
                          `${job.originalName.replace(/\.[^/.]+$/, '')}_enhanced.${isImage ? 'jpg' : 'mp4'}`,
                          isImage ? 'image/jpeg' : 'video/mp4',
                          `TrueEnhance AI ${isImage ? 'Image' : 'Video'}`
                        )}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition cursor-pointer"
                        title="Share via WhatsApp, Drive, etc."
                        aria-label="Share"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => handleDeleteItem(job.id)}
                    disabled={deletingId === job.id}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition cursor-pointer"
                    title="Delete item and remove file from disk"
                    aria-label={`Delete ${job.originalName}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl bg-slate-900/30 border border-slate-800/80 p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
            <FileQuestion className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-300">No Processing History</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {searchQuery || filterType !== 'all'
                ? 'No items matched your search filter.'
                : 'Any photos or videos you upscale and stabilize will be logged here with preview and download options.'}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setActiveTab('image')}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              Enhance Image
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer"
            >
              Enhance Video
            </button>
          </div>
        </div>
      )}

      {/* Inspection Modal for History Item */}
      {previewJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="max-w-4xl w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{previewJob.originalName}</span>
                  <span className="text-xs font-normal text-cyan-400 font-mono">
                    ({previewJob.optionsSummary})
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Enhanced with {previewJob.engineUsed || 'TrueEnhance Engine'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerDirectDownload(
                    `/api/download/${previewJob.id}${previewJob.type === 'image' ? '?format=jpg' : ''}`,
                    `${previewJob.originalName.replace(/\.[^/.]+$/, '')}_enhanced.${previewJob.type === 'image' ? 'jpg' : 'mp4'}`
                  )}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {previewJob.type === 'image' ? 'JPG' : 'MP4'}</span>
                </button>
                <button
                  onClick={() => setPreviewJob(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  aria-label="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content view */}
            {previewJob.type === 'image' ? (
              <BeforeAfterSlider
                originalUrl={previewJob.inputUrl}
                enhancedUrl={previewJob.outputUrl!}
                originalDimensions={previewJob.originalDimensions}
                enhancedDimensions={previewJob.enhancedDimensions}
                originalSize={previewJob.originalSize}
                enhancedSize={previewJob.enhancedSize}
                engineUsed={previewJob.engineUsed}
              />
            ) : (
              <VideoComparePlayer
                originalUrl={previewJob.inputUrl}
                enhancedUrl={previewJob.outputUrl!}
                originalDimensions={previewJob.originalDimensions}
                enhancedDimensions={previewJob.enhancedDimensions}
                originalSize={previewJob.originalSize}
                enhancedSize={previewJob.enhancedSize}
                optionsSummary={previewJob.optionsSummary}
                downloadUrl={`/api/download/${previewJob.id}`}
                jobId={previewJob.id}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
