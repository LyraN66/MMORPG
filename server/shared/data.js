// Game data: classes, enemies, zones, items.

export const GAME_NAME = 'Kemik Vadisi';

export const CLASSES = {
  knight: {
    id: 'knight', icon: '⚔️', name: 'Şövalye', model: 'knight', weapon: null, offhand: null, desc: 'Kılıç ve kalkan. Yakın dövüş, yüksek dayanıklılık.',
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
    id: 'mage', icon: '🔮', name: 'Büyücü', model: 'mage', weapon: null, offhand: null, desc: 'Kadim asa. Uzaktan güçlü büyüler, alan hasarı.',
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
  archer: {
    id: 'archer', icon: '🏹', name: 'Okçu', model: 'npc_ranger', weapon: null, offhand: 'bow', desc: 'Yay ile uzaktan hızlı oklar. Çevik ve isabetli.',
    base: { hp: 105, mp: 80, atk: 16, def: 5 }, grow: { hp: 19, mp: 9, atk: 3.7, def: 1.5 },
    range: 12, atkSpeed: 0.8, moveSpeed: 6.3, ranged: true, crit: 0.05,
    weaponType: 'bow', color: '#9fe07a',
    skills: [
      { id: 'multishot', name: 'Çoklu Ok', icon: '🎯', unlock: 1, cd: 5, mp: 14, desc: 'Önündeki 5 düşmana aynı anda ok: her biri %140 hasar.' },
      { id: 'poisonarrow', name: 'Zehirli Ok', icon: '🧪', unlock: 3, cd: 8, mp: 16, desc: '%130 hasar ve 6 sn boyunca toplam %200 zehir hasarı.' },
      { id: 'leapback', name: 'Geri Sıçrama', icon: '💨', unlock: 6, cd: 12, mp: 15, desc: 'Geriye sıçra, yakındaki düşmanları 3 sn yavaşlat.' },
      { id: 'arrowrain', name: 'Ok Yağmuru', icon: '🌧️', unlock: 15, cd: 14, mp: 32, desc: 'Hedef bölgeye 3 sn ok yağdır: saniyede %140 alan hasarı.' },
      { id: 'snipe', name: 'Keskin Nişan', icon: '🏹', unlock: 35, cd: 20, mp: 45, desc: 'Nişan al ve tek hedefe %650 hasarlık ok fırlat.' },
    ],
  },
  assassin: {
    id: 'assassin', icon: '🗡️', name: 'Suikastçı', model: 'npc_rogue', weapon: 'dagger', offhand: 'dagger', desc: 'Çift hançer. Çok hızlı, kritik vuruşu yüksek, canı az.',
    base: { hp: 110, mp: 70, atk: 15, def: 5 }, grow: { hp: 21, mp: 8, atk: 3.5, def: 1.6 },
    range: 2.0, atkSpeed: 0.55, moveSpeed: 6.7, ranged: false, crit: 0.15,
    weaponType: 'dagger', color: '#c07aff',
    skills: [
      { id: 'shadowstep', name: 'Gölge Adımı', icon: '👤', unlock: 1, cd: 6, mp: 12, desc: 'Hedefin arkasına ışınlan ve %170 hasar ver.' },
      { id: 'venomblade', name: 'Zehirli Bıçak', icon: '🐍', unlock: 3, cd: 7, mp: 14, desc: '3 hızlı darbe (her biri %80) ve zehir: 5 sn toplam %150.' },
      { id: 'vanish', name: 'Görünmezlik', icon: '🌫️', unlock: 6, cd: 22, mp: 20, desc: '6 sn görünmez ol: moblar seni bırakır, sonraki vuruşun 2 kat.' },
      { id: 'bladefan', name: 'Bıçak Fırtınası', icon: '🌪️', unlock: 15, cd: 12, mp: 30, desc: 'Etrafında dönen hançerler: 4 kez %75 alan hasarı.' },
      { id: 'execute', name: 'Ölümcül Darbe', icon: '☠️', unlock: 35, cd: 18, mp: 40, desc: '%380 hasar; canı %30\'un altındaki düşmana 2 kat.' },
    ],
  },
  barbarian: {
    id: 'barbarian', icon: '🪓', name: 'Barbar', model: 'npc_barbarian', weapon: 'axe_2h', offhand: null, desc: 'İki elli balta. Yavaş ama çok sert; canı azaldıkça öfkelenir.',
    base: { hp: 160, mp: 45, atk: 17, def: 6 }, grow: { hp: 29, mp: 5, atk: 3.9, def: 1.7 },
    range: 2.5, atkSpeed: 1.1, moveSpeed: 6.0, ranged: false, rage: true,
    weaponType: 'axe', color: '#ff8a5a',
    skills: [
      { id: 'cleave', name: 'Yarma', icon: '🪓', unlock: 1, cd: 6, mp: 12, desc: 'Önündeki geniş yaya %230 hasar.' },
      { id: 'leapslam', name: 'Sıçrama Darbesi', icon: '🦘', unlock: 3, cd: 9, mp: 16, desc: 'Hedefe sıçra: alanda %190 hasar ve 1 sn sersemletme.' },
      { id: 'bloodlust', name: 'Kan Hırsı', icon: '🩸', unlock: 6, cd: 25, mp: 20, desc: '10 sn: +%25 saldırı, verdiğin hasarın %15\'i kadar can.' },
      { id: 'axestorm', name: 'Balta Kasırgası', icon: '🌀', unlock: 15, cd: 14, mp: 32, desc: 'Yürürken dönen balta: 2.4 sn boyunca 6 kez %75 alan hasarı.' },
      { id: 'earthsplit', name: 'Yer Yarığı', icon: '🌋', unlock: 35, cd: 20, mp: 45, desc: 'Önündeki 10 m\'lik hatta %400 hasar ve sersemletme.' },
    ],
  },
};
// Weapon item names per class weapon type (sword/staff come from the tier table).
export const WEAPON_NOUN = { bow: 'Yay', dagger: 'Hançer', axe: 'Balta' };

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
  { lv: 1, mat: 'Paslı', sword: 'Paslı Kılıç', staff: 'Meşe Asa', armor: 'Deri Yelek', ring: 'Bakır Yüzük' },
  { lv: 4, mat: 'Demir', sword: 'Demir Kılıç', staff: 'Kemik Asa', armor: 'Zincir Zırh', ring: 'Gümüş Yüzük' },
  { lv: 8, mat: 'Çelik', sword: 'Çelik Kılıç', staff: 'Kristal Asa', armor: 'Plaka Zırh', ring: 'Altın Yüzük' },
  { lv: 12, mat: 'Kemik', sword: 'Kemikkıran', staff: 'Ruh Asası', armor: 'Lanetli Zırh', ring: 'Ruh Yüzüğü' },
  { lv: 16, mat: 'Bataklık', sword: 'Bataklık Palası', staff: 'Sarmaşık Asa', armor: 'Pullu Zırh', ring: 'Yosun Yüzüğü' },
  { lv: 20, mat: 'Zehirli', sword: 'Zehirdiş', staff: 'Zümrüt Asa', armor: 'Kertenkele Zırhı', ring: 'Zümrüt Yüzük' },
  { lv: 25, mat: 'Kum', sword: 'Kum Kılıcı', staff: 'Güneş Asası', armor: 'Bronz Zırh', ring: 'Kehribar Yüzük' },
  { lv: 30, mat: 'Firavun', sword: 'Firavun Palası', staff: 'Akrep Asası', armor: 'Altın Pullu Zırh', ring: 'Firavun Mührü' },
  { lv: 36, mat: 'Buz', sword: 'Buzkesen', staff: 'Kırağı Asası', armor: 'Kürk Zırh', ring: 'Buz Yüzüğü' },
  { lv: 42, mat: 'Ayaz', sword: 'Ayaz Kılıcı', staff: 'Kutup Asası', armor: 'Buzul Zırhı', ring: 'Kar Kristali' },
  { lv: 48, mat: 'Lav', sword: 'Lav Kılıcı', staff: 'Magma Asası', armor: 'Obsidyen Zırh', ring: 'Kor Yüzüğü' },
  { lv: 55, mat: 'Volkan', sword: 'Volkan Palası', staff: 'Yanardağ Asası', armor: 'Ateştaşı Zırh', ring: 'Alev Mührü' },
  { lv: 62, mat: 'Fırtına', sword: 'Fırtına Kılıcı', staff: 'Yıldırım Asası', armor: 'Gök Zırhı', ring: 'Şimşek Yüzüğü' },
  { lv: 70, mat: 'Ejder', sword: 'Ejder Dişi', staff: 'Ejder Asası', armor: 'Ejder Pulu Zırh', ring: 'Ejder Gözü' },
  { lv: 78, mat: 'Gölge', sword: 'Gölge Kılıcı', staff: 'Hiçlik Asası', armor: 'Gölge Zırhı', ring: 'Hiçlik Yüzüğü' },
  { lv: 86, mat: 'Yıldız', sword: 'Yıldız Kılıcı', staff: 'Göksel Asa', armor: 'Yıldız Zırhı', ring: 'Yıldız Yüzüğü' },
  { lv: 94, mat: 'Efsane', sword: 'Efsane Kılıcı', staff: 'Efsane Asası', armor: 'Efsane Zırhı', ring: 'Efsane Yüzüğü' },
];
export const tierFor = (lv) => [...TIERS].reverse().find((t) => lv >= t.lv) || TIERS[0];

