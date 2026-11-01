import React from 'react';
import { ShieldCheck, HardDrive, Cpu, Terminal } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-900 bg-slate-950/80 text-slate-400 py-8 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 text-center sm:text-left">
          <div className="flex items-center gap-2 font-semibold text-slate-200">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            TrueEnhance AI Studio
          </div>
          <span className="text-slate-500 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Private Processing: Files stay in your studio instance</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-500">
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            FFmpeg 4.4 + libvidstab
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            Persistent Storage
          </span>
          <span className="flex items-center gap-1">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            Real Inference
          </span>
        </div>
      </div>
    </footer>
  );
};
