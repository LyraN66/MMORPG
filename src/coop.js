import * as THREE from 'three';
import { makeCharacter, Animator } from './assets.js';
import { CLASSES, UNIQUES } from './data.js';
import { heightAt } from './world.js';
import { sfx } from './audio.js';
import { dist2d } from './units.js';
import { Net } from './net.js';
import { PROTOCOL } from '../server/shared/version.js';

const TYPES = ['minion', 'rogue', 'warrior', 'mage'];
const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const r2 = (v) => Math.round(v * 100) / 100;

// Another player in the room, drawn from the state they broadcast.
export class RemotePlayer {
  constructor(game, id, info = {}) {
    this.game = game; this.netId = id; this.isPlayer = true; this.remote = true;
    this.name = info.name || 'Oyuncu'; this.cls = CLASSES[info.cls] || CLASSES.knight;
    this.level = info.lv || 1; this.def = info.def || 5;
    this.ch = makeCharacter(this.cls.model, {});
    this.anim = new Animator(this.ch); this.anim.loop('Idle');
    this.root = this.ch.root; game.scene.add(this.root);
    this.pos = new THREE.Vector3(0, -50, 60); this.netPos = this.pos.clone();
    this.yaw = 0; this.netYaw = 0; this.radius = 0.55;
    this.hp = 1; this.maxHp = 1; this.dead = false; this.gone = false; this.flash = 0; this.fresh = true;
    this.root.visible = false;
    game.ui.addPlayerPlate(this);
  }
  apply(m) {
    this.netPos.set(m.x, m.y, m.z); this.netYaw = m.yw;
    if (this.fresh) { this.pos.copy(this.netPos); this.yaw = m.yw; this.fresh = false; this.root.visible = true; }
    this.hp = m.hp; this.maxHp = m.mh; this.level = m.lv; this.def = m.df;
    if (m.nm) this.name = m.nm;
    this.netAnim = { name: m.an, seq: m.sq, once: !!m.on, ts: m.ts || 1 };
    const dead = !!m.dd;
    if (dead !== this.dead) {
      this.dead = dead;
      this.anim.unlock();
      if (dead) this.anim.once('Death_A', { hold: true }); else this.anim.loop('Idle', 0.05);
    }
  }
  update(dt) {
    const k = 1 - Math.exp(-dt * 12);
    this.pos.lerp(this.netPos, k);
    this.yaw = lerpAngle(this.yaw, this.netYaw, k);
    const na = this.netAnim;
    if (na && !this.dead) {
      if (na.once && na.seq !== this.lastSeq) { this.anim.unlock(); this.anim.once(na.name, { timeScale: na.ts, lockFor: 0 }); }
      else if (!na.once && this.anim.current?.name !== na.name) { this.anim.unlock(); this.anim.loop(na.name, 0.15, na.ts); }
      this.lastSeq = na.seq;
    }
    const near = dist2d(this.pos, this.game.player.pos) < 60;
    this.root.visible = near && !this.fresh;
    this.anim.update(dt, near ? dt : 0);
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 5);
      for (const m of this.ch.materials) m.emissive.setRGB(this.flash * 1.2, this.flash * 0.4, this.flash * 0.3);
    }
  }
  // Host side: an enemy hit this player; their own game applies the damage.
  takeHit(amount, from) {
    if (this.dead) return;
    this.game.coop.send({ t: 'hurt', to: this.netId, d: amount, e: from?.id ?? -1 });
    this.flash = 1;
  }
  dispose() {
    this.gone = true; this.dead = true;
    this.game.scene.remove(this.root);
    this.game.ui.removePlayerPlate(this);
  }
}