// Enhancement success chance per target level (+1 … +10)
export const PLUS_CHANCE = [1, 1, 0.95, 0.85, 0.7, 0.55, 0.45, 0.35, 0.25, 0.16, 0.1];
export const plusCost = (item) => Math.floor(40 * Math.pow(item.plus + 1, 1.9) * (1 + item.lv / 4));

let uid = 1;
// Equipment slots. Mages have no shield. Each slot gives its own stats (per item tier level, times rarity).
export const SLOTS = [
  { id: 'weapon', name: 'Silah', icon: '🗡️' },
  { id: 'shield', name: 'Kalkan', icon: '🛡️', knightOnly: true },
  { id: 'chest', name: 'Üst Zırh', icon: '🥋' },
  { id: 'legs', name: 'Alt Zırh', icon: '👖' },
  { id: 'ring', name: 'Yüzük', icon: '💍' },
  { id: 'necklace', name: 'Kolye', icon: '📿' },
  { id: 'bracelet', name: 'Bileklik', icon: '🔗' },
];
export const SLOT = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
export const slotsFor = (cls) => SLOTS.filter((s) => !(s.knightOnly && cls !== 'knight'));
// Random loot slot the class can use (weapons a bit more common).
export function randomSlot(cls) {
  const pool = ['weapon', 'weapon', ...slotsFor(cls).map((s) => s.id).filter((id) => id !== 'weapon')];
  return pool[Math.floor(Math.random() * pool.length)];
}
const SLOT_NOUN = { shield: 'Kalkan', legs: 'Bacaklık', necklace: 'Kolye', bracelet: 'Bileklik' };
export function makeItem(slot, lv, rarity, cls) {
  if (slot === 'armor') slot = 'chest';
  const t = tierFor(lv);
  const r = RARITY[rarity];
  const L = t.lv, k = r.mul;
  const it = { uid: Date.now().toString(36) + (uid++), slot, lv: L, rarity, plus: 0 };
  const R = Math.round;
  if (slot === 'weapon') {
    const wt = CLASSES[cls]?.weaponType || 'sword';
    it.name = t[wt] || `${t.mat} ${WEAPON_NOUN[wt]}`; it.wtype = wt; it.atk = R((6 + L * 3.2) * k);
  } else if (slot === 'chest') { it.name = t.armor; it.def = R((3 + L * 2.2) * k); }
  else if (slot === 'ring') { it.name = t.ring; it.hp = R((15 + L * 9) * k); }
  else if (slot === 'shield') { it.name = `${t.mat} ${SLOT_NOUN.shield}`; it.def = R((2 + L * 1.4) * k); it.hp = R((5 + L * 3) * k); }
  else if (slot === 'legs') { it.name = `${t.mat} ${SLOT_NOUN.legs}`; it.def = R((2 + L * 1.5) * k); }
  else if (slot === 'necklace') { it.name = `${t.mat} ${SLOT_NOUN.necklace}`; it.mp = R((10 + L * 4) * k); it.hp = R((8 + L * 4) * k); }
  else if (slot === 'bracelet') { it.name = `${t.mat} ${SLOT_NOUN.bracelet}`; it.atk = R((2 + L * 1.2) * k); }
  return it;
}
export const itemStat = (it) => {
  const m = 1 + it.plus * 0.12, R = Math.round;
  return { atk: R((it.atk || 0) * m), def: R((it.def || 0) * m), hp: R((it.hp || 0) * m), mp: R((it.mp || 0) * m) };
};
// One number to compare two items of a slot.
export const itemScore = (it) => { const s = itemStat(it); return s.atk * 3 + s.def * 2 + s.hp * 0.35 + s.mp * 0.3; };
export const STAT_NAMES = { atk: 'Saldırı', def: 'Savunma', hp: 'Can', mp: 'Mana' };
// Old saves had one 'armor' slot: it became the chest piece.
export function migrateSave(s) {
  if (!s) return s;
  s.equip ||= {};
  if (s.equip.armor) { s.equip.chest ||= s.equip.armor; delete s.equip.armor; }
  for (const sl of SLOTS) if (!(sl.id in s.equip)) s.equip[sl.id] = null;
  for (const it of [...(s.bag || []), ...Object.values(s.equip)]) if (it && it.slot === 'armor') it.slot = 'chest';
  s.bagMax ||= 24; s.buffs ||= {};
  return s;
}
export const sellPrice = (it) => Math.floor((8 + it.lv * 6) * (1 + it.rarity * 1.5) * (1 + it.plus * 0.5));

