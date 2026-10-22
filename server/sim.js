// Server-side world simulation: the "host" of the shared world.
// Mirrors the client's enemy behaviour (src/units.js) without any graphics. Clients render enemies
// from the snapshots sent here and report the damage they deal.
import fs from 'node:fs';
import { ENEMIES, UNIQUES, CAMPS, makeItem } from './shared/data.js';
import { generateLayout, heightAt, rng } from './shared/terrain.js';

const CLIPS = JSON.parse(fs.readFileSync(new URL('./shared/clips.json', import.meta.url), 'utf8'));
const TYPES = ['minion', 'rogue', 'warrior', 'mage'];
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angleTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const r2 = (v) => Math.round(v * 100) / 100;

// Animation state as the clients will play it; durations come from the real clips.
class Anim {
  constructor() { this.name = 'Idle'; this.once = false; this.ts = 1; this.seq = 0; this.lock = 0; }
  loop(name, ts = 1) {
    if (this.lock > 0) return;
    if (this.name === name && !this.once) { this.ts = ts; return; }
    this.name = name; this.once = false; this.ts = ts;
  }
  play(name, { timeScale = 1, hold = false, lockFor } = {}) {
    const d = (CLIPS[name] || 1) / timeScale;
    this.name = name; this.once = true; this.ts = timeScale; this.seq++;
    this.lock = hold ? Infinity : (lockFor ?? d * 0.92);
    return d;
  }
  update(dt) { if (this.lock !== Infinity) this.lock = Math.max(0, this.lock - dt); }
  unlock() { this.lock = 0; }
}

