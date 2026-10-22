// Game data: classes, enemies, zones, items.

export const GAME_NAME = 'Kemik Vadisi';

export const CLASSES = {
  knight: {
    id: 'knight', name: 'Şövalye', model: 'knight', desc: 'Kılıç ve kalkan. Yakın dövüş, yüksek dayanıklılık.',
    base: { hp: 140, mp: 50, atk: 14, def: 8 }, grow: { hp: 26, mp: 6, atk: 3.2, def: 2.2 },
    range: 2.3, atkSpeed: 0.85, moveSpeed: 6.2, ranged: false,
    weaponType: 'sword', color: '#ffcf6a',
    skills: [
      { id: 'whirl', name: 'Kasırga', icon: '🌀', unlock: 1, cd: 6, mp: 14, desc: 'Etrafındaki tüm düşmanlara dönerek %180 hasar.' },
      { id: 'charge', name: 'Kalkan Hücumu', icon: '🛡️', unlock: 3, cd: 8, mp: 12, desc: 'Hedefe atıl, %150 hasar ve 1.5 sn sersemlet.' },
      { id: 'warcry', name: 'Savaş Narası', icon: '📯', unlock: 6, cd: 24, mp: 20, desc: '10 sn boyunca +%35 saldırı, +%25 savunma.' },
      { id: 'quake', name: 'Deprem', icon: '💥', unlock: 15, cd: 12, mp: 30, desc: 'Yeri yar: önündeki geniş alanda %260 hasar, 1 sn sersemlet.' },
      { id: 'bladestorm', name: 'Kılıç Fırtınası', icon: '⚔️', unlock: 35, cd: 20, mp: 45, desc: '3 sn boyunca dönen kılıçlar: çevrene saniyede %160 hasar.' },
    ],
  },
  mage: {
    id: 'mage', name: 'Büyücü', model: 'mage', desc: 'Kadim asa. Uzaktan güçlü büyüler, alan hasarı.',
    base: { hp: 95, mp: 110, atk: 17, def: 4 }, grow: { hp: 17, mp: 14, atk: 3.9, def: 1.3 },
    range: 11, atkSpeed: 0.95, moveSpeed: 6.0, ranged: true,
    weaponType: 'staff', color: '#8fd3ff',
    skills: [
      { id: 'fireball', name: 'Ateş Topu', icon: '🔥', unlock: 1, cd: 5, mp: 16, desc: 'Patlayan ateş küresi, alanda %220 hasar.' },
      { id: 'frostnova', name: 'Buz Halkası', icon: '❄️', unlock: 3, cd: 9, mp: 20, desc: 'Çevrene %130 hasar, düşmanları 3 sn %60 yavaşlat.' },
      { id: 'meteor', name: 'Meteor', icon: '☄️', unlock: 6, cd: 18, mp: 34, desc: 'Gökten meteor çağır: büyük alanda %420 hasar.' },
      { id: 'chain', name: 'Zincir Şimşek', icon: '⚡', unlock: 15, cd: 8, mp: 28, desc: 'Hedeften hedefe sekip 5 düşmana %200 hasar veren şimşek.' },
      { id: 'blackhole', name: 'Kara Delik', icon: '🌑', unlock: 35, cd: 24, mp: 55, desc: 'Düşmanları içine çeken kara delik: 3 sn boyunca saniyede %180 hasar.' },
    ],
  },
};

import { MAPS, mapById } from './maps.js';

// Zones and monster camps of the active map (client). The server reads them from the map directly.
export let ZONES = MAPS[0].zones;
export let CAMPS = MAPS[0].camps;
export function useMapData(id) { const m = mapById(id); ZONES = m.zones; CAMPS = m.camps; return m; }
export const zoneAt = (z) => ZONES.find((zn) => z >= zn.zMin && z < zn.zMax) || ZONES[1] || ZONES[0];

