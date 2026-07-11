export function isTauriRuntime() {
  return Boolean(globalThis.__TAURI_INTERNALS__ || globalThis.__TAURI__);
}

export async function openExternal(url, mode = 'external') {
  const target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target)) return false;
  if (mode === 'copy') {
    await copyText(target);
    return true;
  }
  if (mode === 'in-app') {
    globalThis.location.href = target;
    return true;
  }
  if (isTauriRuntime()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(target);
      return true;
    } catch {
      // Browser preview and partially configured Tauri shells fall back below.
    }
  }
  globalThis.open?.(target, '_blank', 'noopener,noreferrer');
  return true;
}

export async function notify(title, body, enabled = true) {
  if (!enabled) return false;
  if (isTauriRuntime()) {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
      let granted = await isPermissionGranted();
      if (!granted) granted = await requestPermission() === 'granted';
      if (granted) {
        sendNotification({ title, body });
        return true;
      }
    } catch {
      // Fall through to the browser Notification API.
    }
  }
  if (!('Notification' in globalThis)) return false;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/assets/icons/icon-192.png' });
    return true;
  }
  return false;
}

export async function copyText(value) {
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(String(value || ''));
    return true;
  }
  return false;
}

export function applyTheme(settings) {
  const theme = settings?.theme || 'system';
  const root = globalThis.document?.documentElement;
  if (!root) return;
  root.dataset.theme = theme;
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsText(file, 'utf-8');
  });
}
