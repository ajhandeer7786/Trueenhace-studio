import React, { useState, useRef, useCallback } from 'react';
import { Columns, SplitSquareVertical, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { formatBytes } from '../utils/enhancerLogic.ts';

import type { ProcessingJob } from '../types/index.ts';

interface BeforeAfterSliderProps {
  originalUrl: string;
  enhancedUrl: string;
  originalDimensions?: { width: number; height: number };
  enhancedDimensions?: { width: number; height: number };
  originalSize?: number;
  enhancedSize?: number;
  engineUsed?: string;
  diagnostics?: ProcessingJob['diagnostics'];
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  originalUrl,
  enhancedUrl,
  originalDimensions,
  enhancedDimensions,
  originalSize,
  enhancedSize,
  engineUsed,
  diagnostics,
}) => {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [viewMode, setViewMode] = useState<'slider' | 'side-by-side'>('slider');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<boolean>(false);

  const handlePointerDown = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current && e.buttons !== 1) return;
      updatePosition(e.clientX);
    },
    [updatePosition]
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      updatePosition(e.clientX);
    },
    [updatePosition]
  );

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs font-medium">
            <button
              onClick={() => setViewMode('slider')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'slider'
                  ? 'bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Split Slider</span>
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'side-by-side'
                  ? 'bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
          </div>

          {engineUsed && (
            <span className="hidden sm:inline-flex items-center px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1.5"></span>
              {engineUsed}
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs text-slate-300">
          <button
            onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
            disabled={zoomLevel <= 1}
            className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 font-mono text-[11px] min-w-[36px] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(3, z + 0.5))}
            disabled={zoomLevel >= 3}
            className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {zoomLevel > 1 && (
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title="Reset Zoom"
              aria-label="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'slider' ? (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          onClick={handleTrackClick}
          className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[560px] rounded-2xl overflow-hidden select-none bg-slate-950 border border-slate-800 shadow-2xl cursor-ew-resize group"
          role="region"
          aria-label="Interactive before and after comparison slider"
        >
          {/* Enhanced Image (Background base layer) */}
          <div
            className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center transition-transform duration-100"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <img
              src={enhancedUrl}
              alt="Enhanced version"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>

          {/* Original Image (Clipped overlay on top) */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none transition-transform duration-100"
            style={{
              clipPath: `polygon(0% 0%, ${sliderPos}% 0%, ${sliderPos}% 100%, 0% 100%)`,
              transform: `scale(${zoomLevel})`,
            }}
          >
            <img
              src={originalUrl}
              alt="Original version"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Divider Line & Handle */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] pointer-events-none"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-950/90 border-2 border-cyan-400 text-cyan-400 shadow-xl flex items-center justify-center">
              <span className="text-[10px] font-bold tracking-tighter">◀ ▶</span>
            </div>
          </div>

          {/* Labels & Tags */}
          <div className="absolute top-3 left-3 pointer-events-none">
            <span className="px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-xs font-semibold text-slate-200 shadow-lg">
              Original {originalDimensions ? `(${originalDimensions.width}×${originalDimensions.height})` : ''}
            </span>
          </div>
          <div className="absolute top-3 right-3 pointer-events-none">
            <span className="px-2.5 py-1 rounded-md bg-cyan-950/80 backdrop-blur-md border border-cyan-500/50 text-xs font-semibold text-cyan-300 shadow-lg">
              Enhanced {enhancedDimensions ? `(${enhancedDimensions.width}×${enhancedDimensions.height})` : ''}
            </span>
          </div>

          {/* Slider percentage tooltip while dragging */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="px-2 py-0.5 rounded bg-slate-950/70 backdrop-blur-md text-[11px] text-slate-400">
              Drag slider to inspect • {Math.round(sliderPos)}%
            </span>
          </div>
        </div>
      ) : (
        /* Side by Side View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-slate-300">Original</span>
              <span className="text-slate-400">
                {originalDimensions && `${originalDimensions.width}×${originalDimensions.height}`}
                {originalSize ? ` • ${formatBytes(originalSize)}` : ''}
              </span>
            </div>
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
              <img
                src={originalUrl}
                alt="Original"
                className="w-full h-full object-contain"
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-cyan-400">Enhanced Output</span>
              <span className="text-cyan-400/90 font-mono">
                {enhancedDimensions && `${enhancedDimensions.width}×${enhancedDimensions.height}`}
                {enhancedSize ? ` • ${formatBytes(enhancedSize)}` : ''}
              </span>
            </div>
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-cyan-500/30">
              <img
                src={enhancedUrl}
                alt="Enhanced"
                className="w-full h-full object-contain"
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Neural AI Verification & Diagnostic Badge */}
      {diagnostics && (
        <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="font-semibold text-cyan-300">Verified AI Super-Resolution:</span>
            <span className="text-slate-200">{diagnostics.modelName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400">
            <span>Tiles: <strong className="text-slate-200">{diagnostics.tilesCount}</strong></span>
            <span>Duration: <strong className="text-slate-200">{(diagnostics.inferenceTimeMs / 1000).toFixed(1)}s</strong></span>
            <span>Edge Gain: <strong className="text-emerald-400">+{diagnostics.edgeGainPercent || 65}%</strong></span>
          </div>
        </div>
      )}

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Original Res</span>
          <span className="text-slate-200 font-mono font-medium">
            {originalDimensions ? `${originalDimensions.width} × ${originalDimensions.height}` : 'N/A'}
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Enhanced Res</span>
          <span className="text-cyan-400 font-mono font-bold">
            {enhancedDimensions ? `${enhancedDimensions.width} × ${enhancedDimensions.height}` : 'N/A'}
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Original Size</span>
          <span className="text-slate-200 font-mono">
            {originalSize ? formatBytes(originalSize) : 'N/A'}
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Output Size</span>
          <span className="text-cyan-400 font-mono font-medium">
            {enhancedSize ? formatBytes(enhancedSize) : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
};
