import * as THREE from 'three';
import { heightAt, CAMP_POS, rng } from './world.js';
import { OUTPOSTS, ACTIVE_MAP, safeAt, nearestOutpost } from '../server/shared/terrain.js';
import { Player, Enemy, dist2d } from './units.js';
import { CAMPS, UNIQUES, ENEMIES, xpToNext, MAX_LEVEL, makeItem, RARITY, zoneAt , randomSlot , travelPrice } from './data.js';
import { Coop } from './coop.js';
import { cloneProp, cloneWeapon, makeCharacter, Animator } from './assets.js';
import { Quests, GIVER } from './quests.js';
import { sfx } from './audio.js';
import { saveGame } from './save.js';

const TMP = new THREE.Vector3();
const PM = new THREE.Matrix4(), FRUSTUM = new THREE.Frustum(), SPH = new THREE.Sphere();
let EID = 0;
const FOGC = new THREE.Color();

export class Game {
  constructor({ renderer, scene, camera, ui, input, save, quality, world, fx, net }) {
    Object.assign(this, { renderer, scene, camera, ui, input, save, quality });
    this.isGuest = !!net && !net.isHost;
    this.enemyById = new Map();
    this.time = 0; this.timers = [];
    this.fx = fx;
    this.world = world; world.cam = camera;
    this.campPos = CAMP_POS.clone().setY(heightAt(CAMP_POS.x, CAMP_POS.z));
    this.enemies = []; this.projectiles = []; this.loot = [];
    this.player = new Player(this, save);
    this.player.pos.copy(save.pos ? new THREE.Vector3(...save.pos) : this.campPos.clone().add(new THREE.Vector3(0, 0, -4)));
    this.world.resolve(this.player.pos, 0.5);
    this.camYawOffset = 0; this.camDist = 1; this.camPos = new THREE.Vector3();
    this.zone = null; this.saveT = 0;
    this.raycaster = new THREE.Raycaster();
    this.coop = net ? new Coop(this, net) : null;
    // Guests don't simulate the world: enemies arrive from the host.
    if (!this.isGuest) this.setupCamps(); else this.camps = [];
    this.setupUniques();
    this.setupNpcs();
    this.quests = new Quests(this);
    this.targetRing = this.makeTargetRing();
    this.moveMarker = this.makeMoveMarker();
    this.guide = this.makeGuide();
    this.ui.bind(this);
    this.warmup();
  }

