import * as THREE from 'three';
import { buildInstancedProps } from './assets.js';
import { CAMPS, ZONES } from './data.js';

export const BOUNDS = { minX: -46, maxX: 46, minZ: -98, maxZ: 76 };
export const CAMP_POS = new THREE.Vector3(0, 0, 63);
export const CRYPT_POS = new THREE.Vector3(0, 0, -93);

// Deterministic RNG so the world is identical for every player (multiplayer-ready).
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const roadX = (z) => 5.5 * Math.sin(z * 0.045) + 2 * Math.sin(z * 0.11);
export function heightAt(x, z) {
  let h = 0.55 * Math.sin(x * 0.075 + 1.3) * Math.cos(z * 0.062) + 0.35 * Math.sin(x * 0.16 + z * 0.12) + 0.2 * Math.cos(x * 0.31 - z * 0.27);
  const dr = Math.abs(x - roadX(z));
  h *= THREE.MathUtils.smoothstep(dr, 1.5, 8);
  const flat = (cx, cz, r) => THREE.MathUtils.smoothstep(Math.hypot(x - cx, z - cz), r * 0.6, r);
  h *= flat(0, 63, 16) * flat(0, -88, 18);
  // Raise edges into hills.
  const ex = Math.max(0, Math.abs(x) - 38), ez = Math.max(0, z - 68, -90 - z);
  h += (ex * ex + ez * ez) * 0.08;
  return h;
}

export class World {
  constructor(scene, quality) {
    this.scene = scene; this.quality = quality;
    this.colliders = []; // {x, z, r}
    this.grid = new Map();
    this.lights = [];
    this.flames = [];
    this.time = 0;
    this.build();
  }

