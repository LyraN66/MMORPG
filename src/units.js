import * as THREE from 'three';
import { makeCharacter, Animator } from './assets.js';
import { CLASSES, ENEMIES, itemStat } from './data.js';
import { heightAt } from './world.js';
import { sfx } from './audio.js';

const TMP = new THREE.Vector3();
export const angleTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
export const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; }

class Unit {
  constructor(game) {
    this.game = game; this.pos = new THREE.Vector3(); this.yaw = 0; this.radius = 0.6;
    this.alive = true; this.flash = 0; this.slowT = 0; this.stunT = 0; this.hitT = 0;
  }
  setupModel(model, opts) {
    this.ch = makeCharacter(model, opts);
    this.anim = new Animator(this.ch);
    this.root = this.ch.root;
    this.game.scene.add(this.root);
  }
  faceTo(p, dt, speed = 14) { this.yaw = lerpAngle(this.yaw, angleTo(this.pos, p), Math.min(1, dt * speed)); }
  syncModel(dt) {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 5);
      for (const m of this.ch.materials) { m.emissive.setRGB(this.flash * 1.4, this.flash * 1.2, this.flash * 1.1); }
    }
  }
  hitFlash() { this.flash = 1; }
}

export class Player extends Unit {
  constructor(game, save) {
    super(game);
    this.save = save;
    this.cls = CLASSES[save.cls];
    this.radius = 0.55;
    const hide = save.cls === 'knight' ? [] : [];
    this.setupModel(this.cls.model, { hideMeshes: hide });
    this.target = null; this.moveTarget = null; this.autoAttack = false;
    this.atkCd = 0; this.combo = 0; this.cast = null; this.cds = {}; this.buffT = 0;
    this.lastDamageT = 99; this.potCd = 0; this.dead = false; this.stepT = 0;
    this.recalc(); this.hp = save.hp ?? this.maxHp; this.mp = save.mp ?? this.maxMp;
    this.anim.loop('Idle');
    this.weaponGlow = null;
    this.updateWeaponLook();
  }
  get level() { return this.save.level; }
  recalc() {
    const c = this.cls, L = this.save.level - 1, eq = this.save.equip;
    const st = { atk: 0, def: 0, hp: 0 };
    for (const k of ['weapon', 'armor', 'ring']) if (eq[k]) { const s = itemStat(eq[k]); st.atk += s.atk; st.def += s.def; st.hp += s.hp; }
    this.maxHp = Math.round(c.base.hp + c.grow.hp * L + st.hp);
    this.maxMp = Math.round(c.base.mp + c.grow.mp * L);
    this.atk = Math.round(c.base.atk + c.grow.atk * L + st.atk);
    this.def = Math.round(c.base.def + c.grow.def * L + st.def);
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }
  get effAtk() { return this.atk * (this.buffT > 0 ? 1.35 : 1); }
  get effDef() { return this.def * (this.buffT > 0 ? 1.25 : 1); }
  updateWeaponLook() {
    // +7 and above weapons glow (classic "plus" aura).
    const w = this.save.equip.weapon; const plus = w ? w.plus : 0;
    const slot = this.ch.slotR;
    if (this.weaponGlow) { slot.remove(this.weaponGlow); this.weaponGlow = null; }
    for (const m of this.ch.materials) m.userData.baseEmissive = 0;
    if (plus >= 5) {
      const col = plus >= 9 ? 0xff5a2a : plus >= 7 ? 0xc06bff : 0x58b8ff;
      const g = this.game.fx.glow(col, 1.0 + plus * 0.12); g.position.set(0, 0.6, 0); g.material.opacity = 0.55;
      slot.add(g); this.weaponGlow = g; this.weaponGlowCol = col;
    }
  }
  skillReady(i) {
    const s = this.cls.skills[i];
    return this.level >= s.unlock && !(this.cds[s.id] > 0) && this.mp >= s.mp && !this.cast && !this.dead;
  }

  update(dt, input) {
    const g = this.game;
    this.lastDamageT += dt; this.atkCd -= dt; this.potCd -= dt; this.buffT -= dt;
    for (const k in this.cds) this.cds[k] -= dt;
    if (this.dead) { this.anim.update(dt); this.syncModel(dt); return; }
    // regen
    const inCamp = this.pos.distanceTo(g.campPos) < 18;
    const regen = inCamp ? 0.06 : this.lastDamageT > 6 ? 0.02 : 0.004;
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * regen * dt);
    this.mp = Math.min(this.maxMp, this.mp + this.maxMp * (regen + 0.006) * dt);
    if (this.target && !this.target.alive) { this.target = null; this.autoAttack = false; }