export const ENEMIES = {
  minion: { name: 'Kemik Er', trophy: 'Paslı Künye', model: 'skel_minion', weapon: 'sk_blade', offhand: null, hp: 1.0, atk: 1.0, def: 1.0, speed: 3.6, range: 2.0, atkTime: 1.5, xp: 1.0, aggro: 8 },
  rogue: { name: 'Kemik Haydut', trophy: 'Haydut Hançeri', model: 'skel_rogue', weapon: 'dagger', offhand: 'dagger', hp: 0.85, atk: 1.15, def: 0.8, speed: 4.6, range: 1.9, atkTime: 1.05, xp: 1.15, aggro: 9 },
  warrior: { name: 'Kemik Muhafız', trophy: 'Muhafız Nişanı', model: 'skel_warrior', weapon: 'sk_axe', offhand: 'sk_shield_l', hp: 1.6, atk: 1.25, def: 1.6, speed: 3.2, range: 2.2, atkTime: 1.7, xp: 1.5, aggro: 8 },
  mage: { name: 'Kemik Kâhin', trophy: 'Kâhin Mührü', model: 'skel_mage', weapon: 'sk_staff', offhand: null, hp: 0.75, atk: 1.2, def: 0.6, speed: 3.3, range: 9, atkTime: 2.1, xp: 1.3, aggro: 11, ranged: true },
  // ---- Zehirli Bataklık (13–25) ----
  slime: { name: 'Bataklık Balçığı', trophy: 'Yapışkan Öz', model: 'Blob_GreenBlob', rig: 'blob', h: 1.3, hp: 0.9, atk: 0.95, def: 0.8, speed: 3.4, range: 1.8, atkTime: 1.4, xp: 1.0, aggro: 8 },
  spiky: { name: 'Dikenli Balçık', trophy: 'Zehirli Diken', model: 'Blob_GreenSpikyBlob', rig: 'blob', h: 1.8, hp: 1.3, atk: 1.2, def: 1.3, speed: 3.1, range: 2.0, atkTime: 1.6, xp: 1.35, aggro: 8 },
  mushnub: { name: 'Mantar Cüce', trophy: 'Spor Kesesi', model: 'Blob_Mushnub', rig: 'blob', h: 1.6, hp: 1.0, atk: 1.1, def: 1.0, speed: 3.8, range: 1.9, atkTime: 1.3, xp: 1.15, aggro: 9 },
  frog: { name: 'Zehir Kurbağası', trophy: 'Kurbağa Dili', model: 'Big_Frog', rig: 'big', h: 1.9, hp: 0.8, atk: 1.2, def: 0.7, speed: 3.6, range: 9, atkTime: 2.0, xp: 1.3, aggro: 11, ranged: true, bolt: 0x7dff4a },
  // ---- Kızıl Çöl (25–37) ----
  cactling: { name: 'Kaktüs Yavrusu', trophy: 'Kaktüs Çiçeği', model: 'Blob_Cactoro', rig: 'blob', h: 1.5, hp: 0.95, atk: 1.0, def: 1.0, speed: 3.5, range: 1.9, atkTime: 1.4, xp: 1.0, aggro: 8 },
  cactoro: { name: 'Kaktüs Devi', trophy: 'Sert Kaktüs Kabuğu', model: 'Big_Cactoro', rig: 'big', h: 2.4, hp: 1.6, atk: 1.25, def: 1.6, speed: 3.0, range: 2.3, atkTime: 1.8, xp: 1.5, aggro: 8 },
  armabee: { name: 'Zırhlı Arı', trophy: 'Arı İğnesi', model: 'Flying_Armabee', rig: 'fly', h: 1.5, hp: 0.8, atk: 1.15, def: 0.8, speed: 4.8, range: 1.9, atkTime: 1.1, xp: 1.15, aggro: 10 },
  shaman: { name: 'Kabile Şamanı', trophy: 'Şaman Maskesi', model: 'Big_Tribal', rig: 'big', h: 2.3, hp: 0.8, atk: 1.25, def: 0.7, speed: 3.3, range: 9.5, atkTime: 2.1, xp: 1.3, aggro: 11, ranged: true, bolt: 0xffb03a },
  // ---- Ayaz Zirvesi (37–50) ----
  yetiling: { name: 'Yeti Yavrusu', trophy: 'Beyaz Post', model: 'Blob_Yeti', rig: 'blob', h: 1.5, hp: 1.0, atk: 1.0, def: 1.0, speed: 3.6, range: 1.9, atkTime: 1.4, xp: 1.0, aggro: 8 },
  bunny: { name: 'Kar Tavşanı', trophy: 'Tavşan Kulağı', model: 'Big_Bunny', rig: 'big', h: 2.1, hp: 0.9, atk: 1.2, def: 0.8, speed: 4.9, range: 2.0, atkTime: 1.1, xp: 1.15, aggro: 9 },
  alpaking: { name: 'Uçan Alpaka', trophy: 'Alpaka Yünü', model: 'Flying_Alpaking', rig: 'fly', h: 1.7, hp: 0.85, atk: 1.2, def: 0.8, speed: 4.4, range: 9, atkTime: 2.0, xp: 1.3, aggro: 11, ranged: true, bolt: 0x9fe8ff },
  birb: { name: 'Buz Kuşu', trophy: 'Buzlu Tüy', model: 'Big_Birb', rig: 'big', h: 2.2, hp: 1.6, atk: 1.25, def: 1.5, speed: 3.2, range: 2.2, atkTime: 1.7, xp: 1.5, aggro: 8 },
  // ---- Kül Diyarı (50–62) ----
  orcling: { name: 'Ork Çömez', trophy: 'Ork Dişi', model: 'Blob_Orc', rig: 'blob', h: 1.5, hp: 1.0, atk: 1.05, def: 1.0, speed: 3.7, range: 1.9, atkTime: 1.35, xp: 1.0, aggro: 8 },
  orc: { name: 'Kül Orku', trophy: 'Kül Bilekliği', model: 'Big_Orc', rig: 'big', h: 2.3, hp: 1.3, atk: 1.2, def: 1.2, speed: 4.0, range: 2.1, atkTime: 1.3, xp: 1.2, aggro: 9 },
  goleling: { name: 'Lav Cücesi', trophy: 'Kor Taşı', model: 'Flying_Goleling', rig: 'fly', h: 1.5, hp: 0.85, atk: 1.25, def: 0.8, speed: 3.6, range: 9, atkTime: 2.0, xp: 1.3, aggro: 11, ranged: true, bolt: 0xff6a2a },
  orcskull: { name: 'Kafatası Orku', trophy: 'Kanlı Kafatası', model: 'Big_Orc_Skull', rig: 'big', h: 2.5, hp: 1.7, atk: 1.3, def: 1.6, speed: 3.1, range: 2.3, atkTime: 1.8, xp: 1.55, aggro: 8 },
  // ---- Batık Kıyı (62–74) ----
  fishling: { name: 'Kıyı Balığı', trophy: 'Parlak Pul', model: 'Blob_Fish', rig: 'blob', h: 1.5, hp: 0.95, atk: 1.05, def: 0.9, speed: 3.8, range: 1.9, atkTime: 1.35, xp: 1.0, aggro: 8 },
  fishman: { name: 'Balık Adam', trophy: 'Mercan Mızrak', model: 'Big_Fish', rig: 'big', h: 2.4, hp: 1.6, atk: 1.25, def: 1.5, speed: 3.2, range: 2.2, atkTime: 1.7, xp: 1.5, aggro: 8 },
  glub: { name: 'Uçan Balon Balığı', trophy: 'Mürekkep Kesesi', model: 'Flying_Glub', rig: 'fly', h: 1.6, hp: 0.8, atk: 1.25, def: 0.7, speed: 3.6, range: 9.5, atkTime: 2.0, xp: 1.3, aggro: 11, ranged: true, bolt: 0x4ac8ff },
  squidle: { name: 'Mürekkep Ahtapotu', trophy: 'Ahtapot Kolu', model: 'Flying_Squidle', rig: 'fly', h: 1.6, hp: 0.9, atk: 1.15, def: 0.85, speed: 4.6, range: 1.9, atkTime: 1.1, xp: 1.15, aggro: 10 },
  // ---- Hayalet Ormanı (74–86) ----
  ghost: { name: 'Gezgin Hayalet', trophy: 'Ruh Parçası', model: 'Flying_Ghost', rig: 'fly', h: 2.0, hp: 0.95, atk: 1.1, def: 0.9, speed: 4.2, range: 2.0, atkTime: 1.2, xp: 1.05, aggro: 9 },
  wraith: { name: 'Kafatası Hortlak', trophy: 'Lanetli Kafatası', model: 'Flying_Ghost_Skull', rig: 'fly', h: 2.0, hp: 0.8, atk: 1.3, def: 0.7, speed: 3.6, range: 9.5, atkTime: 2.0, xp: 1.3, aggro: 11, ranged: true, bolt: 0xc07aff },
  ninja: { name: 'Gölge Ninja', trophy: 'Gölge Kuşağı', model: 'Big_Ninja', rig: 'big', h: 2.2, hp: 1.0, atk: 1.3, def: 0.9, speed: 5.0, range: 2.0, atkTime: 1.0, xp: 1.25, aggro: 10 },
  hywirl: { name: 'Fırtına Ruhu', trophy: 'Fırtına Özü', model: 'Flying_Hywirl', rig: 'fly', h: 2.0, hp: 1.6, atk: 1.25, def: 1.5, speed: 3.3, range: 2.2, atkTime: 1.6, xp: 1.5, aggro: 8 },
  // ---- Ejder Zirvesi (86–100) ----
  drake: { name: 'Ejder Yavrusu', trophy: 'Ejder Pulu', model: 'Flying_Dragon', rig: 'fly', h: 1.7, hp: 1.0, atk: 1.2, def: 1.0, speed: 4.4, range: 2.0, atkTime: 1.2, xp: 1.1, aggro: 9 },
  xeno: { name: 'Yıldız Yaratığı', trophy: 'Yıldız Tozu', model: 'Blob_Alien', rig: 'blob', h: 1.7, hp: 0.85, atk: 1.3, def: 0.8, speed: 3.6, range: 9.5, atkTime: 2.0, xp: 1.3, aggro: 11, ranged: true, bolt: 0x7dffd8 },
  masked: { name: 'Maskeli Muhafız', trophy: 'Muhafız Maskesi', model: 'Flying_Tribal', rig: 'fly', h: 2.3, hp: 1.7, atk: 1.3, def: 1.6, speed: 3.2, range: 2.3, atkTime: 1.7, xp: 1.55, aggro: 8 },
  assassin: { name: 'Zirve Suikastçısı', trophy: 'Zehirli Bıçak', model: 'Blob_Ninja', rig: 'blob', h: 1.7, hp: 0.9, atk: 1.35, def: 0.85, speed: 5.2, range: 1.9, atkTime: 1.0, xp: 1.2, aggro: 10 },
};

