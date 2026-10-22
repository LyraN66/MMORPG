// Map registry. Each map is a separate valley with its own zones, monster camps, bosses, outposts
// and quest chain; players travel between them through the portal in each map's camp.
export const MAPS = [
  {
    id: 'vadi', order: 1, name: 'Kemik Vadisi', lv: [1, 13], layout: 'vadi', seed: 1337,
    bounds: { minX: -46, maxX: 46, minZ: -98, maxZ: 76 },
    road: { a1: 5.5, f1: 0.045, a2: 2, f2: 0.11 },
    terrain: { amp: 1, flats: [[0, 63, 16], [0, -88, 18]], edgeX: 38, edgeZmax: 68, edgeZmin: -90 },
    camp: [0, 63], crypt: [0, -93], spawn: [0, 59],
    portal: { x: 12, z: 70.5 }, arena: [-24, -8], theme: 'bones',
    sky: { top: 0x0b1026, mid: 0x3a2d4f, bot: 0xc46a3d },
    zones: [
      { id: 'camp', name: 'Sürgün Kampı', zMin: 52, zMax: 999, lv: [0, 0], fog: 0x2a2f3a, tint: 0x6f8a4a },
      { id: 'forest', name: 'Solgun Orman', zMin: 10, zMax: 52, lv: [1, 4], fog: 0x2d2f36, tint: 0x6b7d3f },
      { id: 'graves', name: 'Kırık Mezarlık', zMin: -32, zMax: 10, lv: [4, 8], fog: 0x29283a, tint: 0x5d5a3c },
      { id: 'temple', name: 'Kemik Tapınağı', zMin: -999, zMax: -32, lv: [8, 13], fog: 0x2b1f2e, tint: 0x4d4238 },
    ],
    // [x, z, type, count, levelMin, levelMax]
    camps: [
      [-14, 40, 'minion', 3, 1, 2], [12, 34, 'minion', 3, 1, 2], [-26, 24, 'minion', 4, 2, 3], [22, 18, 'minion', 3, 2, 4],
      [0, 22, 'minion', 3, 2, 3], [-10, 16, 'rogue', 2, 3, 4], [30, 44, 'minion', 2, 1, 2],
      [-30, 2, 'rogue', 3, 4, 5], [18, 0, 'minion', 3, 4, 5], [7, -12, 'rogue', 3, 5, 6], [-16, -20, 'mage', 2, 5, 7],
      [26, -18, 'rogue', 3, 6, 7], [-34, -26, 'minion', 4, 6, 7], [10, -26, 'mage', 2, 6, 8],
      [-22, -42, 'warrior', 2, 8, 9], [20, -44, 'warrior', 2, 8, 9], [0, -50, 'mage', 3, 9, 10], [-30, -60, 'warrior', 3, 10, 11],
      [28, -62, 'mage', 2, 10, 11], [-10, -68, 'warrior', 2, 11, 12], [14, -72, 'warrior', 2, 11, 12],
    ],
    uniques: ['gorran', 'morvath'],
    // Safe zones: the starting camp and an outpost in each dangerous zone (quest giver, blacksmith, merchant).
    outposts: [
      { id: 'camp', name: 'Sürgün Kampı', x: 0, z: 63, r: 17,
        npcs: [{ role: 'smith', name: 'Demirci Haldun', x: 7.5, z: 57.3 }, { role: 'merchant', name: 'Tüccar Zerrin', x: -7.5, z: 55.2 }, { role: 'quest', name: 'Gözcü Kaan', x: -3.2, z: 52.6 }] },
      { id: 'graves', name: 'Mezarlık Karakolu', x: 3, z: 4.5, r: 9,
        npcs: [{ role: 'quest', name: 'Gözcü Ayla', x: 0, z: 1.5 }, { role: 'smith', name: 'Demirci Bora', x: 6.5, z: 2 }, { role: 'merchant', name: 'Tüccar Nazlı', x: -0.5, z: 7.5 }] },
      { id: 'temple', name: 'Tapınak Karakolu', x: -4.5, z: -33, r: 9,
        npcs: [{ role: 'quest', name: 'Gözcü Tarık', x: -7.5, z: -36 }, { role: 'smith', name: 'Demirci Kerem', x: -1, z: -35.5 }, { role: 'merchant', name: 'Tüccar Leyla', x: -8, z: -30 }] },
    ],
  },
];