export const SHOP = [
  { id: 'hp', name: 'Can İksiri', icon: '🧪', price: 12, desc: 'Canın %40\'ını yeniler.' },
  { id: 'mp', name: 'Mana İksiri', icon: '💧', price: 12, desc: 'Mananın %45\'ini yeniler.' },
];
export const potionPrice = (lv) => Math.round(10 + lv * 2);
// Timed elixirs (minutes of real play) bought from merchants.
export const ELIXIRS = [
  { id: 'xp', name: 'Bilgelik İksiri', icon: '📘', desc: '%50 daha fazla deneyim', mins: 15, base: 80, per: 22 },
  { id: 'atk', name: 'Öfke İksiri', icon: '🔥', desc: '%20 daha fazla saldırı', mins: 10, base: 60, per: 18 },
  { id: 'def', name: 'Taş Deri İksiri', icon: '🪨', desc: '%20 daha fazla savunma', mins: 10, base: 60, per: 18 },
  { id: 'gold', name: 'Talih İksiri', icon: '🍀', desc: '%50 daha fazla altın', mins: 15, base: 70, per: 20 },
];
export const elixirPrice = (e, lv) => Math.round(e.base + e.per * lv);
export const chestPrice = (lv) => Math.round(60 + lv * 35);
export const bagPrice = (max) => [400, 1500, 5000, 15000][Math.round((max - 24) / 6)] ?? null; // 24 → 48 slots
export const travelPrice = (lv) => Math.round(5 + lv * 1.5);
export const scrollPrice = (lv) => Math.round(15 + lv * 1.2);