export const UNIQUES = {
  gorran: {
    id: 'gorran', map: 'vadi', name: 'Çürük Kral Gorran', type: 'warrior', model: 'skel_warrior', weapon: 'axe_2h', offhand: null,
    level: 7, hpMul: 6, atkMul: 1.5, scale: 1.75, respawn: 150, firstSpawn: 25, pos: [-24, -8], zone: 'Kırık Mezarlık',
    tint: 0x5cff7a, xpMul: 14, gold: 380, summons: ['minion', 'minion'],
  },
  morvath: {
    id: 'morvath', map: 'vadi', name: 'Kemik Lordu Morvath', type: 'warrior', model: 'skel_warrior', weapon: 'sword_2h', offhand: null,
    level: 13, hpMul: 10, atkMul: 1.7, scale: 2.25, respawn: 300, firstSpawn: 60, pos: [0, -86], zone: 'Kemik Tapınağı',
    tint: 0xff3b3b, xpMul: 30, gold: 1500, final: true, summons: ['mage', 'minion', 'minion'],
  },
  sporla: {
    id: 'sporla', map: 'bataklik', name: 'Spor Ana Mikella', type: 'mushnub', model: 'Blob_Mushnub_Evolved', weapon: null, offhand: null, h: 2.1,
    level: 19, hpMul: 6, atkMul: 1.5, scale: 1.6, respawn: 150, firstSpawn: 25, pos: [-24, -8], zone: 'Çürük Göl',
    tint: 0x9dff5c, xpMul: 14, gold: 1800, summons: ['slime', 'mushnub'],
  },
  miselyum: {
    id: 'miselyum', map: 'bataklik', name: 'Mantar Kral Miselyum', type: 'spiky', model: 'Big_MushroomKing', weapon: null, offhand: null, final: true, h: 2.6,
    level: 25, hpMul: 10, atkMul: 1.7, scale: 1.5, respawn: 300, firstSpawn: 60, pos: [0, -86], zone: 'Spor Tapınağı',
    tint: 0xff5cf0, xpMul: 30, gold: 4200, summons: ['spiky', 'frog'],
  },
  zirhkanat: {
    id: 'zirhkanat', map: 'col', name: 'Kraliçe Arı Zırhkanat', type: 'armabee', model: 'Flying_Armabee_Evolved', weapon: null, offhand: null, h: 2.1,
    level: 31, hpMul: 6, atkMul: 1.5, scale: 1.8, respawn: 150, firstSpawn: 25, pos: [24, -8], zone: 'Kavrulmuş Vadi',
    tint: 0xffd23a, xpMul: 14, gold: 5200, summons: ['armabee', 'cactling'],
  },
  monkrus: {
    id: 'monkrus', map: 'col', name: 'Çöl Hükümdarı Monkrus', type: 'cactoro', model: 'Big_Monkroose', weapon: null, offhand: null, final: true, h: 2.6,
    level: 37, hpMul: 10, atkMul: 1.7, scale: 1.4, respawn: 300, firstSpawn: 60, pos: [0, -86], zone: 'Güneş Sunağı',
    tint: 0xff7a2a, xpMul: 30, gold: 9000, summons: ['cactoro', 'shaman'],
  },
  yunbas: {
    id: 'yunbas', map: 'buzul', name: 'Kar Kralı Yünbaş', type: 'alpaking', model: 'Flying_Alpaking_Evolved', weapon: null, offhand: null, h: 2.1,
    level: 43, hpMul: 6, atkMul: 1.5, scale: 1.7, respawn: 150, firstSpawn: 25, pos: [-24, -8], zone: 'Kırağı Geçidi',
    tint: 0x9fe8ff, xpMul: 14, gold: 11000, summons: ['bunny', 'yetiling'],
  },
  yortun: {
    id: 'yortun', map: 'buzul', name: 'Buz Devi Yortun', type: 'birb', model: 'Big_Yeti', weapon: null, offhand: null, final: true, h: 2.6,
    level: 50, hpMul: 10, atkMul: 1.7, scale: 1.6, respawn: 300, firstSpawn: 60, pos: [0, -86], zone: 'Donmuş Taht',
    tint: 0x7ac8ff, xpMul: 30, gold: 18000, summons: ['birb', 'alpaking'],
  },
  magmus: {
    id: 'magmus', map: 'volkan', name: 'Magma Golemi Magmus', type: 'goleling', model: 'Flying_Goleling_Evolved', weapon: null, offhand: null, h: 2.1,
    level: 56, hpMul: 6, atkMul: 1.5, scale: 1.8, respawn: 150, firstSpawn: 25, pos: [24, -8], zone: 'Lav Nehri',
    tint: 0xff5a1a, xpMul: 14, gold: 21000, summons: ['orcling', 'goleling'],
  },
  azgar: {
    id: 'azgar', map: 'volkan', name: 'Ateş İblisi Azgar', type: 'orcskull', model: 'Big_Demon', weapon: null, offhand: null, final: true, h: 2.6,
    level: 62, hpMul: 10, atkMul: 1.7, scale: 1.6, respawn: 300, firstSpawn: 60, pos: [0, -86], zone: 'Kül Kalesi',
    tint: 0xff2a2a, xpMul: 30, gold: 32000, summons: ['orc', 'orcskull'],
  },
  glubora: {
    id: 'glubora', map: 'kiyi', name: 'Derin Ana Glubora', type: 'glub', model: 'Flying_Glub_Evolved', weapon: null, offhand: null, h: 2.1,
    level: 68, hpMul: 6, atkMul: 1.5, scale: 1.6, respawn: 150, firstSpawn: 25, pos: [-24, -8], zone: 'Mercan Mağarası',
    tint: 0x3ab8ff, xpMul: 14, gold: 36000, summons: ['fishling', 'squidle'],
  },
  rex: {
    id: 'rex', map: 'kiyi', name: 'Kadim Kertenkele Rex', type: 'fishman', model: 'Big_Dino', weapon: null, offhand: null, final: true, h: 2.6,
    level: 74, hpMul: 10, atkMul: 1.7, scale: 1.6, respawn: 300, firstSpawn: 60, pos: [0, -86], zone: 'Batık Tapınak',
    tint: 0x5cffb0, xpMul: 30, gold: 52000, summons: ['fishman', 'glub'],
  },
  nekra: {
    id: 'nekra', map: 'hayalet', name: 'Gölge Büyücü Nekra', type: 'wraith', model: 'Blob_Wizard', weapon: null, offhand: null, h: 2.1,
    level: 80, hpMul: 6, atkMul: 1.5, scale: 1.9, respawn: 150, firstSpawn: 25, pos: [24, -8], zone: 'Sisli Mezar',
    tint: 0xb05cff, xpMul: 14, gold: 58000, summons: ['ghost', 'wraith'],
  },
  vorgath: {
    id: 'vorgath', map: 'hayalet', name: 'Mavi İblis Vorgath', type: 'hywirl', model: 'Big_BlueDemon', weapon: null, offhand: null, final: true, h: 2.6,
    level: 86, hpMul: 10, atkMul: 1.7, scale: 1.7, respawn: 300, firstSpawn: 60, pos: [0, -86], zone: 'Ruhlar Kapısı',
    tint: 0x3a6aff, xpMul: 30, gold: 80000, summons: ['ninja', 'hywirl'],
  },
  zorg: {
    id: 'zorg', map: 'ejder', name: 'Yıldız Yiyen Zorg', type: 'xeno', model: 'Big_Alien', weapon: null, offhand: null, h: 2.1,
    level: 93, hpMul: 6, atkMul: 1.5, scale: 1.5, respawn: 150, firstSpawn: 25, pos: [-24, -8], zone: 'Düşen Yıldız Krateri',
    tint: 0x7dffd8, xpMul: 14, gold: 90000, summons: ['xeno', 'assassin'],
  },
  ignarok: {
    id: 'ignarok', map: 'ejder', name: 'Ejder Kral Ignarok', type: 'masked', model: 'Flying_Dragon_Evolved', weapon: null, offhand: null, final: true, h: 2.6,
    level: 100, hpMul: 10, atkMul: 1.7, scale: 1.9, respawn: 300, firstSpawn: 60, pos: [0, -86], zone: 'Ejder Yuvası',
    tint: 0xff3a1a, xpMul: 30, gold: 150000, summons: ['drake', 'masked'],
  },
};

