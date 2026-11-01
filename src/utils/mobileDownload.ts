/**
 * Mobile-friendly media download and phone storage saving helper
 */

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function canNativeShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

/**
 * Triggers clean direct browser file download to phone/desktop storage
 * Avoids target="_blank" which triggers popup blockers in Android Chrome.
 */
export function triggerDirectDownload(url: string, filename?: string): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = url;
  if (filename) {
    link.setAttribute('download', filename);
  }
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
    } catch {}
  }, 300);
}

/**
 * Native phone share drawer (WhatsApp, Drive, Bluetooth, etc.)
 */
export async function shareMediaToPhone(
  downloadUrl: string,
  filename: string,
  mimeType: string,
  title: string = 'Enhanced Media'
): Promise<{ success: boolean; error?: string }> {
  if (!canNativeShareFiles()) {
    triggerDirectDownload(downloadUrl, filename);
    return { success: true };
  }
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error('Could not load file for sharing');
    const blob = await response.blob();
    const file = new File([blob], filename, { type: mimeType });

    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title,
        text: `TrueEnhance AI: ${filename}`,
      });
      return { success: true };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, error: 'User cancelled share' };
    }
    // Fallback to direct download
    triggerDirectDownload(downloadUrl, filename);
    return { success: true };
  }
  triggerDirectDownload(downloadUrl, filename);
  return { success: true };
}

/**
 * Mobile-friendly media download and phone storage saving helper
 */
export async function saveOrDownloadToPhone(
  downloadUrl: string,
  filename: string,
  mimeType: string,
  title: string = 'Enhanced Media'
): Promise<{ method: 'share' | 'download'; success: boolean }> {
  triggerDirectDownload(downloadUrl, filename);
  return { method: 'download', success: true };
}