  addCollider(x, z, r) {
    const c = { x, z, r };
    this.colliders.push(c);
    const cs = 6;
    for (let gx = Math.floor((x - r) / cs); gx <= Math.floor((x + r) / cs); gx++)
      for (let gz = Math.floor((z - r) / cs); gz <= Math.floor((z + r) / cs); gz++) {
        const k = gx + ',' + gz; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(c);
      }
  }
  // Push a circle (pos, radius) out of colliders and keep inside world bounds.
  resolve(pos, r) {
    const k = Math.floor(pos.x / 6) + ',' + Math.floor(pos.z / 6);
    const list = this.grid.get(k);
    if (list) for (const c of list) {
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 1e-4) { pos.x = c.x + (dx / d) * m; pos.z = c.z + (dz / d) * m; }
    }
    pos.x = THREE.MathUtils.clamp(pos.x, BOUNDS.minX + 4, BOUNDS.maxX - 4);
    pos.z = THREE.MathUtils.clamp(pos.z, BOUNDS.minZ + 5, BOUNDS.maxZ - 4);
    pos.y = heightAt(pos.x, pos.z);
  }
  blocked(x, z, r) {
    const list = this.grid.get(Math.floor(x / 6) + ',' + Math.floor(z / 6));
    return !!list && list.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r);
  }

  build() {
    const s = this.scene;
    // Sky dome with gradient + stars + moon
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x0b1026) }, mid: { value: new THREE.Color(0x3a2d4f) }, bot: { value: new THREE.Color(0xc46a3d) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 top, mid, bot; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = mix(bot, mid, smoothstep(-0.05, 0.18, h)); c = mix(c, top, smoothstep(0.15, 0.7, h));
        gl_FragColor = vec4(c, 1.); }`,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat); s.add(this.sky);
    const starGeo = new THREE.BufferGeometry(); const sp = [];
    const r0 = rng(7);
    for (let i = 0; i < 900; i++) {
      const th = r0() * Math.PI * 2, ph = Math.acos(0.15 + r0() * 0.85);
      sp.push(380 * Math.sin(ph) * Math.cos(th), 380 * Math.cos(ph), 380 * Math.sin(ph) * Math.sin(th));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
    s.add(this.stars);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: 0xffe9c4, fog: false }));
    moon.position.set(-140, 150, -300); moon.lookAt(0, 0, 0); s.add(moon);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ color: 0xffd6a0, fog: false, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.copy(moon.position).multiplyScalar(1.01); halo.lookAt(0, 0, 0); s.add(halo);

    // Lighting
    s.add(new THREE.HemisphereLight(0x8a9bd0, 0x3b2a20, 1.25));
    const sun = new THREE.DirectionalLight(0xffd2a1, 2.6);
    sun.position.set(-25, 45, 18);
    sun.castShadow = this.quality !== 'low';
    const sm = this.quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(sm, sm);
    const sc = sun.shadow.camera; sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 120;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    s.add(sun); s.add(sun.target);
    this.sun = sun;
    const rim = new THREE.DirectionalLight(0x6f7cff, 0.7); rim.position.set(30, 20, -40); s.add(rim);

    this.buildTerrain();
    this.buildProps();
    if (this.quality !== 'low') this.buildGrass();
    this.buildAmbientMotes();
  }

  buildTerrain() {
    const W = BOUNDS.maxX - BOUNDS.minX + 60, H = BOUNDS.maxZ - BOUNDS.minZ + 60;
    const seg = this.quality === 'low' ? 110 : 180;
    const geo = new THREE.PlaneGeometry(W, H, seg, Math.round(seg * H / W));
    geo.rotateX(-Math.PI / 2);
    geo.translate((BOUNDS.minX + BOUNDS.maxX) / 2, 0, (BOUNDS.minZ + BOUNDS.maxZ) / 2);
    const pos = geo.attributes.position; const col = []; const c = new THREE.Color(), c2 = new THREE.Color();
    const dirt = new THREE.Color(0x6b5238), stone = new THREE.Color(0x5b5651);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
      // zone tint blend
      const zi = ZONES.findIndex((zn) => z >= zn.zMin && z < zn.zMax);
      const zn = ZONES[Math.max(0, zi)];
      c.set(zn.tint);
      const next = ZONES[Math.min(ZONES.length - 1, zi + 1)];
      const t = THREE.MathUtils.smoothstep(zn.zMin + 8 - z, 0, 16);
      c2.set(next.tint); c.lerp(c2, t * 0.5);
      const n = Math.sin(x * 0.9) * Math.cos(z * 0.7) * 0.5 + Math.sin(x * 0.23 + z * 0.31) * 0.5;
      c.offsetHSL(0.01 * n, 0.04 * n, 0.05 * n);
      const dr = Math.abs(x - roadX(z));
      const road = 1 - THREE.MathUtils.smoothstep(dr, 1.6, 3.2 + Math.sin(z * 0.8) * 0.4);
      c.lerp(z < -60 ? stone : dirt, road * 0.85);
      const plaza = 1 - THREE.MathUtils.smoothstep(Math.hypot(x, z - 63), 7, 11);
      c.lerp(dirt, plaza * 0.6);
      const pz = 1 - THREE.MathUtils.smoothstep(Math.hypot(x, z + 84), 9, 14);
      c.lerp(stone, pz * 0.8);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    // subtle procedural detail noise in fragment shader
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWp;
        float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float nn = vn(vWp.xz*1.7)*0.5 + vn(vWp.xz*6.3)*0.3 + vn(vWp.xz*0.35)*0.4;
          diffuseColor.rgb *= 0.78 + nn*0.38;`);
    };
    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    this.terrain = terrain;
    this.scene.add(terrain);
  }

  buildProps() {
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
      if (col) { this.addCollider(x, z, col * s); }
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
      this.addCollider(x, z, 1.3); this.addCollider(x + Math.cos(a) * 1.4, z - Math.sin(a) * 1.4, 0.7); this.addCollider(x - Math.cos(a) * 1.4, z + Math.sin(a) * 1.4, 0.7);
    }
    // Campfire stones
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; put(['rock_single_A', 'rock_single_C', 'rock_single_D'][i % 3], Math.cos(a) * 1.3, 63 + Math.sin(a) * 1.3, { s: 2.6, noShadow: true }); }
    this.addCollider(0, 63, 1.4);
    this.addFlame(new THREE.Vector3(0, heightAt(0, 63) + 0.3, 63), 1.6, true);
    for (const [x, z] of [[-4, 54], [4, 54], [-4, 72], [4, 72]]) this.addFlame(new THREE.Vector3(x, heightAt(x, z) + 1.05, z), 0.5, false);

    // --- Forest zone ---
    scatter(['tree_pine_orange_large', 'tree_pine_yellow_large', 'tree_pine_orange_medium', 'tree_pine_yellow_medium'], this.quality === 'low' ? 60 : 95, 12, 50, { col: 0.8, sv: 0.4, gap: 1.2 });
    scatter(['tree_pine_orange_small', 'tree_dead_medium'], 30, 14, 52, { col: 0.5, sv: 0.3 });
    scatter(['trees_A_large', 'trees_B_large'], 20, 14, 50, { s: 4.5, col: 1.3, sv: 0.3 });
    scatter(['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_E'], 40, 10, 54, { s: 7, col: 0.9, sv: 0.6 });
    scatter(['pumpkin_orange_jackolantern', 'pumpkin_yellow'], 12, 12, 50, { col: 0.5, s: 0.9 });
    // Gate between forest and graveyard
    { const z = 10, x = roadX(z); put('arch_gate', x, z, { ry: 0 }); this.addCollider(x - 1.9, z, 0.5); this.addCollider(x + 1.9, z, 0.5);
      for (const dx of [-6, -10, -14, 6, 10, 14]) { put('fence', x + dx, z, { ry: 0 }); this.addCollider(x + dx, z, 0.9); } }

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
      for (let t = -len + 0.5; t <= len - 0.5; t += 1) this.addCollider(p.x + Math.cos(p.ry) * t, p.z - Math.sin(p.ry) * t, 0.65);
    }
    // Crypt (boss lair) with plaza, pillars & braziers
    put('crypt', CRYPT_POS.x, CRYPT_POS.z - 2, { ry: 0, s: 1.35 }); this.addCollider(0, -95, 5.2);
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * 0.15 + (i / 9) * Math.PI * 0.7;
      const x = Math.cos(a) * 13, z = -84 + Math.sin(a) * 13 * 0.9;
      put('pillar', x, z, { ry: 0, s: 1.2, col: 0.6 });
      if (i % 3 === 0) this.addFlame(new THREE.Vector3(x, heightAt(x, z) + 5.5, z), 0.8, false, 0xff4422);
    }
    for (const [x, z] of [[-4, -82], [4, -82]]) { put('torch_lit', x, z, { ry: 0, s: 1.6 }); this.addFlame(new THREE.Vector3(x, heightAt(x, z) + 1.7, z), 0.8, false, 0xff5522); }
    // Unique arena in graveyard
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put('post_skull', -24 + Math.cos(a) * 7, -8 + Math.sin(a) * 7, { ry: -a, col: 0.35 }); }

    this.propsGroup = buildInstancedProps(P);
    this.scene.add(this.propsGroup);
    // Props between the camera and the player dissolve (dithered) so the hero is never hidden.
    this.occl = { uCam: { value: new THREE.Vector3() }, uPl: { value: new THREE.Vector3() } };
    const seen = new Set();
    this.propsGroup.traverse((m) => {
      if (!m.isMesh || seen.has(m.material)) return;
      seen.add(m.material);
      const mat = m.material;
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uCam = this.occl.uCam; sh.uniforms.uPl = this.occl.uPl;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWpo;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 wpo = vec4(transformed,1.);\n#ifdef USE_INSTANCING\nwpo = instanceMatrix*wpo;\n#endif\nvWpo = (modelMatrix*wpo).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWpo; uniform vec3 uCam, uPl;')
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
            vec3 seg = uPl - uCam; float L = length(seg); vec3 dir = seg / L;
            float t = dot(vWpo - uCam, dir);
            if (t > 0.0 && t < L - 1.2) {
              float d = length(vWpo - (uCam + dir * t));
              float k = 1.0 - smoothstep(1.4, 3.2, d);
              vec2 f = mod(gl_FragCoord.xy, 4.0);
              float th = (f.x * 4.0 + f.y) / 16.0;
              th = fract(th * 7.0 + f.x * 0.13);
              if (k * 0.85 > th) discard;
            }`);
      };
      mat.needsUpdate = true;
    });
    // A few real point lights for key locations (cheap glow elsewhere).
    if (this.quality !== 'low') {
      const fire = new THREE.PointLight(0xff8a3c, 40, 22, 1.8); fire.position.set(0, heightAt(0, 63) + 1.6, 63); this.scene.add(fire); this.lights.push({ l: fire, base: 40 });
      const crypt = new THREE.PointLight(0xff3322, 60, 30, 1.6); crypt.position.set(0, 4, -82); this.scene.add(crypt); this.lights.push({ l: crypt, base: 60 });
    }
  }

  addFlame(pos, size, big, color = 0xff8a3c) {
    // Billboard glow + flickering particles handled by fx; here a glow sprite
    const tex = World.glowTex ||= makeGlowTexture();
    const mat = new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 });
    const sp = new THREE.Sprite(mat); sp.position.copy(pos); sp.scale.setScalar(size * 3.2);
    this.scene.add(sp);
    this.flames.push({ sp, size, pos: pos.clone(), big, color, seed: Math.random() * 10 });
  }

  buildGrass() {
    const count = this.quality === 'high' ? 14000 : 6000;
    const blade = new THREE.BufferGeometry();
    const v = [];
    // Three crossed blades; each triangle duplicated with reversed winding so both sides are lit.
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI + 0.3, ca = Math.cos(a) * 0.09, sa = Math.sin(a) * 0.09;
      const ox = Math.cos(a + 1.57) * 0.08 * (k - 1), oz = Math.sin(a + 1.57) * 0.08 * (k - 1);
      const A = [-ca + ox, 0, -sa + oz], B = [ca + ox, 0, sa + oz], C = [ox * 2.2, 0.42, oz * 2.2];
      v.push(...A, ...B, ...C, ...B, ...A, ...C);
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    blade.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ side: THREE.FrontSide });
    mat.color.set(0xffffff);
    this.grassUniforms = { uTime: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.grassUniforms.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vH;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vH = position.y / 0.42;
          vec4 wp0 = instanceMatrix * vec4(0.,0.,0.,1.);
          float w = sin(uTime*1.7 + wp0.x*0.35 + wp0.z*0.25)*0.5 + sin(uTime*3.1 + wp0.x*0.9)*0.2;
          transformed.x += w * vH * vH * 0.22; transformed.z += w * vH * vH * 0.12;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.55, 1.25, vH);');
      sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.,1.,0.);');
    };
    const im = new THREE.InstancedMesh(blade, mat, count);
    const R = rng(99), m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    let n = 0, tries = 0;
    while (n < count && tries++ < count * 4) {
      const x = BOUNDS.minX + R() * (BOUNDS.maxX - BOUNDS.minX), z = BOUNDS.minZ + 8 + R() * (BOUNDS.maxZ - BOUNDS.minZ - 8);
      if (Math.abs(x - roadX(z)) < 3) continue;
      if (Math.hypot(x, z - 63) < 9 || Math.hypot(x, z + 84) < 13) continue;
      if (z < -60 && R() < 0.6) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28);
      const sc = 0.6 + R() * 0.8;
      m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.02, z), q, new THREE.Vector3(sc, sc * (0.6 + R() * 0.7), sc));
      im.setMatrixAt(n, m);
      const zn = ZONES.find((zz) => z >= zz.zMin && z < zz.zMax) || ZONES[1];
      col.set(zn.tint).offsetHSL((R() - 0.5) * 0.05, 0.05, 0.02 + (R() - 0.5) * 0.08);
      im.setColorAt(n, col);
      n++;
    }
    im.count = n;
    im.receiveShadow = true;
    im.frustumCulled = false;
    this.scene.add(im);
  }

  buildAmbientMotes() {
    // Floating embers / fireflies near the player.
    const n = 160; const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 60; p[i * 3 + 1] = Math.random() * 6; p[i * 3 + 2] = (Math.random() - 0.5) * 60; ph[i] = Math.random() * 10; }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    this.moteUniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0xffc36b) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.moteUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime; uniform vec3 uCenter; attribute float phase; varying float vA;
        void main(){ vec3 p = position; p.x = mod(p.x - uCenter.x + 30., 60.) - 30. + uCenter.x; p.z = mod(p.z - uCenter.z + 30., 60.) - 30. + uCenter.z;
          p.y += uCenter.y + sin(uTime*0.6+phase)*0.8 + 0.6; p.x += sin(uTime*0.4+phase*2.)*0.9;
          vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
          vA = 0.5+0.5*sin(uTime*2.+phase*3.); gl_PointSize = (6.0 * vA + 2.0) * (40.0 / -mv.z); }`,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d);
        gl_FragColor = vec4(uColor, a*vA*0.8); }`,
    });
    this.motes = new THREE.Points(geo, mat); this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  update(dt, playerPos, fx) {
    this.time += dt;
    if (this.grassUniforms) this.grassUniforms.uTime.value = this.time;
    this.moteUniforms.uTime.value = this.time;
    this.moteUniforms.uCenter.value.copy(playerPos);
    const zn = playerPos.z < -32 ? 0xff6a4a : playerPos.z < 10 ? 0x9cff9c : 0xffc36b;
    this.moteUniforms.uColor.value.lerp(new THREE.Color(zn), dt * 0.8);
    if (this.occl && this.cam) { this.occl.uCam.value.copy(this.cam.position); this.occl.uPl.value.set(playerPos.x, playerPos.y + 1.2, playerPos.z); }
    this.sun.position.set(playerPos.x - 25, 45, playerPos.z + 18);
    this.sun.target.position.copy(playerPos);
    this.sky.position.copy(playerPos); this.stars.position.copy(playerPos);
    for (const L of this.lights) L.l.intensity = L.base * (0.85 + Math.sin(this.time * 13 + L.base) * 0.08 + Math.sin(this.time * 7.3) * 0.07);
    for (const f of this.flames) {
      const fl = 0.88 + Math.sin(this.time * 12 + f.seed) * 0.08 + Math.sin(this.time * 23 + f.seed * 2) * 0.05;
      f.sp.scale.setScalar(f.size * 3.2 * fl);
      if (fx && f.pos.distanceToSquared(playerPos) < 900 && Math.random() < (f.big ? 0.9 : 0.25)) fx.flame(f.pos, f.size, f.color);
    }
  }
}

export function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