    const mv = input.move; // camera-relative already transformed to world x,z
    let moving = false;
    const speed = this.cls.moveSpeed * (this.cast ? 0 : 1);
    if (this.cast) {
      this.cast.t += dt;
      if (this.cast.face) this.faceTo(this.cast.face, dt, 18);
      while (this.cast.events.length && this.cast.t >= this.cast.events[0].at) this.cast.events.shift().fn();
      if (this.cast.t >= this.cast.dur) this.cast = null;
      if (this.cast?.dash) {
        const d = this.cast.dash; const k = Math.min(1, this.cast.t / d.time);
        this.pos.lerpVectors(d.from, d.to, 1 - Math.pow(1 - k, 2));
        g.world.resolve(this.pos, this.radius);
        if (Math.random() < 0.8) g.fx.trail(TMP.copy(this.pos).setY(this.pos.y + 1), 0x9fd0ff, 0.7, 0.3);
      }
    } else if (mv.lengthSq() > 0.01) {
      this.autoAttack = false; this.moveTarget = null;
      this.pos.x += mv.x * speed * dt; this.pos.z += mv.z * speed * dt;
      this.yaw = lerpAngle(this.yaw, Math.atan2(mv.x, mv.z), Math.min(1, dt * 14));
      moving = true;
    } else if (this.autoAttack && this.target) {
      const d = dist2d(this.pos, this.target.pos);
      const range = this.cls.range + this.target.radius;
      if (d > range) {
        TMP.subVectors(this.target.pos, this.pos).setY(0).normalize();
        this.pos.addScaledVector(TMP, speed * dt); this.faceTo(this.target.pos, dt); moving = true;
      } else {
        this.faceTo(this.target.pos, dt, 16);
        if (this.atkCd <= 0) this.basicAttack();
      }
    } else if (this.moveTarget) {
      const d = dist2d(this.pos, this.moveTarget);
      if (d < 0.3) this.moveTarget = null;
      else {
        TMP.subVectors(this.moveTarget, this.pos).setY(0).normalize();
        this.pos.addScaledVector(TMP, Math.min(d, speed * dt)); this.faceTo(this.moveTarget, dt); moving = true;
      }
    }
    if (moving) {
      g.world.resolve(this.pos, this.radius);
      this.anim.loop('Running_A', 0.15, speed / 6.2);
      this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.32; sfx.step(); if (Math.random() < 0.5) g.fx.dust(this.pos, 2, 0x7a6a56, 0.6); }
    } else if (!this.cast) {
      this.pos.y = heightAt(this.pos.x, this.pos.z);
      this.anim.loop(this.cls.id === 'knight' ? 'Idle' : 'Idle');
    }
    if (this.buffT > 0 && Math.random() < 0.3) g.fx.trail(TMP.copy(this.pos).add(new THREE.Vector3((Math.random() - 0.5), 0.2 + Math.random() * 2, (Math.random() - 0.5))), 0xff9a3c, 0.35, 0.6);
    if (this.weaponGlow) {
      this.weaponGlow.material.opacity = 0.45 + Math.sin(g.time * 6) * 0.15;
      if (Math.random() < 0.25) { this.ch.slotR.getWorldPosition(TMP); TMP.y += 0.3; g.fx.trail(TMP, this.weaponGlowCol, 0.3, 0.45); }
    }
    this.anim.update(dt);
    this.syncModel(dt);
  }

  basicAttack() {
    const g = this.game, t = this.target;
    const spd = 1 / this.cls.atkSpeed;
    this.atkCd = this.cls.atkSpeed;
    if (this.cls.id === 'knight') {
      const anims = ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'];
      const name = anims[this.combo % 3]; const combo = this.combo % 3; this.combo++;
      const dur = this.anim.once(name, { timeScale: 1.25 * spd, lockFor: this.cls.atkSpeed * 0.75 });
      this.cast = { t: 0, dur: dur * 0.5, face: t.pos, events: [{ at: dur * 0.28, fn: () => {
        sfx.swing();
        g.fx.slash(this.pos, this.yaw, combo === 2 ? 0xffe2a0 : 0xfff6e0, { radius: 2.1, tilt: combo === 0 ? 0.5 : combo === 1 ? 0 : 1.2, flip: combo === 1 });
        if (t.alive && dist2d(this.pos, t.pos) < this.cls.range + t.radius + 0.9) {
          g.damage(this, t, 1.0 * (combo === 2 ? 1.3 : 1), { knock: combo === 2 ? 0.6 : 0.25 });
          // cleave
          for (const e of g.enemiesNear(this.pos, this.cls.range + 0.8)) if (e !== t && Math.abs(angDiff(angleTo(this.pos, e.pos), this.yaw)) < 0.9) g.damage(this, e, 0.5, { knock: 0.2 });
        }
      } }] };
    } else {
      const dur = this.anim.once('Spellcast_Shoot', { timeScale: 1.5 * spd, lockFor: this.cls.atkSpeed * 0.7 });
      this.cast = { t: 0, dur: dur * 0.45, face: t.pos, events: [{ at: dur * 0.22, fn: () => {
        sfx.magic();
        const from = new THREE.Vector3(); this.ch.slotR.getWorldPosition(from); from.y += 0.6;
        g.projectile({ from, target: t, speed: 22, color: 0x6fc8ff, size: 0.6, owner: this, mult: 1.0, kind: 'bolt' });
      } }] };
    }
  }

  useSkill(i) {
    const g = this.game, s = this.cls.skills[i];
    if (this.level < s.unlock) { g.ui.toast(`${s.name} ${s.unlock}. seviyede açılır`, '#ff8a6a'); sfx.deny(); return; }
    if (this.cds[s.id] > 0 || this.cast || this.dead) { sfx.deny(); return; }
    if (this.mp < s.mp) { g.ui.toast('Yetersiz mana', '#6ab8ff'); sfx.deny(); return; }
    // auto-acquire target for targeted skills
    const needsTarget = ['charge', 'fireball', 'meteor'].includes(s.id);
    if (needsTarget && (!this.target || !this.target.alive || dist2d(this.pos, this.target.pos) > 16)) this.target = g.nearestEnemy(this.pos, 14);
    if (needsTarget && !this.target) { g.ui.toast('Hedef yok', '#ffcf6a'); sfx.deny(); return; }
    this.mp -= s.mp; this.cds[s.id] = s.cd; this.moveTarget = null;
    const t = this.target;
    if (t) this.autoAttack = true;
    switch (s.id) {
      case 'whirl': {
        const dur = this.anim.once('2H_Melee_Attack_Spin', { timeScale: 1.25, lockFor: 0.8 });
        const ev = [];
        for (let k = 0; k < 2; k++) ev.push({ at: 0.18 + k * 0.3, fn: () => {
          sfx.spin(); g.fx.groundRing(this.pos, { color: 0xffd27a, r0: 1, r1: 4, dur: 0.35 });
          for (let a = 0; a < 3; a++) g.fx.slash(this.pos, this.yaw + a * 2.1, 0xffe9b0, { radius: 3.2, width: 0.8, dur: 0.25, tilt: 0.1 });
          for (const e of g.enemiesNear(this.pos, 4)) g.damage(this, e, 0.9, { knock: 0.9 });
          g.fx.shake(0.18);
        } });
        this.cast = { t: 0, dur: Math.min(dur, 0.85), events: ev };
        break;
      }
      case 'charge': {
        const dir = TMP.subVectors(t.pos, this.pos).setY(0); const d = dir.length(); dir.normalize();
        const to = this.pos.clone().addScaledVector(dir, Math.max(0, d - t.radius - 0.9));
        this.yaw = Math.atan2(dir.x, dir.z);
        this.anim.once('Dodge_Forward', { timeScale: 1.6, lockFor: 0.35 });
        sfx.heavySwing();
        this.cast = { t: 0, dur: 0.55, dash: { from: this.pos.clone(), to, time: 0.28 }, events: [{ at: 0.3, fn: () => {
          this.cast.dash = null; this.anim.once('Block_Attack', { timeScale: 1.4, lockFor: 0.3 });
          g.fx.groundRing(this.pos, { color: 0x9fd0ff, r0: 0.5, r1: 3, dur: 0.4 }); g.fx.shake(0.35); g.fx.stop(0.07);
          g.fx.burst(t.pos.clone().setY(t.pos.y + 1.2), 25, 0xbfe3ff, { speed: 7, size: 0.5 });
          for (const e of g.enemiesNear(t.pos, 2.4)) { g.damage(this, e, e === t ? 1.5 : 0.7, { knock: 1.6 }); e.stunT = Math.max(e.stunT, e === t ? 1.5 : 0.8); }
        } }] };
        break;
      }
      case 'warcry': {
        this.anim.once('Cheer', { timeScale: 1.3, lockFor: 0.9 });
        this.cast = { t: 0, dur: 0.9, events: [{ at: 0.35, fn: () => {
          sfx.shout(); this.buffT = 10; g.fx.pillar(this.pos, 0xff9a3c, { h: 6, r: 1.6, dur: 0.8 });
          g.fx.groundRing(this.pos, { color: 0xff9a3c, r0: 1, r1: 7, dur: 0.6 }); g.fx.shake(0.25);
          g.ui.toast('Savaş Narası! +%35 saldırı', '#ffb35a');
        } }] };
        break;
      }
      case 'fireball': {
        this.anim.once('Spellcast_Long', { timeScale: 1.8, lockFor: 0.55 });
        this.cast = { t: 0, dur: 0.6, face: t.pos, events: [{ at: 0.35, fn: () => {
          sfx.magic(); const from = new THREE.Vector3(); this.ch.slotR.getWorldPosition(from); from.y += 0.5;
          g.projectile({ from, target: t, speed: 17, color: 0xff7a2a, size: 1.3, owner: this, mult: 2.2, kind: 'fireball', aoe: 3.2 });
        } }] };
        break;
      }
      case 'frostnova': {
        this.anim.once('Spellcast_Raise', { timeScale: 1.6, lockFor: 0.5 });
        this.cast = { t: 0, dur: 0.55, events: [{ at: 0.3, fn: () => {
          sfx.frost(); g.fx.groundRing(this.pos, { color: 0x9fe8ff, r0: 0.5, r1: 5.5, dur: 0.6, opacity: 1 });
          g.fx.groundRing(this.pos, { color: 0xffffff, r0: 0.5, r1: 4.5, dur: 0.45 });
          g.fx.burst(this.pos.clone().setY(this.pos.y + 0.4), 70, 0xaee9ff, { speed: 10, up: 1.5, size: 0.45, life: 0.7, grav: 1, spread: 1 });
          for (const e of g.enemiesNear(this.pos, 5.5)) { g.damage(this, e, 1.3, { knock: 0.4, color: 'frost' }); e.slowT = 3; }
          g.fx.shake(0.2);
        } }] };
        break;
      }
      case 'meteor': {
        const at = t.pos.clone();
        this.anim.once('Spellcasting', { timeScale: 1.2, lockFor: 0.9 });
        g.fx.telegraph(at, 4.5, 1.1, 0xff7a2a);
        this.cast = { t: 0, dur: 0.9, face: at, events: [{ at: 0.1, fn: () => sfx.magic() }] };
        g.later(1.1, () => g.meteorImpact(at, this));
        break;
      }
    }
  }

  usePotion(kind) {
    const g = this.game;
    if (this.dead || this.potCd > 0) return;
    const inv = this.save.potions;
    if (!inv[kind]) { g.ui.toast(kind === 'hp' ? 'Can iksirin kalmadı' : 'Mana iksirin kalmadı', '#ff8a6a'); sfx.deny(); return; }
    if (kind === 'hp' && this.hp >= this.maxHp) return;
    if (kind === 'mp' && this.mp >= this.maxMp) return;
    inv[kind]--; this.potCd = 1.2; sfx.potion();
    if (kind === 'hp') { const v = Math.round(this.maxHp * 0.4); this.hp = Math.min(this.maxHp, this.hp + v); g.fx.number(this.pos, '+' + v, 'heal'); }
    else { const v = Math.round(this.maxMp * 0.45); this.mp = Math.min(this.maxMp, this.mp + v); g.fx.number(this.pos, '+' + v, 'mana'); }
    g.fx.burst(this.pos.clone().setY(this.pos.y + 1), 20, kind === 'hp' ? 0xff5a6a : 0x5ab0ff, { speed: 2, up: 3, size: 0.35, grav: -1 });
  }

  takeHit(amount, from) {
    if (this.dead) return;
    this.hp -= amount; this.lastDamageT = 0;
    this.hitFlash(); sfx.hurt();
    this.game.fx.number(this.pos, '-' + amount, 'hurt');
    if (amount > this.maxHp * 0.12) { this.game.fx.flash(); this.game.fx.shake(0.25); }
    if (!this.cast && !this.anim.lock && Math.random() < 0.3) this.anim.once('Hit_A', { timeScale: 1.6, lockFor: 0.25 });
    if (!this.target && from?.alive) { this.target = from; }
    if (this.hp <= 0) this.die();
  }
  die() {
    this.hp = 0; this.dead = true; this.cast = null; this.target = null; this.autoAttack = false;
    this.anim.unlock(); this.anim.once('Death_A', { hold: true });
    sfx.death(); this.game.onPlayerDeath();
  }
  revive(at) {
    this.dead = false; this.anim.unlock(); this.anim.loop('Idle', 0.01);
    this.pos.copy(at); this.hp = this.maxHp; this.mp = this.maxMp; this.cds = {};
    this.game.fx.pillar(this.pos, 0xbfe3ff, { h: 10, dur: 1.2 });
  }
}

