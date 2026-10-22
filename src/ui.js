import * as THREE from 'three';
import { xpToNext, RARITY, itemStat, PLUS_CHANCE, plusCost, sellPrice, SHOP, MAX_LEVEL , SLOTS, SLOT, STAT_NAMES, itemScore, potionPrice, ELIXIRS, elixirPrice, chestPrice, bagPrice, travelPrice, makeItem, randomSlot , MOUNTS, ACHIEVEMENTS , scrollPrice } from './data.js';
import { sfx, soundOn, setSound } from './audio.js';
import { saveGame } from './save.js';
import { BOUNDS, roadX, CAMP_POS, CRYPT_POS, heightAt } from './world.js';
import { dist2d } from './units.js';
import { QUESTS, GIVER, GIVERS, questReward, objectiveText, mapLock, chainDone } from './quests.js';
import { OUTPOSTS, ACTIVE_MAP } from '../server/shared/terrain.js';
import { MAPS } from '../server/shared/maps.js';
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
    $('#portrait').textContent = p.cls.icon;
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
    $('#mount-btn').onpointerdown = (e) => { e.preventDefault(); game.toggleMount(); };
    $('#recall-btn').onpointerdown = (e) => { e.preventDefault(); game.startRecall(); };
    $('#btn-ach').onclick = () => this.openAchievements();
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
    const el = h('div', 'plate ally', `<div class="bub hidden"></div><div class="ttl"></div><div class="nm"><span class="lv"></span> <b></b></div><div class="hpb"><i></i></div>`);
    el.style.display = 'none'; this.overlay.appendChild(el);
    (this.allyPlates ||= new Map()).set(r, { el, lv: el.querySelector('.lv'), nm: el.querySelector('b'), bar: el.querySelector('i'), ttl: el.querySelector('.ttl'), bub: el.querySelector('.bub') });
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
    const icon = { smith: '⚒️', merchant: '💰', quest: '📜', portal: '🌀' }[n.role], role = { smith: 'Güçlendirme', merchant: 'Market', quest: 'Görevler', portal: 'Haritalar' }[n.role];
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
      let sc = show && this.project(e.pos, 2.75 * e.scale + 0.2);
      // The boss bar already names the boss; plates that would land on the top HUD strip are hidden.
      if (sc && (sc[1] < 78 || (e.isBoss && this.bossShown === e))) sc = null;
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
      const sc = !r.fresh && dist2d(r.pos, p.pos) < 40 && this.project(r.pos, 2.6 + (r.mount ? r.mount.seat : 0));
      if (!sc) { if (pl.shown) { pl.el.style.display = 'none'; pl.shown = false; } continue; }
      if (!pl.shown) { pl.el.style.display = ''; pl.shown = true; }
      pl.el.style.transform = `translate(${sc[0] | 0}px, ${sc[1] | 0}px) translate(-50%, -100%)`;
      const key = r.level + r.name + r.dead;
      const foe = !!g.social?.isFoe(r), party = !!g.social?.inPartyNet(r.netId);
      const key2 = key + r.title + foe + party;
      if (pl.key !== key2) {
        pl.key = key2; pl.lv.textContent = 'Sv.' + r.level; pl.nm.textContent = r.dead ? `${r.name} (öldü)` : r.name;
        pl.ttl.textContent = r.title ? `« ${r.title} »` : ''; pl.el.classList.toggle('foe', foe); pl.el.classList.toggle('party', party);
      }
      const say = r.say && g.time - r.say.t < 5 ? r.say.text : '';
      if (pl.say !== say) { pl.say = say; pl.bub.textContent = say; pl.bub.classList.toggle('hidden', !say); }
      const w = Math.round(Math.max(0, r.hp / r.maxHp) * 100);
      if (pl.w !== w) { pl.bar.style.width = w + '%'; pl.w = w; }
    }
    let near = null;
    for (const np of this.npcPlates) {
      const { n, el } = np;
      const qm = n.role === 'quest' ? g.quests.npcMark(n.outpost?.id === 'camp') : '';
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
      if (near) b.innerHTML = { smith: '⚒️ Demirci', merchant: '💰 Market', quest: '📜 Görevler', portal: '🌀 Işınlanma Kapısı' }[near.role];
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
    this.elixT = (this.elixT || 0) - dt;
    if (this.elixT <= 0) {
      this.elixT = 1;
      const now = Date.now(), bf = this.g.save.buffs || {};
      const html = ELIXIRS.filter((e) => (bf[e.id] || 0) > now).map((e) => `<span>${e.icon} ${Math.ceil((bf[e.id] - now) / 60000)}dk</span>`).join('');
      if (html !== this.elixHtml) { this.elixHtml = html; $('#elix').innerHTML = html; }
    }
    $('#buff').classList.toggle('hidden', !(p.buffT > 0));
    if (p.buffT > 0) $('#buff span').textContent = Math.ceil(p.buffT);
    $('#pot-hp b').textContent = s.potions.hp || 0;
    $('#pot-mp b').textContent = s.potions.mp || 0;
    const sc = s.potions.scroll || 0;
    if (this.scrollN !== sc) { this.scrollN = sc; $('#recall-btn').classList.toggle('hidden', !sc); $('#recall-btn b').textContent = sc; }
    const hasMount = !!s.mounts?.length;
    if (this.mountShown !== hasMount) { this.mountShown = hasMount; $('#mount-btn').classList.toggle('hidden', !hasMount); }
    if (this.mountOn !== !!p.mount) { this.mountOn = !!p.mount; $('#mount-btn').classList.toggle('on', this.mountOn); }
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
    const bb = $('#bossbar'); bb.classList.toggle('hidden', !boss); this.bossShown = boss || null;
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
    c.fillText('⛺', tx(CAMP_POS.x), tz(CAMP_POS.z)); if (ACTIVE_MAP.crypt) c.fillText('🏛️', tx(CRYPT_POS.x), tz(CRYPT_POS.z + 3));
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
    for (const o of OUTPOSTS) if (o.id !== 'camp') { c.font = `${12 * D}px sans-serif`; c.fillText('⛺', tx(o.x), tz(o.z)); }
    if (ACTIVE_MAP.portal) { c.font = `${12 * D}px sans-serif`; c.fillText('🌀', tx(ACTIVE_MAP.portal.x), tz(ACTIVE_MAP.portal.z)); }
    c.font = `bold ${14 * D}px sans-serif`; c.fillStyle = '#ffd23a';
    for (const gv of GIVERS) { const mk = g.quests.npcMark(gv.camp); if (mk === '!' || mk === '?') c.fillText(mk, tx(gv.pos[0]), tz(gv.pos[1]) - 8 * D); }
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

  itemIcon(it) { return it.slot === 'weapon' ? ({ staff: '🪄', bow: '🏹', dagger: '🔪', axe: '🪓' }[it.wtype] || '🗡️') : SLOT[it.slot]?.icon || '❔'; }
  statText(it) { const st = itemStat(it); return Object.keys(STAT_NAMES).filter((k) => st[k]).map((k) => `${STAT_NAMES[k]} +${st[k]}`).join(' · '); }
  itemCard(it, { compact } = {}) {
    const r = RARITY[it.rarity];
    return `<div class="icard r${it.rarity}"><div class="iic">${this.itemIcon(it)}${it.plus ? `<em>+${it.plus}</em>` : ''}</div>
      ${compact ? '' : `<div class="iinfo"><b style="color:${r.color}">${it.name}${it.plus ? ' +' + it.plus : ''}</b><small>${r.name} · ${SLOT[it.slot]?.name || ''} · Sv.${it.lv}</small><span>${this.statText(it)}</span></div>`}</div>`;
  }

  // An item is an upgrade if this class can use it and it beats what's equipped in that slot.
  canUse(it) {
    const c = this.g.player.cls;
    if (it.slot === 'weapon') return it.wtype === c.weaponType;
    return !(SLOT[it.slot]?.knightOnly && c.id !== 'knight');
  }
  upgradeBy(it) {
    if (!this.canUse(it)) return 0;
    const cur = this.g.save.equip[it.slot];
    if (!cur) return Math.max(1, Math.round(itemScore(it)));
    return Math.max(0, Math.round(itemScore(it) - itemScore(cur)));
  }

  refreshInventory() {
    if (!this.g) return;
    const s = this.g.save, p = this.g.player;
    const eq = $('#equip'); eq.innerHTML = '';
    for (const sl of SLOTS) {
      const it = s.equip[sl.id], blocked = sl.knightOnly && p.cls.id !== 'knight';
      const el = h('div', 'eqslot' + (blocked ? ' blocked' : ''), `<label>${sl.icon} ${sl.name}</label>${it ? this.itemCard(it) : `<div class="empty">${blocked ? `${p.cls.name} kullanamaz` : 'Boş'}</div>`}`);
      if (it) el.onclick = () => this.itemDetail(it, true);
      eq.appendChild(el);
    }
    $('#stats').innerHTML = `<div><span>Seviye</span><b>${s.level}</b></div><div><span>Can</span><b>${p.maxHp}</b></div><div><span>Mana</span><b>${p.maxMp}</b></div>
      <div><span>Saldırı</span><b>${p.atk}</b></div><div><span>Savunma</span><b>${p.def}</b></div><div><span>Altın</span><b>${s.gold.toLocaleString('tr-TR')}</b></div>
      <div><span>Öldürülen</span><b>${s.stats.kills || 0}</b></div><div><span>Unique</span><b>${s.stats.uniques || 0}</b></div>`;
    const bag = $('#bag'); bag.innerHTML = '';
    let ups = 0;
    for (let i = 0; i < s.bagMax; i++) {
      const it = s.bag[i];
      const up = it ? this.upgradeBy(it) : 0;
      if (up) ups++;
      const el = h('div', 'bslot' + (up ? ' up' : '') + (it && !this.canUse(it) ? ' nouse' : ''), it ? this.itemCard(it, { compact: true }) + (up ? '<span class="upb">▲</span>' : '') : '');
      if (it) el.onclick = () => this.itemDetail(it, false);
      bag.appendChild(el);
    }
    $('#bagcount').textContent = `${s.bag.length}/${s.bagMax}`;
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
    if (!equipped && cur && this.canUse(it)) {
      const a = itemStat(it), b = itemStat(cur);
      const parts = Object.keys(STAT_NAMES).filter((k) => a[k] || b[k]).map((k) => { const d = a[k] - b[k]; return `<span class="${d >= 0 ? 'up' : 'down'}">${STAT_NAMES[k]} ${d >= 0 ? '▲' : '▼'}${Math.abs(d)}</span>`; });
      cmp = `<div class="cmp ${itemScore(it) >= itemScore(cur) ? 'up' : 'down'}">${parts.join(' ')} <small>(kuşanılana göre)</small></div>`;
    }
    const wrong = !this.canUse(it);
    if (!equipped && !cur && this.canUse(it)) cmp = '<div class="cmp up">▲ Bu yuva boş — hemen kuşan</div>';
    d.innerHTML = `${this.itemCard(it)}${cmp}${wrong ? '<div class="cmp down">Sınıfın bu eşyayı kullanamaz</div>' : ''}
      <div class="row">${equipped ? '' : `<button class="btn" id="d-eq" ${wrong ? 'disabled' : ''}>Kuşan</button>`}
      ${equipped ? '<button class="btn ghost" id="d-un">Çıkar</button>' : `<button class="btn ghost" id="d-sell">Sat (${sellPrice(it)} 🪙)</button>`}<button class="btn ghost" id="d-x">Kapat</button></div>`;
    d.classList.remove('hidden');
    $('#d-x').onclick = () => d.classList.add('hidden');
    const eqb = $('#d-eq');
    if (eqb) eqb.onclick = () => {
      s.bag = s.bag.filter((x) => x !== it); if (cur) s.bag.push(cur); s.equip[it.slot] = it;
      p.recalc(); p.updateWeaponLook(); sfx.pickup(); d.classList.add('hidden'); this.refreshInventory(); saveGame(s, p);
    };
    const ub = $('#d-un');
    if (ub) ub.onclick = () => {
      if (s.bag.length >= s.bagMax) { this.toast('Çanta dolu!', '#ff6a6a'); return; }
      s.equip[it.slot] = null; s.bag.push(it); p.recalc(); p.updateWeaponLook(); d.classList.add('hidden'); this.refreshInventory(); saveGame(s, p);
    };
    const sb = $('#d-sell');
    if (sb) sb.onclick = () => { s.bag = s.bag.filter((x) => x !== it); s.gold += sellPrice(it); sfx.coin(); d.classList.add('hidden'); this.refreshInventory(); saveGame(s, p); };
  }

  openInventory() { this.refreshInventory(); $('#idetail').classList.add('hidden'); this.openModal('#inv'); }

  openNpc(n) {
    if (dist2d(n.pos, this.g.player.pos) > 6) { this.g.player.moveTarget = n.pos.clone().add(new THREE.Vector3(0, 0, 2.5)); return; }
    if (n.role === 'portal') { this.openPortal(); return; }
    this.curNpc = n;
    const title = { smith: '⚒️ ', merchant: '💰 ', quest: '📜 ' }[n.role] + n.name;
    $({ smith: '#smith', merchant: '#shop', quest: '#quest' }[n.role] + ' .ph h3').textContent = title;
    if (n.role === 'smith') this.openSmith(); else if (n.role === 'quest') this.openQuests(); else this.openShop();
  }
  openPortal() {
    const s = this.g.save, cur = ACTIVE_MAP.id;
    const box = $('#portallist'); box.innerHTML = '';
    for (const m of [...MAPS].sort((a, b) => a.order - b.order)) {
      const lock = mapLock(s, m), here = m.id === cur, done = chainDone(s, m.id);
      const el = h('div', 'pcard' + (here ? ' here' : '') + (lock ? ' locked' : ''), `<div class="pn"><b>${m.order}. ${m.name}</b><small>Seviye ${m.lv[0]}–${m.lv[1]}${done ? ' · ✔ Hikâye tamam' : ''}</small></div>
        ${here ? '<span class="ptag">Buradasın</span>' : lock ? `<span class="ptag lock">🔒 ${lock}</span>` : '<button class="btn">Işınlan</button>'}`);
      const b = el.querySelector('button'); if (b) b.onclick = () => { this.closeModal(); this.g.travel(m.id); };
      box.appendChild(el);
    }
    const nx = MAPS.find((m) => m.order === ACTIVE_MAP.order + 1);
    $('#portalnote').textContent = nx ? (mapLock(s, nx) ? `Sıradaki: ${nx.name} — ${mapLock(s, nx)}.` : `${nx.name} seni bekliyor!`) : 'Yeni diyarlar yakında açılacak…';
    this.openModal('#portal');
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
      el.innerHTML = qs.newMain ? `<div class="qt"><b>📜 Yeni görev</b><span>Kamptaki ${GIVER.name} ile konuş</span></div>` : m === '!' ? `<div class="qt"><b>🎯 Sözleşme</b><span>Bir Gözcü'den av sözleşmesi al</span></div>` : '';
      return;
    }
    el.innerHTML = list.map(({ q, prog, done, kind }) => `<div class="qt ${done ? 'done' : ''}"><b>${kind === 'bounty' ? '🎯' : '📜'} ${q.name}</b>
      <span>${done ? '✔ Teslim için bir Gözcü\'ye git' : `${objectiveText(q)}: ${prog}/${q.count}`}</span></div>`).join('');
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
    if (r.mount) parts.push(`<span style="color:#7dff9a">🐕 Binek: ${MOUNTS.find((m) => m.id === r.mount)?.name}</span>`);
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
    } else if (nx && this.curNpc?.outpost && this.curNpc.outpost.id !== 'camp') {
      html += `<div class="qcard locked"><h4>📜 Hikâye görevleri</h4><p>Yeni hikâye görevlerini kamptaki <b>${GIVER.name}</b> veriyor. Biten görevleri bana da teslim edebilirsin.</p>
        <button class="btn ghost" data-a="tocamp">⚡ Kampa ışınlan (${travelPrice(s.level)} 🪙)</button></div>`;
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
      else if (a === 'tocamp') { this.closeModal(); this.g.fastTravel(OUTPOSTS[0]); return; }
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
    $('#map h3').textContent = '🗺️ ' + ACTIVE_MAP.name;
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
      cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cz: this.map.cz, t: performance.now() }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => { if (drag) this.map.cz = this.map.clampZ(drag.cz - (e.clientY - drag.y) * this.map.D / this.map.k); });
      cv.addEventListener('pointerup', (e) => {
        const d = drag; drag = null;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 500) return;
        // A tap (not a drag): walk there.
        const r = cv.getBoundingClientRect(), { k, D, ox } = this.map, px = (e.clientX - r.left) * D, py = (e.clientY - r.top) * D;
        const oy = (cv.height - this.mapBase.height) / 2, top = this.map.cz - this.map.viewH / 2;
        const x = (px - ox) / k + BOUNDS.minX, z = oy >= 0 ? (py - oy) / k + BOUNDS.minZ : py / k + top;
        if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return;
        if (this.g.player.dead) return;
        if (this.g.player.walkTo(x, z)) {
          this.closeModal(); sfx.ui(); this.toast('📍 Hedefe yürüyorsun', '#bfe3ff');
          const m = this.g.moveMarker; m.visible = true; m.position.set(x, heightAt(x, z) + 0.06, z); m.userData.t = 0; this.g.walkDest = m.position.clone();
        } else this.toast('Oraya yol bulunamadı', '#ff8a6a');
      });
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
    c.fillText('⛺', X(CAMP_POS.x), Z(CAMP_POS.z)); if (ACTIVE_MAP.crypt) c.fillText('🏛️', X(CRYPT_POS.x), Z(CRYPT_POS.z + 2));
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
    for (const o of OUTPOSTS) {
      if (o.id !== 'camp') { c.font = `${18 * D}px sans-serif`; c.fillText('⛺', X(o.x), Z(o.z)); }
      c.font = `bold ${10 * D}px sans-serif`; c.fillStyle = '#000'; c.fillText(o.name, X(o.x) + D, Z(o.z) + 16 * D + D); c.fillStyle = '#bfe3ff'; c.fillText(o.name, X(o.x), Z(o.z) + 16 * D);
      c.strokeStyle = 'rgba(159,224,255,.5)'; c.lineWidth = 1.5 * D; c.setLineDash([2 * D, 3 * D]); c.beginPath(); c.arc(X(o.x), Z(o.z), o.r * k, 0, 6.28); c.stroke(); c.setLineDash([]);
    }
    if (ACTIVE_MAP.portal) { const P = ACTIVE_MAP.portal; c.font = `${18 * D}px sans-serif`; c.fillText('🌀', X(P.x), Z(P.z)); c.font = `bold ${10 * D}px sans-serif`; c.fillStyle = '#000'; c.fillText('Işınlanma Kapısı', X(P.x) + D, Z(P.z) + 16 * D + D); c.fillStyle = '#c9bfff'; c.fillText('Işınlanma Kapısı', X(P.x), Z(P.z) + 16 * D); }
    c.font = `900 ${20 * D}px sans-serif`; c.fillStyle = '#ffd23a';
    for (const gv of GIVERS) { const mk = g.quests.npcMark(gv.camp); if (mk === '!' || mk === '?') c.fillText(mk, X(gv.pos[0]) + 9 * D, Z(gv.pos[1]) - 10 * D); }
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
    const price = travelPrice(g.save.level);
    const posts = OUTPOSTS.map((o, i) => `<div class="lg"><span>⛺ ${o.name}</span><button class="btn mini" data-o="${i}">⚡ ${price} 🪙</button></div>`).join('');
    $('#maplegend').innerHTML = `<p class="maptip">👆 Haritada bir yere dokun, karakterin oraya yürüsün.</p><h4>Hızlı Işınlanma</h4>${posts}<h4>Unique Boss'lar</h4>${rows}<h4>Görevler</h4>${qs || '<div class="lg dim">Aktif görev yok</div>'}
      <div class="keys"><span>⛺ Kamp</span><span>🏛️ Tapınak</span><span><i class="dot org"></i> Mob kampı (seviye)</span><span><i class="dot red"></i> Zor</span><span><i class="dot blue"></i> NPC</span><span><i class="dot green"></i> Arkadaş</span><span>✦ Toplanacak</span><span><i class="ring"></i> Görev bölgesi</span></div>`;
    $('#maplegend').querySelectorAll('button[data-o]').forEach((b) => (b.onclick = () => { this.closeModal(); g.fastTravel(OUTPOSTS[+b.dataset.o]); }));
    clearTimeout(this.legendT);
    if (!$('#map').classList.contains('hidden')) this.legendT = setTimeout(() => this.mapLegend(), 1000);
  }

  openShop(tab = this.shopTab || 'pots') {
    // The camp has the full market; outpost merchants only sell potions and return scrolls.
    const camp = !this.curNpc?.outpost || this.curNpc.outpost.id === 'camp';
    if (!camp) tab = 'pots';
    this.shopTab = tab;
    const s = this.g.save, p = this.g.player, lv = s.level, box = $('#shoplist'); box.innerHTML = '';
    const tabs = h('div', 'shoptabs', (camp ? [['pots', '🧪 İksir'], ['elix', '✨ Güç'], ['chest', '🎁 Sandık'], ['bag', '🎒 Çanta'], ['mount', '🐎 Binek']] : [['pots', '🧪 İksir']])
      .map(([id, n]) => `<button class="tab${id === tab ? ' on' : ''}" data-t="${id}">${n}</button>`).join(''));
    tabs.querySelectorAll('button').forEach((b) => (b.onclick = () => { sfx.ui(); this.openShop(b.dataset.t); }));
    box.appendChild(tabs);
    const pay = (cost) => { if (s.gold < cost) { sfx.deny(); this.toast('Yetersiz altın', '#ff6a6a'); return false; } s.gold -= cost; sfx.coin(); return true; };
    const refresh = () => { saveGame(s, p); this.openShop(tab); };
    const row = (icon, name, desc, btns) => { const r = h('div', 'shoprow', `<div class="si">${icon}</div><div class="sinfo"><b>${name}</b><small>${desc}</small></div>${btns}`); box.appendChild(r); return r; };
    if (tab === 'pots') {
      const price = potionPrice(lv);
      for (const it of SHOP) {
        const r = row(it.icon, it.name, `${it.desc} · Sende: ${s.potions[it.id] || 0}`, `<button class="btn" data-n="1">${price} 🪙</button><button class="btn ghost" data-n="10">x10</button>`);
        r.querySelectorAll('button').forEach((b) => (b.onclick = () => { const n = +b.dataset.n; if (pay(price * n)) { s.potions[it.id] = (s.potions[it.id] || 0) + n; refresh(); } }));
      }
      const sp = scrollPrice(lv);
      const r = row('📜', 'Dönüş Parşömeni', `3 saniyede kampa ışınlar (saldırı alırsan bozulur) · Sende: ${s.potions.scroll || 0}`, `<button class="btn" data-n="1">${sp} 🪙</button><button class="btn ghost" data-n="5">x5</button>`);
      r.querySelectorAll('button').forEach((b) => (b.onclick = () => { const n = +b.dataset.n; if (pay(sp * n)) { s.potions.scroll = (s.potions.scroll || 0) + n; refresh(); } }));
      if (!camp) box.appendChild(h('p', 'shopnote', 'Güç iksirleri, sandık, çanta ve binek kamptaki tüccarda.'));
    } else if (tab === 'elix') {
      for (const e of ELIXIRS) {
        const left = Math.max(0, (s.buffs[e.id] || 0) - Date.now()), price = elixirPrice(e, lv);
        const r = row(e.icon, e.name, `${e.desc} · ${e.mins} dk${left ? ` · <em>Aktif: ${Math.ceil(left / 60000)} dk</em>` : ''}`, `<button class="btn">${price.toLocaleString('tr-TR')} 🪙</button>`);
        r.querySelector('button').onclick = () => {
          if (!pay(price)) return;
          s.buffs[e.id] = Math.max(Date.now(), s.buffs[e.id] || 0) + e.mins * 60000; // buying again adds time
          this.toast(`${e.icon} ${e.name} içildi!`, '#ffd36b'); p.recalc(); refresh();
        };
      }
      box.appendChild(h('p', 'shopnote', 'Süre oyun açıkken de kapalıyken de işler. Tekrar alırsan süre uzar.'));
    } else if (tab === 'chest') {
      const price = chestPrice(lv);
      const r = row('🎁', 'Gizemli Eşya Sandığı', `Seviyene uygun rastgele bir eşya · %10 destansı, %2 efsanevi şansı`, `<button class="btn">${price.toLocaleString('tr-TR')} 🪙</button>`);
      r.querySelector('button').onclick = () => {
        if (s.bag.length >= s.bagMax) { sfx.deny(); this.toast('Çanta dolu!', '#ff6a6a'); return; }
        if (!pay(price)) return;
        const x = Math.random(), rar = x < 0.02 ? 3 : x < 0.12 ? 2 : x < 0.45 ? 1 : 0;
        const it = makeItem(randomSlot(s.cls), lv, rar, s.cls);
        this.g.giveItem(it); if (rar >= 2) sfx.rare();
        refresh();
      };
    } else if (tab === 'mount') {
      s.mounts ||= [];
      for (const m of MOUNTS) {
        const own = s.mounts.includes(m.id), low = lv < m.lv;
        const r = row(m.icon, m.name, `%${Math.round(m.speed * 100)} daha hızlı koşu · Sv.${m.lv}+${own ? ' · <em>Sende var</em>' : ''}`,
          own ? `<button class="btn ghost">${s.mountPick === m.id || (!s.mountPick && s.mounts.at(-1) === m.id) ? '✔ Seçili' : 'Seç'}</button>` : `<button class="btn" ${low ? 'disabled' : ''}>${m.price.toLocaleString('tr-TR')} 🪙</button>`);
        r.querySelector('button').onclick = () => {
          if (own) { s.mountPick = m.id; if (p.mount) this.g.setMount(p, m.id); refresh(); return; }
          if (!pay(m.price)) return;
          s.mounts.push(m.id); s.mountPick = m.id; sfx.levelUp(); this.toast(`${m.icon} ${m.name} senin! 🐎 butonuyla bin.`, '#7dff9a'); refresh();
        };
      }
      box.appendChild(h('p', 'shopnote', 'Bineğe sağ alttaki 🐎 butonuyla binersin. Saldırınca ya da hasar alınca inersin.'));
    } else {
      const price = bagPrice(s.bagMax);
      const r = row('🎒', 'Çanta Genişletme', `Çantana 6 yuva ekler · Şu an: ${s.bagMax} yuva (en fazla 48)`, price ? `<button class="btn">${price.toLocaleString('tr-TR')} 🪙</button>` : '<span class="ptag">En büyük çanta</span>');
      const b = r.querySelector('button');
      if (b) b.onclick = () => { if (!pay(price)) return; s.bagMax += 6; this.toast(`🎒 Çanta ${s.bagMax} yuva oldu`, '#7dff9a'); refresh(); };
    }
    $('#shopgold').textContent = s.gold.toLocaleString('tr-TR') + ' 🪙';
    this.openModal('#shop');
  }

  openSmith(sel) {
    const s = this.g.save; const list = $('#smithlist'); list.innerHTML = '';
    const worn = SLOTS.map((sl) => s.equip[sl.id]).filter(Boolean);
    const items = [...worn, ...s.bag];
    sel = sel && items.includes(sel) ? sel : items[0];
    const section = (title, arr) => {
      list.appendChild(h('div', 'smithh', title));
      const grid = h('div', 'smithgrid2', '');
      if (!arr.length) grid.appendChild(h('div', 'smithnone', 'Yok'));
      for (const it of arr) {
        const el = h('div', 'bslot' + (it === sel ? ' sel' : '') + (it.plus ? ' plus' : ''), this.itemCard(it, { compact: true }));
        el.onclick = () => this.openSmith(it); grid.appendChild(el);
      }
      list.appendChild(grid);
    };
    section('🧍 Üzerindekiler', worn);
    section(`🎒 Çantadakiler (${s.bag.length})`, s.bag);
    const panel = $('#smithpanel');
    if (!sel) { panel.innerHTML = '<p>Güçlendirilecek eşya yok.</p>'; this.openModal('#smith'); return; }
    const max = sel.plus >= 10;
    const ch = max ? 0 : PLUS_CHANCE[sel.plus + 1]; const cost = plusCost(sel);
    const next = { ...sel, plus: sel.plus + 1 };
    const a = itemStat(sel), b = itemStat(next); const k = a.atk ? 'atk' : a.def ? 'def' : a.hp ? 'hp' : 'mp';
    const label = STAT_NAMES[k];
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
        if (ok) { sel.plus++; s.stats.maxPlus = Math.max(s.stats.maxPlus || 0, sel.plus); sfx.enhanceOk(); anvil.classList.add('ok'); this.toast(`Başarılı! ${sel.name} +${sel.plus}`, '#7dff9a'); }
        else { if (sel.plus + 1 >= 4) sel.plus = Math.max(0, sel.plus - 1); sfx.enhanceFail(); anvil.classList.add('fail'); this.toast('Güçlendirme başarısız…', '#ff6a6a'); }
        this.g.player.recalc(); this.g.player.updateWeaponLook(); saveGame(s, this.g.player);
        setTimeout(() => { this.openSmith(sel); $('#smith').classList.remove('hidden'); }, 900);
      }, 1200);
    };
    this.openModal('#smith');
  }

  openAchievements() {
    const s = this.g.save; s.ach ||= [];
    $('#ach-sum').textContent = `${s.ach.length}/${ACHIEVEMENTS.length} başarım. Unvanı olanlara dokunarak isminin üstünde göster.`;
    const box = $('#achlist'); box.innerHTML = '';
    const none = h('div', 'achrow' + (!s.title ? ' on' : ''), '<div class="ai">🚫</div><div class="an"><b>Unvan gösterme</b></div>');
    none.onclick = () => { s.title = ''; saveGame(s, this.g.player); this.openAchievements(); };
    box.appendChild(none);
    for (const a of ACHIEVEMENTS) {
      const done = s.ach.includes(a.id), [v, goal] = a.p(s), pct = Math.min(100, Math.round((v / goal) * 100));
      const el = h('div', 'achrow' + (done ? ' done' : '') + (s.title === a.id ? ' on' : ''), `<div class="ai">${done ? '🏅' : '🔒'}</div>
        <div class="an"><b>${a.name}</b><small>${a.desc}${a.title ? ` · Unvan: «${a.title}»` : ''}</small>${done ? '' : `<div class="ab"><i style="width:${pct}%"></i></div><small class="av">${Math.min(v, goal).toLocaleString('tr-TR')} / ${goal.toLocaleString('tr-TR')}</small>`}</div>
        ${done && a.title ? `<span class="atag">${s.title === a.id ? '✔ Takılı' : 'Tak'}</span>` : ''}`);
      if (done && a.title) el.onclick = () => { s.title = a.id; sfx.ui(); saveGame(s, this.g.player); this.openAchievements(); };
      box.appendChild(el);
    }
    this.openModal('#achm');
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
