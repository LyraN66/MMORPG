import { makeItem } from './data.js';

const KEY = 'kemik-vadisi-save-v1';

export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.cls) return s; } catch { /* storage unavailable */ }
  return null;
}

export function newSave(cls, name) {
  return {
    v: 1, cls, name: name || (cls === 'knight' ? 'Şövalye' : 'Büyücü'), level: 1, xp: 0, gold: 60,
    equip: { weapon: makeItem('weapon', 1, 0, cls), armor: makeItem('armor', 1, 0, cls), ring: null },
    bag: [], potions: { hp: 8, mp: 6 }, stats: { kills: 0, uniques: 0 }, created: Date.now(),
  };
}

export function saveGame(save, player) {
  if (player) {
    save.pos = player.dead ? null : [player.pos.x, player.pos.y, player.pos.z];
    save.hp = player.dead ? null : Math.round(player.hp);
    save.mp = Math.round(player.mp);
  }
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage unavailable */ }
}

export function deleteSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