class Enemy {
  constructor(sim, id, type, level, home, unique) {
    const T = unique ? ENEMIES[unique.type] : ENEMIES[type];
    Object.assign(this, { sim, id, T, level, unique: unique || null });
    this.type = unique ? unique.type : type;
    this.home = { x: home.x, z: home.z };
    this.scale = unique ? unique.scale : 1;
    this.radius = 0.6 * this.scale;
    this.maxHp = Math.round((40 + level * 22) * T.hp * (unique ? unique.hpMul : 1));
    this.hp = this.maxHp;
    this.atk = (6 + level * 3.2) * T.atk * (unique ? unique.atkMul : 1);
    this.def = (1.5 + level * 0.9) * T.def;
    this.speed = T.speed * (unique ? 0.95 : 1);
    this.range = unique ? T.range * 1.5 : T.range;
    this.pos = { x: home.x, y: heightAt(home.x, home.z), z: home.z };
    this.yaw = Math.random() * 6.28;
    this.alive = true; this.tgt = null; this.knock = { x: 0, z: 0 };
    this.slowT = 0; this.stunT = 0; this.atkCd = 1 + Math.random(); this.wanderT = Math.random() * 4; this.wanderTo = null;
    this.abilityT = 4; this.enraged = false; this.state = 'spawn';
    this.anim = new Anim();
    this.stateT = Math.min(this.anim.play('Spawn_Ground_Skeletons', { timeScale: unique ? 0.8 : 1.3, lockFor: 0 }), 2.2);
  }
  get isBoss() { return !!this.unique; }
  faceTo(p, dt, speed = 14) { this.yaw = lerpAngle(this.yaw, angleTo(this.pos, p), Math.min(1, dt * speed)); }
  stepToward(p, speed, dt) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 1e-4) return;
    const s = Math.min(d, speed * dt);
    this.pos.x += (dx / d) * s; this.pos.z += (dz / d) * s;
    this.sim.col.resolve(this.pos, this.radius);
  }

  update(dt) {
    const sim = this.sim;
    this.anim.update(dt);
    this.slowT -= dt; this.stunT -= dt; this.atkCd -= dt; this.stateT -= dt;
    if (!this.alive) return;
    if (Math.abs(this.knock.x) + Math.abs(this.knock.z) > 0.001) {
      this.pos.x += this.knock.x * dt * 10; this.pos.z += this.knock.z * dt * 10;
      const k = Math.max(0, 1 - dt * 10); this.knock.x *= k; this.knock.z *= k;
      sim.col.resolve(this.pos, this.radius);
    }
    if (this.state === 'spawn') { if (this.stateT <= 0) this.state = 'idle'; return; }
    if (this.stunT > 0) { this.anim.loop('Idle', 0.3); return; }

    if (this.tgt && (this.tgt.dead || this.tgt.gone)) this.tgt = null;
    const p = this.tgt || sim.nearestPlayer(this.pos);
    const dp = !p || p.dead ? 999 : dist2d(this.pos, p.pos);
    const dh = dist2d(this.pos, this.home);
    const spd = this.speed * (this.slowT > 0 ? 0.4 : 1) * (this.enraged ? 1.3 : 1);

    if (this.state === 'cast') {
      this.castT += dt;
      while (this.castEv.length && this.castT >= this.castEv[0].at) this.castEv.shift().fn();
      if (this.castFace && p && !p.dead) this.faceTo(p.pos, dt, 4);
      if (this.castT >= this.castDur) this.state = 'chase';
      if (this.leapTo) {
        const k = Math.min(1, Math.max(0, (this.castT - 0.35) / 0.75)), e = k * k * (3 - 2 * k);
        this.pos.x = this.leapFrom.x + (this.leapTo.x - this.leapFrom.x) * e;
        this.pos.z = this.leapFrom.z + (this.leapTo.z - this.leapFrom.z) * e;
        this.pos.y = heightAt(this.pos.x, this.pos.z) + Math.sin(k * Math.PI) * 3.5;
        return;
      }
      if (this.spinning && p && dist2d(p.pos, this.pos) > 1) this.stepToward(p.pos, spd * 0.9, dt);
      return;
    }

    if (this.state === 'idle' || this.state === 'wander') {
      if (p && dp < this.T.aggro * (this.isBoss ? 1.6 : 1)) { this.tgt = p; this.aggro(); }
      else {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 3 + Math.random() * 5;
          this.wanderTo = { x: this.home.x + (Math.random() - 0.5) * 8, z: this.home.z + (Math.random() - 0.5) * 8 };
        }
        if (this.wanderTo && dist2d(this.pos, this.wanderTo) > 0.4) {
          this.stepToward(this.wanderTo, 1.3, dt); this.faceTo(this.wanderTo, dt, 4);
          this.anim.loop('Walking_D_Skeletons', 0.8);
        } else this.anim.loop('Idle');
      }
    } else if (this.state === 'chase') {
      if (!p || p.dead || dh > (this.isBoss ? 30 : 24)) { this.state = 'return'; this.tgt = null; }
      else {
        if (this.isBoss) this.bossThink(dt, p);
        if (this.state !== 'chase') return;
        const want = this.T.ranged ? this.range * 0.8 : this.range + p.radius * 0.5;
        if (dp > want) {
          this.stepToward(p.pos, spd, dt); this.faceTo(p.pos, dt, 8);
          this.anim.loop('Running_C', r2(spd / 4.2));
        } else {
          this.faceTo(p.pos, dt, 8);
          if (this.atkCd <= 0 && this.anim.lock <= 0) this.attack(p);
          else if (this.anim.lock <= 0) this.anim.loop('Idle_Combat');
        }
      }
    } else if (this.state === 'return') {
      if (dist2d(this.pos, this.home) < 1) this.state = 'idle';
      else { this.stepToward(this.home, this.speed * 1.4, dt); this.faceTo(this.home, dt, 8); this.anim.loop('Running_C'); }
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt);
      if (this.isBoss) this.enraged = false;
    }
    // separation from nearby enemies
    for (const o of sim.enemies.values()) {
      if (o === this || !o.alive || !o.awake) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = this.radius + o.radius;
      if (d < m && d > 1e-3) { const k = (m - d) * 0.5; this.pos.x += dx / d * k; this.pos.z += dz / d * k; }
    }
    this.pos.y = heightAt(this.pos.x, this.pos.z);
  }

  aggro() {
    if (this.state === 'chase' || this.state === 'cast' || !this.alive) return;
    const first = this.state !== 'return';
    this.state = 'chase';
    if (this.isBoss && first && !this.roared) {
      this.roared = true;
      this.startCast('Taunt', 1.6, [{ at: 0.3, fn: () => this.sim.efx('roar', { x: this.pos.x, z: this.pos.z, c: this.unique.tint, r: 12 }) }], 0.9);
    }
  }

  attack(p) {
    const sim = this.sim;
    this.atkCd = this.T.atkTime * (this.enraged ? 0.75 : 1) * (0.9 + Math.random() * 0.2);
    if (this.T.ranged) {
      const dur = this.anim.play('Spellcast_Shoot', { timeScale: 1.1, lockFor: 0.8 });
      sim.later(dur * 0.35, () => {
        if (!this.alive || p.dead || p.gone) return;
        sim.efx('ebolt', { e: this.id, to: p.id });
        const travel = dist2d(this.pos, p.pos) / 11;
        sim.later(travel, () => { if (!p.dead && !p.gone && this.alive) sim.damagePlayer(this, p, 1); });
      });
    } else {
      const big = this.isBoss;
      const name = big ? '2H_Melee_Attack_Chop' : (Math.random() < 0.5 ? '1H_Melee_Attack_Chop' : '1H_Melee_Attack_Slice_Diagonal');
      const dur = this.anim.play(name, { timeScale: big ? 1.0 : 1.15, lockFor: 0.9 });
      sim.later(dur * 0.42, () => {
        if (!this.alive || this.stunT > 0) return;
        if (!p.dead && !p.gone && dist2d(this.pos, p.pos) < this.range + p.radius + 0.6) sim.damagePlayer(this, p, 1);
        if (big) sim.efx('bigswing', { x: this.pos.x + Math.sin(this.yaw) * 2, z: this.pos.z + Math.cos(this.yaw) * 2 });
      });
    }
  }

  startCast(anim, dur, events, timeScale = 1, face = true) {
    this.state = 'cast'; this.castT = 0; this.castDur = dur; this.castEv = events; this.castFace = face;
    this.anim.unlock(); this.anim.play(anim, { timeScale, lockFor: dur });
  }

  bossThink(dt, p) {
    const sim = this.sim;
    this.abilityT -= dt;
    if (!this.enraged && this.hp < this.maxHp * 0.35) {
      this.enraged = true;
      this.startCast('Taunt', 1.4, [{ at: 0.2, fn: () => sim.efx('enrage', { x: this.pos.x, z: this.pos.z, name: this.unique.name }) }], 1);
      return;
    }
    if (this.abilityT > 0) return;
    const roll = Math.random(), big = this.unique.id === 'morvath';
    if (roll < 0.42) {
      const at = { x: p.pos.x, z: p.pos.z }, rr = big ? 4.2 : 3.4;
      this.abilityT = this.enraged ? 4 : 6;
      sim.efx('tele', { x: at.x, z: at.z, r: rr, dur: 1.15 });
      this.startCast('1H_Melee_Attack_Jump_Chop', 1.4, [
        { at: 0.35, fn: () => {
          const dx = this.pos.x - at.x, dz = this.pos.z - at.z, d = Math.hypot(dx, dz) || 1;
          this.leapFrom = { x: this.pos.x, z: this.pos.z }; this.leapTo = { x: at.x + dx / d * 1.2, z: at.z + dz / d * 1.2 };
        } },
        { at: 1.1, fn: () => {
          if (this.leapTo) { this.pos.x = this.leapTo.x; this.pos.z = this.leapTo.z; } this.leapTo = null; sim.col.resolve(this.pos, this.radius);
          sim.efx('slam', { x: at.x, z: at.z, r: big ? 5.5 : 4.5 });
          for (const q of sim.alivePlayers()) if (dist2d(q.pos, at) < rr + q.radius) sim.damagePlayer(this, q, 2.2);
        } },
      ], 0.85, false);
      this.castFace = true;
    } else if (roll < 0.72) {
      this.abilityT = this.enraged ? 5 : 7;
      const ev = [];
      for (let k = 0; k < 6; k++) ev.push({ at: 0.3 + k * 0.4, fn: () => {
        sim.efx('spin', { x: this.pos.x, z: this.pos.z, c: this.unique.tint, r: 3.6 * this.scale / 2 });
        for (const q of sim.alivePlayers()) if (dist2d(q.pos, this.pos) < 3.2 * this.scale / 2 + q.radius) sim.damagePlayer(this, q, 0.55);
      } });
      ev.push({ at: 2.7, fn: () => { this.spinning = false; } });
      this.spinning = true;
      this.startCast('2H_Melee_Attack_Spinning', 2.8, ev, 1);
    } else {
      this.abilityT = this.enraged ? 7 : 10;
      if ([...sim.enemies.values()].filter((e) => e.summoned && e.alive).length >= 6) { this.abilityT = 1; return; }
      this.startCast('Spellcast_Summon', 1.6, [{ at: 0.8, fn: () => {
        sim.efx('summon', { x: this.pos.x, z: this.pos.z });
        const n = big ? 3 : 2;
        for (let k = 0; k < n; k++) {
          const a = Math.random() * 6.28;
          const e = sim.spawnEnemy(big && k === 0 ? 'mage' : 'minion', Math.max(1, this.level - 2), { x: this.pos.x + Math.cos(a) * 3.5, z: this.pos.z + Math.sin(a) * 3.5 }, null);
          e.summoned = true; e.noLoot = Math.random() < 0.6; e.T = { ...e.T, aggro: 30 };
        }
      } }], 1);
    }
  }

  takeHit(amount, from, opts = {}) {
    if (!this.alive) return;
    this.hp -= amount;
    if (opts.stun) this.stunT = Math.max(this.stunT, opts.stun);
    if (opts.slow) this.slowT = Math.max(this.slowT, opts.slow);
    if (from && (!this.tgt || this.state !== 'chase')) this.tgt = from;
    if (opts.knock && !this.isBoss && from) {
      const dx = this.pos.x - from.pos.x, dz = this.pos.z - from.pos.z, d = Math.hypot(dx, dz) || 1;
      this.knock.x += dx / d * opts.knock; this.knock.z += dz / d * opts.knock;
    }
    if (this.state === 'idle' || this.state === 'wander' || this.state === 'return' || this.state === 'spawn') { if (this.state === 'spawn') this.state = 'idle'; this.aggro(); }
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.sim.onKilled(this, from); return; }
    if (!this.isBoss && this.state !== 'cast' && Math.random() < 0.35) this.anim.play('Hit_A', { timeScale: 1.5, lockFor: 0.25 });
  }
}