const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Enemy extends Unit {
  constructor(game, type, level, home, unique) {
    super(game);
    const T = unique ? ENEMIES[unique.type] : ENEMIES[type];
    this.T = T; this.type = unique ? unique.type : type; this.unique = unique || null;
    this.level = level; this.home = home.clone();
    this.name = unique ? unique.name : T.name;
    const scale = unique ? unique.scale : 1;
    this.scale = scale;
    this.radius = 0.6 * scale;
    this.maxHp = Math.round((40 + level * 22) * T.hp * (unique ? unique.hpMul : 1));
    this.hp = this.maxHp;
    this.atk = (6 + level * 3.2) * T.atk * (unique ? unique.atkMul : 1);
    this.def = (1.5 + level * 0.9) * T.def;
    this.speed = T.speed * (unique ? 0.95 : 1);
    this.range = (unique ? T.range * 1.5 : T.range);
    this.setupModel(unique ? unique.model : T.model, { weapon: unique ? unique.weapon : T.weapon, offhand: unique ? unique.offhand : T.offhand });
    this.root.scale.setScalar(scale);
    if (unique) {
      for (const m of this.ch.materials) { m.color.lerp(new THREE.Color(unique.tint), 0.18); }
      const eyes = []; this.root.traverse((o) => { if (o.isMesh && /Eyes/.test(o.name)) eyes.push(o); });
      for (const e of eyes) { e.material.emissive = new THREE.Color(unique.tint); e.material.emissiveIntensity = 3; }
      this.aura = game.fx.glow(unique.tint, 5.5); this.aura.material.opacity = 0.35; this.aura.position.y = 1.4;
      this.root.add(this.aura);
    }
    this.state = 'spawn'; this.stateT = 0; this.atkCd = 1 + Math.random(); this.wanderT = Math.random() * 4;
    this.wanderTo = null; this.deadT = 0; this.knock = new THREE.Vector3();
    this.pos.copy(home); this.pos.y = heightAt(home.x, home.z); this.yaw = Math.random() * 6.28;
    this.hitbox = new THREE.Mesh(new THREE.CylinderGeometry(this.radius * 1.4, this.radius * 1.4, 2.6 * scale, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = 1.3 * scale; this.hitbox.userData.enemy = this; this.root.add(this.hitbox);
    // ability timers (bosses)
    this.abilityT = 4; this.enraged = false; this.summons = 0;
    const d = this.anim.once('Spawn_Ground_Skeletons', { timeScale: unique ? 0.8 : 1.3, lockFor: 0 });
    this.stateT = Math.min(d, 2.2);
    game.fx.dust(this.pos, 10, 0x6a5a48, scale);
  }

  get isBoss() { return !!this.unique; }

  update(dt) {
    const g = this.game, p = g.player;
    // Animation LOD: off-screen characters don't pose their skeleton; distant ones update at half rate.
    const adt = dt * (this.slowT > 0 ? 0.6 : 1);
    this.animAcc = (this.animAcc || 0) + adt;
    if (this.animate !== false) { this.anim.update(adt, Math.min(this.animAcc, 2)); this.animAcc = 0; }
    else this.anim.update(adt, 0);
    this.slowT -= dt; this.stunT -= dt; this.atkCd -= dt; this.stateT -= dt;
    if (this.slowT > 0 && Math.random() < 0.2) g.fx.trail(TMP.copy(this.pos).setY(this.pos.y + 1 + Math.random()), 0x9fe8ff, 0.3, 0.5);
    if (!this.alive) {
      this.deadT += dt;
      if (this.deadT > 2.5) this.root.position.y -= dt * 0.6;
      this.root.rotation.y = this.yaw;
      if (this.deadT > 5) this.remove = true;
      return;
    }
    if (this.knock.lengthSq() > 0.0001) { this.pos.addScaledVector(this.knock, dt * 10); this.knock.multiplyScalar(Math.max(0, 1 - dt * 10)); g.world.resolve(this.pos, this.radius); }
    if (this.state === 'spawn') { if (this.stateT <= 0) this.state = 'idle'; this.syncModel(dt); return; }
    if (this.stunT > 0) { this.anim.loop('Idle', 0.1, 0.3); if (Math.random() < 0.3) g.fx.trail(TMP.copy(this.pos).setY(this.pos.y + 2.4 * this.scale), 0xffe066, 0.25, 0.4); this.syncModel(dt); return; }

    const dp = p.dead ? 999 : dist2d(this.pos, p.pos);
    const dh = dist2d(this.pos, this.home);
    const slow = this.slowT > 0 ? 0.4 : 1;
    const spd = this.speed * slow * (this.enraged ? 1.3 : 1);

    if (this.state === 'cast') {
      this.castT += dt;
      while (this.castEv.length && this.castT >= this.castEv[0].at) this.castEv.shift().fn();
      if (this.castFace && !p.dead) this.faceTo(p.pos, dt, 4);
      if (this.castT >= this.castDur) this.state = 'chase';
      if (this.leapTo) {
        const k = THREE.MathUtils.clamp((this.castT - 0.35) / 0.75, 0, 1);
        this.pos.lerpVectors(this.leapFrom, this.leapTo, k * k * (3 - 2 * k));
        this.pos.y = heightAt(this.pos.x, this.pos.z) + Math.sin(k * Math.PI) * 3.5;
        this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
        if (this.flash > 0) this.syncModel(dt);
        return;
      }
      if (this.spinning) {
        TMP.subVectors(p.pos, this.pos).setY(0); if (TMP.length() > 1) { TMP.normalize(); this.pos.addScaledVector(TMP, spd * 0.9 * dt); g.world.resolve(this.pos, this.radius); }
      }
      this.syncModel(dt); return;
    }

    if (this.state === 'idle' || this.state === 'wander') {
      if (dp < this.T.aggro * (this.isBoss ? 1.6 : 1)) { this.aggro(); }
      else {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 3 + Math.random() * 5;
          this.wanderTo = this.home.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8));
        }
        if (this.wanderTo && dist2d(this.pos, this.wanderTo) > 0.4) {
          TMP.subVectors(this.wanderTo, this.pos).setY(0).normalize();
          this.pos.addScaledVector(TMP, 1.3 * dt); this.faceTo(this.wanderTo, dt, 4); g.world.resolve(this.pos, this.radius);
          this.anim.loop('Walking_D_Skeletons', 0.3, 0.8);
        } else this.anim.loop('Idle', 0.3);
      }
    } else if (this.state === 'chase') {
      if (p.dead || dh > (this.isBoss ? 30 : 24)) { this.state = 'return'; }
      else {
        if (this.isBoss) this.bossThink(dt, dp);
        if (this.state !== 'chase') { this.syncModel(dt); return; }
        const want = this.T.ranged ? this.range * 0.8 : this.range + p.radius * 0.5;
        if (dp > want) {
          TMP.subVectors(p.pos, this.pos).setY(0).normalize();
          this.pos.addScaledVector(TMP, spd * dt); this.faceTo(p.pos, dt, 8); g.world.resolve(this.pos, this.radius);
          this.anim.loop('Running_C', 0.2, spd / 4.2);
        } else {
          this.faceTo(p.pos, dt, 8);
          if (this.atkCd <= 0 && this.anim.lock <= 0) this.attack();
          else if (this.anim.lock <= 0) this.anim.loop('Idle_Combat', 0.2);
        }
      }
    } else if (this.state === 'return') {
      TMP.subVectors(this.home, this.pos).setY(0);
      if (TMP.length() < 1) { this.state = 'idle'; }
      else { TMP.normalize(); this.pos.addScaledVector(TMP, this.speed * 1.4 * dt); this.faceTo(this.home, dt, 8); g.world.resolve(this.pos, this.radius); this.anim.loop('Running_C', 0.2); }
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt);
      if (this.isBoss) this.enraged = false;
    }
    // separation
    for (const o of g.enemies) {
      if (o === this || !o.alive || !o.awake) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = this.radius + o.radius;
      if (d < m && d > 1e-3) { const k = (m - d) * 0.5; this.pos.x += dx / d * k; this.pos.z += dz / d * k; }
    }
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    if (this.aura) this.aura.material.opacity = (this.enraged ? 0.55 : 0.3) + Math.sin(g.time * 4) * 0.08;
    this.syncModel(dt);
  }

  aggro() {
    if (this.state === 'chase' || this.state === 'cast' || !this.alive) return;
    const first = this.state !== 'return';
    this.state = 'chase';
    if (this.isBoss && first && !this.roared) { this.roared = true; this.startCast('Taunt', 1.6, [{ at: 0.3, fn: () => { sfx.roar(); this.game.fx.shake(0.6); this.game.fx.groundRing(this.pos, { color: this.unique.tint, r0: 1, r1: 12, dur: 1 }); } }], 0.9); }
  }

  attack() {
    const g = this.game, p = g.player;
    this.atkCd = this.T.atkTime * (this.enraged ? 0.75 : 1) * (0.9 + Math.random() * 0.2);
    if (this.T.ranged) {
      const dur = this.anim.once('Spellcast_Shoot', { timeScale: 1.1, lockFor: 0.8 });
      this.castLite(dur * 0.35, () => {
        if (!this.alive) return;
        const from = this.pos.clone(); from.y += 1.6 * this.scale;
        g.projectile({ from, target: p, speed: 11, color: 0xa66bff, size: 0.55, owner: this, mult: 1, kind: 'enemyBolt' });
      });
    } else {
      const big = this.isBoss;
      const name = big ? '2H_Melee_Attack_Chop' : (Math.random() < 0.5 ? '1H_Melee_Attack_Chop' : '1H_Melee_Attack_Slice_Diagonal');
      const dur = this.anim.once(name, { timeScale: big ? 1.0 : 1.15, lockFor: 0.9 });
      this.castLite(dur * 0.42, () => {
        if (!this.alive || this.stunT > 0) return;
        sfx.swing();
        if (!p.dead && dist2d(this.pos, p.pos) < this.range + p.radius + 0.6) g.damage(this, p, 1);
        if (big) { g.fx.shake(0.3); g.fx.groundRing(this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 2, 0, Math.cos(this.yaw) * 2)), { color: 0xffffff, r0: 0.5, r1: 2.5, dur: 0.3 }); }
      });
    }
  }
  castLite(at, fn) { this.game.later(at, fn); }

  startCast(anim, dur, events, timeScale = 1, face = true) {
    this.state = 'cast'; this.castT = 0; this.castDur = dur; this.castEv = events; this.castFace = face;
    this.anim.unlock(); this.anim.once(anim, { timeScale, lockFor: dur });
  }

  bossThink(dt, dp) {
    const g = this.game, p = g.player;
    this.abilityT -= dt;
    if (!this.enraged && this.hp < this.maxHp * 0.35) {
      this.enraged = true;
      g.ui.announce(`${this.name} öfkelendi!`, 'boss');
      this.startCast('Taunt', 1.4, [{ at: 0.2, fn: () => { sfx.roar(); g.fx.shake(0.7); g.fx.flash('rgba(255,30,30,0.25)'); g.fx.groundRing(this.pos, { color: 0xff2222, r0: 1, r1: 14, dur: 0.9 }); } }], 1);
      for (const m of this.ch.materials) m.color.lerp(new THREE.Color(0xff4040), 0.25);
      return;
    }
    if (this.abilityT > 0) return;
    const roll = Math.random();
    const big = this.unique.id === 'morvath';
    if (roll < 0.42) {
      // Leap slam on player position
      const at = p.pos.clone(); this.abilityT = this.enraged ? 4 : 6;
      g.fx.telegraph(at, big ? 4.2 : 3.4, 1.15);
      sfx.warn();
      this.startCast('1H_Melee_Attack_Jump_Chop', 1.4, [
        { at: 0.35, fn: () => { this.leapFrom = this.pos.clone(); this.leapTo = at.clone().addScaledVector(TMP.subVectors(this.pos, at).setY(0).normalize(), 1.2); } },
        { at: 1.1, fn: () => {
          if (this.leapTo) this.pos.copy(this.leapTo); this.leapTo = null; g.world.resolve(this.pos, this.radius);
          sfx.boom(true); g.fx.shake(0.9); g.fx.stop(0.08);
          g.fx.groundRing(at, { color: 0xff6a3a, r0: 0.5, r1: big ? 5.5 : 4.5, dur: 0.5 });
          g.fx.dust(at, 20, 0x6a5a48, 2); g.fx.burst(at.clone().setY(at.y + 0.3), 40, 0xff8a3a, { speed: 9, up: 4, size: 0.6 });
          if (!p.dead && dist2d(p.pos, at) < (big ? 4.2 : 3.4) + p.radius) g.damage(this, p, 2.2);
        } },
      ], 0.85, false);
      this.castFace = true;
    } else if (roll < 0.72) {
      // Spin attack chasing player
      this.abilityT = this.enraged ? 5 : 7;
      const ev = []; for (let k = 0; k < 6; k++) ev.push({ at: 0.3 + k * 0.4, fn: () => {
        sfx.spin(); g.fx.groundRing(this.pos, { color: this.unique.tint, r0: 1, r1: 3.6 * this.scale / 2, dur: 0.3, opacity: 0.8 });
        if (!p.dead && dist2d(p.pos, this.pos) < 3.2 * this.scale / 2 + p.radius) g.damage(this, p, 0.55);
      } });
      ev.push({ at: 2.7, fn: () => { this.spinning = false; } });
      this.spinning = true;
      this.startCast('2H_Melee_Attack_Spinning', 2.8, ev, 1);
    } else {
      // Summon minions
      this.abilityT = this.enraged ? 7 : 10;
      if (g.enemies.filter((e) => e.summoned && e.alive).length >= 6) { this.abilityT = 1; return; }
      this.startCast('Spellcast_Summon', 1.6, [{ at: 0.8, fn: () => {
        sfx.roar(); g.fx.groundRing(this.pos, { color: 0x8a5aff, r0: 1, r1: 8, dur: 0.8 });
        const n = big ? 3 : 2;
        for (let k = 0; k < n; k++) {
          const a = Math.random() * 6.28, at = this.pos.clone().add(new THREE.Vector3(Math.cos(a) * 3.5, 0, Math.sin(a) * 3.5));
          const e = g.spawnEnemy(big && k === 0 ? 'mage' : 'minion', Math.max(1, this.level - 2), at, null);
          e.summoned = true; e.noLoot = Math.random() < 0.6; e.T = { ...e.T, aggro: 30 };
        }
      } }], 1);
    }
  }

  takeHit(amount, from, opts = {}) {
    if (!this.alive) return;
    this.hp -= amount; this.hitFlash();
    if (opts.knock && !this.isBoss && from) {
      TMP.subVectors(this.pos, from.pos).setY(0).normalize();
      this.knock.addScaledVector(TMP, opts.knock);
    }
    if (this.state === 'idle' || this.state === 'wander' || this.state === 'return') this.aggro();
    if (this.hp <= 0) { this.hp = 0; this.die(from); return; }
    if (!this.isBoss && this.state !== 'cast' && Math.random() < 0.35) this.anim.once('Hit_A', { timeScale: 1.5, lockFor: 0.25 });
  }

  die(killer) {
    this.alive = false; this.state = 'dead';
    this.anim.unlock(); this.anim.once(Math.random() < 0.7 ? 'Death_C_Skeletons' : 'Death_A', { hold: true, timeScale: 1.1 });
    this.root.remove(this.hitbox);
    if (this.aura) this.aura.visible = false;
    sfx.bone();
    this.game.fx.bones(this.pos, this.isBoss ? 60 : 12);
    this.game.onEnemyKilled(this, killer);
  }

  dispose() {
    this.game.scene.remove(this.root);
    this.root.traverse((o) => { if (o.isMesh) o.material.dispose(); });
  }
}
