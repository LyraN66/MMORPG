import { makeItem, migrateSave } from './data.js';

const KEY = 'kemik-vadisi-save-v1';

export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.cls) return migrateSave(s); } catch { /* storage unavailable */ }
  return null;
}

export function newSave(cls, name) {
  return migrateSave({
    v: 1, map: 'vadi', cls, name: name || 'Kahraman', level: 1, xp: 0, gold: 60,
    equip: { weapon: makeItem('weapon', 1, 0, cls), chest: makeItem('chest', 1, 0, cls) },
    bag: [], potions: { hp: 8, mp: 6 }, stats: { kills: 0, uniques: 0 }, created: Date.now(),
  });
}

// Online saves also go to the server (throttled; `now` forces it, e.g. before travelling).
let remote = null, lastSent = 0;
export function setRemoteSaver(fn) { remote = fn; }
export function saveGame(save, player, now = false) {
  if (player) {
    save.pos = player.dead ? null : [player.pos.x, player.pos.y, player.pos.z];
    save.hp = player.dead ? null : Math.round(player.hp);
    save.mp = Math.round(player.mp);
  }
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage unavailable */ }
  if (remote && (now || Date.now() - lastSent > 5000)) { lastSent = Date.now(); remote(save, now); }
}

export function deleteSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

// The pre-account offline character of this phone, kept aside so it can be moved into an account once.
export function legacySave() {
  try {
    if (!localStorage.getItem('kv-migrated')) {
      const old = localStorage.getItem(KEY);
      if (old) localStorage.setItem('kv-legacy', old);
      localStorage.setItem('kv-migrated', '1');
    }
    const l = JSON.parse(localStorage.getItem('kv-legacy'));
    return l && l.cls ? migrateSave(l) : null;
  } catch { return null; }
}
export function dropLegacy() { try { localStorage.removeItem('kv-legacy'); } catch { /* ignore */ } }
export function cacheSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }
