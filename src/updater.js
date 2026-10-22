// Over-the-air updates for the Android app: on launch, check the GitHub "latest" release; if it carries
// a newer game build, download it, switch to it and restart. Native-shell changes still need a new APK.
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { NATIVE_VERSION, WEB_VERSION, REPO } from './version.js';

export const isNative = () => Capacitor.isNativePlatform();

// Must run as early as possible: tells the plugin this bundle started fine (otherwise it rolls back).
export function markReady() { if (isNative()) CapacitorUpdater.notifyAppReady().catch(() => {}); }

async function latestInfo(timeout = 6000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/latest`, { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const j = await r.json();
    const m = /<!--kv (\{.*?\})-->/.exec(j.body || '');
    if (!m) return null;
    const info = JSON.parse(m[1]);
    const asset = (name) => j.assets?.find((a) => a.name === name)?.browser_download_url;
    return { ...info, zip: asset('web.zip'), apk: asset('KemikVadisi.apk') || `https://github.com/${REPO}/releases/download/latest/KemikVadisi.apk` };
  } finally { clearTimeout(t); }
}

// Returns { apk } if a new APK is required, otherwise null. Restarts the app when a game update applies.
export async function checkForUpdate(onStatus) {
  if (!isNative()) return null;
  let info;
  try { info = await latestInfo(); } catch { return null; }
  if (!info) return null;
  if (info.native > NATIVE_VERSION) return { apk: info.apk, web: info.web };
  if (!(info.web > WEB_VERSION) || !info.zip) return null;
  onStatus?.(`Güncelleme indiriliyor (v${info.web})…`, 0);
  const sub = await CapacitorUpdater.addListener('download', (e) => onStatus?.(`Güncelleme indiriliyor (v${info.web})… %${Math.round(e.percent || 0)}`, (e.percent || 0) / 100));
  try {
    const bundle = await CapacitorUpdater.download({ url: info.zip, version: String(info.web) });
    onStatus?.('Güncelleme kuruluyor…', 1);
    await CapacitorUpdater.set({ id: bundle.id }); // reloads the app with the new build
  } catch (e) {
    onStatus?.('Güncelleme indirilemedi, mevcut sürümle devam ediliyor…', 1);
    console.warn('update failed', e);
  } finally { sub?.remove?.(); }
  return null;
}