export class Coop {
  constructor(game, net) {
    this.g = game; this.remotes = new Map();
    this.sendT = 0; this.snapT = 0; this.utT = 0; this.lid = 1;
    this.attach(net);
  }
  attach(net) {
    this.net = net; this.id = net.id; this.code = net.code;
    this.g.player.netId = net.id;
    net.onMessage = (m) => this.onMessage(m);
    net.onClose = () => this.reconnect();
    for (const p of net.peers) this.addRemote(p.id, p.info, true);
  }
  // Connection dropped (phone switched apps, server restarted…): rejoin the world automatically.
  async reconnect() {
    if (this.closed || this.reconnecting) return;
    this.reconnecting = true;
    const g = this.g, url = this.net.url;
    g.ui.netBanner('Bağlantı koptu, yeniden bağlanılıyor…');
    for (const r of [...this.remotes.keys()]) { this.remotes.get(r).dispose(); this.remotes.delete(r); }
    for (const e of g.enemies) if (e.remote) e.remove = true;
    for (let i = g.loot.length - 1; i >= 0; i--) if (g.loot[i].shared) g.removeLoot(i);
    for (let i = 0; i < 8 && !this.closed; i++) {
      await new Promise((r) => setTimeout(r, Math.min(8000, 1500 * (i + 1))));
      const net = new Net(url);
      try {
        await net.connect(60000);
        await net.enter({ t: 'hello', proto: PROTOCOL, info: { name: g.save.name, cls: g.save.cls, lv: g.save.level } });
        this.attach(net); this.reconnecting = false;
        g.ui.netBanner(null); g.ui.toast('🌍 Yeniden bağlandın', '#7dff9a'); g.ui.roomBadge();
        return;
      } catch (e) {
        net.close();
        if (/güncel/i.test(e.message)) { this.reconnecting = false; this.lost(e.message); return; }
      }
    }
    this.reconnecting = false;
    this.lost('Sunucuya ulaşılamıyor. İnternet bağlantını kontrol et.');
  }
  get isHost() { return this.net.isHost; }
  get hostId() { return this.net.host; }
  get count() { return 1 + [...this.remotes.values()].filter((r) => !r.gone).length; }
  send(m) { this.net.send(m); }
  sendAct(a) { this.send({ t: 'act', ...a }); }
  nextLid() { return this.id * 100000 + this.lid++; }

  addRemote(id, info, quiet) {
    if (this.remotes.has(id)) return this.remotes.get(id);
    const r = new RemotePlayer(this.g, id, info);
    this.remotes.set(id, r);
    if (!quiet) { this.g.ui.toast(`🌍 ${r.name} vadiye girdi`, '#7dff9a'); sfx.pickup(); }
    this.g.ui.roomBadge();
    return r;
  }
  removeRemote(id) {
    const r = this.remotes.get(id); if (!r) return;
    this.g.ui.toast(`🌍 ${r.name} vadiden ayrıldı`, '#ffb38a');
    r.dispose(); this.remotes.delete(id);
    for (const e of this.g.enemies) if (e.tgt === r) e.tgt = null;
    this.g.ui.roomBadge();
  }
  lost(reason) {
    if (this.closed) return; this.closed = true;
    this.g.ui.netBanner(null);
    this.g.ui.netLost(reason);
  }

  update(dt) {
    this.sendT -= dt;
    if (this.sendT <= 0) { this.sendT = 1 / 12; this.sendState(); }
    for (const r of this.remotes.values()) r.update(dt);
    if (this.isHost) {
      this.snapT -= dt; if (this.snapT <= 0) { this.snapT = 0.1; this.sendSnapshot(); }
      this.utT -= dt; if (this.utT <= 0) { this.utT = 1; this.send({ t: 'ut', u: this.g.uniques.map((u) => [u.def.id, Math.round(u.timer), u.enemy && u.enemy.alive ? 1 : 0]) }); }
    } else {
      // Enemies the host stopped sending (out of our range) are removed.
      for (const e of this.g.enemies) if (e.remote && e.alive && this.g.time - (e.seenT || 0) > 3) e.remove = true;
    }
  }

