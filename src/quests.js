import * as THREE from 'three';
import { xpToNext, ENEMIES, UNIQUES, CAMPS, makeItem } from './data.js';
import { heightAt, rng, BOUNDS } from './world.js';
import { cloneProp } from './assets.js';
import { dist2d } from './units.js';
import { sfx } from './audio.js';
import { saveGame } from './save.js';

export const GIVER = { name: 'Gözcü Kaan', pos: [-3.2, 52.6] };

// Main story chain, handed out one at a time by Gözcü Kaan.
export const QUESTS = [
  { id: 'q1', lv: 1, type: 'kill', target: 'minion', count: 6, name: 'Kemiklerin Uyanışı',
    story: 'Ormandaki eski mezarlar açıldı, ölüler yürüyor. Kampa ulaşmadan önce 6 Kemik Er\'i toprağa geri gönder.',
    done: 'İyi iş! Kılıcın keskin, yüreğin sağlam. Vadinin sana ihtiyacı var.', xpk: 0.9, gold: 40, potions: { hp: 3 } },
  { id: 'q2', lv: 2, type: 'collect', item: 'Altın Balkabağı', prop: 'pumpkin_yellow', scale: 0.75, count: 5, area: [14, 50], name: 'Ormanın Altını',
    story: 'Solgun Orman\'da parlayan altın balkabakları lanete karşı iksir yapımında kullanılır. Bana 5 tane getir.',
    done: 'Kokusu bile insanı iyileştiriyor! Zerrin bunlarla iksir kaynatacak.', xpk: 0.7, gold: 50, potions: { hp: 2, mp: 2 } },
  { id: 'q3', lv: 3, type: 'drop', item: 'Kemik Tozu', icon: 'bone_A', from: ['minion', 'rogue'], chance: 0.55, count: 8, name: 'Kemik Tozu',
    story: 'İskeletlerin kemiklerindeki tozla laneti çözebiliriz. Ormandaki iskeletlerden 8 avuç Kemik Tozu topla.',
    done: 'Bu toz hâlâ sıcak… Lanet sandığımızdan da güçlü.', xpk: 0.7, gold: 70, gear: 1 },
  { id: 'q4', lv: 4, type: 'kill', target: 'rogue', count: 8, name: 'Haydut Avı',
    story: 'Kemik Haydutlar orman ile mezarlık arasındaki yolu kesiyor. 8 tanesini temizle.',
    done: 'Yol artık güvende. Tüccarlar sana minnettar kalacak.', xpk: 0.7, gold: 90 },
  { id: 'q5', lv: 5, type: 'collect', item: 'Ruh Mumu', prop: 'candle_triple', scale: 1.3, count: 5, area: [-30, 6], name: 'Ruh Mumları',
    story: 'Kırık Mezarlık\'ta hâlâ yanan ruh mumları var. Onları getir; tapınağın yolunu aydınlatacaklar.',
    done: 'Alevleri mavi yanıyor… Ruhlar sana yol gösterecek.', xpk: 0.6, gold: 110, potions: { mp: 3 } },
  { id: 'q6', lv: 6, type: 'drop', item: 'Kırık Asa', icon: 'staff', from: ['mage'], chance: 0.6, count: 5, name: 'Kâhinlerin Asaları',
    story: 'Kemik Kâhinler karanlık güçlerini asalarından alıyor. Bana 5 asa parçası getir ki onları yakalım.',
    done: 'Asalar kırıldıkça kâhinler zayıflayacak. Çok iyi.', xpk: 0.6, gold: 140, gear: 1 },
  { id: 'q7', lv: 7, type: 'boss', target: 'gorran', count: 1, name: 'Çürük Kral',
    story: 'Mezarlığın efendisi Çürük Kral Gorran uyandı. Onu yen ve vadiye nefes aldır. Dikkat et: sıçrar, döner ve ölüleri çağırır.',
    done: 'Gorran düştü! Şarkılar senin adını söyleyecek, kahraman.', xpk: 1.1, gold: 300, gear: 2 },
  { id: 'q8', lv: 8, type: 'kill', target: 'warrior', count: 8, name: 'Tapınak Muhafızları',
    story: 'Kemik Tapınağı\'nın kapısını Kemik Muhafızlar tutuyor. 8 tanesini yık ki içeri girebilelim.',
    done: 'Kapı aralandı. İçeriden gelen soğuğu buradan hissediyorum.', xpk: 0.6, gold: 220 },
  { id: 'q9', lv: 10, type: 'collect', item: 'Lanetli Kafatası', prop: 'skull', scale: 0.75, count: 6, area: [-82, -36], name: 'Lanetli Kafatasları',
    story: 'Tapınağın etrafına saçılmış lanetli kafatasları Morvath\'a güç veriyor. 6 tanesini topla.',
    done: 'Morvath artık eskisi kadar güçlü değil. Sıra onda.', xpk: 0.6, gold: 300, potions: { hp: 4, mp: 4 } },
  { id: 'q10', lv: 12, type: 'boss', target: 'morvath', count: 1, name: 'Kemik Lordu',
    story: 'Her şeyin kaynağı Kemik Lordu Morvath. Tapınağın kalbine gir ve laneti sonsuza dek bitir.',
    done: 'Başardın… Vadi yeniden nefes alıyor. Ama ölüler kolay pes etmez; sözleşmeler hâlâ seni bekliyor.', xpk: 1.3, gold: 1000, gear: 3 },
];

