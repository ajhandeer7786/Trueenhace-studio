import React, { useState } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Video as VideoIcon,
  Clock,
  Settings,
  Cpu,
  Menu,
  X,
  ShieldCheck,
  Code,
} from 'lucide-react';
import type { SystemCapabilities } from '../types/index.ts';

import { PWAInstallButton } from './PWAInstallButton.tsx';

export type NavTab = 'home' | 'image' | 'video' | 'history' | 'settings';

export interface NavbarProps {
  activeTab?: NavTab;
  currentTab?: NavTab;
  setActiveTab?: (tab: NavTab) => void;
  onSelectTab?: (tab: NavTab) => void;
  historyCount: number;
  capabilities?: SystemCapabilities | null;
  isEngineReady?: boolean;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  currentTab,
  setActiveTab,
  onSelectTab,
  historyCount,
  capabilities,
  isEngineReady,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const selectedTab = activeTab ?? currentTab ?? 'home';
  const handleSelect = setActiveTab ?? onSelectTab ?? (() => {});

  const navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: Sparkles },
    { id: 'image', label: 'Image Enhancer', icon: ImageIcon },
    { id: 'video', label: 'Video Enhancer', icon: VideoIcon },
    {
      id: 'history',
      label: 'Processing History',
      icon: Clock,
      badge: historyCount > 0 ? historyCount : undefined,
    },
    { id: 'settings', label: 'Settings & Privacy', icon: Settings },
  ];

  const handleNavClick = (id: NavTab) => {
    handleSelect(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <button
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
            aria-label="TrueEnhance AI Studio Home"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all duration-300">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight text-white">
                  TrueEnhance
                </span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  STUDIO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Real AI Image &amp; Video Engine</p>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = selectedTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700/80'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs font-bold bg-cyan-500 text-slate-950">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action & Status Area */}
          <div className="hidden md:flex items-center gap-3 pl-4 border-l border-slate-800">
            <PWAInstallButton />
            <a
              href="/api/export-code"
              download="trueenhance-ai-studio-source.zip"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-xs text-indigo-300 hover:bg-indigo-500/25 transition cursor-pointer"
              title="Download entire project code as .zip"
            >
              <Code className="w-3.5 h-3.5 text-indigo-400" />
              <span>Get Code</span>
            </a>
            <button
              onClick={() => handleNavClick('settings')}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-900/80 border border-slate-800 text-xs text-slate-300 hover:border-slate-700 transition cursor-pointer"
              title="View hardware & FFmpeg capabilities"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isEngineReady ? 'Real-ESRGAN & FFmpeg 4.4' : 'Engines Initializing'}</span>
              <span className={`w-2 h-2 rounded-full ${isEngineReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
            </button>
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400" title="Zero permanent data retention without consent">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Private</span>
            </div>
          </div>

          {/* Mobile top bar buttons */}
          <div className="flex md:hidden items-center gap-2">
            <PWAInstallButton />
            {historyCount > 0 && (
              <button
                onClick={() => handleNavClick('history')}
                className="relative p-2 rounded-lg bg-slate-900 text-slate-300 border border-slate-800"
                aria-label="View history"
              >
                <Clock className="w-5 h-5 text-cyan-400" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">
                  {historyCount}
                </span>
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:text-white focus:outline-none"
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-b border-slate-800 px-4 pt-3 pb-5 space-y-2">
          <div className="pb-2 mb-2 border-b border-slate-800/80 flex items-center justify-between">
            <span className="text-xs text-slate-400">Install as App:</span>
            <PWAInstallButton />
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = selectedTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-500 text-slate-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <a
            href="/api/export-code"
            download="trueenhance-ai-studio-source.zip"
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-base font-semibold bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-900/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Code className="w-5 h-5 text-indigo-400" />
              <span>Download Full Code (.zip)</span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/25 text-indigo-200">
              Export
            </span>
          </a>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-400" />
              FFmpeg 4.4 &amp; Real-ESRGAN Active
            </span>
            <span className="flex items-center gap-1 text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
              Private Storage
            </span>
          </div>
        </div>
      )}
    </header>
  );
};
