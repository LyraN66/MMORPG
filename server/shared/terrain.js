// World layout shared by the game client and the server: terrain height, road, props and colliders.
// Everything is deterministic so every player and the server build the identical valley.
// makeTerrain(map) builds the functions for one map; the exports below follow the client's active map.
import { MAPS, mapById } from './maps.js';

export const smoothstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function makeTerrain(map) {
  const B = map.bounds, R = map.road, P = map.terrain;
  const roadX = (z) => R.a1 * Math.sin(z * R.f1) + R.a2 * Math.sin(z * R.f2);
  const heightAt = (x, z) => {
    let h = 0.55 * Math.sin(x * 0.075 + 1.3) * Math.cos(z * 0.062) + 0.35 * Math.sin(x * 0.16 + z * 0.12) + 0.2 * Math.cos(x * 0.31 - z * 0.27);
    h *= P.amp;
    h *= smoothstep(Math.abs(x - roadX(z)), 1.5, 8);
    for (const [cx, cz, r] of P.flats) h *= smoothstep(Math.hypot(x - cx, z - cz), r * 0.6, r);
    const ex = Math.max(0, Math.abs(x) - P.edgeX), ez = Math.max(0, z - P.edgeZmax, P.edgeZmin - z);
    h += (ex * ex + ez * ez) * 0.08;
    return h;
  };
  const OUTPOSTS = map.outposts;
  const safeAt = (x, z) => OUTPOSTS.find((o) => Math.hypot(x - o.x, z - o.z) < o.r) || null;
  const nearestOutpost = (x, z) => OUTPOSTS.reduce((a, o) => (Math.hypot(x - o.x, z - o.z) < Math.hypot(x - a.x, z - a.z) ? o : a));
  const T = { map, BOUNDS: B, roadX, heightAt, OUTPOSTS, safeAt, nearestOutpost };
  T.generateLayout = () => LAYOUTS[map.layout](T);
  return T;
}

// ----- client-side "active map" facade (live bindings) -----
let T = makeTerrain(MAPS[0]);
export let BOUNDS = T.BOUNDS, OUTPOSTS = T.OUTPOSTS, CAMP = T.map.camp, CRYPT = T.map.crypt, ACTIVE_MAP = T.map;
export const roadX = (z) => T.roadX(z);
export const heightAt = (x, z) => T.heightAt(x, z);
export const safeAt = (x, z) => T.safeAt(x, z);
export const nearestOutpost = (x, z) => T.nearestOutpost(x, z);
export const generateLayout = () => T.generateLayout();
export function useTerrain(id) {
  T = makeTerrain(mapById(id));
  BOUNDS = T.BOUNDS; OUTPOSTS = T.OUTPOSTS; CAMP = T.map.camp; CRYPT = T.map.crypt; ACTIVE_MAP = T.map;
  return T;
}

// Circle colliders on a coarse grid.
export class Colliders {
  constructor(T) { this.T = T; this.list = []; this.grid = new Map(); }
  add(x, z, r) {
    const c = { x, z, r }; this.list.push(c);
    for (let gx = Math.floor((x - r) / 6); gx <= Math.floor((x + r) / 6); gx++)
      for (let gz = Math.floor((z - r) / 6); gz <= Math.floor((z + r) / 6); gz++) {
        const k = gx + ',' + gz; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(c);
      }
  }
  // Push a circle out of colliders and keep it inside the valley. pos: {x, y, z}
  resolve(pos, r) {
    const list = this.grid.get(Math.floor(pos.x / 6) + ',' + Math.floor(pos.z / 6));
    if (list) for (const c of list) {
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 1e-4) { pos.x = c.x + (dx / d) * m; pos.z = c.z + (dz / d) * m; }
    }
    const B = this.T.BOUNDS;
    pos.x = clamp(pos.x, B.minX + 4, B.maxX - 4);
    pos.z = clamp(pos.z, B.minZ + 5, B.maxZ - 4);
    pos.y = this.T.heightAt(pos.x, pos.z);
  }
  blocked(x, z, r) {
    const list = this.grid.get(Math.floor(x / 6) + ',' + Math.floor(z / 6));
    return !!list && list.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r);
  }
}