// ---------- mounts ----------
// Bought from merchants; ridden for extra move speed (dismounts when fighting). seat = rider height as a share of the model's height.
export const MOUNTS = [
  { id: 'wolf', name: 'Sadık Köpek', icon: '🐕', model: 'Blob_Dog', h: 1.7, seat: 0.62, speed: 0.35, price: 1500, lv: 5 },
  { id: 'chicken', name: 'Dev Tavuk', icon: '🐔', model: 'Blob_Chicken', h: 2.1, seat: 0.6, speed: 0.5, price: 15000, lv: 25 },
  { id: 'alpaca', name: 'Uçan Alpaka', icon: '🦙', model: 'Flying_Alpaking', h: 2.2, seat: 0.62, speed: 0.7, price: 80000, lv: 50 },
];
export const MOUNT = Object.fromEntries(MOUNTS.map((m) => [m.id, m]));

// ---------- achievements & titles ----------
const st = (s) => s.stats || {};
const bk = (s, id) => (st(s).bk || {})[id] || 0;
export const ACHIEVEMENTS = [
  { id: 'k100', name: 'Avcı', desc: '100 canavar öldür', title: 'Avcı', p: (s) => [st(s).kills || 0, 100] },
  { id: 'k1000', name: 'Kasap', desc: '1.000 canavar öldür', title: 'Kasap', p: (s) => [st(s).kills || 0, 1000] },
  { id: 'k10000', name: 'Kıyamet', desc: '10.000 canavar öldür', title: 'Kıyamet Getiren', p: (s) => [st(s).kills || 0, 10000] },
  { id: 'u1', name: 'İlk Kan', desc: 'Bir boss yen', title: null, p: (s) => [st(s).uniques || 0, 1] },
  { id: 'u25', name: 'Boss Avcısı', desc: '25 boss yen', title: 'Boss Avcısı', p: (s) => [st(s).uniques || 0, 25] },
  { id: 'u100', name: 'Kâbus', desc: '100 boss yen', title: 'Kâbus', p: (s) => [st(s).uniques || 0, 100] },
  { id: 'morvath', name: 'Vadinin Kurtarıcısı', desc: 'Kemik Lordu Morvath\'ı yen', title: 'Vadinin Kurtarıcısı', p: (s) => [bk(s, 'morvath'), 1] },
  { id: 'ignarok', name: 'Ejder Avcısı', desc: 'Ejder Kral Ignarok\'u yen', title: 'Ejder Avcısı', p: (s) => [bk(s, 'ignarok'), 1] },
  { id: 'lv25', name: 'Tecrübeli', desc: '25. seviyeye ulaş', title: 'Tecrübeli', p: (s) => [s.level, 25] },
  { id: 'lv50', name: 'Usta', desc: '50. seviyeye ulaş', title: 'Usta', p: (s) => [s.level, 50] },
  { id: 'lv100', name: 'Efsane', desc: '100. seviyeye ulaş', title: 'Efsane', p: (s) => [s.level, 100] },
  { id: 'maps', name: 'Gezgin', desc: '8 haritanın hepsine git', title: 'Gezgin', p: (s) => [(s.visited || ['vadi']).length, 8] },
  { id: 'q50', name: 'Kahraman', desc: '50 görev tamamla', title: 'Kahraman', p: (s) => [(s.quests?.done || []).length, 50] },
  { id: 'd1', name: 'Düellocu', desc: 'Bir düello kazan', title: 'Düellocu', p: (s) => [st(s).duelWins || 0, 1] },
  { id: 'd25', name: 'Gladyatör', desc: '25 düello kazan', title: 'Gladyatör', p: (s) => [st(s).duelWins || 0, 25] },
  { id: 'd100', name: 'Arena Şampiyonu', desc: '100 düello kazan', title: 'Arena Şampiyonu', p: (s) => [st(s).duelWins || 0, 100] },
  { id: 'p7', name: 'Örsün Dostu', desc: 'Bir eşyayı +7 yap', title: 'Örsün Dostu', p: (s) => [st(s).maxPlus || 0, 7] },
  { id: 'p10', name: 'Usta Demirci', desc: 'Bir eşyayı +10 yap', title: 'Usta Demirci', p: (s) => [st(s).maxPlus || 0, 10] },
  { id: 'g100k', name: 'Zengin', desc: '100.000 altın biriktir', title: 'Zengin', p: (s) => [s.gold, 100000] },
  { id: 'g1m', name: 'Altın Babası', desc: '1.000.000 altın biriktir', title: 'Altın Babası', p: (s) => [s.gold, 1000000] },
  { id: 't10', name: 'Tüccar', desc: '10 takas yap', title: 'Tüccar', p: (s) => [st(s).trades || 0, 10] },
  { id: 'mount', name: 'Süvari', desc: 'Bir binek satın al', title: 'Süvari', p: (s) => [(s.mounts || []).length, 1] },
  { id: 'mount3', name: 'Ahır Sahibi', desc: 'Bütün binekleri topla', title: 'Hayvan Dostu', p: (s) => [(s.mounts || []).length, MOUNTS.length] },
];
export const ACH = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
