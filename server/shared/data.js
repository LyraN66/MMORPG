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
    ],
  },
};

// Zones run from the camp in the south (z ≈ +70) to the temple in the north (z ≈ -80).
export const ZONES = [
  { id: 'camp', name: 'Sürgün Kampı', zMin: 52, zMax: 999, lv: [0, 0], fog: 0x2a2f3a, tint: 0x6f8a4a },
  { id: 'forest', name: 'Solgun Orman', zMin: 10, zMax: 52, lv: [1, 4], fog: 0x2d2f36, tint: 0x6b7d3f },
  { id: 'graves', name: 'Kırık Mezarlık', zMin: -32, zMax: 10, lv: [4, 8], fog: 0x29283a, tint: 0x5d5a3c },
  { id: 'temple', name: 'Kemik Tapınağı', zMin: -999, zMax: -32, lv: [8, 13], fog: 0x2b1f2e, tint: 0x4d4238 },
];
export const zoneAt = (z) => ZONES.find((zn) => z >= zn.zMin && z < zn.zMax) || ZONES[1];

export const ENEMIES = {
  minion: { name: 'Kemik Er', model: 'skel_minion', weapon: 'sk_blade', offhand: null, hp: 1.0, atk: 1.0, def: 1.0, speed: 3.6, range: 2.0, atkTime: 1.5, xp: 1.0, aggro: 8 },
  rogue: { name: 'Kemik Haydut', model: 'skel_rogue', weapon: 'dagger', offhand: 'dagger', hp: 0.85, atk: 1.15, def: 0.8, speed: 4.6, range: 1.9, atkTime: 1.05, xp: 1.15, aggro: 9 },
  warrior: { name: 'Kemik Muhafız', model: 'skel_warrior', weapon: 'sk_axe', offhand: 'sk_shield_l', hp: 1.6, atk: 1.25, def: 1.6, speed: 3.2, range: 2.2, atkTime: 1.7, xp: 1.5, aggro: 8 },
  mage: { name: 'Kemik Kâhin', model: 'skel_mage', weapon: 'sk_staff', offhand: null, hp: 0.75, atk: 1.2, def: 0.6, speed: 3.3, range: 9, atkTime: 2.1, xp: 1.3, aggro: 11, ranged: true },
};

export const UNIQUES = {
  gorran: {
    id: 'gorran', name: 'Çürük Kral Gorran', type: 'warrior', model: 'skel_warrior', weapon: 'axe_2h', offhand: null,
    level: 7, hpMul: 6, atkMul: 1.5, scale: 1.75, respawn: 150, firstSpawn: 25, pos: [-24, -8], zone: 'Kırık Mezarlık',
    tint: 0x5cff7a, xpMul: 14, gold: 380,
  },
  morvath: {
    id: 'morvath', name: 'Kemik Lordu Morvath', type: 'warrior', model: 'skel_warrior', weapon: 'sword_2h', offhand: null,
    level: 13, hpMul: 10, atkMul: 1.7, scale: 2.25, respawn: 300, firstSpawn: 60, pos: [0, -86], zone: 'Kemik Tapınağı',
    tint: 0xff3b3b, xpMul: 30, gold: 1500,
  },
};

// Enemy spawn camps: [x, z, type, count, levelMin, levelMax]
export const CAMPS = [
  [-14, 40, 'minion', 3, 1, 2], [12, 34, 'minion', 3, 1, 2], [-26, 24, 'minion', 4, 2, 3], [22, 18, 'minion', 3, 2, 4],
  [0, 22, 'minion', 3, 2, 3], [-10, 16, 'rogue', 2, 3, 4], [30, 44, 'minion', 2, 1, 2],
  [-30, 2, 'rogue', 3, 4, 5], [18, 0, 'minion', 3, 4, 5], [7, -12, 'rogue', 3, 5, 6], [-16, -20, 'mage', 2, 5, 7],
  [26, -18, 'rogue', 3, 6, 7], [-34, -26, 'minion', 4, 6, 7], [10, -26, 'mage', 2, 6, 8],
  [-22, -42, 'warrior', 2, 8, 9], [20, -44, 'warrior', 2, 8, 9], [0, -50, 'mage', 3, 9, 10], [-30, -60, 'warrior', 3, 10, 11],
  [28, -62, 'mage', 2, 10, 11], [-10, -68, 'warrior', 2, 11, 12], [14, -72, 'warrior', 2, 11, 12],
];

export const xpToNext = (lv) => Math.floor(40 * Math.pow(lv, 1.75) + 30);
export const MAX_LEVEL = 30;

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