// Hand-built layout of the first valley.
function layoutVadi(T) {
  const { BOUNDS, roadX, heightAt, OUTPOSTS } = T;
  const CAMPS = T.map.camps, CRYPT = T.map.crypt;
  const col = new Colliders(T);
  const flames = [];
  const addCollider = (x, z, r) => col.add(x, z, r);
  const addFlame = (x, y, z, size, big, color = 0xff8a3c) => flames.push({ x, y, z, size, big, color });
    const R = rng(T.map.seed);
    const P = [];
    const occupied = [];
    const free = (x, z, r) => {
      if (Math.abs(x - roadX(z)) < 3.6 + r) return false;
      if (x < BOUNDS.minX + 3 || x > BOUNDS.maxX - 3 || z < BOUNDS.minZ + 3 || z > BOUNDS.maxZ - 3) return false;
      for (const c of CAMPS) if (Math.hypot(x - c[0], z - c[1]) < 5.5 + r) return false;
      if (Math.hypot(x, z - 63) < 14) return false;
      if (Math.hypot(x, z + 86) < 14) return false;
      if (Math.hypot(x + 24, z + 8) < 8) return false; // unique arena
      for (const o of OUTPOSTS) if (o.id !== 'camp' && Math.hypot(x - o.x, z - o.z) < o.r + 1 + r) return false;
      return !occupied.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
    };
    const put = (name, x, z, { s = 1, ry = R() * Math.PI * 2, col = 0, noShadow = false, y } = {}) => {
      P.push({ name, x, z, y: y ?? heightAt(x, z) - 0.05, ry, s, noShadow });
      if (col) { addCollider(x, z, col * s); }
      occupied.push({ x, z, r: Math.max(0.6, col * s) });
    };
    const scatter = (names, n, zMin, zMax, opts) => {
      let tries = 0, placed = 0;
      while (placed < n && tries++ < n * 30) {
        const x = BOUNDS.minX + 3 + R() * (BOUNDS.maxX - BOUNDS.minX - 6), z = zMin + R() * (zMax - zMin);
        const r = (opts.col || 0.5) * (opts.s || 1);
        if (!free(x, z, r + (opts.gap || 0.5))) continue;
        const name = names[Math.floor(R() * names.length)];
        const s = (opts.s || 1) * (opts.sv ? 1 - opts.sv / 2 + R() * opts.sv : 1);
        put(name, x, z, { ...opts, s }); placed++;
      }
    };

    // --- Border mountains (Medieval Hexagon pack, scaled up) ---
    const mts = ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass'];
    for (let z = BOUNDS.minZ - 6; z <= BOUNDS.maxZ + 6; z += 11) {
      for (const side of [-1, 1]) put(mts[Math.floor(R() * 3)], side * (BOUNDS.maxX + 4 + R() * 5), z, { s: 11 + R() * 6, noShadow: true });
    }
    for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 11) {
      put(mts[Math.floor(R() * 3)], x, BOUNDS.minZ - 6 - R() * 4, { s: 12 + R() * 6, noShadow: true });
      put(mts[Math.floor(R() * 3)], x, BOUNDS.maxZ + 6 + R() * 4, { s: 11 + R() * 5, noShadow: true });
    }

    // --- Camp ---
    const camp = [
      ['banner_patternA_red', -9, 70, 0.3], ['banner_shield_red', 7, 76, -0.3], ['barrel_large', -11, 58, 0, 0.9], ['barrel_small_stack', -12, 61, 1.2, 0.9],
      ['crates_stacked', 11.5, 57, 0.4, 1.1], ['table_long_decorated_A', -7.5, 57.5, 1.57, 1.2], ['keg_decorated', -13, 66, 1.2, 1.3],
      ['chest_gold', -6, 55.5, 0.2, 0.8], ['coin_stack_large', -9.3, 55.5, 0.6, 0.6], ['sword_shield_gold', 7.5, 55, 0, 0], ['torch_lit', -4, 54, 0, 0],
      ['torch_lit', 4, 54, 0, 0], ['torch_lit', -4, 72, 0, 0], ['torch_lit', 4, 72, 0, 0], ['crates_stacked', 5.5, 74, 0.9, 1.1], ['barrel_large', 14, 61, 0, 0.9],
    ];
    for (const [n, x, z, ry, col] of camp) put(n, x, z, { ry, col });
    // Fence ring around camp with openings on the road
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
      const x = Math.sin(a) * 17.5, z = 63 + Math.cos(a) * 17.5;
      if (Math.abs(x - roadX(z)) < 5) continue;
      put(R() < 0.2 ? 'fence_broken' : 'fence', x, z, { ry: a + Math.PI / 2, col: 0 });
      addCollider(x, z, 1.3); addCollider(x + Math.cos(a) * 1.4, z - Math.sin(a) * 1.4, 0.7); addCollider(x - Math.cos(a) * 1.4, z + Math.sin(a) * 1.4, 0.7);
    }
    // Portal arch, opening towards the camp centre
    { const P = T.map.portal, c = T.map.camp, ry = Math.atan2(c[0] - P.x, c[1] - P.z);
      put('arch', P.x, P.z, { ry, s: 1.1 });
      for (const sgn of [-1, 1]) addCollider(P.x + Math.cos(ry) * 2.05 * sgn, P.z - Math.sin(ry) * 2.05 * sgn, 0.55); }
    // Campfire stones
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; put(['rock_single_A', 'rock_single_C', 'rock_single_D'][i % 3], Math.cos(a) * 1.3, 63 + Math.sin(a) * 1.3, { s: 2.6, noShadow: true }); }
    addCollider(0, 63, 1.4);
    addFlame(0, heightAt(0, 63) + 0.3, 63, 1.6, true);
    for (const [x, z] of [[-4, 54], [4, 54], [-4, 72], [4, 72]]) addFlame(x, heightAt(x, z) + 1.05, z, 0.5, false);

    // --- Outposts ---
    for (const o of OUTPOSTS) {
      if (o.id === 'camp') continue;
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; put(['rock_single_A', 'rock_single_C', 'rock_single_D'][i % 3], o.x + Math.cos(a) * 1.3, o.z + Math.sin(a) * 1.3, { s: 2.6, noShadow: true }); }
      addCollider(o.x, o.z, 1.4); addFlame(o.x, heightAt(o.x, o.z) + 0.3, o.z, 1.6, true);
      for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { put('torch_lit', o.x + dx, o.z + dz, { ry: 0 }); addFlame(o.x + dx, heightAt(o.x + dx, o.z + dz) + 1.05, o.z + dz, 0.5, false); }
      put('banner_patternA_red', o.x - 7, o.z, { ry: Math.PI / 2 }); put('banner_shield_red', o.x + 7.5, o.z + 1, { ry: -Math.PI / 2 });
      put('crates_stacked', o.x + 6.5, o.z + 6, { ry: 0.4, col: 1.1 }); put('barrel_large', o.x - 6.5, o.z + 5.5, { ry: 0, col: 0.9 });
      put('barrel_small_stack', o.x - 6.5, o.z - 4, { ry: 1.2, col: 0.9 }); put('chest_gold', o.x + 2.5, o.z - 6, { ry: 0.2, col: 0.8 });
    }

    // --- Forest zone ---
    scatter(['tree_pine_orange_large', 'tree_pine_yellow_large', 'tree_pine_orange_medium', 'tree_pine_yellow_medium'], 95, 12, 50, { col: 0.8, sv: 0.4, gap: 1.2 });
    scatter(['tree_pine_orange_small', 'tree_dead_medium'], 30, 14, 52, { col: 0.5, sv: 0.3 });
    scatter(['trees_A_large', 'trees_B_large'], 20, 14, 50, { s: 4.5, col: 1.3, sv: 0.3 });
    scatter(['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_E'], 40, 10, 54, { s: 7, col: 0.9, sv: 0.6 });
    scatter(['pumpkin_orange_jackolantern', 'pumpkin_yellow'], 12, 12, 50, { col: 0.5, s: 0.9 });
    // Gate between forest and graveyard
    { const z = 10, x = roadX(z); put('arch_gate', x, z, { ry: 0 }); addCollider(x - 1.9, z, 0.5); addCollider(x + 1.9, z, 0.5);
      for (const dx of [-6, -10, -14, 6, 10, 14]) { put('fence', x + dx, z, { ry: 0 }); addCollider(x + dx, z, 0.9); } }

    // --- Graveyard zone ---
    for (let row = 0; row < 7; row++) for (let i = 0; i < 9; i++) {
      for (const side of [-1, 1]) {
        const x = side * (9 + i * 3.4) + (R() - 0.5), z = 4 - row * 5 + (R() - 0.5) * 1.5;
        if (!free(x, z, 1)) continue;
        if (R() < 0.35) continue;
        const n = ['grave_A', 'grave_B', 'grave_A_destroyed', 'gravestone', 'gravemarker_A', 'gravemarker_B'][Math.floor(R() * 6)];
        put(n, x, z, { ry: Math.PI + (R() - 0.5) * 0.4, col: n.startsWith('grave_') ? 0.9 : 0.45 });
      }
    }
    scatter(['tree_dead_large', 'tree_dead_large_decorated', 'tree_dead_medium', 'tree_dead_small'], 40, -32, 8, { col: 0.5, sv: 0.4, gap: 1 });
    scatter(['post_lantern', 'post_skull'], 14, -30, 8, { col: 0.35 });
    scatter(['coffin', 'coffin_decorated', 'shrine_candles', 'plaque_candles'], 12, -30, 6, { col: 0.9 });
    scatter(['skull', 'ribcage', 'bone_A', 'bone_B'], 50, -40, 8, { noShadow: true });
    scatter(['fence_broken', 'fence'], 14, -30, 6, { col: 0 });
    scatter(['pumpkin_orange_jackolantern'], 6, -28, 6, { col: 0.5 });

    // --- Temple zone ---
    scatter(['pillar_decorated', 'pillar'], 22, -82, -34, { col: 0.8, gap: 2 });
    scatter(['wall_broken', 'wall_arched', 'wall_half'], 16, -80, -36, { col: 0, gap: 2.5 });
    scatter(['rubble_large', 'rubble_half'], 10, -82, -36, { col: 1.6, gap: 2 });
    scatter(['tree_dead_large', 'tree_dead_large_decorated'], 18, -90, -34, { col: 0.5, sv: 0.4 });
    scatter(['skull', 'ribcage', 'bone_A', 'bone_B', 'candle_triple'], 50, -92, -34, { noShadow: true });
    scatter(['post_skull', 'banner_patternA_red'], 12, -84, -36, { col: 0.4 });
    // Walls get colliders along their length
    for (const p of P) if (p.name.startsWith('wall_')) {
      const len = p.name === 'wall_half' ? 1 : 2;
      for (let t = -len + 0.5; t <= len - 0.5; t += 1) addCollider(p.x + Math.cos(p.ry) * t, p.z - Math.sin(p.ry) * t, 0.65);
    }
    // Crypt (boss lair) with plaza, pillars & braziers
    put('crypt', CRYPT[0], CRYPT[1] - 2, { ry: 0, s: 1.35 }); addCollider(0, -95, 5.2);
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * 0.15 + (i / 9) * Math.PI * 0.7;
      const x = Math.cos(a) * 13, z = -84 + Math.sin(a) * 13 * 0.9;
      put('pillar', x, z, { ry: 0, s: 1.2, col: 0.6 });
      if (i % 3 === 0) addFlame(x, heightAt(x, z) + 5.5, z, 0.8, false, 0xff4422);
    }
    for (const [x, z] of [[-4, -82], [4, -82]]) { put('torch_lit', x, z, { ry: 0, s: 1.6 }); addFlame(x, heightAt(x, z) + 1.7, z, 0.8, false, 0xff5522); }
    // Unique arena in graveyard
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put('post_skull', -24 + Math.cos(a) * 7, -8 + Math.sin(a) * 7, { ry: -a, col: 0.35 }); }

  return { placements: P, colliders: col, flames };
}