const TYPE_NAMES = { minion: 'Kemik Er', rogue: 'Kemik Haydut', warrior: 'Kemik Muhafız', mage: 'Kemik Kâhin' };

export function questReward(q, lv) {
  return { xp: Math.round(xpToNext(q.lv || lv) * q.xpk), gold: q.gold, potions: q.potions || null, item: q.gear ?? null };
}
export function objectiveText(q) {
  if (q.type === 'kill') return `${TYPE_NAMES[q.target]} öldür`;
  if (q.type === 'boss') return `${UNIQUES[q.target].name}'ı yen`;
  if (q.type === 'collect') return `${q.item} topla`;
  return `${q.item} topla (${q.from.map((f) => TYPE_NAMES[f]).join(', ')})`;
}

// Repeatable bounty scaled to the player's level.
function makeBounty(lv, n) {
  const R = rng(lv * 977 + n * 131);
  const pool = lv < 4 ? ['minion'] : lv < 6 ? ['minion', 'rogue'] : lv < 9 ? ['rogue', 'mage', 'minion'] : ['warrior', 'mage'];
  const target = pool[Math.floor(R() * pool.length)];
  const drop = R() < 0.4;
  const count = drop ? 6 : 8 + Math.floor(R() * 5);
  const base = { id: 'bounty', lv, count, xpk: 0.35 + count * 0.01, gold: Math.round(25 + lv * 18), potions: R() < 0.5 ? { hp: 2 } : { mp: 2 } };
  if (drop) {
    const item = { minion: 'Paslı Künye', rogue: 'Haydut Hançeri', mage: 'Kâhin Mührü', warrior: 'Muhafız Nişanı' }[target];
    return { ...base, type: 'drop', item, icon: target === 'mage' ? 'staff' : 'bone_A', from: [target], chance: 0.5, name: `Sözleşme: ${item}`,
      story: `${TYPE_NAMES[target]}lerin taşıdığı ${item}lar lazım. ${count} tane getir, karşılığını cömertçe ödeyeceğim.` };
  }
  return { ...base, type: 'kill', target, minLv: Math.max(1, lv - 4), name: `Sözleşme: ${TYPE_NAMES[target]} Avı`,
    story: `${TYPE_NAMES[target]}ler yine çoğaldı. Seviyene yakın ${count} tanesini öldür.` };
}

export class Quests {
  constructor(game) {
    this.g = game;
    const s = game.save;
    s.quests ||= { done: [], active: null, prog: 0, bounty: null, bountyN: 0 };
    this.st = s.quests;
    this.nodes = [];
    this.channel = null;
    this.ver = 0; // bumps when tracker text must refresh
    this.syncNodes();
  }

  get next() { return QUESTS.find((q) => !this.st.done.includes(q.id)) || null; }
  get main() { return this.st.active ? QUESTS.find((q) => q.id === this.st.active) : null; }
  get mainDone() { const q = this.main; return !!q && this.st.prog >= q.count; }
  get bounty() { return this.st.bounty; }
  get bountyDone() { const b = this.st.bounty; return !!b && b.prog >= b.count; }

  // NPC head marker: '?' ready to hand in, '!' new quest, '…' in progress.
  npcMark() {
    if (this.mainDone || this.bountyDone) return '?';
    const n = this.next;
    if (!this.st.active && n && n.lv <= this.g.save.level) return '!';
    if (!this.st.bounty && this.st.done.includes('q1')) return '!';
    if (this.st.active || this.st.bounty) return '…';
    return '';
  }

  list() {
    const out = [];
    const m = this.main;
    if (m) out.push({ q: m, prog: Math.min(this.st.prog, m.count), done: this.mainDone, kind: 'main' });
    const b = this.st.bounty;
    if (b) out.push({ q: b, prog: Math.min(b.prog, b.count), done: this.bountyDone, kind: 'bounty' });
    return out;
  }