export const xpToNext = (lv) => Math.floor(40 * Math.pow(lv, 1.75) + 30);
export const MAX_LEVEL = 100;

export const RARITY = [
  { id: 0, name: 'Sıradan', color: '#d8d8d8', mul: 1.0 },
  { id: 1, name: 'Nadir', color: '#4fa8ff', mul: 1.25 },
  { id: 2, name: 'Destansı', color: '#c66bff', mul: 1.55 },
  { id: 3, name: 'Efsanevi', color: '#ffae2b', mul: 2.0 },
];

const TIERS = [
  { lv: 1, sword: 'Paslı Kılıç', staff: 'Meşe Asa', armor: 'Deri Yelek', ring: 'Bakır Yüzük' },
  { lv: 4, sword: 'Demir Kılıç', staff: 'Kemik Asa', armor: 'Zincir Zırh', ring: 'Gümüş Yüzük' },
  { lv: 8, sword: 'Çelik Kılıç', staff: 'Kristal Asa', armor: 'Plaka Zırh', ring: 'Altın Yüzük' },
  { lv: 12, sword: 'Kemikkıran', staff: 'Ruh Asası', armor: 'Lanetli Zırh', ring: 'Ruh Yüzüğü' },
  { lv: 16, sword: 'Bataklık Palası', staff: 'Sarmaşık Asa', armor: 'Pullu Zırh', ring: 'Yosun Yüzüğü' },
  { lv: 20, sword: 'Zehirdiş', staff: 'Zümrüt Asa', armor: 'Kertenkele Zırhı', ring: 'Zümrüt Yüzük' },
  { lv: 25, sword: 'Kum Kılıcı', staff: 'Güneş Asası', armor: 'Bronz Zırh', ring: 'Kehribar Yüzük' },
  { lv: 30, sword: 'Firavun Palası', staff: 'Akrep Asası', armor: 'Altın Pullu Zırh', ring: 'Firavun Mührü' },
  { lv: 36, sword: 'Buzkesen', staff: 'Kırağı Asası', armor: 'Kürk Zırh', ring: 'Buz Yüzüğü' },
  { lv: 42, sword: 'Ayaz Kılıcı', staff: 'Kutup Asası', armor: 'Buzul Zırhı', ring: 'Kar Kristali' },
  { lv: 48, sword: 'Lav Kılıcı', staff: 'Magma Asası', armor: 'Obsidyen Zırh', ring: 'Kor Yüzüğü' },
  { lv: 55, sword: 'Volkan Palası', staff: 'Yanardağ Asası', armor: 'Ateştaşı Zırh', ring: 'Alev Mührü' },
  { lv: 62, sword: 'Fırtına Kılıcı', staff: 'Yıldırım Asası', armor: 'Gök Zırhı', ring: 'Şimşek Yüzüğü' },
  { lv: 70, sword: 'Ejder Dişi', staff: 'Ejder Asası', armor: 'Ejder Pulu Zırh', ring: 'Ejder Gözü' },
  { lv: 78, sword: 'Gölge Kılıcı', staff: 'Hiçlik Asası', armor: 'Gölge Zırhı', ring: 'Hiçlik Yüzüğü' },
  { lv: 86, sword: 'Yıldız Kılıcı', staff: 'Göksel Asa', armor: 'Yıldız Zırhı', ring: 'Yıldız Yüzüğü' },
  { lv: 94, sword: 'Efsane Kılıcı', staff: 'Efsane Asası', armor: 'Efsane Zırhı', ring: 'Efsane Yüzüğü' },
];
export const tierFor = (lv) => [...TIERS].reverse().find((t) => lv >= t.lv) || TIERS[0];

