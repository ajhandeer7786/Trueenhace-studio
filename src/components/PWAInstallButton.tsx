import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, X, Check, Apple, Sparkles, ExternalLink, AlertTriangle, Copy } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [installStatusMsg, setInstallStatusMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // If already installed and launched as standalone PWA, hide button
  if (isInstalled) {
    return null;
  }

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';

  const handleCopyLink = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(currentUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {}
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const res = await install();
      if (!res.success) {
        if (res.error === 'dismissed') {
          return;
        }
        setInstallStatusMsg(res.error || 'Browser rejected direct install');
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition cursor-pointer active:scale-95 ${
          isInstallable
            ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 shadow-cyan-500/20 animate-pulse hover:animate-none'
            : 'bg-slate-800/90 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60'
        }`}
        title="Install TrueEnhance AI Studio on your Phone or Computer"
      >
        {isInstallable ? <Download className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5 text-cyan-400" />}
        <span>Install App</span>
      </button>

      {showGuide && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowGuide(false);
                setInstallStatusMsg(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 shrink-0">
                <Sparkles className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Install TrueEnhance AI Studio</h3>
                <p className="text-xs text-slate-400">Android, iPhone aur Computer par direct install karein</p>
              </div>
            </div>

            {/* Why 'App cannot be installed' happens */}
            {isIframe ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2.5 text-xs">
                <div className="flex items-start gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Kyun "App cannot be installed" show hota hai?</span>
                </div>
                <p className="text-[11px] text-amber-100/90 leading-relaxed">
                  Google Chrome security iframe (preview window) ke andar direct install block karti hai. Is app ko apne phone par install karne ke liye neeche button se naye Chrome tab mein open karein:
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full sm:flex-1 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Real Chrome Tab</span>
                  </a>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center justify-center gap-1.5 w-full sm:w-auto py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 font-semibold text-xs border border-amber-500/30 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            ) : isInstallable ? (
              <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 space-y-2 text-xs">
                <p className="text-[11px] text-cyan-100/90">
                  Aapka browser direct installation support karta hai:
                </p>
                <button
                  onClick={handleInstallClick}
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install App Directly Now</span>
                </button>
              </div>
            ) : null}

            {installStatusMsg && !isIframe && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Notice: Chrome menu (3 dots) ke zariye install karein. Neeche diye gaye steps follow karein:</span>
              </div>
            )}

            {/* Platform Instructions */}
            <div className="space-y-3 pt-1 text-xs">
              {isIOS ? (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-cyan-400">
                    <Apple className="w-4 h-4" />
                    <span>iPhone / iPad (Safari) Instructions:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
                    <li>Safari browser ke neeche <strong className="text-white">Share</strong> button (box with arrow 📤) dabayein.</li>
                    <li>Neeche scroll karke <strong className="text-cyan-300">Add to Home Screen</strong> select karein.</li>
                    <li>Top-right par <strong className="text-white">Add</strong> dabayein. App home screen par aa jayegi!</li>
                  </ol>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-cyan-400">
                    <Smartphone className="w-4 h-4" />
                    <span>Android (Google Chrome / Samsung Internet):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-2 text-slate-300 leading-relaxed">
                    <li>
                      Browser ke top-right corner par <strong className="text-white">3 dots (⋮)</strong> menu dabayein.
                    </li>
                    <li>
                      Menu list mein se <strong className="text-cyan-300">"Install app"</strong> (ya <strong className="text-cyan-300">"Add to Home screen"</strong>) par click karein.
                    </li>
                    <li>
                      <strong className="text-white">"Install"</strong> confirm karein. App direct phone ke home screen par standalone app ban jayegi!
                    </li>
                  </ol>
                </div>
              )}

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
                <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">PWA Standalone Mode</span>
                  <span className="text-[11px] text-emerald-400/80">Play Store account ke baghair foran install hoti hai, aur bina URL bar ke full-screen chalti hai.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Tab</span>
              </a>
              <button
                onClick={() => {
                  setShowGuide(false);
                  setInstallStatusMsg(null);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Theek Hai (Got it)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