export class Sim {
  constructor({ send, broadcast }) {
    this.send = send; this.broadcast = broadcast;
    const L = generateLayout();
    this.col = L.colliders;
    this.enemies = new Map(); this.players = new Map(); this.loot = new Map();
    this.timers = []; this.nextId = 1; this.nextLid = 1; this.time = 0; this.snapT = 0; this.utT = 0;
    const R = rng(4242);
    this.camps = CAMPS.map(([x, z, type, count, lmin, lmax]) => ({ x, z, type, count, lmin, lmax, respawnQ: [] }));
    for (const c of this.camps) for (let i = 0; i < c.count; i++) this.spawnAtCamp(c, R);
    this.uniques = Object.values(UNIQUES).map((u) => ({ def: u, timer: u.firstSpawn, enemy: null }));
  }

  // ---------- players ----------
  addPlayer(id, info = {}) {
    this.players.set(id, { id, isPlayer: true, name: info.name || 'Oyuncu', cls: info.cls || 'knight', level: info.lv || 1,
      pos: { x: 0, y: 0, z: 59 }, radius: 0.55, def: 5, dead: false, gone: false, fresh: true });
  }
  removePlayer(id) {
    const p = this.players.get(id); if (!p) return;
    p.gone = true; p.dead = true; this.players.delete(id);
    for (const e of this.enemies.values()) if (e.tgt === p) e.tgt = null;
  }
  onState(id, m) {
    const p = this.players.get(id); if (!p) return;
    p.pos.x = m.x; p.pos.y = m.y; p.pos.z = m.z; p.dead = !!m.dd; p.def = m.df || 5; p.level = m.lv || p.level; p.fresh = false;
    if (m.nm) p.name = m.nm;
  }
  alivePlayers() { return [...this.players.values()].filter((p) => !p.dead && !p.fresh); }
  nearestPlayer(pos) {
    let best = null, bd = Infinity;
    for (const p of this.players.values()) { if (p.dead || p.fresh) continue; const d = dist2d(p.pos, pos); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  welcome(id) {
    const loot = [...this.loot.values()].map((l) => ({ lid: l.lid, kind: l.kind, data: l.data, x: l.x, z: l.z }));
    this.send(id, { t: 'welcome', loot });
    this.send(id, this.utMsg());
  }

  // ---------- combat ----------
  onDamage(id, m) {
    const e = this.enemies.get(m.id), p = this.players.get(id);
    if (!e || !e.alive || !p || p.dead) return;
    const d = Math.max(1, Math.min(100000, Math.round(+m.d || 0)));
    e.takeHit(d, p, { knock: +m.k || 0, stun: Math.min(3, +m.st || 0), slow: Math.min(5, +m.sl || 0) });
  }
  damagePlayer(e, p, mult) {
    const dmg = Math.max(1, Math.round(e.atk * mult * (60 / (60 + (p.def || 5) * 3)) * (0.9 + Math.random() * 0.2)));
    this.send(p.id, { t: 'hurt', to: p.id, d: dmg, e: e.id });
  }
  efx(k, a) { for (const [k2, v] of Object.entries(a)) if (typeof v === 'number') a[k2] = r2(v); this.broadcast({ t: 'efx', k, a }); }
  later(t, fn) { this.timers.push({ t, fn }); }

  spawnEnemy(type, lv, at, unique) {
    const e = new Enemy(this, this.nextId++, type, lv, at, unique);
    this.enemies.set(e.id, e);
    return e;
  }
  spawnAtCamp(c, R = Math.random) {
    let home = { x: c.x + (R() - 0.5) * 6, z: c.z + (R() - 0.5) * 6 };
    if (this.col.blocked(home.x, home.z, 0.7)) home = { x: c.x, z: c.z };
    const e = this.spawnEnemy(c.type, c.lmin + Math.floor(R() * (c.lmax - c.lmin + 1)), home, null);
    e.camp = c;
    return e;
  }
  spawnUnique(u) {
    const d = u.def;
    u.enemy = this.spawnEnemy(d.type, d.level, { x: d.pos[0], z: d.pos[1] }, d);
    this.broadcast({ t: 'ann', x: `⚔ ${d.name} (Sv.${d.level}) ${d.zone}'nda belirdi!`, k: 'unique' });
    this.efx('pillar', { x: d.pos[0], z: d.pos[1], c: d.tint });
  }

  onKilled(e, killer) {
    if (e.camp) e.camp.respawnQ.push(14 + Math.random() * 8);
    e.deadT = 0;
    this.broadcast({ t: 'ekill', id: e.id, type: e.type, lv: e.level, u: e.unique ? e.unique.id : '', s: e.summoned ? 1 : 0, x: r2(e.pos.x), z: r2(e.pos.z) });
    if (!killer || e.noLoot) { if (e.unique) this.resetUnique(e); return; }
    const drop = (kind, data) => this.dropLoot(e.pos, kind, data);
    const cls = () => { const c = [...this.players.values()].map((p) => p.cls); return c[Math.floor(Math.random() * c.length)] || 'knight'; };
    const slot = () => ['weapon', 'armor', 'ring'][Math.floor(Math.random() * 3)];
    if (e.unique) {
      const u = UNIQUES[e.unique.id];
      this.broadcast({ t: 'ann', x: `🏆 ${u.name} yenildi!`, k: 'victory' });
      drop('gold', Math.round(u.gold * (0.8 + Math.random() * 0.4)));
      const items = u.id === 'morvath' ? [3, 2, 2] : [2, Math.random() < 0.5 ? 2 : 1];
      for (const r of items) drop('item', makeItem(slot(), e.level, r, cls()));
      drop('potion', 'hp'); drop('potion', 'mp'); drop('potion', 'hp');
      this.resetUnique(e);
      return;
    }
    drop('gold', Math.round(e.level * 3 * (0.6 + Math.random() * 0.8) + 2));
    if (Math.random() < 0.16) { const r = Math.random(); drop('item', makeItem(slot(), e.level, r < 0.04 ? 2 : r < 0.26 ? 1 : 0, cls())); }
    if (Math.random() < 0.14) drop('potion', Math.random() < 0.55 ? 'hp' : 'mp');
  }
  resetUnique(e) { const st = this.uniques.find((u) => u.enemy === e); if (st) { st.enemy = null; st.timer = st.def.respawn; } }

  dropLoot(at, kind, data) {
    const lid = this.nextLid++;
    const l = { lid, kind, data, x: r2(at.x + (Math.random() - 0.5) * 2.2), z: r2(at.z + (Math.random() - 0.5) * 2.2), t: 0 };
    this.loot.set(lid, l);
    this.broadcast({ t: 'loot', lid, kind, data, x: l.x, z: l.z });
  }
  onPick(id, lid) {
    const l = this.loot.get(lid);
    if (!l || !this.players.has(id)) return;
    this.loot.delete(lid);
    this.broadcast({ t: 'picked', lid, by: id });
  }

  utMsg() { return { t: 'ut', u: this.uniques.map((u) => [u.def.id, Math.round(u.timer), u.enemy && u.enemy.alive ? 1 : 0]) }; }

  // ---------- main loop ----------
  tick(dt) {
    if (!this.players.size) return; // nobody online: the valley sleeps
    this.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    const ps = [...this.players.values()].filter((p) => !p.fresh);
    for (const e of this.enemies.values()) {
      if (!e.alive) { e.deadT += dt; if (e.deadT > 3) this.enemies.delete(e.id); continue; }
      const busy = e.state === 'chase' || e.state === 'cast' || e.state === 'return';
      e.awake = busy || ps.some((p) => dist2d(p.pos, e.pos) < 40);
      if (e.awake) e.update(dt);
    }
    for (const c of this.camps) for (let i = c.respawnQ.length - 1; i >= 0; i--) {
      c.respawnQ[i] -= dt;
      if (c.respawnQ[i] <= 0 && !ps.some((p) => Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 7)) { c.respawnQ.splice(i, 1); this.spawnAtCamp(c); }
    }
    for (const u of this.uniques) { if (u.enemy) continue; u.timer -= dt; if (u.timer <= 0) this.spawnUnique(u); }
    for (const l of this.loot.values()) { l.t += dt; if (l.t > 120) this.loot.delete(l.lid); }
    this.snapT -= dt;
    if (this.snapT <= 0) { this.snapT = 0.1; this.sendSnapshots(ps); }
    this.utT -= dt;
    if (this.utT <= 0) { this.utT = 1; this.broadcast(this.utMsg()); }
  }

  sendSnapshots(ps) {
    for (const p of ps) {
      const l = [];
      for (const e of this.enemies.values()) {
        if (!e.alive || dist2d(p.pos, e.pos) > 45) continue;
        l.push([e.id, TYPES.indexOf(e.type), e.level, e.unique ? e.unique.id : '', r2(e.pos.x), r2(e.pos.y), r2(e.pos.z), r2(e.yaw),
          Math.ceil(e.hp), e.maxHp, e.anim.name, e.anim.seq, e.anim.once ? 1 : 0, r2(e.anim.ts),
          (e.enraged ? 1 : 0) | (e.slowT > 0 ? 2 : 0) | (e.stunT > 0 ? 4 : 0) | (e.summoned ? 8 : 0)]);
      }
      this.send(p.id, { t: 'es', l });
    }
  }
}