// Enhancement success chance per target level (+1 … +10)
export const PLUS_CHANCE = [1, 1, 0.95, 0.85, 0.7, 0.55, 0.45, 0.35, 0.25, 0.16, 0.1];
export const plusCost = (item) => Math.floor(40 * Math.pow(item.plus + 1, 1.9) * (1 + item.lv / 4));

let uid = 1;
export function makeItem(slot, lv, rarity, cls) {
  const t = tierFor(lv);
  const r = RARITY[rarity];
  const tierLv = t.lv;
  const it = { uid: Date.now().toString(36) + (uid++), slot, lv: tierLv, rarity, plus: 0 };
  if (slot === 'weapon') {
    const wt = cls === 'mage' ? 'staff' : 'sword';
    it.name = t[wt]; it.wtype = wt; it.atk = Math.round((6 + tierLv * 3.2) * r.mul);
  } else if (slot === 'armor') {
    it.name = t.armor; it.def = Math.round((3 + tierLv * 2.2) * r.mul);
  } else {
    it.name = t.ring; it.hp = Math.round((15 + tierLv * 9) * r.mul);
  }
  return it;
}
export const itemStat = (it) => {
  const m = 1 + it.plus * 0.12;
  return { atk: Math.round((it.atk || 0) * m), def: Math.round((it.def || 0) * m), hp: Math.round((it.hp || 0) * m) };
};
export const sellPrice = (it) => Math.floor((8 + it.lv * 6) * (1 + it.rarity * 1.5) * (1 + it.plus * 0.5));

export const SHOP = [
  { id: 'hp', name: 'Can İksiri', icon: '🧪', price: 12, desc: 'Canın %40\'ını yeniler.' },
  { id: 'mp', name: 'Mana İksiri', icon: '💧', price: 12, desc: 'Mananın %45\'ini yeniler.' },
];