  accept() {
    const n = this.next; if (!n || this.st.active || n.lv > this.g.save.level) return;
    this.st.active = n.id; this.st.prog = 0;
    this.g.ui.announce(`📜 Yeni görev: ${n.name}`, 'skill'); sfx.pickup();
    this.syncNodes(); this.changed();
  }
  acceptBounty() {
    if (this.st.bounty) return;
    this.st.bountyN++;
    this.st.bounty = { ...makeBounty(this.g.save.level, this.st.bountyN), prog: 0 };
    this.g.ui.announce(`📜 ${this.st.bounty.name}`, 'skill'); sfx.pickup();
    this.changed();
  }
  abandonBounty() { this.st.bounty = null; this.changed(); }

  turnIn(kind) {
    const g = this.g, s = g.save;
    let q;
    if (kind === 'main') { if (!this.mainDone) return; q = this.main; s.quests.done.push(q.id); this.st.active = null; this.st.prog = 0; }
    else { if (!this.bountyDone) return; q = this.st.bounty; this.st.bounty = null; }
    const r = questReward(q, s.level);
    s.gold += r.gold;
    if (r.potions) for (const k in r.potions) s.potions[k] = (s.potions[k] || 0) + r.potions[k];
    if (r.item != null) g.giveItem(makeItem(['weapon', 'armor', 'ring'][Math.floor(Math.random() * 3)], Math.max(s.level, q.lv), r.item, s.cls));
    sfx.enhanceOk();
    g.ui.announce(`✔ Görev tamamlandı: ${q.name}`, 'victory');
    g.fx.pillar(g.player.pos, 0x7dff9a, { h: 10, r: 1.2, dur: 1.2 });
    g.gainXp(r.xp, g.player.pos);
    this.syncNodes(); this.changed();
    saveGame(s, g.player);
    return q;
  }

  changed() { this.ver++; this.g.ui.refreshQuests?.(); }

  bump(q, isMain, label) {
    const st = isMain ? this.st : this.st.bounty;
    if (st.prog >= q.count) return;
    st.prog++;
    this.changed();
    this.g.ui.toast(`${label} ${st.prog}/${q.count}`, '#ffe08a');
    if (st.prog >= q.count) {
      sfx.rare();
      this.g.ui.announce(`✔ ${q.name} — ${GIVER.name}'a dön`, 'victory');
      if (isMain) this.syncNodes();
    }
  }

  // ---------- hooks ----------
  onKill(e) {
    const m = this.main, b = this.st.bounty;
    for (const [q, isMain] of [[m, true], [b, false]]) {
      if (!q) continue;
      if (q.type === 'kill' && !e.unique && e.type === q.target && (!q.minLv || e.level >= q.minLv)) this.bump(q, isMain, TYPE_NAMES[q.target]);
      if (q.type === 'boss' && e.unique && e.unique.id === q.target) this.bump(q, isMain, UNIQUES[q.target].name);
      if (q.type === 'drop' && !e.unique && q.from.includes(e.type)) {
        const st = isMain ? this.st : b;
        const pending = this.g.loot.filter((l) => l.kind === 'quest' && l.data.qid === (isMain ? q.id : 'bounty')).length;
        if (st.prog + pending < q.count && Math.random() < q.chance) this.g.dropLoot(e.pos, 'quest', { qid: isMain ? q.id : 'bounty', item: q.item, icon: q.icon });
      }
    }
  }
  onQuestItem(d) {
    const isMain = d.qid !== 'bounty';
    const q = isMain ? this.main : this.st.bounty;
    if (!q || (isMain && q.id !== d.qid)) { this.g.ui.toast(`${d.item} artık gerekmiyor`, '#aaa'); return; }
    this.bump(q, isMain, d.item);
  }

  // ---------- collectible nodes ----------
  syncNodes() {
    const q = this.main;
    const want = q && q.type === 'collect' && !this.mainDone ? q : null;
    if (this.nodeQuest === want?.id) return;
    for (const n of this.nodes) this.removeNode(n);
    this.nodes = [];
    this.nodeQuest = want?.id;
    if (!want) return;
    const R = rng(want.id.length * 7919 + 17);
    const spots = [];
    let tries = 0;
    while (spots.length < want.count + 4 && tries++ < 500) {
      const x = BOUNDS.minX + 8 + R() * (BOUNDS.maxX - BOUNDS.minX - 16);
      const z = want.area[0] + R() * (want.area[1] - want.area[0]);
      if (this.g.world.blocked(x, z, 1.2)) continue;
      if (spots.some((p) => Math.hypot(p[0] - x, p[1] - z) < 7)) continue;
      spots.push([x, z]);
    }
    for (const [x, z] of spots) this.nodes.push(this.makeNode(want, x, z));
  }
  makeNode(q, x, z) {
    const g = this.g;
    const mesh = cloneProp(q.prop, q.scale || 1);
    const y = heightAt(x, z);
    mesh.position.set(x, y, z);
    const glow = g.fx.glow(0xffe08a, 2.4); glow.position.y = 0.5 / (q.scale || 1); glow.material.opacity = 0.6; mesh.add(glow);
    g.scene.add(mesh);
    const beam = g.fx.lootBeam(new THREE.Vector3(x, y, z), 0xffd36b); beam.material.opacity = 0.25; beam.scale.set(1.4, 0.7, 1.4);
    return { q, pos: new THREE.Vector3(x, y, z), mesh, beam, glow, alive: true, respawn: 0, seed: Math.random() * 10 };
  }
  removeNode(n) { this.g.scene.remove(n.mesh); this.g.scene.remove(n.beam); }