// ---------- maps 2–8: generated on the same valley plan as Kemik Vadisi ----------
// Every map runs north→south: camp + portal, three zones of rising level, two outposts, a mid boss arena and
// the final boss lair. Monster roles: a = weak melee, b = tank, c = fast, d = ranged (same slots as the skeletons).
const VADI = MAPS[0];
const ROLE = { minion: 'a', warrior: 'b', rogue: 'c', mage: 'd' };
function genMap(o) {
  const [L0, L1] = o.lv, mx = o.mirror ? -1 : 1, R = (n) => Math.round(n);
  const lvl = (v) => R(L0 + (v - 1) * (L1 - 1 - L0) / 11); // vadi levels 1..12 → this map's range
  const camps = VADI.camps.map(([x, z, t, n, a, b]) => [x * mx, z, o.mobs[ROLE[t]], n, lvl(a), lvl(b)]);
  const span = L1 - L0;
  const zones = [
    { id: 'camp', name: o.zones[0], zMin: 52, zMax: 999, lv: [0, 0], fog: o.fog[0], tint: o.tint[0] },
    { id: 'z1', name: o.zones[1], zMin: 10, zMax: 52, lv: [L0, R(L0 + span * 0.33)], fog: o.fog[1], tint: o.tint[1] },
    { id: 'z2', name: o.zones[2], zMin: -32, zMax: 10, lv: [R(L0 + span * 0.33), R(L0 + span * 0.66)], fog: o.fog[2], tint: o.tint[2] },
    { id: 'z3', name: o.zones[3], zMin: -999, zMax: -32, lv: [R(L0 + span * 0.66), L1], fog: o.fog[3], tint: o.tint[3] },
  ];
  const np = o.npcs;
  const outposts = [
    { id: 'camp', name: o.zones[0], x: 0, z: 63, r: 17,
      npcs: [{ role: 'smith', name: np[0], x: 7.5, z: 57.3 }, { role: 'merchant', name: np[1], x: -7.5, z: 55.2 }, { role: 'quest', name: np[2], x: -3.2, z: 52.6 }] },
    { id: 'o2', name: o.posts[0], x: 3 * mx, z: 4.5, r: 9,
      npcs: [{ role: 'quest', name: np[3], x: 0, z: 1.5 }, { role: 'smith', name: np[4], x: 6.5 * mx, z: 2 }, { role: 'merchant', name: np[5], x: -0.5 * mx, z: 7.5 }] },
    { id: 'o3', name: o.posts[1], x: -4.5 * mx, z: -33, r: 9,
      npcs: [{ role: 'quest', name: np[6], x: -7.5 * mx, z: -36 }, { role: 'smith', name: np[7], x: -1 * mx, z: -35.5 }, { role: 'merchant', name: np[8], x: -8 * mx, z: -30 }] },
  ];
  return {
    id: o.id, order: o.order, name: o.name, lv: o.lv, layout: 'gen', seed: o.seed, theme: o.theme, mirror: !!o.mirror,
    bounds: VADI.bounds, road: o.road, terrain: { ...VADI.terrain, amp: o.amp ?? 1 },
    camp: VADI.camp, crypt: VADI.crypt, spawn: VADI.spawn, portal: VADI.portal, arena: [-24 * mx, -8],
    sky: o.sky, zones, camps, uniques: o.uniques, outposts, mobs: o.mobs, story: o.story,
  };
}

