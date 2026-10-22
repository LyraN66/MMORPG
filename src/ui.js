import * as THREE from 'three';
import { xpToNext, RARITY, itemStat, PLUS_CHANCE, plusCost, sellPrice, SHOP, MAX_LEVEL } from './data.js';
import { sfx, soundOn, setSound } from './audio.js';
import { saveGame } from './save.js';
import { BOUNDS, roadX, CAMP_POS, CRYPT_POS } from './world.js';
import { dist2d } from './units.js';
import { QUESTS, GIVER, questReward, objectiveText } from './quests.js';
import { UNIQUES, ZONES, CAMPS } from './data.js';

const $ = (s) => document.querySelector(s);
const fmtTime = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const V = new THREE.Vector3();
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export class UI {
  constructor() {
    this.plates = new Map(); this.npcPlates = []; this.lootPlates = new Map();
    this.overlay = $('#overlay');
    this.toasts = $('#toasts');
    this.mm = $('#minimap'); this.mmc = this.mm.getContext('2d');
    this.mmT = 0;
  }

  bind(game) {
    this.g = game; const p = game.player;
    $('#hud').classList.remove('hidden'); $('#controls').classList.remove('hidden');
    $('#pname').textContent = game.save.name;
    $('#portrait').textContent = p.cls.id === 'knight' ? '⚔️' : '🔮';
    // skill buttons
    const wrap = $('#skills'); wrap.innerHTML = '';
    this.skillBtns = p.cls.skills.map((s, i) => {
      const b = h('button', 'skill s' + i, `<span class="ic">${s.icon}</span><span class="cd"></span><span class="mpc">${s.mp}</span><span class="key">${i + 1}</span><span class="lock">🔒${s.unlock}</span>`);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); game.player.useSkill(i); });
      wrap.appendChild(b); return b;
    });
    $('#atk').onpointerdown = (e) => { e.preventDefault(); game.attackButton(); };
    $('#pot-hp').onpointerdown = (e) => { e.preventDefault(); game.player.usePotion('hp'); };
    $('#pot-mp').onpointerdown = (e) => { e.preventDefault(); game.player.usePotion('mp'); };
    $('#btn-inv').onclick = () => this.openInventory();
    $('#sellall').onclick = () => this.sellAll();
    $('#btn-menu').onclick = () => this.openMenu();
    $('#revive').onclick = () => game.revive();
    $('#target').onclick = () => { if (game.player.target) { game.player.autoAttack = true; } };
    $('#npc-btn').onclick = () => this.interact();
    $('#minimap').onclick = () => this.openMap();
    $('#qtrack').onclick = () => this.openMap();
    this.refreshQuests();
    this.roomBadge();
    if (!game.save.quests.done.length && !game.save.quests.active) setTimeout(() => this.toast(`📜 ${GIVER.name} kampta seni bekliyor (!)`, '#ffe08a'), 2500);
    document.querySelectorAll('.modal .close').forEach((b) => (b.onclick = () => this.closeModal()));
    this.refreshInventory();
  }

  // ---------- plates ----------
  addPlate(e) {
    const el = h('div', 'plate' + (e.isBoss ? ' boss' : ''), `<div class="nm"><span class="lv">Sv.${e.level}</span> ${e.name}</div><div class="hpb"><i></i></div>`);
    el.style.display = 'none'; this.overlay.appendChild(el); this.plates.set(e, { el, bar: el.querySelector('i'), shown: false });
  }
  removePlate(e) { const p = this.plates.get(e); if (p) { p.el.remove(); this.plates.delete(e); } }
  addPlayerPlate(r) {
    const el = h('div', 'plate ally', `<div class="nm"><span class="lv"></span> <b></b></div><div class="hpb"><i></i></div>`);
    el.style.display = 'none'; this.overlay.appendChild(el);
    (this.allyPlates ||= new Map()).set(r, { el, lv: el.querySelector('.lv'), nm: el.querySelector('b'), bar: el.querySelector('i') });
  }
  removePlayerPlate(r) { const p = this.allyPlates?.get(r); if (p) { p.el.remove(); this.allyPlates.delete(r); } }
  roomBadge() {
    const c = this.g?.coop || null, el = $('#room');
    if (!el) return;
    if (!c) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `🌍 Çevrimiçi · <b>${c.count}</b> oyuncu`;
  }
  netBanner(text) {
    const el = $('#netwarn');
    if (!text) { el.classList.add('hidden'); return; }
    el.textContent = text; el.classList.remove('hidden');
  }
  netLost(reason) {
    $('#netlost p').textContent = reason;
    $('#netlost').classList.remove('hidden');
    $('#netlost button').onclick = () => { saveGame(this.g.save, this.g.player); location.reload(); };
  }
  addNpcPlate(n) {
    const icon = { smith: '⚒️', merchant: '💰', quest: '📜' }[n.role], role = { smith: 'Güçlendirme', merchant: 'Market', quest: 'Görevler' }[n.role];
    const el = h('div', 'plate npc', `<div class="mark"></div><div class="nm">${icon} ${n.name}</div><div class="role">${role}</div>`);
    this.overlay.appendChild(el); this.npcPlates.push({ n, el, mark: el.querySelector('.mark') });
  }
  addLootPlate(l) {
    if (l.kind !== 'item' && l.kind !== 'quest') return;
    const it = l.data;
    const el = l.kind === 'quest' ? h('div', 'plate loot', `<div class="nm" style="color:#7dff9a">📜 ${it.item}</div>`)
      : h('div', 'plate loot', `<div class="nm" style="color:${RARITY[it.rarity].color}">${it.name}</div>`);
    this.overlay.appendChild(el); this.lootPlates.set(l, el);
  }
  removeLootPlate(l) { const el = this.lootPlates.get(l); if (el) { el.remove(); this.lootPlates.delete(l); } }

  project(pos, yOff) {
    V.copy(pos); V.y += yOff; V.project(this.g.camera);
    if (V.z > 1 || V.x < -1.2 || V.x > 1.2 || V.y < -1.2 || V.y > 1.2) return null;
    return [(V.x * 0.5 + 0.5) * innerWidth, (-V.y * 0.5 + 0.5) * innerHeight];
  }

  // ---------- frame update ----------
  update(dt) {
    const g = this.g, p = g.player, s = g.save;
    for (const [e, pl] of this.plates) {
      const d = dist2d(e.pos, p.pos);
      const show = e.alive && e.root.visible && e.state !== 'spawn' && d < (e.isBoss ? 40 : 22);
      const sc = show && this.project(e.pos, 2.75 * e.scale + 0.2);
      if (!sc) { if (pl.shown) { pl.el.style.display = 'none'; pl.shown = false; } continue; }
      if (!pl.shown) { pl.el.style.display = ''; pl.shown = true; }
      pl.el.style.transform = `translate(${sc[0] | 0}px, ${sc[1] | 0}px) translate(-50%, -100%)`;
      const sel = p.target === e, hurt = e.hp < e.maxHp || sel;
      if (pl.hurt !== hurt) { pl.el.classList.toggle('hurt', hurt); pl.hurt = hurt; }
      if (pl.sel !== sel) { pl.el.classList.toggle('sel', sel); pl.sel = sel; }
      const w = Math.round((e.hp / e.maxHp) * 100);
      if (pl.w !== w) { pl.bar.style.width = w + '%'; pl.w = w; }
      const diff = e.level - p.level;
      const dc = diff >= 3 ? 'red' : diff <= -4 ? 'grey' : diff >= 1 ? 'orange' : 'white';
      if (pl.dc !== dc) { pl.el.dataset.diff = dc; pl.dc = dc; }
    }
    if (this.allyPlates) for (const [r, pl] of this.allyPlates) {
      const sc = !r.fresh && dist2d(r.pos, p.pos) < 40 && this.project(r.pos, 2.6);
      if (!sc) { if (pl.shown) { pl.el.style.display = 'none'; pl.shown = false; } continue; }
      if (!pl.shown) { pl.el.style.display = ''; pl.shown = true; }
      pl.el.style.transform = `translate(${sc[0] | 0}px, ${sc[1] | 0}px) translate(-50%, -100%)`;
      const key = r.level + r.name + r.dead;
      if (pl.key !== key) { pl.key = key; pl.lv.textContent = 'Sv.' + r.level; pl.nm.textContent = r.dead ? `${r.name} (öldü)` : r.name; }
      const w = Math.round(Math.max(0, r.hp / r.maxHp) * 100);
      if (pl.w !== w) { pl.bar.style.width = w + '%'; pl.w = w; }
    }
    let near = null;
    const qm = g.quests.npcMark();
    for (const np of this.npcPlates) {
      const { n, el } = np;
      if (n.role === 'quest' && np.m !== qm) { np.m = qm; np.mark.textContent = qm; np.mark.className = 'mark ' + (qm === '?' ? 'ready' : qm === '!' ? 'new' : 'wait'); }
      const sc = dist2d(n.pos, p.pos) < 25 && this.project(n.pos, 2.9);
      if (!sc) { el.style.display = 'none'; continue; }
      el.style.display = ''; el.style.transform = `translate(${sc[0] | 0}px, ${sc[1] | 0}px) translate(-50%, -100%)`;
      if (dist2d(n.pos, p.pos) < 4.5) near = n;
    }
    // Context action: talk to a nearby NPC, or collect a quest object.
    const node = !near && !g.quests.channel ? g.quests.nearestNode(p.pos) : null;
    const act = near ? 'npc:' + near.name : node ? 'node' : '';
    if (act !== this.actKey) {
      this.actKey = act; this.nearNpc = near; this.nearNode = node;
      const b = $('#npc-btn'); b.classList.toggle('hidden', !act);
      if (near) b.innerHTML = { smith: '⚒️ Demirci', merchant: '💰 Market', quest: '📜 Görevler' }[near.role];
      else if (node) b.innerHTML = `✋ Topla: ${node.q.item}`;
    }
    this.nearNode = node;
    for (const [l, el] of this.lootPlates) {
      const sc = this.project(l.mesh.position, 0.9);
      if (!sc || l.flying) { el.style.display = 'none'; continue; }
      el.style.display = ''; el.style.transform = `translate(${sc[0] | 0}px, ${sc[1] | 0}px) translate(-50%, -100%)`;
    }
    if (this.qver !== g.quests.ver) this.refreshQuests();

    // HUD bars
    $('#hp i').style.width = (p.hp / p.maxHp) * 100 + '%';
    $('#hp span').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('#mp i').style.width = (p.mp / p.maxMp) * 100 + '%';
    $('#mp span').textContent = `${Math.floor(p.mp)} / ${p.maxMp}`;
    $('#plv').textContent = s.level;
    $('#gold').textContent = s.gold.toLocaleString('tr-TR');
    const need = xpToNext(s.level);
    const xpk = s.level >= MAX_LEVEL ? 1 : s.xp / need;
    $('#xp i').style.width = xpk * 100 + '%';
    $('#xp span').textContent = s.level >= MAX_LEVEL ? 'MAKS' : `Sv.${s.level} · %${(xpk * 100).toFixed(1)}`;
    $('#hp').classList.toggle('low', p.hp / p.maxHp < 0.3);
    $('#buff').classList.toggle('hidden', !(p.buffT > 0));
    if (p.buffT > 0) $('#buff span').textContent = Math.ceil(p.buffT);
    $('#pot-hp b').textContent = s.potions.hp || 0;
    $('#pot-mp b').textContent = s.potions.mp || 0;
    p.cls.skills.forEach((sk, i) => {
      const b = this.skillBtns[i]; const cd = p.cds[sk.id] || 0;
      const locked = p.level < sk.unlock;
      b.classList.toggle('locked', locked);
      b.classList.toggle('nomp', !locked && p.mp < sk.mp);
      b.classList.toggle('cool', cd > 0);
      b.querySelector('.cd').textContent = cd > 0 ? Math.ceil(cd) : '';
      b.style.setProperty('--cd', cd > 0 ? (cd / sk.cd) * 360 + 'deg' : '0deg');
    });
    // target frame
    const t = p.target && p.target.alive ? p.target : null;
    const tf = $('#target');
    tf.classList.toggle('hidden', !t || t.isBoss);
    if (t && !t.isBoss) {
      tf.querySelector('.nm').innerHTML = `<span class="lv">Sv.${t.level}</span> ${t.name}`;
      tf.querySelector('i').style.width = (t.hp / t.maxHp) * 100 + '%';
      tf.querySelector('span.v').textContent = `${Math.ceil(t.hp)} / ${t.maxHp}`;
    }
    // boss bar: shows when a unique is targeted or fighting nearby
    const boss = g.enemies.find((e) => e.isBoss && e.alive && (p.target === e || (e.state !== 'idle' && e.state !== 'wander' && dist2d(e.pos, p.pos) < 30)));
    const bb = $('#bossbar'); bb.classList.toggle('hidden', !boss);
    if (boss) {
      bb.querySelector('.nm').textContent = `${boss.name}  ·  Sv.${boss.level}`;
      bb.querySelector('i').style.width = (boss.hp / boss.maxHp) * 100 + '%';
      bb.querySelector('b').style.width = (boss.hp / boss.maxHp) * 100 + '%';
      bb.querySelector('.v').textContent = `${Math.ceil(boss.hp).toLocaleString('tr-TR')} / ${boss.maxHp.toLocaleString('tr-TR')}`;
      bb.classList.toggle('enraged', boss.enraged);
    }
    this.mmT -= dt; if (this.mmT <= 0) { this.mmT = 0.1; this.drawMinimap(); }
  }

  drawMinimap() {
    const g = this.g, p = g.player, c = this.mmc, W = this.mm.width, H = this.mm.height;
    const scale = W / 60; // 60 units across
    c.clearRect(0, 0, W, H);
    c.save(); c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(16,18,24,0.82)'; c.fillRect(0, 0, W, H);
    const tx = (x) => W / 2 + (x - p.pos.x) * scale, tz = (z) => H / 2 + (z - p.pos.z) * scale;
    // road
    c.strokeStyle = 'rgba(160,130,90,0.55)'; c.lineWidth = 3 * scale * 0.9; c.beginPath();
    for (let z = p.pos.z - 40; z <= p.pos.z + 40; z += 2) { const x = roadX(z); z === p.pos.z - 40 ? c.moveTo(tx(x), tz(z)) : c.lineTo(tx(x), tz(z)); }
    c.stroke();
    // bounds
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
    c.strokeRect(tx(BOUNDS.minX + 4), tz(BOUNDS.minZ + 5), (BOUNDS.maxX - BOUNDS.minX - 8) * scale, (BOUNDS.maxZ - BOUNDS.minZ - 9) * scale);
    // camp / crypt icons
    c.font = `${12 * devicePixelRatio}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('⛺', tx(CAMP_POS.x), tz(CAMP_POS.z)); c.fillText('🏛️', tx(CRYPT_POS.x), tz(CRYPT_POS.z + 3));
    for (const l of g.loot) { if (l.kind !== 'item') continue; c.fillStyle = RARITY[l.data.rarity].color; c.fillRect(tx(l.pos.x) - 2, tz(l.pos.z) - 2, 4, 4); }
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (e.isBoss) { c.fillText('💀', tx(e.pos.x), tz(e.pos.z)); continue; }
      c.fillStyle = e.state === 'chase' || e.state === 'cast' ? '#ff4a3a' : '#e0a040';
      c.beginPath(); c.arc(tx(e.pos.x), tz(e.pos.z), 2.2 * devicePixelRatio, 0, 6.28); c.fill();
    }
    for (const n of g.npcs) { c.fillStyle = '#6ad1ff'; c.beginPath(); c.arc(tx(n.pos.x), tz(n.pos.z), 2.5 * devicePixelRatio, 0, 6.28); c.fill(); }
    if (g.coop) for (const r of g.coop.remotes.values()) {
      if (r.fresh || r.gone) continue;
      const dx = r.pos.x - p.pos.x, dz = r.pos.z - p.pos.z, d = Math.hypot(dx, dz) * scale, R = W / 2 - 8 * devicePixelRatio;
      const k = d > R ? R / d : 1;
      c.fillStyle = r.dead ? '#888' : '#5dff7a'; c.strokeStyle = '#000'; c.lineWidth = devicePixelRatio;
      c.beginPath(); c.arc(W / 2 + dx * scale * k, H / 2 + dz * scale * k, 3.5 * devicePixelRatio, 0, 6.28); c.fill(); c.stroke();
    }
    // quest objectives
    const D = devicePixelRatio;
    const tg = g.quests.targets();
    let nearest = null, nd = Infinity;
    for (const t of tg) {
      const d = Math.hypot(t.x - p.pos.x, t.z - p.pos.z);
      if (d < nd) { nd = d; nearest = t; }
      if (t.r) { c.strokeStyle = 'rgba(255,224,138,0.85)'; c.setLineDash([3 * D, 3 * D]); c.lineWidth = 1.5 * D; c.beginPath(); c.arc(tx(t.x), tz(t.z), t.r * scale, 0, 6.28); c.stroke(); c.setLineDash([]); }
      else if (t.kind === 'node') { c.fillStyle = '#ffe08a'; c.font = `${11 * D}px sans-serif`; c.fillText('✦', tx(t.x), tz(t.z)); }
    }
    const qm = g.quests.npcMark();
    if (qm === '!' || qm === '?') { c.font = `bold ${14 * D}px sans-serif`; c.fillStyle = '#ffd23a'; c.fillText(qm, tx(GIVER.pos[0]), tz(GIVER.pos[1]) - 8 * D); }
    if (nearest && nd * scale > W / 2 - 12) {
      const a = Math.atan2(nearest.z - p.pos.z, nearest.x - p.pos.x), r = W / 2 - 10 * D;
      c.save(); c.translate(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); c.rotate(a);
      c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(6 * D, 0); c.lineTo(-4 * D, -5 * D); c.lineTo(-4 * D, 5 * D); c.closePath(); c.fill(); c.restore();
    }
    // unique arrows at edge when far
    for (const u of g.uniques) if (u.enemy && u.enemy.alive) {
      const dx = u.enemy.pos.x - p.pos.x, dz = u.enemy.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d * scale > W / 2 - 10) { const a = Math.atan2(dz, dx); c.fillText('💀', W / 2 + Math.cos(a) * (W / 2 - 12), H / 2 + Math.sin(a) * (H / 2 - 12)); }
    }
    c.restore();
    // player arrow
    c.save(); c.translate(W / 2, H / 2); c.rotate(-p.yaw + Math.PI);
    c.fillStyle = '#fff'; c.beginPath(); const s = 5 * devicePixelRatio; c.moveTo(0, -s * 1.3); c.lineTo(s, s); c.lineTo(0, s * 0.4); c.lineTo(-s, s); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(214,180,110,0.8)'; c.lineWidth = 2 * devicePixelRatio; c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); c.stroke();
  }

  // ---------- notifications ----------
  toast(text, color = '#fff') {
    const el = h('div', 'toast', text); el.style.color = color;
    this.toasts.prepend(el);
    while (this.toasts.children.length > 4) this.toasts.lastChild.remove();
    setTimeout(() => el.classList.add('out'), 2200); setTimeout(() => el.remove(), 2700);
  }
  announce(text, kind = '') {
    const box = $('#announce'); const el = h('div', 'ann' + (kind ? ' ann-' + kind : ''), text);
    box.appendChild(el);
    if (kind === 'unique') sfx.warn();
    setTimeout(() => el.classList.add('out'), 4200); setTimeout(() => el.remove(), 5000);
  }
  zone(zn) {
    const el = $('#zonebanner');
    el.innerHTML = `<small>${zn.lv[0] ? `Seviye ${zn.lv[0]}–${zn.lv[1]}` : 'Güvenli Bölge'}</small>${zn.name}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    $('#zonename').textContent = zn.name;
  }
  levelUp(lv) {
    const el = $('#levelup'); el.innerHTML = `<small>SEVİYE ATLADIN</small>${lv}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  death(on) { $('#death').classList.toggle('hidden', !on); }

  // ---------- modals ----------
  openModal(id) { this.closeModal(); $(id).classList.remove('hidden'); this.g.input.enabled = false; sfx.ui(); }
  closeModal() { document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden')); if (this.g) this.g.input.enabled = true; }

  itemCard(it, { compact } = {}) {
    const r = RARITY[it.rarity]; const st = itemStat(it);
    const stat = st.atk ? `Saldırı +${st.atk}` : st.def ? `Savunma +${st.def}` : `Can +${st.hp}`;
    return `<div class="icard r${it.rarity}"><div class="iic">${it.slot === 'weapon' ? (it.wtype === 'staff' ? '🪄' : '🗡️') : it.slot === 'armor' ? '🛡️' : '💍'}${it.plus ? `<em>+${it.plus}</em>` : ''}</div>
      ${compact ? '' : `<div class="iinfo"><b style="color:${r.color}">${it.name}${it.plus ? ' +' + it.plus : ''}</b><small>${r.name} · Sv.${it.lv}</small><span>${stat}</span></div>`}</div>`;
  }

  // An item is an upgrade if this class can use it and it beats what's equipped in that slot.
  canUse(it) { return it.slot !== 'weapon' || it.wtype === (this.g.player.cls.id === 'mage' ? 'staff' : 'sword'); }
  upgradeBy(it) {
    if (!this.canUse(it)) return 0;
    const cur = this.g.save.equip[it.slot];
    const a = itemStat(it), k = a.atk ? 'atk' : a.def ? 'def' : 'hp';
    if (!cur) return a[k] || 1;
    return Math.max(0, a[k] - (itemStat(cur)[k] || 0));
  }

  refreshInventory() {
    if (!this.g) return;
    const s = this.g.save, p = this.g.player;
    const eq = $('#equip'); eq.innerHTML = '';
    for (const [slot, label] of [['weapon', 'Silah'], ['armor', 'Zırh'], ['ring', 'Yüzük']]) {
      const it = s.equip[slot];
      const el = h('div', 'eqslot', `<label>${label}</label>${it ? this.itemCard(it) : '<div class="empty">Boş</div>'}`);
      if (it) el.onclick = () => this.itemDetail(it, true);
      eq.appendChild(el);
    }
    $('#stats').innerHTML = `<div><span>Seviye</span><b>${s.level}</b></div><div><span>Can</span><b>${p.maxHp}</b></div><div><span>Mana</span><b>${p.maxMp}</b></div>
      <div><span>Saldırı</span><b>${p.atk}</b></div><div><span>Savunma</span><b>${p.def}</b></div><div><span>Altın</span><b>${s.gold.toLocaleString('tr-TR')}</b></div>
      <div><span>Öldürülen</span><b>${s.stats.kills || 0}</b></div><div><span>Unique</span><b>${s.stats.uniques || 0}</b></div>`;
    const bag = $('#bag'); bag.innerHTML = '';
    let ups = 0;
    for (let i = 0; i < 24; i++) {
      const it = s.bag[i];
      const up = it ? this.upgradeBy(it) : 0;
      if (up) ups++;
      const el = h('div', 'bslot' + (up ? ' up' : '') + (it && !this.canUse(it) ? ' nouse' : ''), it ? this.itemCard(it, { compact: true }) + (up ? '<span class="upb">▲</span>' : '') : '');
      if (it) el.onclick = () => this.itemDetail(it, false);
      bag.appendChild(el);
    }
    $('#bagcount').textContent = `${s.bag.length}/24`;
    $('#btn-inv').classList.toggle('has-up', ups > 0);
    $('#sellall').disabled = !s.bag.some((it) => !this.upgradeBy(it));
  }

  sellAll() {
    const s = this.g.save, p = this.g.player, d = $('#idetail');
    const sell = s.bag.filter((it) => !this.upgradeBy(it));
    const keep = s.bag.length - sell.length;
    if (!sell.length) { this.toast('Satılacak eşya yok', '#ffcf6a'); return; }
    const gold = sell.reduce((a, it) => a + sellPrice(it), 0);
    const rare = sell.filter((it) => it.rarity >= 2 || it.plus >= 3).length;
    d.innerHTML = `<div class="sellq"><b>${sell.length} eşya satılsın mı?</b><span>Kazanç: <em>${gold.toLocaleString('tr-TR')} 🪙</em></span>
      ${keep ? `<small>▲ Daha iyi olan ${keep} eşya korunacak.</small>` : ''}${rare ? `<small class="warn">Aralarında ${rare} destansı/güçlendirilmiş eşya var.</small>` : ''}</div>
      <div class="row"><button class="btn" id="d-sellall">💰 Sat</button><button class="btn ghost" id="d-x">Vazgeç</button></div>`;
    d.classList.remove('hidden');
    $('#d-x').onclick = () => d.classList.add('hidden');
    $('#d-sellall').onclick = () => {
      s.bag = s.bag.filter((it) => !sell.includes(it)); s.gold += gold;
      sfx.coin(); setTimeout(() => sfx.coin(), 120);
      d.classList.add('hidden'); this.toast(`+${gold.toLocaleString('tr-TR')} altın`, '#ffd36b');
      this.refreshInventory(); saveGame(s, p);
    };
  }

  itemDetail(it, equipped) {
    const s = this.g.save, p = this.g.player;
    const d = $('#idetail'); const cur = s.equip[it.slot];
    let cmp = '';
    if (!equipped && cur) {
      const a = itemStat(it), b = itemStat(cur); const k = a.atk ? 'atk' : a.def ? 'def' : 'hp';
      const diff = a[k] - b[k]; cmp = `<div class="cmp ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)} (kuşanılana göre)</div>`;
    }
    const wrong = it.slot === 'weapon' && it.wtype !== (p.cls.id === 'mage' ? 'staff' : 'sword');
    if (!equipped && !cur && this.canUse(it)) cmp = '<div class="cmp up">▲ Bu yuva boş — hemen kuşan</div>';
    d.innerHTML = `${this.itemCard(it)}${cmp}${wrong ? '<div class="cmp down">Bu silahı sınıfın kullanamaz</div>' : ''}
      <div class="row">${equipped ? '' : `<button class="btn" id="d-eq" ${wrong ? 'disabled' : ''}>Kuşan</button>`}
      ${equipped ? '' : `<button class="btn ghost" id="d-sell">Sat (${sellPrice(it)} 🪙)</button>`}<button class="btn ghost" id="d-x">Kapat</button></div>`;
    d.classList.remove('hidden');
    $('#d-x').onclick = () => d.classList.add('hidden');
    const eqb = $('#d-eq');
    if (eqb) eqb.onclick = () => {
      s.bag = s.bag.filter((x) => x !== it); if (cur) s.bag.push(cur); s.equip[it.slot] = it;
      p.recalc(); p.updateWeaponLook(); sfx.pickup(); d.classList.add('hidden'); this.refreshInventory(); saveGame(s, p);
    };
    const sb = $('#d-sell');
    if (sb) sb.onclick = () => { s.bag = s.bag.filter((x) => x !== it); s.gold += sellPrice(it); sfx.coin(); d.classList.add('hidden'); this.refreshInventory(); saveGame(s, p); };
  }

  openInventory() { this.refreshInventory(); $('#idetail').classList.add('hidden'); this.openModal('#inv'); }

  openNpc(n) {
    if (dist2d(n.pos, this.g.player.pos) > 6) { this.g.player.moveTarget = n.pos.clone().add(new THREE.Vector3(0, 0, 2.5)); return; }
    if (n.role === 'smith') this.openSmith(); else if (n.role === 'quest') this.openQuests(); else this.openShop();
  }
  interact() {
    if (this.nearNpc) this.openNpc(this.nearNpc);
    else if (this.nearNode) this.g.quests.startCollect(this.nearNode);
  }

  // ---------- quests ----------
  refreshQuests() {
    if (!this.g) return;
    const qs = this.g.quests; this.qver = qs.ver;
    const list = qs.list();
    const el = $('#qtrack');
    if (!list.length) {
      const m = qs.npcMark();
      el.innerHTML = m === '!' ? `<div class="qt"><b>📜 Yeni görev</b><span>${GIVER.name} ile konuş</span></div>` : '';
      return;
    }
    el.innerHTML = list.map(({ q, prog, done, kind }) => `<div class="qt ${done ? 'done' : ''}"><b>${kind === 'bounty' ? '🎯' : '📜'} ${q.name}</b>
      <span>${done ? `✔ ${GIVER.name}'a dön` : `${objectiveText(q)}: ${prog}/${q.count}`}</span></div>`).join('');
  }

  channel(label, k) {
    const el = $('#channel');
    if (label == null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('span').textContent = label;
    el.querySelector('i').style.width = Math.min(100, k * 100) + '%';
  }

  rewardText(q) {
    const r = questReward(q, this.g.save.level);
    const parts = [`✨ ${r.xp.toLocaleString('tr-TR')} XP`, `🪙 ${r.gold}`];
    if (r.potions?.hp) parts.push(`🧪 ×${r.potions.hp}`);
    if (r.potions?.mp) parts.push(`💧 ×${r.potions.mp}`);
    if (r.item != null) parts.push(`<span style="color:${RARITY[r.item].color}">🎁 ${RARITY[r.item].name} eşya</span>`);
    return parts.join(' · ');
  }

  openQuests() {
    const qs = this.g.quests, s = this.g.save; const box = $('#questbody');
    let html = '';
    const m = qs.main, nx = qs.next;
    if (m) {
      const done = qs.mainDone;
      html += `<div class="qcard"><h4>📜 ${m.name}</h4><p>${done ? m.done : m.story}</p>
        <div class="qobj">${objectiveText(m)}: <b>${Math.min(s.quests.prog, m.count)}/${m.count}</b></div>
        <div class="qrew">${this.rewardText(m)}</div>
        ${done ? '<button class="btn" data-a="turn-main">Teslim Et</button>' : '<div class="qwait">Devam ediyor…</div>'}</div>`;
    } else if (nx) {
      const ok = nx.lv <= s.level;
      html += `<div class="qcard ${ok ? '' : 'locked'}"><h4>📜 ${nx.name} <small>Sv.${nx.lv}</small></h4><p>${ok ? nx.story : `Bu iş için henüz hazır değilsin. ${nx.lv}. seviyeye ulaşınca gel.`}</p>
        ${ok ? `<div class="qobj">${objectiveText(nx)}: <b>0/${nx.count}</b></div><div class="qrew">${this.rewardText(nx)}</div><button class="btn" data-a="accept">Kabul Et</button>` : ''}</div>`;
    } else {
      html += `<div class="qcard"><h4>🏆 Hikâye tamamlandı</h4><p>Vadinin kurtarıcısı sensin. Sözleşmeler seni bekliyor.</p></div>`;
    }
    if (s.quests.done.includes('q1')) {
      const b = qs.bounty;
      if (b) {
        const done = qs.bountyDone;
        html += `<div class="qcard bounty"><h4>🎯 ${b.name}</h4><p>${b.story}</p>
          <div class="qobj">${objectiveText(b)}: <b>${Math.min(b.prog, b.count)}/${b.count}</b></div><div class="qrew">${this.rewardText(b)}</div>
          ${done ? '<button class="btn" data-a="turn-bounty">Teslim Et</button>' : '<button class="btn ghost" data-a="abandon">Vazgeç</button>'}</div>`;
      } else {
        html += `<div class="qcard bounty"><h4>🎯 Av Sözleşmesi</h4><p>Tekrarlanabilir işler: seviyene göre avlar ve toplama görevleri. İstediğin kadar al.</p>
          <button class="btn" data-a="bounty">Sözleşme Al</button></div>`;
      }
    }
    const say = qs.mainDone || qs.bountyDone ? '"Geri döndün! Anlat bakalım, neler yaptın?"' : m ? '"Vakit kaybetme, vadi bekliyor."' : '"Yolcu! Kampımıza hoş geldin. Burada iş çok, cesur el az."';
    $('#questsay').textContent = say;
    box.innerHTML = html;
    box.querySelectorAll('button[data-a]').forEach((b) => (b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'accept') qs.accept();
      else if (a === 'bounty') qs.acceptBounty();
      else if (a === 'abandon') qs.abandonBounty();
      else if (a === 'turn-main') qs.turnIn('main');
      else if (a === 'turn-bounty') qs.turnIn('bounty');
      this.openQuests();
    }));
    this.openModal('#quest');
  }

  // ---------- world map ----------
  buildMapBase(W, H) {
    // Static layer drawn once: zones, terrain tint, road, props, mountains.
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const sx = W / (BOUNDS.maxX - BOUNDS.minX), sz = H / (BOUNDS.maxZ - BOUNDS.minZ);
    const X = (v) => (v - BOUNDS.minX) * sx, Z = (v) => (v - BOUNDS.minZ) * sz;
    x.fillStyle = '#0b0a0e'; x.fillRect(0, 0, W, H);
    for (const zn of ZONES) {
      const z0 = Math.max(BOUNDS.minZ, zn.zMin), z1 = Math.min(BOUNDS.maxZ, zn.zMax);
      const col = new THREE.Color(zn.tint).multiplyScalar(0.75);
      x.fillStyle = '#' + col.getHexString(); x.fillRect(0, Z(z0), W, Z(z1) - Z(z0));
    }
    // speckle
    const pl = this.g.world.placements || [];
    for (const p of pl) {
      const n = p.name;
      if (/^mountain/.test(n)) continue;
      const col = /tree_pine|trees_/.test(n) ? 'rgba(70,45,25,.45)' : /tree_dead/.test(n) ? 'rgba(40,30,25,.5)' : /grave|gravestone|coffin|crypt|pillar|wall|rubble|arch/.test(n) ? 'rgba(190,185,175,.55)' : null;
      if (!col) continue;
      x.fillStyle = col;
      const r = /tree_pine.*large|trees_/.test(n) ? 2.4 : /tree/.test(n) ? 1.7 : 1.2;
      x.beginPath(); x.arc(X(p.x), Z(p.z), r * Math.min(sx, sz) * 0.6, 0, 6.28); x.fill();
    }
    x.strokeStyle = 'rgba(190,160,110,.9)'; x.lineWidth = 3.2 * sx; x.lineCap = 'round'; x.beginPath();
    for (let z = BOUNDS.minZ + 4; z <= BOUNDS.maxZ - 2; z += 1.5) { const px = X(roadX(z)), pz = Z(z); z === BOUNDS.minZ + 4 ? x.moveTo(px, pz) : x.lineTo(px, pz); }
    x.stroke();
    // mountain border
    x.strokeStyle = 'rgba(30,25,22,.9)'; x.lineWidth = 7 * sx; x.strokeRect(2 * sx, 2 * sz, W - 4 * sx, H - 4 * sz);
    // zone separators + names
    const FD = Math.min(2, devicePixelRatio); x.font = `600 ${Math.round(15 * FD)}px Cinzel, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const zn of ZONES) {
      const z0 = Math.max(BOUNDS.minZ, zn.zMin), z1 = Math.min(BOUNDS.maxZ, zn.zMax);
      if (zn.zMin > BOUNDS.minZ) { x.strokeStyle = 'rgba(255,230,180,.25)'; x.setLineDash([6, 6]); x.lineWidth = 1; x.beginPath(); x.moveTo(0, Z(zn.zMin)); x.lineTo(W, Z(zn.zMin)); x.stroke(); x.setLineDash([]); }
      const cy = (Z(z0) + Z(z1)) / 2;
      x.fillStyle = 'rgba(0,0,0,.6)'; x.fillText(zn.name, W * 0.22 + 2, cy + 2); x.fillStyle = '#f3dc9c'; x.fillText(zn.name, W * 0.22, cy);
      if (zn.lv[0]) { x.font = `${Math.round(12 * FD)}px sans-serif`; x.fillStyle = '#e8d3a0'; x.fillText(`Seviye ${zn.lv[0]}–${zn.lv[1]}`, W * 0.22, cy + 18 * FD); x.font = `600 ${Math.round(15 * FD)}px Cinzel, serif`; }
    }
    return c;
  }

  openMap() {
    this.openModal('#map');
    const cv = $('#mapcv'); const box = cv.parentElement.getBoundingClientRect();
    const D = Math.min(2, devicePixelRatio);
    const W = Math.round(box.width * D), H = Math.round(box.height * D);
    cv.style.width = box.width + 'px'; cv.style.height = box.height + 'px';
    cv.width = W; cv.height = H;
    // Fill the width; the valley is tall, so the map scrolls north/south.
    const k = Math.min(W / (BOUNDS.maxX - BOUNDS.minX), H / 72);
    const mw = Math.round((BOUNDS.maxX - BOUNDS.minX) * k), fullH = Math.round((BOUNDS.maxZ - BOUNDS.minZ) * k);
    if (!this.mapBase || this.mapBase.width !== mw || this.mapBase.height !== fullH) this.mapBase = this.buildMapBase(mw, fullH);
    const viewH = H / k;
    const lo = BOUNDS.minZ + viewH / 2, hi = BOUNDS.maxZ - viewH / 2;
    const clampZ = (z) => (lo > hi ? (BOUNDS.minZ + BOUNDS.maxZ) / 2 : Math.min(hi, Math.max(lo, z)));
    this.map = { k, viewH, cz: clampZ(this.g.player.pos.z), clampZ, D, ox: Math.round((W - mw) / 2) };
    if (!cv.dataset.bound) {
      cv.dataset.bound = '1';
      let drag = null;
      cv.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, cz: this.map.cz }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => { if (drag) this.map.cz = this.map.clampZ(drag.cz - (e.clientY - drag.y) * this.map.D / this.map.k); });
      cv.addEventListener('pointerup', () => { drag = null; });
      cv.addEventListener('wheel', (e) => { this.map.cz = this.map.clampZ(this.map.cz + e.deltaY * 0.05); e.preventDefault(); }, { passive: false });
    }
    const draw = () => {
      if ($('#map').classList.contains('hidden')) return;
      this.drawMap(cv); requestAnimationFrame(draw);
    };
    draw();
    this.mapLegend();
  }

  drawMap(cv) {
    const g = this.g, p = g.player, c = cv.getContext('2d'), W = cv.width, H = cv.height, { k, viewH, cz, D, ox } = this.map;
    const top = cz - viewH / 2;
    c.fillStyle = '#0b0a0e'; c.fillRect(0, 0, W, H);
    const oy = (H - this.mapBase.height) / 2;
    let Z;
    const mw = this.mapBase.width;
    if (oy >= 0) { c.drawImage(this.mapBase, ox, oy); Z = (v) => oy + (v - BOUNDS.minZ) * k; }
    else { c.drawImage(this.mapBase, 0, (top - BOUNDS.minZ) * k, mw, H, ox, 0, mw, H); Z = (v) => (v - top) * k; }
    const X = (v) => ox + (v - BOUNDS.minX) * k;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const cp of CAMPS) {
      const lvl = g.save.level, hard = cp[4] > lvl + 2, easy = cp[5] < lvl - 3;
      c.fillStyle = hard ? '#ff3a2a' : easy ? '#9a9a9a' : '#ffa040';
      c.beginPath(); c.arc(X(cp[0]), Z(cp[1]), 4 * D, 0, 6.28); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1.2 * D; c.stroke();
      c.font = `bold ${9 * D}px sans-serif`; c.fillStyle = '#000'; c.fillText(`${cp[4]}-${cp[5]}`, X(cp[0]) + D, Z(cp[1]) - 9 * D + D);
      c.fillStyle = '#fff'; c.fillText(`${cp[4]}-${cp[5]}`, X(cp[0]), Z(cp[1]) - 9 * D);
    }
    const t = performance.now() / 1000;
    for (const q of g.quests.targets()) {
      if (q.r) { c.strokeStyle = 'rgba(255,224,138,.95)'; c.lineWidth = 2 * D; c.setLineDash([5 * D, 4 * D]); c.beginPath(); c.arc(X(q.x), Z(q.z), q.r * k * (1 + Math.sin(t * 3) * 0.08), 0, 6.28); c.stroke(); c.setLineDash([]); }
      else if (q.kind === 'node') { c.font = `${15 * D}px sans-serif`; c.fillStyle = '#ffe08a'; c.fillText('✦', X(q.x), Z(q.z)); }
    }
    c.font = `${20 * D}px sans-serif`;
    c.fillText('⛺', X(CAMP_POS.x), Z(CAMP_POS.z)); c.fillText('🏛️', X(CRYPT_POS.x), Z(CRYPT_POS.z + 2));
    for (const u of g.uniques) {
      const d = u.def; const alive = u.enemy && u.enemy.alive;
      c.font = `${20 * D}px sans-serif`; c.globalAlpha = alive ? 1 : 0.5; c.fillText('💀', X(d.pos[0]), Z(d.pos[1])); c.globalAlpha = 1;
      c.font = `bold ${11 * D}px sans-serif`; c.fillStyle = '#000'; c.fillText(alive ? 'BURADA!' : fmtTime(u.timer), X(d.pos[0]) + D, Z(d.pos[1]) + 17 * D + D);
      c.fillStyle = alive ? '#ff6a4a' : '#eee'; c.fillText(alive ? 'BURADA!' : fmtTime(u.timer), X(d.pos[0]), Z(d.pos[1]) + 17 * D);
    }
    for (const n of g.npcs) { c.fillStyle = '#6ad1ff'; c.beginPath(); c.arc(X(n.pos.x), Z(n.pos.z), 3.5 * D, 0, 6.28); c.fill(); }
    if (g.coop) for (const r of g.coop.remotes.values()) {
      if (r.fresh || r.gone) continue;
      c.fillStyle = r.dead ? '#888' : '#5dff7a'; c.strokeStyle = '#000'; c.lineWidth = 1.5 * D;
      c.beginPath(); c.arc(X(r.pos.x), Z(r.pos.z), 5 * D, 0, 6.28); c.fill(); c.stroke();
      c.font = `bold ${11 * D}px sans-serif`; c.fillStyle = '#000'; c.fillText(r.name, X(r.pos.x) + D, Z(r.pos.z) - 11 * D + D); c.fillStyle = '#9dffb0'; c.fillText(r.name, X(r.pos.x), Z(r.pos.z) - 11 * D);
    }
    const qm = g.quests.npcMark();
    if (qm === '!' || qm === '?') { c.font = `900 ${20 * D}px sans-serif`; c.fillStyle = '#ffd23a'; c.fillText(qm, X(GIVER.pos[0]) + 9 * D, Z(GIVER.pos[1]) - 10 * D); }
    c.save(); c.translate(X(p.pos.x), Z(p.pos.z)); c.rotate(-p.yaw + Math.PI);
    const s = 8 * D; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2 * D;
    c.beginPath(); c.moveTo(0, -s * 1.3); c.lineTo(s, s); c.lineTo(0, s * 0.4); c.lineTo(-s, s); c.closePath(); c.fill(); c.stroke(); c.restore();
    // scroll hints
    c.font = `${12 * D}px sans-serif`; c.fillStyle = 'rgba(255,240,200,.7)';
    if (cz - viewH / 2 > BOUNDS.minZ + 1) c.fillText('▲ kuzey', W / 2, 10 * D);
    if (cz + viewH / 2 < BOUNDS.maxZ - 1) c.fillText('▼ güney', W / 2, H - 10 * D);
  }

  mapLegend() {
    const g = this.g;
    const rows = g.uniques.map((u) => `<div class="lg"><span>💀 ${u.def.name}</span><b>${u.enemy && u.enemy.alive ? '<em>Sahada!</em>' : fmtTime(u.timer)}</b></div>`).join('');
    const qs = g.quests.list().map(({ q, prog, done }) => `<div class="lg"><span>${done ? '✔' : '📜'} ${q.name}</span><b>${done ? 'Teslim et' : prog + '/' + q.count}</b></div>`).join('');
    $('#maplegend').innerHTML = `<h4>Unique Boss'lar</h4>${rows}<h4>Görevler</h4>${qs || '<div class="lg dim">Aktif görev yok</div>'}
      <div class="keys"><span>⛺ Kamp</span><span>🏛️ Tapınak</span><span><i class="dot org"></i> Mob kampı (seviye)</span><span><i class="dot red"></i> Zor</span><span><i class="dot blue"></i> NPC</span><span><i class="dot green"></i> Arkadaş</span><span>✦ Toplanacak</span><span><i class="ring"></i> Görev bölgesi</span></div>`;
    clearTimeout(this.legendT);
    if (!$('#map').classList.contains('hidden')) this.legendT = setTimeout(() => this.mapLegend(), 1000);
  }

  openShop() {
    const s = this.g.save; const box = $('#shoplist'); box.innerHTML = '';
    for (const it of SHOP) {
      const row = h('div', 'shoprow', `<div class="si">${it.icon}</div><div class="sinfo"><b>${it.name}</b><small>${it.desc} · Sende: ${s.potions[it.id] || 0}</small></div>
        <button class="btn" data-n="1">${it.price} 🪙</button><button class="btn ghost" data-n="10">x10</button>`);
      row.querySelectorAll('button').forEach((b) => (b.onclick = () => {
        const n = +b.dataset.n, cost = it.price * n;
        if (s.gold < cost) { sfx.deny(); this.toast('Yetersiz altın', '#ff6a6a'); return; }
        s.gold -= cost; s.potions[it.id] = (s.potions[it.id] || 0) + n; sfx.coin(); this.openShop(); $('#shop').classList.remove('hidden');
      }));
      box.appendChild(row);
    }
    $('#shopgold').textContent = s.gold.toLocaleString('tr-TR') + ' 🪙';
    this.openModal('#shop');
  }

  openSmith(sel) {
    const s = this.g.save; const list = $('#smithlist'); list.innerHTML = '';
    const items = [...Object.values(s.equip).filter(Boolean), ...s.bag];
    sel = sel && items.includes(sel) ? sel : items[0];
    for (const it of items) {
      const el = h('div', 'bslot' + (it === sel ? ' sel' : ''), this.itemCard(it, { compact: true }));
      el.onclick = () => this.openSmith(it); list.appendChild(el);
    }
    const panel = $('#smithpanel');
    if (!sel) { panel.innerHTML = '<p>Güçlendirilecek eşya yok.</p>'; this.openModal('#smith'); return; }
    const max = sel.plus >= 10;
    const ch = max ? 0 : PLUS_CHANCE[sel.plus + 1]; const cost = plusCost(sel);
    const next = { ...sel, plus: sel.plus + 1 };
    const a = itemStat(sel), b = itemStat(next); const k = a.atk ? 'atk' : a.def ? 'def' : 'hp';
    const label = { atk: 'Saldırı', def: 'Savunma', hp: 'Can' }[k];
    panel.innerHTML = `<div class="anvil" id="anvil">${this.itemCard(sel)}</div>
      ${max ? '<p class="maxed">Bu eşya en yüksek seviyede (+10)!</p>' : `
      <div class="enh"><div><span>Hedef</span><b>+${sel.plus + 1}</b></div><div><span>Başarı</span><b class="${ch < 0.4 ? 'bad' : ch < 0.8 ? 'mid' : 'ok'}">%${Math.round(ch * 100)}</b></div>
      <div><span>${label}</span><b>${a[k]} → ${b[k]}</b></div><div><span>Ücret</span><b>${cost.toLocaleString('tr-TR')} 🪙</b></div></div>
      <p class="warn">${sel.plus + 1 >= 4 ? 'Başarısız olursa eşya 1 seviye düşer.' : 'Bu seviyede başarısızlıkta kayıp yok.'}</p>
      <button class="btn big" id="enh-go">⚒️ Güçlendir</button>`}`;
    $('#smithgold').textContent = s.gold.toLocaleString('tr-TR') + ' 🪙';
    const go = $('#enh-go');
    if (go) go.onclick = () => {
      if (s.gold < cost) { sfx.deny(); this.toast('Yetersiz altın', '#ff6a6a'); return; }
      s.gold -= cost; go.disabled = true;
      const anvil = $('#anvil'); anvil.classList.add('forging');
      let n = 0; const tick = setInterval(() => { sfx.enhanceTick(); if (++n > 9) clearInterval(tick); }, 110);
      setTimeout(() => {
        const ok = Math.random() < ch;
        anvil.classList.remove('forging');
        if (ok) { sel.plus++; sfx.enhanceOk(); anvil.classList.add('ok'); this.toast(`Başarılı! ${sel.name} +${sel.plus}`, '#7dff9a'); }
        else { if (sel.plus + 1 >= 4) sel.plus = Math.max(0, sel.plus - 1); sfx.enhanceFail(); anvil.classList.add('fail'); this.toast('Güçlendirme başarısız…', '#ff6a6a'); }
        this.g.player.recalc(); this.g.player.updateWeaponLook(); saveGame(s, this.g.player);
        setTimeout(() => { this.openSmith(sel); $('#smith').classList.remove('hidden'); }, 900);
      }, 1200);
    };
    this.openModal('#smith');
  }

  openMenu() {
    $('#snd').textContent = soundOn() ? '🔊 Ses: Açık' : '🔇 Ses: Kapalı';
    $('#snd').onclick = () => { setSound(!soundOn()); this.openMenu(); };
    const q = localStorage.getItem('kv-quality') || 'auto';
    $('#qual').textContent = '🎨 Grafik: ' + { auto: 'Otomatik (cihaza göre)', high: 'Yüksek', medium: 'Orta', low: 'Düşük' }[q];
    let fp = 'auto'; try { fp = localStorage.getItem('kv-fps') || 'auto'; } catch { /* ignore */ }
    $('#fpsbtn').textContent = '⏱️ FPS: ' + { auto: 'Otomatik', 60: '60 (en yüksek)', 30: '30 (sabit, akıcı)' }[fp];
    $('#fpsbtn').onclick = () => {
      const order = ['auto', '60', '30']; const n = order[(order.indexOf(fp) + 1) % 3];
      try { localStorage.setItem('kv-fps', n); } catch { /* ignore */ }
      window.__kv?.setFps(n); this.openMenu();
    };
    $('#qual').onclick = () => {
      const order = ['auto', 'high', 'medium', 'low']; const n = order[(order.indexOf(q) + 1) % 4];
      try { localStorage.setItem('kv-quality', n); } catch { /* ignore */ }
      this.openMenu(); $('#qnote').classList.remove('hidden');
    };
    let perf = false; try { perf = localStorage.getItem('kv-perf') === '1'; } catch { /* ignore */ }
    $('#perf').textContent = perf ? '📊 Performans göstergesi: Açık' : '📊 Performans göstergesi: Kapalı';
    $('#perf').onclick = () => { try { localStorage.setItem('kv-perf', perf ? '0' : '1'); } catch { /* ignore */ } window.__kv?.setPerf(!perf); this.openMenu(); };
    $('#tomenu').onclick = () => { saveGame(this.g.save, this.g.player); location.reload(); };
    this.openModal('#menu');
  }
}