  nearestNode(pos, r = 2.6) {
    let best = null, bd = r;
    for (const n of this.nodes) { if (!n.alive) continue; const d = dist2d(n.pos, pos); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  startCollect(n) {
    const p = this.g.player;
    if (!n || !n.alive || p.dead || this.channel) return;
    if (dist2d(n.pos, p.pos) > 2.8) { p.moveTarget = n.pos.clone(); p.autoAttack = false; return; }
    p.autoAttack = false; p.moveTarget = null; p.target = null;
    p.yaw = Math.atan2(n.pos.x - p.pos.x, n.pos.z - p.pos.z);
    p.anim.once('PickUp', { timeScale: 1.1, lockFor: 1.1 });
    this.channel = { n, t: 0, dur: 1.2, hp: p.hp };
    this.g.ui.channel(n.q.item, 0);
  }

  update(dt) {
    const g = this.g, p = g.player;
    for (const n of this.nodes) {
      if (!n.alive) {
        n.respawn -= dt;
        if (n.respawn <= 0) { n.alive = true; n.mesh.visible = true; n.beam.visible = true; g.fx.burst(n.pos.clone().setY(n.pos.y + 0.5), 14, 0xffe08a, { speed: 2, up: 2, size: 0.3 }); }
        continue;
      }
      const near = dist2d(n.pos, p.pos) < 40;
      n.mesh.visible = near; n.beam.visible = near;
      if (!near) continue;
      n.glow.material.opacity = 0.45 + Math.sin(g.time * 3 + n.seed) * 0.2;
      n.mesh.rotation.y += dt * 0.6;
      if (Math.random() < dt * 4) g.fx.trail(n.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2)), 0xffe08a, 0.25, 0.8);
    }
    const c = this.channel;
    if (c) {
      const moved = g.input.move.x !== 0 || g.input.move.y !== 0 || p.moveTarget || p.autoAttack;
      if (moved || p.dead || p.hp < c.hp - 0.5 || !c.n.alive) {
        this.channel = null; g.ui.channel(null); p.anim.unlock();
        if (p.hp < c.hp - 0.5) g.ui.toast('Toplama bölündü!', '#ff8a6a');
        return;
      }
      c.t += dt; g.ui.channel(c.n.q.item, c.t / c.dur);
      if (c.t >= c.dur) {
        this.channel = null; g.ui.channel(null);
        const n = c.n; n.alive = false; n.respawn = 25; n.mesh.visible = false; n.beam.visible = false;
        sfx.pickup(); g.fx.burst(n.pos.clone().setY(n.pos.y + 0.6), 26, 0xffe08a, { speed: 4, up: 4, size: 0.4, grav: 2 });
        if (this.main && this.main.id === n.q.id) this.bump(n.q, true, n.q.item);
      }
    }
  }

  // ---------- map targets ----------
  targets() {
    const out = [];
    const add = (q, done) => {
      if (done) { out.push({ x: GIVER.pos[0], z: GIVER.pos[1], r: 0, kind: 'turnin', label: q.name }); return; }
      if (q.type === 'kill' || q.type === 'drop') {
        const types = q.type === 'kill' ? [q.target] : q.from;
        const lv = this.g.save.level;
        const camps = CAMPS.filter((c) => types.includes(c[2]));
        // Prefer camps near the player's level so the marker points somewhere sensible.
        const good = camps.filter((c) => c[5] >= lv - 3 && c[4] <= lv + 3);
        for (const c of (good.length ? good : camps)) out.push({ x: c[0], z: c[1], r: 6, kind: 'area', label: q.name });
      } else if (q.type === 'boss') {
        const u = UNIQUES[q.target]; out.push({ x: u.pos[0], z: u.pos[1], r: 7, kind: 'boss', label: q.name });
      } else {
        for (const n of this.nodes) if (n.alive) out.push({ x: n.pos.x, z: n.pos.z, r: 0, kind: 'node', label: q.item });
      }
    };
    const m = this.main; if (m) add(m, this.mainDone);
    const b = this.st.bounty; if (b) add(b, this.bountyDone);
    if (!m && !b && this.npcMark() === '!') out.push({ x: GIVER.pos[0], z: GIVER.pos[1], r: 0, kind: 'turnin', label: 'Yeni görev' });
    return out;
  }
}

export { TYPE_NAMES, ENEMIES };