// Prop sets of the generated maps (same KayKit kit, re-coloured per theme on the client).
export const THEMES = {
  bones: {},
  swamp: { mts: ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass'],
    z1: [[['tree_dead_large', 'tree_dead_medium', 'tree_dead_large_decorated'], 60, { col: 0.6, sv: 0.4, gap: 1.2 }], [['trees_A_large', 'trees_B_large'], 26, { s: 4.5, col: 1.3, sv: 0.3 }], [['tree_single_A', 'tree_single_B'], 30, { s: 3.5, col: 0.7, sv: 0.4 }]],
    z2: [[['tree_dead_medium', 'tree_dead_small'], 40, { col: 0.5, sv: 0.4 }], [['rock_single_A', 'rock_single_B', 'rock_single_C'], 40, { s: 6, col: 0.9, sv: 0.6 }], [['post_lantern', 'lantern_standing'], 14, { col: 0.35 }], [['pumpkin_orange_jackolantern'], 10, { col: 0.5 }]],
    z3: [[['pillar', 'pillar_decorated'], 22, { col: 0.8, gap: 2 }], [['rubble_large', 'rubble_half'], 12, { col: 1.6, gap: 2 }], [['tree_dead_large_decorated', 'tree_dead_large'], 18, { col: 0.5, sv: 0.4 }], [['wall_broken', 'wall_half'], 12, { col: 0, gap: 2.5 }]],
    clutter: ['rock_single_D', 'rock_single_E', 'bone_A'], lair: 'ring', flame: 0x7dff4a },
  desert: { mts: ['mountain_C_grass', 'mountain_B_grass_trees'],
    z1: [[['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_E'], 70, { s: 7, col: 0.9, sv: 0.7 }], [['tree_dead_small', 'tree_dead_medium'], 22, { col: 0.5, sv: 0.4 }]],
    z2: [[['column', 'pillar'], 26, { col: 0.8, gap: 2 }], [['rubble_large', 'rubble_half'], 16, { col: 1.6, gap: 2 }], [['rock_single_A', 'rock_single_D'], 40, { s: 8, col: 1, sv: 0.6 }], [['skull', 'ribcage', 'bone_B'], 30, { noShadow: true }]],
    z3: [[['pillar_decorated', 'column'], 26, { col: 0.8, gap: 2 }], [['wall_arched', 'wall_broken', 'wall_half'], 16, { col: 0, gap: 2.5 }], [['rubble_large'], 10, { col: 1.6, gap: 2 }], [['coin_stack_large', 'chest'], 8, { col: 0.6 }]],
    clutter: ['rock_single_D', 'bone_A', 'skull'], lair: 'ring', flame: 0xffa040 },
  snow: { mts: ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass'],
    z1: [[['tree_pine_orange_large', 'tree_pine_yellow_large', 'tree_pine_orange_medium', 'tree_pine_yellow_medium'], 110, { col: 0.8, sv: 0.4, gap: 1.2 }], [['rock_single_A', 'rock_single_C'], 30, { s: 7, col: 0.9, sv: 0.6 }]],
    z2: [[['tree_pine_orange_small', 'tree_pine_yellow_medium'], 50, { col: 0.6, sv: 0.4 }], [['rock_single_B', 'rock_single_E'], 50, { s: 8, col: 1, sv: 0.6 }], [['post_lantern', 'lantern_standing'], 10, { col: 0.35 }]],
    z3: [[['pillar', 'column'], 20, { col: 0.8, gap: 2 }], [['rubble_large', 'rubble_half'], 14, { col: 1.6, gap: 2 }], [['rock_single_A', 'rock_single_D'], 40, { s: 9, col: 1.1, sv: 0.6 }], [['wall_half', 'wall_broken'], 10, { col: 0, gap: 2.5 }]],
    clutter: ['rock_single_D', 'rock_single_E'], lair: 'ring', flame: 0x7fd8ff },
  lava: { mts: ['mountain_C_grass', 'mountain_B_grass_trees'],
    z1: [[['tree_dead_large', 'tree_dead_medium', 'tree_dead_small'], 50, { col: 0.5, sv: 0.4 }], [['rock_single_A', 'rock_single_B', 'rock_single_C'], 60, { s: 8, col: 1, sv: 0.6 }]],
    z2: [[['rock_single_D', 'rock_single_E', 'rock_single_A'], 70, { s: 9, col: 1.1, sv: 0.6 }], [['skull', 'ribcage', 'bone_A'], 40, { noShadow: true }], [['post_skull'], 12, { col: 0.35 }]],
    z3: [[['wall_broken', 'wall_arched', 'wall_half'], 18, { col: 0, gap: 2.5 }], [['pillar_decorated', 'pillar'], 20, { col: 0.8, gap: 2 }], [['rubble_large', 'rubble_half'], 14, { col: 1.6, gap: 2 }], [['banner_patternA_red', 'post_skull'], 12, { col: 0.4 }]],
    clutter: ['rock_single_D', 'skull'], lair: 'ring', flame: 0xff4a1a },
  coast: { mts: ['mountain_A_grass_trees', 'mountain_C_grass'],
    z1: [[['tree_single_A', 'tree_single_B'], 50, { s: 3.6, col: 0.7, sv: 0.4 }], [['rock_single_A', 'rock_single_C', 'rock_single_E'], 40, { s: 6, col: 0.9, sv: 0.6 }], [['barrel_large', 'crates_stacked'], 12, { col: 0.9 }]],
    z2: [[['rock_single_B', 'rock_single_D', 'rock_single_A'], 70, { s: 8, col: 1, sv: 0.7 }], [['trees_A_large', 'trees_B_large'], 14, { s: 4.5, col: 1.3, sv: 0.3 }], [['chest', 'barrel_small_stack'], 10, { col: 0.8 }]],
    z3: [[['column', 'pillar_decorated'], 26, { col: 0.8, gap: 2 }], [['wall_arched', 'wall_broken'], 16, { col: 0, gap: 2.5 }], [['rubble_large', 'rubble_half'], 12, { col: 1.6, gap: 2 }], [['coin_stack_large', 'chest_gold'], 8, { col: 0.6 }]],
    clutter: ['rock_single_D', 'rock_single_E'], lair: 'ring', flame: 0x4ad8ff },
  ghost: { mts: ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass'],
    z1: [[['tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_dead_large'], 90, { col: 0.8, sv: 0.4, gap: 1.2 }], [['trees_A_large', 'trees_B_large'], 20, { s: 4.5, col: 1.3, sv: 0.3 }], [['lantern_standing', 'post_lantern'], 14, { col: 0.35 }]],
    z2: [[['grave_A', 'grave_B', 'grave_A_destroyed', 'gravestone', 'gravemarker_A'], 70, { col: 0.6 }], [['tree_dead_large_decorated', 'tree_dead_medium'], 30, { col: 0.5, sv: 0.4 }], [['coffin', 'shrine_candles', 'plaque_candles'], 14, { col: 0.9 }]],
    z3: [[['pillar_decorated', 'pillar'], 22, { col: 0.8, gap: 2 }], [['wall_broken', 'wall_arched', 'wall_half'], 16, { col: 0, gap: 2.5 }], [['tree_dead_large', 'tree_dead_large_decorated'], 16, { col: 0.5, sv: 0.4 }], [['candle_triple', 'skull'], 30, { noShadow: true }]],
    clutter: ['skull', 'bone_A', 'candle_triple'], lair: 'crypt', flame: 0xb07aff },
  dragon: { mts: ['mountain_C_grass', 'mountain_B_grass_trees'],
    z1: [[['tree_dead_large', 'tree_dead_medium'], 40, { col: 0.5, sv: 0.4 }], [['rock_single_A', 'rock_single_B', 'rock_single_E'], 60, { s: 8, col: 1, sv: 0.7 }], [['skull', 'ribcage'], 30, { noShadow: true }]],
    z2: [[['rock_single_C', 'rock_single_D'], 70, { s: 10, col: 1.2, sv: 0.6 }], [['rubble_large', 'rubble_half'], 16, { col: 1.6, gap: 2 }], [['post_skull', 'banner_shield_red'], 12, { col: 0.4 }]],
    z3: [[['pillar_decorated', 'column'], 26, { col: 0.8, gap: 2 }], [['wall_arched', 'wall_broken', 'wall_half'], 16, { col: 0, gap: 2.5 }], [['coin_stack_large', 'chest_gold', 'sword_shield_gold'], 14, { col: 0.6 }], [['skull', 'ribcage', 'bone_B'], 40, { noShadow: true }]],
    clutter: ['rock_single_D', 'bone_A', 'coin'], lair: 'ring', flame: 0xff5a2a },
};

