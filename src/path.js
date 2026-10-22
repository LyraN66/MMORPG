// Grid A* over the world colliders, used when the player taps a far-away spot on the map.
import { BOUNDS } from '../server/shared/terrain.js';

const CELL = 1.5, R = 0.7;
let grid = null, W = 0, H = 0;

function build(world) {
  W = Math.ceil((BOUNDS.maxX - BOUNDS.minX - 8) / CELL); H = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ - 9) / CELL);
  grid = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const [x, z] = pos(i, j); grid[j * W + i] = world.blocked(x, z, R) ? 1 : 0; }
}
const pos = (i, j) => [BOUNDS.minX + 4 + (i + 0.5) * CELL, BOUNDS.minZ + 5 + (j + 0.5) * CELL];
const cellOf = (x, z) => [Math.max(0, Math.min(W - 1, Math.floor((x - BOUNDS.minX - 4) / CELL))), Math.max(0, Math.min(H - 1, Math.floor((z - BOUNDS.minZ - 5) / CELL)))];

// Nearest walkable cell (the tap may land on a tree).
function freeCell(i, j) {
  if (!grid[j * W + i]) return [i, j];
  for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < W && b < H && !grid[b * W + a]) return [a, b];
  }
  return [i, j];
}

function lineFree(world, ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.6);
  for (let k = 1; k < n; k++) { const t = k / n; if (world.blocked(ax + (bx - ax) * t, az + (bz - az) * t, R * 0.85)) return false; }
  return true;
}

// Returns waypoints [{x, z}, …] ending at the goal, or null.
export function findPath(world, from, to) {
  if (!grid || world !== findPath.world) { findPath.world = world; build(world); }
  if (lineFree(world, from.x, from.z, to.x, to.z)) return [{ x: to.x, z: to.z }];
  const [si, sj] = freeCell(...cellOf(from.x, from.z)), [gi, gj] = freeCell(...cellOf(to.x, to.z));
  const N = W * H, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const start = sj * W + si, goal = gj * W + gi;
  const heap = [[0, start]]; g[start] = 0;
  const hfn = (k) => Math.hypot((k % W) - gi, Math.floor(k / W) - gj);
  const push = (f, k) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  let found = false, it = 0;
  while (heap.length && it++ < 40000) {
    const [, k] = pop(); if (closed[k]) continue; closed[k] = 1;
    if (k === goal) { found = true; break; }
    const i = k % W, j = Math.floor(k / W);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue;
      const n = b * W + a; if (grid[n] || closed[n]) continue;
      if (di && dj && (grid[j * W + a] || grid[b * W + i])) continue; // no corner cutting
      const ng = g[k] + (di && dj ? 1.414 : 1);
      if (ng < g[n]) { g[n] = ng; came[n] = k; push(ng + hfn(n), n); }
    }
  }
  if (!found) return null;
  const cells = []; for (let k = goal; k !== -1; k = came[k]) cells.push(k);
  cells.reverse();
  const pts = cells.map((k) => { const [x, z] = pos(k % W, Math.floor(k / W)); return { x, z }; });
  pts[pts.length - 1] = { x: to.x, z: to.z };
  // String-pull: skip waypoints that are in straight view.
  const out = []; let cx = from.x, cz = from.z, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !lineFree(world, cx, cz, pts[j].x, pts[j].z)) j--;
    out.push(pts[j]); cx = pts[j].x; cz = pts[j].z; i = j + 1;
  }
  return out;
}