MAPS.push(
  genMap({ id: 'bataklik', order: 2, name: 'Zehirli Bataklık', lv: [13, 25], seed: 2025, theme: 'swamp',
    road: { a1: 7, f1: 0.05, a2: 2.5, f2: 0.13 }, amp: 0.7,
    zones: ['Sazlık Kampı', 'Çürük Sazlık', 'Zehir Gölü', 'Spor Tapınağı'], posts: ['Göl Karakolu', 'Spor Karakolu'],
    mobs: { a: 'slime', b: 'spiky', c: 'mushnub', d: 'frog' }, uniques: ['sporla', 'miselyum'],
    npcs: ['Demirci Rüstem', 'Tüccar Meltem', 'Gözcü Doğan', 'Gözcü Sevgi', 'Demirci Cemal', 'Tüccar Hülya', 'Gözcü Murat', 'Demirci Ozan', 'Tüccar Sibel'],
    sky: { top: 0x07140f, mid: 0x1f3a2a, bot: 0x7a9a4a }, fog: [0x1d2a22, 0x1e2b20, 0x1f2a1c, 0x22261e], tint: [0x4f6a3a, 0x48663a, 0x3f5a32, 0x4a4a36] }),
  genMap({ id: 'col', order: 3, name: 'Kızıl Çöl', lv: [25, 37], seed: 3131, theme: 'desert', mirror: true,
    road: { a1: 4, f1: 0.04, a2: 3, f2: 0.09 }, amp: 1.4,
    zones: ['Vaha Kampı', 'Kavrulmuş Kumlar', 'Kavrulmuş Vadi', 'Güneş Sunağı'], posts: ['Kervan Karakolu', 'Sunak Karakolu'],
    mobs: { a: 'cactling', b: 'cactoro', c: 'armabee', d: 'shaman' }, uniques: ['zirhkanat', 'monkrus'],
    npcs: ['Demirci Kadir', 'Tüccar Yasemin', 'Gözcü Selim', 'Gözcü Derya', 'Demirci Halil', 'Tüccar Ece', 'Gözcü Baran', 'Demirci Yavuz', 'Tüccar Nur'],
    sky: { top: 0x1a2a5a, mid: 0xc8784a, bot: 0xffc27a }, fog: [0x8a6a4a, 0x9a7048, 0x946444, 0x7a4a3a], tint: [0xc8a06a, 0xd2a868, 0xc89458, 0xa8704a] }),
  genMap({ id: 'buzul', order: 4, name: 'Ayaz Zirvesi', lv: [37, 50], seed: 4444, theme: 'snow',
    road: { a1: 6, f1: 0.045, a2: 2, f2: 0.12 }, amp: 1.3,
    zones: ['Ocak Kampı', 'Karlı Çamlık', 'Kırağı Geçidi', 'Donmuş Taht'], posts: ['Geçit Karakolu', 'Taht Karakolu'],
    mobs: { a: 'yetiling', b: 'birb', c: 'bunny', d: 'alpaking' }, uniques: ['yunbas', 'yortun'],
    npcs: ['Demirci Erkan', 'Tüccar Gül', 'Gözcü Kaya', 'Gözcü Buket', 'Demirci Tuncay', 'Tüccar Aslı', 'Gözcü Volkan', 'Demirci Ferhat', 'Tüccar Pınar'],
    sky: { top: 0x10203a, mid: 0x5a7aa8, bot: 0xd8e8ff }, fog: [0x8a98b0, 0x93a2ba, 0x8c9cb8, 0x7a88a8], tint: [0xdfe8f0, 0xe8eef6, 0xd8e2ee, 0xc8d4e4] }),
  genMap({ id: 'volkan', order: 5, name: 'Kül Diyarı', lv: [50, 62], seed: 5050, theme: 'lava', mirror: true,
    road: { a1: 5, f1: 0.05, a2: 3, f2: 0.1 }, amp: 1.5,
    zones: ['Kor Kampı', 'Kül Ovası', 'Lav Nehri', 'Kül Kalesi'], posts: ['Nehir Karakolu', 'Kale Karakolu'],
    mobs: { a: 'orcling', b: 'orcskull', c: 'orc', d: 'goleling' }, uniques: ['magmus', 'azgar'],
    npcs: ['Demirci Demir', 'Tüccar Ateş', 'Gözcü Korhan', 'Gözcü Alev', 'Demirci Çelik', 'Tüccar Közde', 'Gözcü Yalaz', 'Demirci Tunç', 'Tüccar Ceren'],
    sky: { top: 0x0a0505, mid: 0x4a1a12, bot: 0xff5a2a }, fog: [0x2a1a16, 0x2e1a14, 0x341a12, 0x2a1210], tint: [0x4a3a34, 0x3e322e, 0x3a2a26, 0x2e2220] }),
  genMap({ id: 'kiyi', order: 6, name: 'Batık Kıyı', lv: [62, 74], seed: 6262, theme: 'coast',
    road: { a1: 6.5, f1: 0.04, a2: 2.5, f2: 0.12 }, amp: 0.8,
    zones: ['Liman Kampı', 'Kumlu Koy', 'Mercan Mağarası', 'Batık Tapınak'], posts: ['Koy Karakolu', 'Tapınak Karakolu'],
    mobs: { a: 'fishling', b: 'fishman', c: 'squidle', d: 'glub' }, uniques: ['glubora', 'rex'],
    npcs: ['Demirci Deniz', 'Tüccar Ayşe', 'Gözcü Kaptan Rıza', 'Gözcü Mercan', 'Demirci Poyraz', 'Tüccar İnci', 'Gözcü Levent', 'Demirci Barış', 'Tüccar Ada'],
    sky: { top: 0x0a2040, mid: 0x3a8ab0, bot: 0xbfe8e0 }, fog: [0x4a7888, 0x4a8090, 0x3a7088, 0x2a5070], tint: [0xd8c48e, 0xe0cc94, 0x6aa08a, 0x4a7a7a] }),
  genMap({ id: 'hayalet', order: 7, name: 'Hayalet Ormanı', lv: [74, 86], seed: 7373, theme: 'ghost', mirror: true,
    road: { a1: 6, f1: 0.055, a2: 2, f2: 0.14 }, amp: 1.1,
    zones: ['Fener Kampı', 'Sisli Orman', 'Sisli Mezar', 'Ruhlar Kapısı'], posts: ['Mezar Karakolu', 'Kapı Karakolu'],
    mobs: { a: 'ghost', b: 'hywirl', c: 'ninja', d: 'wraith' }, uniques: ['nekra', 'vorgath'],
    npcs: ['Demirci Gölge', 'Tüccar Sis', 'Gözcü Ruhi', 'Gözcü Ayşın', 'Demirci Karan', 'Tüccar Melek', 'Gözcü Sezgin', 'Demirci Kurt', 'Tüccar Yıldız'],
    sky: { top: 0x080614, mid: 0x2a1f4a, bot: 0x6a4a9a }, fog: [0x221c33, 0x241d38, 0x221a36, 0x1c1430], tint: [0x4a4a5a, 0x3e4a48, 0x44405a, 0x3a3048] }),
  genMap({ id: 'ejder', order: 8, name: 'Ejder Zirvesi', lv: [86, 100], seed: 8888, theme: 'dragon',
    road: { a1: 5, f1: 0.05, a2: 3, f2: 0.11 }, amp: 1.6,
    zones: ['Son Kamp', 'Yanık Yamaçlar', 'Düşen Yıldız Krateri', 'Ejder Yuvası'], posts: ['Krater Karakolu', 'Yuva Karakolu'],
    mobs: { a: 'drake', b: 'masked', c: 'assassin', d: 'xeno' }, uniques: ['zorg', 'ignarok'],
    npcs: ['Usta Demirci Efe', 'Tüccar Lale', 'Gözcü Bilge', 'Gözcü Şahin', 'Demirci Kartal', 'Tüccar Nehir', 'Gözcü Ejderhan', 'Demirci Atlas', 'Tüccar Dilara'],
    sky: { top: 0x12050a, mid: 0x5a1a2a, bot: 0xff8a4a }, fog: [0x2a1a1e, 0x301a1a, 0x2a1a2a, 0x301010], tint: [0x5a4a44, 0x5a3e34, 0x4a3a44, 0x4a2a24] }),
);

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
export const nextMap = (id) => MAPS.find((m) => m.order === mapById(id).order + 1) || null;