  // Compile every effect/loot shader up front so the first hit, drop or skill doesn't stall the frame.
  warmup() {
    const at = new THREE.Vector3(0, -200, 0), tmp = [];
    const add = (o) => { o.position.copy(at); this.scene.add(o); tmp.push(o); };
    this.fx.slash(at, 0, 0xffffff, { dur: 0.01 });
    this.fx.groundRing(at, { dur: 0.01 });
    this.fx.telegraph(at, 1, 0.01);
    this.fx.pillar(at, 0xffffff, { dur: 0.01 });
    add(this.fx.lootBeam(at, 0xffffff));
    for (const n of ['chest', 'chest_gold', 'coin_stack_large', 'bone_A', 'pumpkin_yellow', 'candle_triple', 'skull']) add(cloneProp(n, 1));
    add(cloneWeapon('sk_staff', 1));
    add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0xff0000 })));
    this.renderer.compile(this.scene, this.camera);
    for (const o of tmp) this.scene.remove(o);
  }

  // ---------- setup ----------
  setupCamps() {
    const R = rng(4242);
    this.camps = CAMPS.map(([x, z, type, count, lmin, lmax]) => ({ x, z, type, count, lmin, lmax, alive: [], respawnQ: [] }));
    for (const c of this.camps) for (let i = 0; i < c.count; i++) this.spawnAtCamp(c, R);
  }
  spawnAtCamp(c, R = Math.random) {
    const home = new THREE.Vector3(c.x + (R() - 0.5) * 6, 0, c.z + (R() - 0.5) * 6);
    if (this.world.blocked(home.x, home.z, 0.7)) { home.x = c.x; home.z = c.z; }
    const lv = c.lmin + Math.floor(R() * (c.lmax - c.lmin + 1));
    const e = this.spawnEnemy(c.type, lv, home, null);
    e.camp = c; c.alive.push(e);
    return e;
  }
  spawnEnemy(type, lv, at, unique, opts = {}) {
    const e = new Enemy(this, type, lv, at, unique, opts);
    e.id = opts.id ?? EID++; e.awake = true;
    this.enemyById.set(e.id, e);
    this.enemies.push(e); this.ui.addPlate(e);
    return e;
  }
  setupUniques() {
    this.uniques = Object.values(UNIQUES).filter((u) => u.map === ACTIVE_MAP.id).map((u) => ({ def: u, timer: u.firstSpawn, enemy: null }));
  }
  spawnUnique(u) {
    const d = u.def;
    const at = new THREE.Vector3(d.pos[0], 0, d.pos[1]);
    u.enemy = this.spawnEnemy(d.type, d.level, at, d);
    this.announceAll(`⚔ ${d.name} (Sv.${d.level}) ${d.zone}'nda belirdi!`, 'unique');
    sfx.roar();
    this.efx('pillar', { x: at.x, z: at.z, c: d.tint });
  }
  setupNpcs() {
    this.npcs = [];
    // NPCs never use the player classes' models: barbarian smith, rogue merchant, ranger scout.
    const LOOK = {
      smith: { model: 'npc_barbarian', weapon: 'axe_2h', hide: [], tint: 0xb0602a, k: 0 },
      merchant: { model: 'npc_rogue', weapon: 'dagger', hide: [], tint: 0x7a48c8, k: 0 },
      quest: { model: 'npc_ranger', hide: [], tint: 0x3a8a5a, k: 0 },
    };
    for (const o of OUTPOSTS) for (const d of o.npcs) {
      const L = LOOK[d.role];
      const ch = makeCharacter(L.model, { weapon: L.weapon, hideMeshes: L.hide });
      const tc = new THREE.Color(L.tint), u = { value: new THREE.Vector4(tc.r, tc.g, tc.b, L.k) };
      if (L.k) for (const m of ch.materials) {
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uNpc = u;
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uNpc;')
            .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, uNpc.rgb * (0.45 + dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) * 1.6), uNpc.a);');
        };
        m.customProgramCacheKey = () => 'npc-tint'; m.needsUpdate = true;
      }
      const an = new Animator(ch); an.loop('Idle');
      const y = heightAt(d.x, d.z);
      ch.root.position.set(d.x, y, d.z); this.scene.add(ch.root);
      const ring = this.fx.glow(d.role === 'smith' ? 0xffb24a : d.role === 'quest' ? 0xffe08a : 0x6ad1ff, 2.2); ring.position.set(d.x, y + 3.2, d.z); this.scene.add(ring);
      const npc = { ch, an, pos: new THREE.Vector3(d.x, y, d.z), name: d.name, role: d.role, ring, outpost: o };
      this.npcs.push(npc); this.ui.addNpcPlate(npc);
    }
    if (this.world.portal) {
      const npc = { ch: null, an: null, pos: this.world.portal.pos.clone(), name: 'Işınlanma Kapısı', role: 'portal' };
      this.npcs.push(npc); this.ui.addNpcPlate(npc);
    }
  }

  // Travel to another map: save, then restart the game on that map (online players rejoin automatically).
  travel(mapId) {
    const s = this.save, p = this.player;
    if (this.traveling || mapId === ACTIVE_MAP.id) return;
    this.traveling = true;
    sfx.levelUp(); this.fx.pillar(p.pos, 0x8a7aff, { h: 18, r: 1.6, dur: 1.2 }); this.fx.flash('rgba(140,120,255,0.45)');
    this.fx.burst(p.pos.clone().setY(p.pos.y + 1), 90, 0x9fe8ff, { speed: 7, up: 8, size: 0.45, life: 1.2, grav: -1 });
    s.map = mapId; s.pos = null; s.hp = null;
    s.visited = [...new Set([...(s.visited || []), ACTIVE_MAP.id, mapId])];
    saveGame(s, null);
    try { sessionStorage.setItem('kv-resume', this.coop ? 'online' : 'solo'); } catch { /* ignore */ }
    setTimeout(() => { this.coop?.net.close(); location.reload(); }, 1100);
  }
  makeTargetRing() {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.visible = false; this.scene.add(m); return m;
  }
  // Glowing dots on the ground leading toward the nearest quest objective.
  makeGuide() {
    const N = 12;
    const geo = new THREE.CircleGeometry(0.17, 14); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.95, depthWrite: false, fog: false, toneMapped: false });
    const dots = new THREE.InstancedMesh(geo, mat, N); dots.frustumCulled = false; dots.renderOrder = 6; dots.visible = false;
    const halo = new THREE.InstancedMesh(new THREE.CircleGeometry(0.34, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a0d00, transparent: true, opacity: 0.35, depthWrite: false, fog: false }), N);
    halo.frustumCulled = false; halo.renderOrder = 5; halo.visible = false;
    this.scene.add(halo); this.scene.add(dots);
    const lbl = document.createElement('div'); lbl.className = 'guidelbl'; lbl.style.display = 'none';
    document.getElementById('overlay').appendChild(lbl);
    return { dots, halo, N, lbl, t: 0, pick: null, pickT: 0, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), sc: new THREE.Vector3() };
  }
  updateGuide(dt) {
    const G = this.guide, p = this.player;
    G.t += dt; G.pickT -= dt;
    if (G.pickT <= 0) {
      G.pickT = 0.5; G.pick = null;
      let bd = Infinity;
      for (const t of this.quests.targets()) {
        const d = Math.max(0, Math.hypot(t.x - p.pos.x, t.z - p.pos.z) - (t.r || 0));
        if (d < bd) { bd = d; G.pick = t; }
      }
    }
    const t = G.pick;
    const dist = t ? Math.max(0, Math.hypot(t.x - p.pos.x, t.z - p.pos.z) - (t.r || 0)) : 0;
    const show = !!t && !p.dead && dist > 3;
    G.dots.visible = G.halo.visible = show;
    if (!show) { if (G.lbl.style.display !== 'none') G.lbl.style.display = 'none'; return; }
    const dx = t.x - p.pos.x, dz = t.z - p.pos.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    const SP = 1.45, start = 1.4, maxLen = Math.min(dist + (t.r ? 0 : 0), start + SP * (G.N - 1));
    const flow = (G.t * 2.2) % SP;
    let last = start;
    for (let i = 0; i < G.N; i++) {
      const s = start + flow + i * SP;
      // dots fade in near the player and fade out at the end of the trail
      const k = s > maxLen ? 0 : Math.min(1, (s - start) / 1.2, (maxLen - s) / 2.2 + 0.15);
      const x = p.pos.x + ux * s, z = p.pos.z + uz * s;
      G.v.set(x, heightAt(x, z) + 0.14, z); G.sc.setScalar(Math.max(0.001, k));
      G.m4.compose(G.v, G.q, G.sc);
      G.dots.setMatrixAt(i, G.m4); G.halo.setMatrixAt(i, G.m4);
      if (k > 0) last = s;
    }
    G.dots.instanceMatrix.needsUpdate = true; G.halo.instanceMatrix.needsUpdate = true;
    const lx = p.pos.x + ux * (last + 1), lz = p.pos.z + uz * (last + 1);
    TMP.set(lx, heightAt(lx, lz) + 0.4, lz).project(this.camera);
    G.lbl.style.display = '';
    G.lbl.textContent = `${Math.round(dist)} m`;
    G.lbl.style.transform = `translate(${((TMP.x * 0.5 + 0.5) * innerWidth) | 0}px, ${((-TMP.y * 0.5 + 0.5) * innerHeight) | 0}px) translate(-50%, -50%)`;
  }
  makeMoveMarker() {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 24), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.visible = false; this.scene.add(m); return m;
  }

  // ---------- helpers ----------
  later(t, fn) { this.timers.push({ t, fn }); }
  players() { return this.coop ? [this.player, ...[...this.coop.remotes.values()].filter((r) => !r.gone && !r.fresh)] : [this.player]; }
  nearestPlayer(pos) {
    let best = null, bd = Infinity;
    for (const q of this.players()) { if (q.dead || safeAt(q.pos.x, q.pos.z)) continue; const d = dist2d(q.pos, pos); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  announceAll(text, kind) { this.ui.announce(text, kind); if (this.coop?.isHost) this.coop.send({ t: 'ann', x: text, k: kind }); }

  // World effects caused by enemies: played here and, on the host, mirrored to guests.
  efx(kind, a, netOnly) {
    if (!netOnly) this.playEfx(kind, a);
    if (this.coop?.isHost) this.coop.send({ t: 'efx', k: kind, a });
  }
  playEfx(kind, a) {
    const fx = this.fx;
    if (kind === 'ebolt') {
      const e = this.enemyById.get(a.e), to = this.coop?.remoteOrMe(a.to);
      if (e && to) { const from = e.pos.clone(); from.y += 1.6 * e.scale; this.projectile({ from, target: to, speed: 11, color: e.T.bolt || 0xa66bff, size: 0.55, owner: e, mult: 0, kind: 'enemyBolt', visual: true }); }
      return;
    }
    const at = new THREE.Vector3(a.x, heightAt(a.x, a.z), a.z);
    const d = dist2d(at, this.player.pos), near = d < 18, audible = d < 40;
    switch (kind) {
      case 'roar': if (audible) sfx.roar(); if (near) fx.shake(0.6); fx.groundRing(at, { color: a.c, r0: 1, r1: a.r, dur: 1 }); break;
      case 'enrage': this.ui.announce(`${a.name} öfkelendi!`, 'boss'); if (audible) sfx.roar(); if (near) { fx.shake(0.7); fx.flash('rgba(255,30,30,0.25)'); } fx.groundRing(at, { color: 0xff2222, r0: 1, r1: 14, dur: 0.9 }); break;
      case 'tele': fx.telegraph(at, a.r, a.dur); if (audible) sfx.warn(); break;
      case 'slam':
        if (audible) sfx.boom(true); if (near) { fx.shake(0.9); fx.stop(0.08); }
        fx.groundRing(at, { color: 0xff6a3a, r0: 0.5, r1: a.r, dur: 0.5 }); fx.dust(at, 20, 0x6a5a48, 2);
        fx.burst(at.clone().setY(at.y + 0.3), 40, 0xff8a3a, { speed: 9, up: 4, size: 0.6 }); break;
      case 'spin': if (audible) sfx.spin(); fx.groundRing(at, { color: a.c, r0: 1, r1: a.r, dur: 0.3, opacity: 0.8 }); break;
      case 'summon': if (audible) sfx.roar(); fx.groundRing(at, { color: 0x8a5aff, r0: 1, r1: 8, dur: 0.8 }); break;
      case 'bigswing': if (near) fx.shake(0.3); fx.groundRing(at, { color: 0xffffff, r0: 0.5, r1: 2.5, dur: 0.3 }); break;
      case 'pillar': fx.pillar(at, a.c, { h: 30, r: 2.5, dur: 2.5 }); break;
      default: break;
    }
  }
  enemiesNear(p, r) { return this.enemies.filter((e) => e.alive && e.state !== 'spawn' && dist2d(e.pos, p) < r + e.radius); }
  // Auto-target: a boss nearby always wins, otherwise the closest monster.
  pickTarget(p, r = 12, exclude = null) {
    let boss = null, best = null, bd = r, bb = 18;
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'spawn' || e === exclude) continue;
      const d = dist2d(e.pos, p);
      if (e.isBoss && d < bb) { bb = d; boss = e; }
      if (d < bd) { bd = d; best = e; }
    }
    return boss || best;
  }
  nearestEnemy(p, r) {
    let best = null, bd = r;
    for (const e of this.enemies) { if (!e.alive || e.state === 'spawn') continue; const d = dist2d(e.pos, p); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  damage(from, to, mult, opts = {}) {
    const isPlayer = from === this.player;
    // No fighting inside camps/outposts, in either direction.
    if ((to.isPlayer && safeAt(to.pos.x, to.pos.z)) || (from.isPlayer && safeAt(from.pos.x, from.pos.z))) return 0;
    const atk = isPlayer ? from.effAtk : from.atk;
    const def = to.isEnemy ? to.def : to === this.player ? to.effDef : (to.def || 5);
    let dmg = atk * mult * (60 / (60 + def * 3)) * (0.9 + Math.random() * 0.2);
    let crit = false;
    if (isPlayer && Math.random() < 0.12) { crit = true; dmg *= 1.8; }
    dmg = Math.max(1, Math.round(dmg));
    if (to.isEnemy && to.remote) {
      // Guest hitting a host-simulated enemy: report it, predict the hit locally.
      this.coop.send({ t: 'dmg', to: this.coop.hostId, id: to.id, d: dmg, k: opts.knock || 0, st: opts.stun || 0, sl: opts.slow || 0 });
      to.hitFlash(); to.hp = Math.max(1, to.hp - dmg); to.predT = this.time;
      if (opts.slow) to.slowT = opts.slow;
    } else to.takeHit(dmg, from, opts);
    if (to.isEnemy) {
      this.fx.number(to.pos, crit ? dmg + '!' : String(dmg), crit ? 'crit big' : opts.color === 'frost' ? 'frost' : '');
      sfx.hit(crit);
      const hp = to.pos.clone(); hp.y += 1.2 * to.scale;
      this.fx.burst(hp, crit ? 18 : 8, crit ? 0xffd36b : 0xffe7c2, { speed: crit ? 7 : 4, up: 2, size: crit ? 0.45 : 0.3, life: 0.35 });
      this.fx.burst(hp, 5, 0xe8e2d0, { solid: true, speed: 4, up: 4, size: 0.18, life: 0.6, grav: 14 });
      if (crit) { this.fx.shake(0.15); this.fx.stop(0.05); }
      if (isPlayer && !this.player.target) this.player.target = to;
    }
    return dmg;
  }

  projectile(o) {
    const core = this.fx.glow(o.color, o.size * 2.2);
    const inner = this.fx.glow(0xffffff, o.size * 0.9);
    core.add(inner); inner.scale.setScalar(0.4);
    core.position.copy(o.from); this.scene.add(core);
    this.projectiles.push({ ...o, pos: o.from.clone(), mesh: core, life: 3 });
  }

  // Mage black hole: swirling vortex that drags enemies toward its centre (owner null = remote replay, visuals only).
  blackHole(at, owner) {
    sfx.frost(); this.fx.shake(0.3);
    const core = this.fx.glow(0x6a3cff, 4.5); core.position.copy(at).setY(at.y + 1.2);
    this.fx.timedMesh(core, 3.2, (k) => { core.scale.setScalar(4.5 * Math.min(1, k * 6) * (1 - Math.max(0, k - 0.85) * 6)); core.material.rotation += 0.15; });
    for (let k = 0; k < 6; k++) this.later(k * 0.5, () => {
      this.fx.groundRing(at, { color: 0x8a5cff, r0: 6, r1: 0.5, dur: 0.5 });
      for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r = 3 + Math.random() * 3; this.fx.trail(at.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.3 + Math.random() * 2, Math.sin(a) * r)), 0xb08cff, 0.45, 0.5); }
      if (!owner) return;
      for (const e of this.enemiesNear(at, 6.5)) {
        if (!e.remote && !e.unique && e.state !== 'cast') { const d = new THREE.Vector3().subVectors(at, e.pos).setY(0); const l = d.length(); if (l > 1) e.pos.addScaledVector(d, Math.min(1, 1.4 / l)); }
        this.damage(owner, e, 0.9, { knock: 0, slow: 1, color: 'frost' });
      }
    });
  }

  meteorImpact(at, owner) {
    // A meteor falls from the sky and explodes.
    const start = at.clone().add(new THREE.Vector3(-6, 22, 6));
    const m = this.fx.glow(0xff7a2a, 4); m.position.copy(start); this.scene.add(m);
    const fall = { t: 0 };
    const tick = (dt) => {
      fall.t += dt * 3.2; const k = Math.min(1, fall.t);
      m.position.lerpVectors(start, at, k * k);
      for (let i = 0; i < 3; i++) this.fx.trail(m.position, i ? 0xff9a3a : 0xffe08a, 1.2, 0.5);
      if (k >= 1) {
        this.scene.remove(m); m.material.dispose();
        const nearMe = dist2d(at, this.player.pos) < 20;
        if (dist2d(at, this.player.pos) < 40) sfx.boom(true);
        if (nearMe) { this.fx.shake(owner ? 1 : 0.4); if (owner) { this.fx.stop(0.1); this.fx.flash('rgba(255,150,60,0.25)'); } }
        this.fx.groundRing(at, { color: 0xff7a2a, r0: 0.5, r1: 6, dur: 0.6 });
        this.fx.groundRing(at, { color: 0xffe08a, r0: 0.5, r1: 4.5, dur: 0.4 });
        this.fx.burst(at.clone().setY(at.y + 0.4), 120, 0xff7a2a, { speed: 14, up: 6, size: 0.9, life: 0.9, grav: 4 });
        this.fx.burst(at.clone().setY(at.y + 0.4), 50, 0x553322, { solid: true, speed: 9, up: 9, size: 0.35, life: 1.2, grav: 18 });
        this.fx.dust(at, 24, 0x5a4a3a, 2.5);
        if (owner) for (const e of this.enemiesNear(at, 4.5)) this.damage(owner, e, 4.2, { knock: 1.4 });
        return true;
      }
    };
    this.tickers = this.tickers || []; this.tickers.push(tick);
  }

  // ---------- events ----------
  onEnemyKilled(e, killer) {
    const p = this.player;
    if (e.camp) { e.camp.alive = e.camp.alive.filter((x) => x !== e); e.camp.respawnQ.push(14 + Math.random() * 8); }
    if (!killer || !killer.isPlayer) return;
    const info = { id: e.id, type: e.type, lv: e.level, u: e.unique ? e.unique.id : '', s: e.summoned ? 1 : 0, x: e.pos.x, z: e.pos.z };
    if (this.coop?.isHost) this.coop.send({ t: 'ekill', ...info });
    this.rewardKill(info);
    if (e.noLoot) return;
    // Loot
    const drop = (kind, data) => this.dropLoot(e.pos, kind, data);
    if (e.unique) {
      const u = UNIQUES[e.unique.id];
      this.announceAll(`🏆 ${u.name} yenildi!`, 'victory');
      sfx.rare();
      drop('gold', Math.round(u.gold * (0.8 + Math.random() * 0.4)));
      const items = u.final ? [3, 2, 2] : [2, Math.random() < 0.5 ? 2 : 1];
      for (const r of items) { const c = this.lootClass(); drop('item', makeItem(randomSlot(c), e.level, r, c)); }
      drop('potion', 'hp'); drop('potion', 'mp'); drop('potion', 'hp');
      const st = this.uniques.find((x) => x.def.id === u.id); st.enemy = null; st.timer = u.respawn;
      return;
    }
    drop('gold', Math.round(e.level * 3 * (0.6 + Math.random() * 0.8) + 2));
    if (Math.random() < 0.16) {
      const r = Math.random(); const rar = r < 0.04 ? 2 : r < 0.26 ? 1 : 0;
      const c = this.lootClass(); drop('item', makeItem(randomSlot(c), e.level, rar, c));
    }
    if (Math.random() < 0.14) drop('potion', Math.random() < 0.55 ? 'hp' : 'mp');
  }

  // XP and quest credit for a kill: everyone in the party who is close enough gets it.
  rewardKill(info) {
    const p = this.player; if (p.dead) return;
    if (Math.hypot(p.pos.x - info.x, p.pos.z - info.z) > 32) return;
    const T = ENEMIES[info.type], uq = info.u ? UNIQUES[info.u] : null;
    const at = new THREE.Vector3(info.x, heightAt(info.x, info.z), info.z);
    const diff = THREE.MathUtils.clamp(1 + (info.lv - p.level) * 0.15, 0.15, 1.6);
    const xp = Math.round(14 * Math.pow(info.lv, 1.25) * T.xp * diff * (uq ? uq.xpMul : 1) * (info.s ? 0.3 : 1));
    this.gainXp(xp, at);
    if (uq) this.save.stats.uniques = (this.save.stats.uniques || 0) + 1;
    else this.save.stats.kills = (this.save.stats.kills || 0) + 1;
    this.quests.onKill({ type: info.type, level: info.lv, unique: uq, pos: at });
  }
  // Shared loot can be anyone's class.
  lootClass() {
    const cls = [this.save.cls, ...(this.coop ? [...this.coop.remotes.values()].map((r) => r.cls.id) : [])];
    return cls[Math.floor(Math.random() * cls.length)];
  }

  dropLoot(at, kind, data, net = {}) {
    const pos = net.exact ? at.clone() : at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 0, (Math.random() - 0.5) * 2.2));
    pos.y = heightAt(pos.x, pos.z);
    const shared = !!this.coop && kind !== 'quest';
    const lid = net.lid ?? (this.coop ? this.coop.nextLid() : 0);
    if (shared && this.coop.isHost && net.lid == null) this.coop.send({ t: 'loot', lid, kind, data, x: pos.x, z: pos.z });
    let mesh, beam = null, color = 0xffd36b;
    if (kind === 'gold') { mesh = cloneProp('coin_stack_large', 0.32); }
    else if (kind === 'item') {
      color = new THREE.Color(RARITY[data.rarity].color).getHex();
      mesh = cloneProp(data.rarity >= 2 ? 'chest_gold' : 'chest', 0.42);
      beam = this.fx.lootBeam(pos, color);
      if (data.rarity >= 1 && !net.quiet && dist2d(pos, this.player.pos) < 40) sfx.rare();
    } else if (kind === 'quest') {
      color = 0x7dff9a;
      mesh = data.icon === 'staff' ? cloneWeapon('sk_staff', 0.55) : cloneProp(data.icon || 'bone_A', data.icon && data.icon !== 'bone_A' ? 0.8 : 1.1);
      beam = this.fx.lootBeam(pos, color);
    } else {
      color = data === 'hp' ? 0xff4a5a : 0x4aa8ff;
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.8 }));
    }
    const glow = this.fx.glow(color, 1.6); glow.position.y = 0.4; mesh.add(glow);
    mesh.position.copy(pos); this.scene.add(mesh);
    const l = { kind, data, pos, mesh, beam, t: 0, vy: 5, y: 1, color, lid, shared };
    this.loot.push(l);
    this.ui.addLootPlate?.(l);
  }

  pickup(l) {
    const s = this.save, p = this.player;
    if (l.kind === 'gold') { const v = Math.round(l.data * (p.elixir('gold') ? 1.5 : 1)); s.gold += v; sfx.coin(); this.fx.number(p.pos, `+${v} altın`, 'gold'); }
    else if (l.kind === 'potion') { s.potions[l.data] = (s.potions[l.data] || 0) + 1; sfx.pickup(); this.ui.toast(l.data === 'hp' ? '🧪 Can İksiri' : '💧 Mana İksiri', l.data === 'hp' ? '#ff8a96' : '#8ac8ff'); }
    else if (l.kind === 'quest') { sfx.pickup(); this.quests.onQuestItem(l.data); }
    else {
      if (s.bag.length >= s.bagMax) { this.ui.toast('Çanta dolu!', '#ff6a6a'); return false; }
      sfx.pickup(); this.giveItem(l.data);
    }
    return true;
  }
  giveItem(it) {
    const s = this.save, p = this.player;
    if (!s.equip[it.slot]) { s.equip[it.slot] = it; p.recalc(); p.updateWeaponLook(); this.ui.toast(`Kuşanıldı: ${it.name}`, RARITY[it.rarity].color); }
    else if (s.bag.length < s.bagMax) { s.bag.push(it); this.ui.toast(`${RARITY[it.rarity].name}: ${it.name}`, RARITY[it.rarity].color); }
    else { s.gold += 50; this.ui.toast('Çanta dolu, eşya yerine 50 altın aldın', '#ff8a6a'); }
    this.ui.refreshInventory();
  }

  gainXp(xp, at) {
    const s = this.save, p = this.player;
    if (s.level >= MAX_LEVEL) return;
    if (p.elixir('xp')) xp = Math.round(xp * 1.5);
    s.xp += xp;
    this.fx.number(at, `+${xp} XP`, 'xp');
    let up = false;
    while (s.level < MAX_LEVEL && s.xp >= xpToNext(s.level)) { s.xp -= xpToNext(s.level); s.level++; up = true; }
    if (up) {
      p.recalc(); p.hp = p.maxHp; p.mp = p.maxMp;
      sfx.levelUp();
      this.fx.pillar(p.pos, 0xffd36b, { h: 16, r: 1.3, dur: 1.8 });
      this.fx.groundRing(p.pos, { color: 0xffd36b, r0: 0.5, r1: 7, dur: 0.9 });
      this.fx.burst(p.pos.clone().setY(p.pos.y + 1), 80, 0xffd36b, { speed: 6, up: 8, size: 0.45, life: 1.4, grav: 3 });
      this.ui.levelUp(s.level);
      const unlocked = p.cls.skills.find((k) => k.unlock === s.level);
      if (unlocked) this.later(1.4, () => this.ui.announce(`Yeni yetenek: ${unlocked.icon} ${unlocked.name}`, 'skill'));
      saveGame(this.save, p);
    }
  }

  onPlayerDeath() {
    this.ui.death(true);
    // XP penalty: lose 5% of current level requirement
    const s = this.save; s.xp = Math.max(0, s.xp - Math.round(xpToNext(s.level) * 0.05));
  }
  revive() {
    this.ui.death(false);
    const o = nearestOutpost(this.player.pos.x, this.player.pos.z);
    const at = o.id === 'camp' ? this.campPos.clone().add(new THREE.Vector3(0, 0, -4)) : new THREE.Vector3(o.x, 0, o.z - 3.5);
    this.world.resolve(at, 0.6);
    this.player.revive(at);
    this.ui.toast(`${o.name}'nda dirildin`, '#bfe3ff');
    for (const e of this.enemies) if (!e.remote && (e.state === 'chase' || e.state === 'cast') && (!e.tgt || e.tgt === this.player)) { e.state = 'return'; e.tgt = null; }
  }

  // ---------- input ----------
  handleTap(x, y) {
    const p = this.player; if (p.dead) return;
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const boxes = this.enemies.filter((e) => e.alive && e.root.visible).map((e) => e.hitbox);
    const hit = this.raycaster.intersectObjects(boxes, false)[0];
    if (hit) {
      const e = hit.object.userData.enemy;
      p.target = e; p.autoAttack = true; p.moveTarget = null; sfx.ui();
      return;
    }
    // Quest collectible tap
    for (const n of this.quests.nodes) {
      if (!n.alive || !n.mesh.visible) continue;
      TMP.copy(n.pos); TMP.y += 0.5; TMP.project(this.camera);
      const sx = (TMP.x * 0.5 + 0.5) * innerWidth, sy = (-TMP.y * 0.5 + 0.5) * innerHeight;
      if (Math.hypot(sx - x, sy - y) < 45) { this.quests.startCollect(n); return; }
    }
    // NPC tap
    for (const n of this.npcs) {
      TMP.copy(n.pos); TMP.y += 1.2; TMP.project(this.camera);
      const sx = (TMP.x * 0.5 + 0.5) * innerWidth, sy = (-TMP.y * 0.5 + 0.5) * innerHeight;
      if (Math.hypot(sx - x, sy - y) < 50) { this.ui.openNpc(n); return; }
    }
    const g = this.raycaster.intersectObject(this.world.terrain, false)[0];
    if (g) {
      p.moveTarget = g.point.clone(); p.autoAttack = false; p.path = null; p.walk = null;
      this.moveMarker.visible = true; this.moveMarker.position.copy(g.point).setY(g.point.y + 0.06); this.moveMarker.userData.t = 0;
    }
  }
  // Fast travel between the camp and outposts of this map, for a little gold.
  fastTravel(o) {
    const p = this.player, s = this.save, price = travelPrice(s.level);
    if (p.dead) return;
    if (p.lastDamageT < 6) { this.ui.toast('Savaşırken ışınlanamazsın', '#ff8a6a'); sfx.deny(); return; }
    if (s.gold < price) { this.ui.toast('Yetersiz altın', '#ff6a6a'); sfx.deny(); return; }
    s.gold -= price; sfx.coin();
    this.fx.pillar(p.pos, 0x8a7aff, { h: 10, r: 1.2, dur: 0.9 });
    p.path = null; p.moveTarget = null; p.autoAttack = false; p.target = null;
    p.pos.set(o.x + 2, 0, o.z + 2.5); this.world.resolve(p.pos, 0.5);
    this.fx.pillar(p.pos, 0x8a7aff, { h: 10, r: 1.2, dur: 0.9 }); this.fx.burst(p.pos.clone().setY(p.pos.y + 1), 40, 0x9fe8ff, { speed: 5, up: 5, size: 0.4 });
    this.ui.toast(`⚡ ${o.name} (-${price} 🪙)`, '#c9bfff');
    saveGame(s, p);
  }
  attackButton() {
    const p = this.player; if (p.dead) return;
    if (p.safe) { this.ui.toast('Güvenli bölgede savaşamazsın', '#9fe0ff'); return; }
    const cur = p.target, dc = cur?.alive ? dist2d(p.pos, cur.pos) : 999;
    const keep = cur?.alive && ((cur.isBoss && dc < 18) || dc <= p.cls.range + cur.radius + 0.6);
    if (!keep) p.target = this.pickTarget(p.pos);
    if (p.target) { p.autoAttack = true; p.moveTarget = null; }
    else { this.ui.toast('Yakında düşman yok', '#ffcf6a'); }
  }

  // ---------- main update ----------
  update(rawDt) {
    let dt = Math.min(rawDt, 0.05);
    if (this.fx.hitStop > 0) { this.fx.hitStop -= dt; dt *= 0.08; }
    this.time += dt;
    const p = this.player;
    // timers
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    if (this.tickers) this.tickers = this.tickers.filter((f) => !f(dt));

    // input → world-space move vector (camera looks north, so screen up = -z)
    const mv = this.input.move;
    const move = TMP.set(mv.x, 0, mv.y);
    p.update(dt, { move: move.clone() });

    this.updateEnemies(dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].remove) {
      const e = this.enemies[i];
      this.ui.removePlate(e); e.dispose(); this.enemies.splice(i, 1);
      if (this.enemyById.get(e.id) === e) this.enemyById.delete(e.id);
      if (this.player.target === e) { this.player.target = null; this.player.autoAttack = false; }
    }
    for (const n of this.npcs) {
      if (!n.ch) continue;
      const d = dist2d(n.pos, p.pos); n.ch.root.visible = d < 45;
      if (d < 45) n.an.update(dt);
      if (d < 6) n.ch.root.rotation.y = Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z);
    }

    // camps respawn (host / single player only)
    for (const c of this.camps) {
      for (let i = c.respawnQ.length - 1; i >= 0; i--) {
        c.respawnQ[i] -= dt;
        if (c.respawnQ[i] <= 0 && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) > 7) { c.respawnQ.splice(i, 1); this.spawnAtCamp(c); }
      }
    }
    for (const u of this.uniques) {
      if (u.enemy) continue;
      u.timer -= dt;
      if (u.timer <= 0 && !this.isGuest) this.spawnUnique(u);
    }
    this.coop?.update(dt);

    this.updateProjectiles(dt);
    this.updateLoot(dt);
    this.quests.update(dt);

    // zone banner
    const zn = zoneAt(p.pos.z);
    if (zn !== this.zone) { this.zone = zn; this.ui.zone(zn); this.scene.fog.color.set(zn.fog); }
    this.scene.fog.color.lerp(FOGC.set(this.zone.fog), dt);

    // target ring
    if (p.target && p.target.alive) {
      const t = p.target; this.targetRing.visible = true;
      this.targetRing.position.set(t.pos.x, t.pos.y + 0.07, t.pos.z);
      this.targetRing.scale.setScalar(t.radius * 1.7 + Math.sin(this.time * 6) * 0.05);
      this.targetRing.material.color.set(t.isBoss ? 0xff2a2a : 0xff6a4a);
    } else this.targetRing.visible = false;
    this.updateGuide(rawDt);
    if (this.moveMarker.visible) {
      const m = this.moveMarker; m.userData.t += dt; if (p.path?.length && m.userData.t > 0.6) m.userData.t = 0; m.scale.setScalar(1 + m.userData.t * 2); m.material.opacity = 1 - m.userData.t * 1.6;
      if ((m.userData.t > 0.6 && !p.path) || !p.moveTarget) { m.visible = false; this.walkDest = null; }
    }

    this.world.update(dt, p.pos, this.fx);
    this.fx.update(dt, rawDt);
    this.updateCamera(rawDt);
    this.ui.update(rawDt);

    this.saveT += rawDt;
    if (this.saveT > 8) { this.saveT = 0; saveGame(this.save, p); }
  }

  // Only enemies near the player think; only on-screen ones animate and render.
  updateEnemies(dt) {
    const p = this.player, cam = this.camera;
    this.frame = (this.frame || 0) + 1;
    cam.updateMatrixWorld();
    PM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); FRUSTUM.setFromProjectionMatrix(PM);
    for (const e of this.enemies) {
      const d = dist2d(e.pos, p.pos);
      let dn = d;
      if (this.coop && !e.remote) for (const r of this.coop.remotes.values()) if (!r.gone) dn = Math.min(dn, dist2d(e.pos, r.pos));
      const busy = e.remote || !e.alive || e.state === 'chase' || e.state === 'cast' || e.state === 'return';
      e.awake = busy || dn < 36;
      if (!e.awake) { if (e.root.visible) e.root.visible = false; continue; }
      SPH.center.set(e.pos.x, e.pos.y + 1.2 * e.scale, e.pos.z); SPH.radius = 2 * e.scale;
      const onScreen = d < 60 && FRUSTUM.intersectsSphere(SPH);
      if (e.root.visible !== onScreen) e.root.visible = onScreen;
      e.animate = onScreen && (d < 20 || e.isBoss || (this.frame + e.id) % 2 === 0);
      e.update(dt);
    }
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      const tgt = pr.target;
      const aim = tgt && tgt.alive !== false && !tgt.dead && !tgt.gone ? TMP.copy(tgt.pos).setY(tgt.pos.y + 1.1 * (tgt.scale || 1)) : null;
      if (aim) { const dir = aim.clone().sub(pr.pos); const d = dir.length(); dir.normalize(); pr.vel = dir.multiplyScalar(pr.speed); if (d < 0.7) pr.life = -1, pr.hit = true; }
      if (pr.vel) pr.pos.addScaledVector(pr.vel, dt);
      pr.mesh.position.copy(pr.pos);
      pr.mesh.material.rotation += dt * 6;
      this.fx.trail(pr.pos, pr.color, pr.size * 0.8, 0.3);
      if (pr.kind === 'fireball') this.fx.trail(pr.pos, 0xffe08a, pr.size * 0.5, 0.25);
      if (pr.life <= 0) {
        if (pr.hit || pr.aoe) this.projectileHit(pr);
        this.scene.remove(pr.mesh); pr.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }
  projectileHit(pr) {
    const at = pr.pos.clone();
    if (pr.kind === 'enemyBolt') {
      if (pr.hit && !pr.visual && pr.owner.alive && pr.target && !pr.target.dead) this.damage(pr.owner, pr.target, pr.mult);
      this.fx.burst(at, 14, pr.color, { speed: 4, size: 0.4, life: 0.4 });
      return;
    }
    if (pr.kind === 'fireball') {
      sfx.boom(false); this.fx.shake(0.3);
      const g = at.clone(); g.y = heightAt(g.x, g.z);
      this.fx.groundRing(g, { color: 0xff7a2a, r0: 0.5, r1: pr.aoe, dur: 0.4 });
      this.fx.burst(at, 60, 0xff7a2a, { speed: 9, up: 4, size: 0.7, life: 0.6, grav: 2 });
      this.fx.burst(at, 20, 0xffe08a, { speed: 5, up: 3, size: 0.5, life: 0.4 });
      if (!pr.visual) for (const e of this.enemiesNear(at, pr.aoe)) this.damage(pr.owner, e, pr.mult * (e === pr.target ? 1 : 0.7), { knock: 0.8 });
      return;
    }
    if (pr.hit && !pr.visual && pr.target?.alive) this.damage(pr.owner, pr.target, pr.mult, { knock: 0.15 });
    this.fx.burst(at, 16, pr.color, { speed: 5, size: 0.4, life: 0.35 });
  }

  updateLoot(dt) {
    const p = this.player;
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const l = this.loot[i]; l.t += dt;
      if (l.flying) {
        const k = Math.min(1, (l.t - l.flyStart) / 0.25);
        TMP.copy(p.pos).setY(p.pos.y + 1);
        l.mesh.position.lerp(TMP, k);
        l.mesh.scale.multiplyScalar(0.92);
        if (k >= 1) { this.removeLoot(i); }
        continue;
      }
      // pop out of the corpse
      if (l.vy > -10 && l.y > 0) { l.vy -= 20 * dt; l.y = Math.max(0, l.y + l.vy * dt); }
      l.mesh.position.set(l.pos.x, l.pos.y + l.y + (l.y === 0 ? 0.08 + Math.sin(this.time * 3 + i) * 0.06 : 0), l.pos.z);
      l.mesh.rotation.y += dt * (l.kind === 'gold' ? 2 : 0.8);
      if (l.beam) l.beam.material.opacity = 0.3 + Math.sin(this.time * 4) * 0.12;
      if (l.pending && this.time - l.pending > 1.5) l.pending = 0;
      if (!p.dead && l.t > 0.5 && !l.pending && !l.taken && dist2d(l.pos, p.pos) < 2.4) {
        if (l.shared) {
          // Shared loot: first come, first served — the host decides.
          if (l.kind === 'item' && this.save.bag.length >= this.save.bagMax && this.save.equip[l.data.slot]) { if (!l.fullWarn) { l.fullWarn = true; this.ui.toast('Çanta dolu!', '#ff6a6a'); } }
          else if (this.coop.isHost) this.hostPick(l.lid, this.coop.id);
          else { this.coop.send({ t: 'pick', to: this.coop.hostId, lid: l.lid }); l.pending = this.time; }
        } else if (this.pickup(l)) this.flyLoot(l);
      }
      if (l.t > 120) this.removeLoot(i);
    }
  }
  flyLoot(l) { l.flying = true; l.flyStart = l.t; if (l.beam) { this.scene.remove(l.beam); l.beam = null; } }
  hostPick(lid, by) {
    const l = this.loot.find((x) => x.lid === lid);
    if (!l || l.taken) return;
    l.taken = true;
    this.coop.send({ t: 'picked', lid, by });
    this.onPicked(lid, by);
  }
  onPicked(lid, by) {
    const i = this.loot.findIndex((x) => x.lid === lid); if (i < 0) return;
    const l = this.loot[i]; l.taken = true;
    if (by === this.coop.id) { if (this.pickup(l)) this.flyLoot(l); else this.removeLoot(i); }
    else {
      const r = this.coop.remotes.get(by);
      this.fx.burst(l.mesh.position.clone().setY(l.mesh.position.y + 0.4), 10, l.color, { speed: 2, up: 3, size: 0.3 });
      if (r && l.kind === 'item' && dist2d(l.pos, this.player.pos) < 25) this.ui.toast(`${r.name}: ${l.data.name}`, RARITY[l.data.rarity].color);
      this.removeLoot(i);
    }
  }
  removeLoot(i) {
    const l = this.loot[i];
    this.scene.remove(l.mesh); if (l.beam) this.scene.remove(l.beam);
    this.ui.removeLootPlate?.(l);
    this.loot.splice(i, 1);
  }

  updateCamera(dt) {
    const p = this.player;
    const zoom = this.input.zoom; // 0.6 … 1.6
    const off = new THREE.Vector3(0, 11.5 * zoom, 10.5 * zoom);
    const want = p.pos.clone().add(off);
    if (!this.camInit) { this.camPos.copy(want); this.camInit = true; }
    this.camPos.lerp(want, 1 - Math.exp(-dt * 8));
    this.camera.position.copy(this.camPos);
    const s = this.fx.shakeAmt;
    if (s > 0) {
      this.camera.position.x += (Math.random() - 0.5) * s * 0.7;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.5;
      this.fx.shakeAmt = Math.max(0, s - dt * 3.2);
    }
    this.camera.lookAt(this.camPos.x - off.x, this.camPos.y - off.y + 1.3, this.camPos.z - off.z);
  }
}
