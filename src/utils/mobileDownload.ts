/**
 * Mobile-friendly media export and phone storage saving helper
 * Triggers a clean single-tap download saved directly to Phone Downloads / Gallery / File Manager.
 */

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Triggers clean direct browser file download to phone/desktop storage.
 * Avoids target="_blank" which triggers popup blockers in Android Chrome,
 * and avoids double-downloading into JS memory.
 */
export function triggerDirectDownload(url: string, filename?: string): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = url;
  if (filename) {
    link.setAttribute('download', filename);
  }
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
    } catch {}
  }, 500);
}

/**
 * Unified single "Export" action for the entire app.
 * Direct-saves enhanced JPG photo or MP4 video to phone Gallery & File Manager (Downloads folder).
 */
export async function exportMediaToPhone(
  jobIdOrUrl: string,
  originalName: string,
  type: 'image' | 'video' = 'image'
): Promise<{ success: boolean; method: 'download' }> {
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'enhanced';
  const isImage = type === 'image';
  const extension = isImage ? 'jpg' : 'mp4';
  const filename = `${baseName}_enhanced.${extension}`;

  const downloadUrl = jobIdOrUrl.startsWith('/') || jobIdOrUrl.startsWith('http')
    ? jobIdOrUrl
    : `/api/download/${jobIdOrUrl}${isImage ? '?format=jpg' : ''}`;

  triggerDirectDownload(downloadUrl, filename);
  return { success: true, method: 'download' };
}

/**
 * Compatibility exports
 */
export async function shareMediaToPhone(
  downloadUrl: string,
  filename: string
): Promise<{ success: boolean }> {
  triggerDirectDownload(downloadUrl, filename);
  return { success: true };
}

export async function saveOrDownloadToPhone(
  downloadUrl: string,
  filename: string
): Promise<{ method: 'download'; success: boolean }> {
  triggerDirectDownload(downloadUrl, filename);
  return { method: 'download', success: true };
}
