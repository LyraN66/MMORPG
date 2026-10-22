// NATIVE_VERSION: bump only when the Android shell changes (new Capacitor plugin, permissions, icon…).
// Game code updates are delivered over the air and don't need a new APK.
export const NATIVE_VERSION = 2;
// Set at build time by CI (GitHub run number); 0 for local builds.
export const WEB_VERSION = Number(import.meta.env.VITE_WEB_VERSION || 0);
export const REPO = 'LyraN66/MMORPG';
