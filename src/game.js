import * as THREE from 'three';
import { heightAt, CAMP_POS, rng } from './world.js';
import { Player, Enemy, dist2d } from './units.js';
import { CAMPS, UNIQUES, xpToNext, MAX_LEVEL, makeItem, RARITY, zoneAt } from './data.js';
import { cloneProp, makeCharacter, Animator } from './assets.js';
import { sfx } from './audio.js';
import { saveGame } from './save.js';

const TMP = new THREE.Vector3();

export class Game {
  constructor({ renderer, scene, camera, ui, input, save, quality, world, fx }) {
    Object.assign(this, { renderer, scene, camera, ui, input, save, quality });
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
    this.setupCamps();
    this.setupUniques();
    this.setupNpcs();
    this.targetRing = this.makeTargetRing();
    this.moveMarker = this.makeMoveMarker();
    this.ui.bind(this);
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
  spawnEnemy(type, lv, at, unique) {
    const e = new Enemy(this, type, lv, at, unique);
    this.enemies.push(e); this.ui.addPlate(e);
    return e;
  }
  setupUniques() {
    this.uniques = Object.values(UNIQUES).map((u) => ({ def: u, timer: u.firstSpawn, enemy: null }));
  }
  spawnUnique(u) {
    const d = u.def;
    const at = new THREE.Vector3(d.pos[0], 0, d.pos[1]);
    u.enemy = this.spawnEnemy(d.type, d.level, at, d);
    this.ui.announce(`⚔ ${d.name} (Sv.${d.level}) ${d.zone}'nda belirdi!`, 'unique');
    sfx.roar();
    this.fx.pillar(at.clone().setY(heightAt(at.x, at.z)), d.tint, { h: 30, r: 2.5, dur: 2.5 });
  }
  setupNpcs() {
    this.npcs = [];
    const mk = (model, x, z, yaw, name, role, hide) => {
      const ch = makeCharacter(model, { hideMeshes: hide });
      const an = new Animator(ch); an.loop(role === 'smith' ? 'Idle' : 'Idle');
      ch.root.position.set(x, heightAt(x, z), z); ch.root.rotation.y = yaw; this.scene.add(ch.root);
      const ring = this.fx.glow(role === 'smith' ? 0xffb24a : 0x6ad1ff, 2.2); ring.position.set(x, heightAt(x, z) + 3.2, z); this.scene.add(ring);
      const npc = { ch, an, pos: new THREE.Vector3(x, heightAt(x, z), z), name, role, ring };
      this.npcs.push(npc); this.ui.addNpcPlate(npc);
    };
    mk('knight', 7.5, 57.3, 0, 'Demirci Haldun', 'smith', ['Badge_Shield']);
    mk('mage', -7.5, 55.2, 0, 'Tüccar Zerrin', 'merchant', []);
  }
  makeTargetRing() {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.visible = false; this.scene.add(m); return m;
  }
  makeMoveMarker() {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 24), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.visible = false; this.scene.add(m); return m;
  }