  sendState() {
    const p = this.g.player, a = p.anim.current;
    this.send({ t: 'ps', x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), yw: r2(p.yaw), hp: Math.ceil(p.hp), mh: p.maxHp, lv: p.level,
      dd: p.dead ? 1 : 0, an: a?.name || 'Idle', sq: p.anim.seq, on: a?.once ? 1 : 0, ts: r2(a?.ts || 1), df: Math.round(p.effDef), nm: this.g.save.name });
  }

  sendSnapshot() {
    const rs = [...this.remotes.values()].filter((r) => !r.gone && !r.fresh);
    if (!rs.length) return;
    const l = [];
    for (const e of this.g.enemies) {
      if (!e.alive || !rs.some((r) => dist2d(r.pos, e.pos) < 45)) continue;
      const a = e.anim.current;
      l.push([e.id, TYPES.indexOf(e.type), e.level, e.unique ? e.unique.id : '', r2(e.pos.x), r2(e.pos.y), r2(e.pos.z), r2(e.yaw),
        Math.ceil(e.hp), e.maxHp, a?.name || 'Idle', e.anim.seq, a?.once ? 1 : 0, r2(a?.ts || 1),
        (e.enraged ? 1 : 0) | (e.slowT > 0 ? 2 : 0) | (e.stunT > 0 ? 4 : 0) | (e.summoned ? 8 : 0)]);
    }
    this.send({ t: 'es', l });
  }

  applySnapshot(list) {
    const g = this.g;
    for (const r of list) {
      let e = g.enemyById.get(r[0]);
      if (!e) {
        const uq = r[3] ? UNIQUES[r[3]] : null;
        e = g.spawnEnemy(TYPES[r[1]], r[2], new THREE.Vector3(r[4], 0, r[6]), uq, { id: r[0], remote: true });
        e.state = 'remote'; e.yaw = e.netYaw = r[7];
        if (uq) { const st = g.uniques.find((u) => u.def.id === uq.id); if (st) st.enemy = e; }
      }
      if (!e.alive) continue;
      e.netPos.set(r[4], r[5], r[6]); e.netYaw = r[7];
      e.hp = g.time - (e.predT ?? -9) < 0.8 ? Math.min(e.hp, r[8]) : r[8];
      e.maxHp = r[9];
      e.netAnim = { name: r[10], seq: r[11], once: !!r[12], ts: r[13] };
      e.netEnraged = !!(r[14] & 1); if (r[14] & 2) e.slowT = 0.3; e.stunned = !!(r[14] & 4); e.summoned = !!(r[14] & 8);
      e.seenT = g.time;
    }
  }

  remoteOrMe(id) { return id === this.id ? this.g.player : this.remotes.get(id) || null; }

  onMessage(m) {
    const g = this.g;
    switch (m.t) {
      case 'peerJoined': {
        this.addRemote(m.id, m.info);
        if (this.isHost) {
          const loot = g.loot.filter((l) => l.shared && !l.taken).map((l) => ({ lid: l.lid, kind: l.kind, data: l.data, x: l.pos.x, z: l.pos.z }));
          this.send({ t: 'welcome', to: m.id, loot });
        }
        break;
      }
      case 'peerLeft': this.removeRemote(m.id); break;
      case 'closed': this.lost('Odayı kuran oyuncu oyundan ayrıldı.'); break;
      case 'ps': {
        const r = this.remotes.get(m.f) || this.addRemote(m.f, { name: m.nm, cls: 'knight' }, true);
        r.apply(m); break;
      }
      case 'act': { const r = this.remotes.get(m.f); if (r) this.replayAct(r, m); break; }
      case 'es': if (!this.isHost && m.f === this.hostId) this.applySnapshot(m.l); break;
      case 'ut':
        if (this.isHost) break;
        for (const [id, t, alive] of m.u) {
          const st = g.uniques.find((u) => u.def.id === id); if (!st) continue;
          st.timer = t;
          if (!alive) st.enemy = null;
          else if (!st.enemy || !st.enemy.alive) st.enemy = g.enemies.find((e) => e.alive && e.unique?.id === id) || { alive: true, pos: new THREE.Vector3(st.def.pos[0], 0, st.def.pos[1]) };
        }
        break;
      case 'efx': if (!this.isHost) g.playEfx(m.k, m.a); break;
      case 'ann': g.ui.announce(m.x, m.k); if (m.k === 'unique') sfx.roar(); break;
      case 'dmg': {
        if (!this.isHost) break;
        const e = g.enemyById.get(m.id), r = this.remotes.get(m.f);
        if (!e || !e.alive) break;
        e.takeHit(m.d, r || null, { knock: m.k, stun: m.st, slow: m.sl });
        if (dist2d(e.pos, g.player.pos) < 25) g.fx.number(e.pos, String(m.d), 'ally');
        break;
      }
      case 'hurt': {
        if (m.to !== this.id) break;
        g.player.takeHit(m.d, g.enemyById.get(m.e) || null);
        break;
      }
      case 'ekill': {
        if (this.isHost) break;
        const e = g.enemyById.get(m.id);
        if (e) e.dieRemote();
        g.rewardKill(m);
        break;
      }
      case 'loot': if (!this.isHost) g.dropLoot(new THREE.Vector3(m.x, 0, m.z), m.kind, m.data, { lid: m.lid, exact: true }); break;
      case 'welcome':
        for (const l of m.loot || []) g.dropLoot(new THREE.Vector3(l.x, 0, l.z), l.kind, l.data, { lid: l.lid, exact: true, quiet: true });
        break;
      case 'pick': if (this.isHost) g.hostPick(m.lid, m.f); break;
      case 'picked': g.onPicked(m.lid, m.by); break;
      default: break;
    }
  }

  // Cosmetic replay of another player's attacks and skills (damage is reported separately by them).
  replayAct(r, m) {
    const g = this.g, fx = g.fx;
    const near = dist2d(r.pos, g.player.pos) < 30;
    const tgt = m.tid != null ? g.enemyById.get(m.tid) : null;
    const s = (fn) => { if (near) fn(); };
    const from = () => { const v = r.pos.clone(); v.y += 1.6; return v; };
    switch (m.s) {
      case 'basic':
        if (r.cls.id === 'knight') g.later(0.25, () => { s(() => sfx.swing()); fx.slash(r.pos, r.yaw, 0xfff6e0, { radius: 2.1, tilt: m.c === 0 ? 0.5 : m.c === 1 ? 0 : 1.2, flip: m.c === 1 }); });
        else g.later(0.2, () => { if (!tgt) return; s(() => sfx.magic()); g.projectile({ from: from(), target: tgt, speed: 22, color: 0x6fc8ff, size: 0.6, owner: null, mult: 0, kind: 'bolt', visual: true }); });
        break;
      case 'whirl':
        for (let k = 0; k < 2; k++) g.later(0.18 + k * 0.3, () => {
          s(() => sfx.spin()); fx.groundRing(r.pos, { color: 0xffd27a, r0: 1, r1: 4, dur: 0.35 });
          for (let a = 0; a < 3; a++) fx.slash(r.pos, r.yaw + a * 2.1, 0xffe9b0, { radius: 3.2, width: 0.8, dur: 0.25, tilt: 0.1 });
        });
        break;
      case 'charge':
        s(() => sfx.heavySwing());
        g.later(0.3, () => { fx.groundRing(r.pos, { color: 0x9fd0ff, r0: 0.5, r1: 3, dur: 0.4 }); if (tgt) fx.burst(tgt.pos.clone().setY(tgt.pos.y + 1.2), 25, 0xbfe3ff, { speed: 7, size: 0.5 }); });
        break;
      case 'warcry':
        g.later(0.35, () => { s(() => sfx.shout()); fx.pillar(r.pos, 0xff9a3c, { h: 6, r: 1.6, dur: 0.8 }); fx.groundRing(r.pos, { color: 0xff9a3c, r0: 1, r1: 7, dur: 0.6 }); });
        break;
      case 'fireball':
        g.later(0.35, () => { if (!tgt) return; s(() => sfx.magic()); g.projectile({ from: from(), target: tgt, speed: 17, color: 0xff7a2a, size: 1.3, owner: null, mult: 0, kind: 'fireball', aoe: 3.2, visual: true }); });
        break;
      case 'frostnova':
        g.later(0.3, () => {
          s(() => sfx.frost()); fx.groundRing(r.pos, { color: 0x9fe8ff, r0: 0.5, r1: 5.5, dur: 0.6 }); fx.groundRing(r.pos, { color: 0xffffff, r0: 0.5, r1: 4.5, dur: 0.45 });
          fx.burst(r.pos.clone().setY(r.pos.y + 0.4), 70, 0xaee9ff, { speed: 10, up: 1.5, size: 0.45, life: 0.7, grav: 1 });
        });
        break;
      case 'meteor': {
        if (m.tx == null) break;
        const at = new THREE.Vector3(m.tx, heightAt(m.tx, m.tz), m.tz);
        fx.telegraph(at, 4.5, 1.1, 0xff7a2a);
        g.later(1.1, () => g.meteorImpact(at, null));
        break;
      }
      default: break;
    }
  }
}