// Generic layout used by maps 2–8: same plan as the first valley, dressed with the map's theme.
function layoutGen(T) {
  const { BOUNDS, roadX, heightAt, OUTPOSTS } = T;
  const M = T.map, TH = THEMES[M.theme], CAMPS = M.camps, CRYPT = M.crypt, AR = M.arena;
  const col = new Colliders(T), flames = [], P = [], occupied = [];
  const R = rng(M.seed);
  const addCollider = (x, z, r) => col.add(x, z, r);
  const addFlame = (x, y, z, size, big, color = 0xff8a3c) => flames.push({ x, y, z, size, big, color });
  const free = (x, z, r) => {
    if (Math.abs(x - roadX(z)) < 3.6 + r) return false;
    if (x < BOUNDS.minX + 3 || x > BOUNDS.maxX - 3 || z < BOUNDS.minZ + 3 || z > BOUNDS.maxZ - 3) return false;
    for (const c of CAMPS) if (Math.hypot(x - c[0], z - c[1]) < 5.5 + r) return false;
    if (Math.hypot(x - M.camp[0], z - M.camp[1]) < 19) return false;
    if (Math.hypot(x - CRYPT[0], z - CRYPT[1] - 7) < 15) return false;
    if (Math.hypot(x - AR[0], z - AR[1]) < 8) return false;
    for (const o of OUTPOSTS) if (o.id !== 'camp' && Math.hypot(x - o.x, z - o.z) < o.r + 1 + r) return false;
    return !occupied.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
  };
  const put = (name, x, z, { s = 1, ry = R() * Math.PI * 2, col = 0, noShadow = false, y } = {}) => {
    P.push({ name, x, z, y: y ?? heightAt(x, z) - 0.05, ry, s, noShadow });
    if (col) addCollider(x, z, col * s);
    occupied.push({ x, z, r: Math.max(0.6, col * s) });
  };
  const scatter = (names, n, zMin, zMax, opts) => {
    let tries = 0, placed = 0;
    while (placed < n && tries++ < n * 30) {
      const x = BOUNDS.minX + 3 + R() * (BOUNDS.maxX - BOUNDS.minX - 6), z = zMin + R() * (zMax - zMin);
      const r = (opts.col || 0.5) * (opts.s || 1);
      if (!free(x, z, r + (opts.gap || 0.5))) continue;
      const s = (opts.s || 1) * (opts.sv ? 1 - opts.sv / 2 + R() * opts.sv : 1);
      put(names[Math.floor(R() * names.length)], x, z, { ...opts, s }); placed++;
    }
  };
  const mts = TH.mts, pick = (a) => a[Math.floor(R() * a.length)];
  for (let z = BOUNDS.minZ - 6; z <= BOUNDS.maxZ + 6; z += 11) for (const side of [-1, 1]) put(pick(mts), side * (BOUNDS.maxX + 4 + R() * 5), z, { s: 11 + R() * 6, noShadow: true });
  for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 11) {
    put(pick(mts), x, BOUNDS.minZ - 6 - R() * 4, { s: 12 + R() * 6, noShadow: true });
    put(pick(mts), x, BOUNDS.maxZ + 6 + R() * 4, { s: 11 + R() * 5, noShadow: true });
  }
  // Camp: same furniture as the first valley.
  const [cx, cz] = M.camp;
  const camp = [
    ['banner_patternA_red', -9, 7, 0.3], ['banner_shield_red', 7, 13, -0.3], ['barrel_large', -11, -5, 0, 0.9], ['barrel_small_stack', -12, -2, 1.2, 0.9],
    ['crates_stacked', 11.5, -6, 0.4, 1.1], ['table_long_decorated_A', -7.5, -5.5, 1.57, 1.2], ['keg_decorated', -13, 3, 1.2, 1.3],
    ['chest_gold', -6, -7.5, 0.2, 0.8], ['coin_stack_large', -9.3, -7.5, 0.6, 0.6], ['sword_shield_gold', 7.5, -8, 0, 0], ['torch_lit', -4, -9, 0, 0],
    ['torch_lit', 4, -9, 0, 0], ['torch_lit', -4, 9, 0, 0], ['torch_lit', 4, 9, 0, 0], ['crates_stacked', 5.5, 11, 0.9, 1.1], ['barrel_large', 14, -2, 0, 0.9],
  ];
  for (const [n, x, z, ry, c] of camp) put(n, cx + x, cz + z, { ry, col: c });
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
    const x = cx + Math.sin(a) * 17.5, z = cz + Math.cos(a) * 17.5;
    if (Math.abs(x - roadX(z)) < 5) continue;
    put(R() < 0.2 ? 'fence_broken' : 'fence', x, z, { ry: a + Math.PI / 2, col: 0 });
    addCollider(x, z, 1.3); addCollider(x + Math.cos(a) * 1.4, z - Math.sin(a) * 1.4, 0.7); addCollider(x - Math.cos(a) * 1.4, z + Math.sin(a) * 1.4, 0.7);
  }
  { const Pt = M.portal, ry = Math.atan2(cx - Pt.x, cz - Pt.z);
    put('arch', Pt.x, Pt.z, { ry, s: 1.1 });
    for (const sgn of [-1, 1]) addCollider(Pt.x + Math.cos(ry) * 2.05 * sgn, Pt.z - Math.sin(ry) * 2.05 * sgn, 0.55); }
  const fire = (x, z) => {
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; put(['rock_single_A', 'rock_single_C', 'rock_single_D'][i % 3], x + Math.cos(a) * 1.3, z + Math.sin(a) * 1.3, { s: 2.6, noShadow: true }); }
    addCollider(x, z, 1.4); addFlame(x, heightAt(x, z) + 0.3, z, 1.6, true);
  };
  fire(cx, cz);
  for (const [x, z] of [[-4, -9], [4, -9], [-4, 9], [4, 9]]) addFlame(cx + x, heightAt(cx + x, cz + z) + 1.05, cz + z, 0.5, false);
  for (const o of OUTPOSTS) {
    if (o.id === 'camp') continue;
    fire(o.x, o.z);
    for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { put('torch_lit', o.x + dx, o.z + dz, { ry: 0 }); addFlame(o.x + dx, heightAt(o.x + dx, o.z + dz) + 1.05, o.z + dz, 0.5, false); }
    put('banner_patternA_red', o.x - 7, o.z, { ry: Math.PI / 2 }); put('banner_shield_red', o.x + 7.5, o.z + 1, { ry: -Math.PI / 2 });
    put('crates_stacked', o.x + 6.5, o.z + 6, { ry: 0.4, col: 1.1 }); put('barrel_large', o.x - 6.5, o.z + 5.5, { ry: 0, col: 0.9 });
    put('barrel_small_stack', o.x - 6.5, o.z - 4, { ry: 1.2, col: 0.9 }); put('chest_gold', o.x + 2.5, o.z - 6, { ry: 0.2, col: 0.8 });
  }
  // Zones
  for (const [names, n, opts] of TH.z1) scatter(names, n, 12, 50, opts);
  { const z = 10, x = roadX(z); put('arch_gate', x, z, { ry: 0 }); addCollider(x - 1.9, z, 0.5); addCollider(x + 1.9, z, 0.5);
    for (const dx of [-6, -10, -14, 6, 10, 14]) { put('fence', x + dx, z, { ry: 0 }); addCollider(x + dx, z, 0.9); } }
  for (const [names, n, opts] of TH.z2) scatter(names, n, -32, 8, opts);
  for (const [names, n, opts] of TH.z3) scatter(names, n, -84, -34, opts);
  scatter(TH.clutter, 60, -92, 50, { noShadow: true });
  for (const p of P) if (p.name.startsWith('wall_')) {
    const len = p.name === 'wall_half' ? 1 : 2;
    for (let t = -len + 0.5; t <= len - 0.5; t += 1) addCollider(p.x + Math.cos(p.ry) * t, p.z - Math.sin(p.ry) * t, 0.65);
  }
  // Boss lair: crypt or a pillar ring with braziers around a gate.
  if (TH.lair === 'crypt') { put('crypt', CRYPT[0], CRYPT[1] - 2, { ry: 0, s: 1.35 }); addCollider(CRYPT[0], CRYPT[1] - 2, 5.2); }
  else {
    put('arch', CRYPT[0], CRYPT[1] + 1, { ry: 0, s: 2.2 }); addCollider(CRYPT[0] - 4.4, CRYPT[1] + 1, 1); addCollider(CRYPT[0] + 4.4, CRYPT[1] + 1, 1);
    for (const dx of [-9, -6, 6, 9]) { put('rubble_large', CRYPT[0] + dx, CRYPT[1] - 1, { ry: R() * 6, col: 1.6 }); }
  }
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * 0.15 + (i / 9) * Math.PI * 0.7;
    const x = CRYPT[0] + Math.cos(a) * 13, z = CRYPT[1] + 9 + Math.sin(a) * 13 * 0.9;
    put('pillar', x, z, { ry: 0, s: 1.2, col: 0.6 });
    if (i % 3 === 0) addFlame(x, heightAt(x, z) + 5.5, z, 0.8, false, TH.flame);
  }
  for (const dx of [-4, 4]) { const x = CRYPT[0] + dx, z = CRYPT[1] + 11; put('torch_lit', x, z, { ry: 0, s: 1.6 }); addFlame(x, heightAt(x, z) + 1.7, z, 0.8, false, TH.flame); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put('post_skull', AR[0] + Math.cos(a) * 7, AR[1] + Math.sin(a) * 7, { ry: -a, col: 0.35 }); }
  return { placements: P, colliders: col, flames };
}

const LAYOUTS = { vadi: layoutVadi, gen: layoutGen };
