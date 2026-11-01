import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar, NavTab } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { ImageEnhancerPage } from './pages/ImageEnhancerPage.tsx';
import { VideoEnhancerPage } from './pages/VideoEnhancerPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { GlobalProcessingToast } from './components/GlobalProcessingToast.tsx';
import { fetchCapabilities, fetchHistory, checkVideoStatus } from './utils/apiClient.ts';
import type { ProcessingJob, SystemCapabilities } from './types/index.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [history, setHistory] = useState<ProcessingJob[]>([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Global background processing job tracker & toast state
  const [globalActiveJob, setGlobalActiveJob] = useState<ProcessingJob | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const originalTitleRef = useRef<string>('TrueEnhance AI Studio');

  // Network online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initial capabilities and history load
  const loadInitialData = useCallback(async () => {
    try {
      const [caps, hist] = await Promise.all([
        fetchCapabilities().catch(() => null),
        fetchHistory().catch(() => []),
      ]);
      if (caps) setCapabilities(caps);
      if (hist) setHistory(hist);
    } catch (e) {
      console.warn('Initial load warning:', e);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Request browser notification permission gently when user starts a job
  const requestNotificationPermission = useCallback(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch {}
    }
  }, []);

  // Push notification when processing finishes in background
  const notifyJobFinished = useCallback((job: ProcessingJob) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('TrueEnhance AI Studio', {
          body: `✓ Enhancement completed: ${job.originalName}`,
          icon: '/pwa-192x192.png',
        });
      } catch (err) {
        console.warn('Notification send note:', err);
      }
    }
  }, []);

  // Update document title dynamically while processing so user sees progress in other browser tabs
  useEffect(() => {
    if (globalActiveJob?.status === 'processing') {
      document.title = `(${globalActiveJob.progress}%) ${globalActiveJob.originalName} | TrueEnhance AI`;
    } else if (globalActiveJob?.status === 'completed') {
      document.title = `✓ Ready: ${globalActiveJob.originalName} | TrueEnhance AI`;
      const timer = setTimeout(() => {
        document.title = originalTitleRef.current;
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      document.title = originalTitleRef.current;
    }
  }, [globalActiveJob?.status, globalActiveJob?.progress, globalActiveJob?.originalName]);

  // Global elapsed timer for active processing
  useEffect(() => {
    if (!globalActiveJob || globalActiveJob.status !== 'processing') {
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [globalActiveJob?.status]);

  // Background polling for video jobs across ANY tab switch
  useEffect(() => {
    if (!globalActiveJob || globalActiveJob.status !== 'processing' || globalActiveJob.type !== 'video') {
      return;
    }

    const videoJobId = globalActiveJob.id;
    const pollInterval = setInterval(async () => {
      try {
        const updated = await checkVideoStatus(videoJobId);
        setGlobalActiveJob(updated);

        if (updated.status === 'completed') {
          clearInterval(pollInterval);
          handleJobCompleted(updated);
          notifyJobFinished(updated);
        } else if (updated.status === 'failed') {
          clearInterval(pollInterval);
        }
      } catch (pollErr) {
        console.warn('Global status poll note:', pollErr);
      }
    }, 1200);

    return () => clearInterval(pollInterval);
  }, [globalActiveJob?.id, globalActiveJob?.status, globalActiveJob?.type, notifyJobFinished]);

  const handleStartGlobalJob = (job: ProcessingJob) => {
    setGlobalActiveJob(job);
    setElapsedSeconds(0);
    requestNotificationPermission();
  };

  const handleUpdateGlobalJob = (job: ProcessingJob) => {
    setGlobalActiveJob(job);
    if (job.status === 'completed') {
      handleJobCompleted(job);
      notifyJobFinished(job);
    }
  };

  const handleJobCompleted = (job: ProcessingJob) => {
    setHistory((prev) => {
      const filtered = prev.filter((j) => j.id !== job.id);
      return [job, ...filtered];
    });
  };

  const handleRefreshHistory = async () => {
    try {
      const updated = await fetchHistory();
      setHistory(updated);
    } catch (e) {
      console.warn('Could not refresh history:', e);
    }
  };

  const handleRefreshCapabilities = async () => {
    try {
      const caps = await fetchCapabilities();
      setCapabilities(caps);
    } catch (e) {
      console.warn('Could not refresh capabilities:', e);
    }
  };

  const handleViewJob = (job: ProcessingJob) => {
    if (job.type === 'video') {
      setActiveTab('video');
    } else {
      setActiveTab('image');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950 font-sans antialiased">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        historyCount={history.length}
        capabilities={capabilities}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16">
        {activeTab === 'home' && (
          <HomePage setActiveTab={setActiveTab} capabilities={capabilities} />
        )}

        {activeTab === 'image' && (
          <ImageEnhancerPage
            onJobCompleted={handleJobCompleted}
            capabilities={capabilities}
            activeGlobalJob={globalActiveJob}
            onStartGlobalJob={handleStartGlobalJob}
            onUpdateGlobalJob={handleUpdateGlobalJob}
          />
        )}

        {activeTab === 'video' && (
          <VideoEnhancerPage
            onJobCompleted={handleJobCompleted}
            capabilities={capabilities}
            activeGlobalJob={globalActiveJob}
            onStartGlobalJob={handleStartGlobalJob}
            onUpdateGlobalJob={handleUpdateGlobalJob}
          />
        )}

        {activeTab === 'history' && (
          <HistoryPage
            history={history}
            onRefreshHistory={handleRefreshHistory}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPage
            capabilities={capabilities}
            onRefreshCapabilities={handleRefreshCapabilities}
            onRefreshHistory={handleRefreshHistory}
          />
        )}
      </main>

      {/* Global Background Processing Toast with Live Progress Bar */}
      <GlobalProcessingToast
        job={globalActiveJob}
        elapsedSeconds={elapsedSeconds}
        onViewJob={handleViewJob}
        onDismiss={() => setGlobalActiveJob(null)}
      />

      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500/95 text-slate-950 font-semibold px-4 py-2 text-xs shadow-xl backdrop-blur-sm border border-amber-400">
          <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
          <span>Offline Mode — Cached resources available</span>
        </div>
      )}

      {/* Persistent Studio Footer */}
      <Footer />
    </div>
  );
}