  // ---------- helpers ----------
  later(t, fn) { this.timers.push({ t, fn }); }
  enemiesNear(p, r) { return this.enemies.filter((e) => e.alive && e.state !== 'spawn' && dist2d(e.pos, p) < r + e.radius); }
  nearestEnemy(p, r) {
    let best = null, bd = r;
    for (const e of this.enemies) { if (!e.alive || e.state === 'spawn') continue; const d = dist2d(e.pos, p); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  damage(from, to, mult, opts = {}) {
    const isPlayer = from === this.player;
    const atk = isPlayer ? from.effAtk : from.atk;
    const def = to === this.player ? to.effDef : to.def;
    let dmg = atk * mult * (60 / (60 + def * 3)) * (0.9 + Math.random() * 0.2);
    let crit = false;
    if (isPlayer && Math.random() < 0.12) { crit = true; dmg *= 1.8; }
    dmg = Math.max(1, Math.round(dmg));
    to.takeHit(dmg, from, opts);
    if (to !== this.player) {
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
        sfx.boom(true); this.fx.shake(1); this.fx.stop(0.1); this.fx.flash('rgba(255,150,60,0.25)');
        this.fx.groundRing(at, { color: 0xff7a2a, r0: 0.5, r1: 6, dur: 0.6 });
        this.fx.groundRing(at, { color: 0xffe08a, r0: 0.5, r1: 4.5, dur: 0.4 });
        this.fx.burst(at.clone().setY(at.y + 0.4), 120, 0xff7a2a, { speed: 14, up: 6, size: 0.9, life: 0.9, grav: 4 });
        this.fx.burst(at.clone().setY(at.y + 0.4), 50, 0x553322, { solid: true, speed: 9, up: 9, size: 0.35, life: 1.2, grav: 18 });
        this.fx.dust(at, 24, 0x5a4a3a, 2.5);
        for (const e of this.enemiesNear(at, 4.5)) this.damage(owner, e, 4.2, { knock: 1.4 });
        return true;
      }
    };
    this.tickers = this.tickers || []; this.tickers.push(tick);
  }

  // ---------- events ----------
  onEnemyKilled(e, killer) {
    const p = this.player;
    if (e.camp) { e.camp.alive = e.camp.alive.filter((x) => x !== e); e.camp.respawnQ.push(14 + Math.random() * 8); }
    if (killer !== p) return;
    const diff = THREE.MathUtils.clamp(1 + (e.level - p.level) * 0.15, 0.15, 1.6);
    let xp = Math.round(14 * Math.pow(e.level, 1.25) * e.T.xp * diff * (e.unique ? e.unique.xpMul : 1) * (e.summoned ? 0.3 : 1));
    this.gainXp(xp, e.pos);
    if (e.noLoot) return;
    // Loot
    const drop = (kind, data) => this.dropLoot(e.pos, kind, data);
    if (e.unique) {
      const u = UNIQUES[e.unique.id];
      this.ui.announce(`🏆 ${u.name} yenildi!`, 'victory');
      sfx.rare();
      drop('gold', Math.round(u.gold * (0.8 + Math.random() * 0.4)));
      const items = u.id === 'morvath' ? [3, 2, 2] : [2, Math.random() < 0.5 ? 2 : 1];
      for (const r of items) drop('item', makeItem(['weapon', 'armor', 'ring'][Math.floor(Math.random() * 3)], e.level, r, p.save.cls));
      drop('potion', 'hp'); drop('potion', 'mp'); drop('potion', 'hp');
      const st = this.uniques.find((x) => x.def.id === u.id); st.enemy = null; st.timer = u.respawn;
      this.save.stats.uniques = (this.save.stats.uniques || 0) + 1;
      return;
    }
    this.save.stats.kills = (this.save.stats.kills || 0) + 1;
    drop('gold', Math.round(e.level * 3 * (0.6 + Math.random() * 0.8) + 2));
    if (Math.random() < 0.16) {
      const r = Math.random(); const rar = r < 0.04 ? 2 : r < 0.26 ? 1 : 0;
      drop('item', makeItem(['weapon', 'armor', 'ring'][Math.floor(Math.random() * 3)], e.level, rar, p.save.cls));
    }
    if (Math.random() < 0.14) drop('potion', Math.random() < 0.55 ? 'hp' : 'mp');
  }

  dropLoot(at, kind, data) {
    const pos = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 0, (Math.random() - 0.5) * 2.2));
    pos.y = heightAt(pos.x, pos.z);
    let mesh, beam = null, color = 0xffd36b;
    if (kind === 'gold') { mesh = cloneProp('coin_stack_large', 0.32); }
    else if (kind === 'item') {
      color = new THREE.Color(RARITY[data.rarity].color).getHex();
      mesh = cloneProp(data.rarity >= 2 ? 'chest_gold' : 'chest', 0.42);
      beam = this.fx.lootBeam(pos, color);
      if (data.rarity >= 1) sfx.rare();
    } else {
      color = data === 'hp' ? 0xff4a5a : 0x4aa8ff;
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 }));
    }
    const glow = this.fx.glow(color, 1.6); glow.position.y = 0.4; mesh.add(glow);
    mesh.position.copy(pos); this.scene.add(mesh);
    const l = { kind, data, pos, mesh, beam, t: 0, vy: 5, y: 1, color };
    this.loot.push(l);
    this.ui.addLootPlate?.(l);
  }

  pickup(l) {
    const s = this.save, p = this.player;
    if (l.kind === 'gold') { s.gold += l.data; sfx.coin(); this.fx.number(p.pos, `+${l.data} altın`, 'gold'); }
    else if (l.kind === 'potion') { s.potions[l.data] = (s.potions[l.data] || 0) + 1; sfx.pickup(); this.ui.toast(l.data === 'hp' ? '🧪 Can İksiri' : '💧 Mana İksiri', l.data === 'hp' ? '#ff8a96' : '#8ac8ff'); }
    else {
      if (s.bag.length >= 24) { this.ui.toast('Çanta dolu!', '#ff6a6a'); return false; }
      const it = l.data; sfx.pickup();
      if (!s.equip[it.slot]) { s.equip[it.slot] = it; p.recalc(); p.updateWeaponLook(); this.ui.toast(`Kuşanıldı: ${it.name}`, RARITY[it.rarity].color); }
      else { s.bag.push(it); this.ui.toast(`${RARITY[it.rarity].name}: ${it.name}`, RARITY[it.rarity].color); }
      this.ui.refreshInventory();
    }
    return true;
  }

  gainXp(xp, at) {
    const s = this.save, p = this.player;
    if (s.level >= MAX_LEVEL) return;
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
    this.player.revive(this.campPos.clone().add(new THREE.Vector3(0, 0, -4)));
    for (const e of this.enemies) if (e.state === 'chase' || e.state === 'cast') e.state = 'return';
  }

  // ---------- input ----------
  handleTap(x, y) {
    const p = this.player; if (p.dead) return;
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const boxes = this.enemies.filter((e) => e.alive).map((e) => e.hitbox);
    const hit = this.raycaster.intersectObjects(boxes, false)[0];
    if (hit) {
      const e = hit.object.userData.enemy;
      p.target = e; p.autoAttack = true; p.moveTarget = null; sfx.ui();
      return;
    }
    // NPC tap
    for (const n of this.npcs) {
      TMP.copy(n.pos); TMP.y += 1.2; TMP.project(this.camera);
      const sx = (TMP.x * 0.5 + 0.5) * innerWidth, sy = (-TMP.y * 0.5 + 0.5) * innerHeight;
      if (Math.hypot(sx - x, sy - y) < 50) { this.ui.openNpc(n); return; }
    }
    const g = this.raycaster.intersectObject(this.world.terrain, false)[0];
    if (g) {
      p.moveTarget = g.point.clone(); p.autoAttack = false;
      this.moveMarker.visible = true; this.moveMarker.position.copy(g.point).setY(g.point.y + 0.06); this.moveMarker.userData.t = 0;
    }
  }
  attackButton() {
    const p = this.player; if (p.dead) return;
    if (!p.target || !p.target.alive || dist2d(p.pos, p.target.pos) > 14) p.target = this.nearestEnemy(p.pos, 12);
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

    for (const e of this.enemies) e.update(dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].remove) { this.ui.removePlate(this.enemies[i]); this.enemies[i].dispose(); this.enemies.splice(i, 1); }
    for (const n of this.npcs) { n.an.update(dt); const d = dist2d(n.pos, p.pos); if (d < 6) n.ch.root.rotation.y = Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z); }

    // camps respawn
    for (const c of this.camps) {
      for (let i = c.respawnQ.length - 1; i >= 0; i--) {
        c.respawnQ[i] -= dt;
        if (c.respawnQ[i] <= 0 && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) > 7) { c.respawnQ.splice(i, 1); this.spawnAtCamp(c); }
      }
    }
    for (const u of this.uniques) {
      if (u.enemy) continue;
      u.timer -= dt;
      if (u.timer <= 0) this.spawnUnique(u);
    }

    this.updateProjectiles(dt);
    this.updateLoot(dt);

    // zone banner
    const zn = zoneAt(p.pos.z);
    if (zn !== this.zone) { this.zone = zn; this.ui.zone(zn); this.scene.fog.color.set(zn.fog); }
    this.scene.fog.color.lerp(new THREE.Color(this.zone.fog), dt);

    // target ring
    if (p.target && p.target.alive) {
      const t = p.target; this.targetRing.visible = true;
      this.targetRing.position.set(t.pos.x, t.pos.y + 0.07, t.pos.z);
      this.targetRing.scale.setScalar(t.radius * 1.7 + Math.sin(this.time * 6) * 0.05);
      this.targetRing.material.color.set(t.isBoss ? 0xff2a2a : 0xff6a4a);
    } else this.targetRing.visible = false;
    if (this.moveMarker.visible) {
      const m = this.moveMarker; m.userData.t += dt; m.scale.setScalar(1 + m.userData.t * 2); m.material.opacity = 1 - m.userData.t * 1.6;
      if (m.userData.t > 0.6 || !p.moveTarget) m.visible = false;
    }

    this.world.update(dt, p.pos, this.fx);
    this.fx.update(dt, rawDt);
    this.updateCamera(rawDt);
    this.ui.update(rawDt);

    this.saveT += rawDt;
    if (this.saveT > 8) { this.saveT = 0; saveGame(this.save, p); }
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      const tgt = pr.target;
      const aim = tgt && (tgt.alive !== false) && !(tgt === p && p.dead) ? TMP.copy(tgt.pos).setY(tgt.pos.y + 1.1 * (tgt.scale || 1)) : null;
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
      if (pr.hit && pr.owner.alive) this.damage(pr.owner, this.player, pr.mult);
      this.fx.burst(at, 14, pr.color, { speed: 4, size: 0.4, life: 0.4 });
      return;
    }
    if (pr.kind === 'fireball') {
      sfx.boom(false); this.fx.shake(0.3);
      const g = at.clone(); g.y = heightAt(g.x, g.z);
      this.fx.groundRing(g, { color: 0xff7a2a, r0: 0.5, r1: pr.aoe, dur: 0.4 });
      this.fx.burst(at, 60, 0xff7a2a, { speed: 9, up: 4, size: 0.7, life: 0.6, grav: 2 });
      this.fx.burst(at, 20, 0xffe08a, { speed: 5, up: 3, size: 0.5, life: 0.4 });
      for (const e of this.enemiesNear(at, pr.aoe)) this.damage(pr.owner, e, pr.mult * (e === pr.target ? 1 : 0.7), { knock: 0.8 });
      return;
    }
    if (pr.hit && pr.target?.alive) this.damage(pr.owner, pr.target, pr.mult, { knock: 0.15 });
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
      if (!p.dead && l.t > 0.5 && dist2d(l.pos, p.pos) < 2.4) {
        if (this.pickup(l)) { l.flying = true; l.flyStart = l.t; if (l.beam) { this.scene.remove(l.beam); l.beam = null; } }
      }
      if (l.t > 120) this.removeLoot(i);
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
