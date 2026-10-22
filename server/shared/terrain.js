// World layout shared by the game client and the server: terrain height, road, props and colliders.
// Everything is deterministic so every player and the server build the identical valley.
import { CAMPS } from './data.js';

export const BOUNDS = { minX: -46, maxX: 46, minZ: -98, maxZ: 76 };
export const CAMP = [0, 63];
export const CRYPT = [0, -93];
export const smoothstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const roadX = (z) => 5.5 * Math.sin(z * 0.045) + 2 * Math.sin(z * 0.11);
export function heightAt(x, z) {
  let h = 0.55 * Math.sin(x * 0.075 + 1.3) * Math.cos(z * 0.062) + 0.35 * Math.sin(x * 0.16 + z * 0.12) + 0.2 * Math.cos(x * 0.31 - z * 0.27);
  const dr = Math.abs(x - roadX(z));
  h *= smoothstep(dr, 1.5, 8);
  const flat = (cx, cz, r) => smoothstep(Math.hypot(x - cx, z - cz), r * 0.6, r);
  h *= flat(0, 63, 16) * flat(0, -88, 18);
  const ex = Math.max(0, Math.abs(x) - 38), ez = Math.max(0, z - 68, -90 - z);
  h += (ex * ex + ez * ez) * 0.08;
  return h;
}

// Circle colliders on a coarse grid.
export class Colliders {
  constructor() { this.list = []; this.grid = new Map(); }
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
    pos.x = clamp(pos.x, BOUNDS.minX + 4, BOUNDS.maxX - 4);
    pos.z = clamp(pos.z, BOUNDS.minZ + 5, BOUNDS.maxZ - 4);
    pos.y = heightAt(pos.x, pos.z);
  }
  blocked(x, z, r) {
    const list = this.grid.get(Math.floor(x / 6) + ',' + Math.floor(z / 6));
    return !!list && list.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r);
  }
}

export function generateLayout() {
  const col = new Colliders();
  const flames = [];
  const addCollider = (x, z, r) => col.add(x, z, r);
  const addFlame = (x, y, z, size, big, color = 0xff8a3c) => flames.push({ x, y, z, size, big, color });
    const R = rng(1337);
    const P = [];
    const occupied = [];
    const free = (x, z, r) => {
      if (Math.abs(x - roadX(z)) < 3.6 + r) return false;
      if (x < BOUNDS.minX + 3 || x > BOUNDS.maxX - 3 || z < BOUNDS.minZ + 3 || z > BOUNDS.maxZ - 3) return false;
      for (const c of CAMPS) if (Math.hypot(x - c[0], z - c[1]) < 5.5 + r) return false;
      if (Math.hypot(x, z - 63) < 14) return false;
      if (Math.hypot(x, z + 86) < 14) return false;
      if (Math.hypot(x + 24, z + 8) < 8) return false; // unique arena
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
      ['banner_patternA_red', -9, 70, 0.3], ['banner_shield_red', 9, 70, -0.3], ['barrel_large', -11, 58, 0, 0.9], ['barrel_small_stack', -12, 61, 1.2, 0.9],
      ['crates_stacked', 11.5, 57, 0.4, 1.1], ['box_stacked', 13, 66, 0.2, 1.6], ['table_long_decorated_A', -7.5, 57.5, 1.57, 1.2], ['keg_decorated', -13, 66, 1.2, 1.3],
      ['chest_gold', -6, 55.5, 0.2, 0.8], ['coin_stack_large', -9.3, 55.5, 0.6, 0.6], ['sword_shield_gold', 7.5, 55, 0, 0], ['torch_lit', -4, 54, 0, 0],
      ['torch_lit', 4, 54, 0, 0], ['torch_lit', -4, 72, 0, 0], ['torch_lit', 4, 72, 0, 0], ['crates_stacked', 6, 72, 0.9, 1.1], ['barrel_large', 14, 61, 0, 0.9],
    ];
    for (const [n, x, z, ry, col] of camp) put(n, x, z, { ry, col });
    // Fence ring around camp with openings on the road
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
      const x = Math.sin(a) * 17.5, z = 63 + Math.cos(a) * 17.5;
      if (Math.abs(x - roadX(z)) < 5) continue;
      put(R() < 0.2 ? 'fence_broken' : 'fence', x, z, { ry: a + Math.PI / 2, col: 0 });
      addCollider(x, z, 1.3); addCollider(x + Math.cos(a) * 1.4, z - Math.sin(a) * 1.4, 0.7); addCollider(x - Math.cos(a) * 1.4, z + Math.sin(a) * 1.4, 0.7);
    }
    // Campfire stones
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; put(['rock_single_A', 'rock_single_C', 'rock_single_D'][i % 3], Math.cos(a) * 1.3, 63 + Math.sin(a) * 1.3, { s: 2.6, noShadow: true }); }
    addCollider(0, 63, 1.4);
    addFlame(0, heightAt(0, 63) + 0.3, 63, 1.6, true);
    for (const [x, z] of [[-4, 54], [4, 54], [-4, 72], [4, 72]]) addFlame(x, heightAt(x, z) + 1.05, z, 0.5, false);

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
