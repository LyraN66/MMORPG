import * as THREE from 'three';
import { xpToNext, RARITY, itemStat, PLUS_CHANCE, plusCost, sellPrice, SHOP, MAX_LEVEL } from './data.js';
import { sfx, soundOn, setSound } from './audio.js';
import { saveGame } from './save.js';
import { BOUNDS, roadX, CAMP_POS, CRYPT_POS } from './world.js';
import { dist2d } from './units.js';

const $ = (s) => document.querySelector(s);
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
    $('#btn-menu').onclick = () => this.openMenu();
    $('#revive').onclick = () => game.revive();
    $('#target').onclick = () => { if (game.player.target) { game.player.autoAttack = true; } };
    $('#npc-btn').onclick = () => { if (this.nearNpc) this.openNpc(this.nearNpc); };
    document.querySelectorAll('.modal .close').forEach((b) => (b.onclick = () => this.closeModal()));
    this.refreshInventory();
  }

  // ---------- plates ----------
  addPlate(e) {
    const el = h('div', 'plate' + (e.isBoss ? ' boss' : ''), `<div class="nm"><span class="lv">Sv.${e.level}</span> ${e.name}</div><div class="hpb"><i></i></div>`);
    this.overlay.appendChild(el); this.plates.set(e, { el, bar: el.querySelector('i') });
  }
  removePlate(e) { const p = this.plates.get(e); if (p) { p.el.remove(); this.plates.delete(e); } }
  addNpcPlate(n) {
    const el = h('div', 'plate npc', `<div class="nm">${n.role === 'smith' ? '⚒️' : '💰'} ${n.name}</div><div class="role">${n.role === 'smith' ? 'Güçlendirme' : 'Market'}</div>`);
    this.overlay.appendChild(el); this.npcPlates.push({ n, el });
  }
  addLootPlate(l) {
    if (l.kind !== 'item') return;
    const it = l.data; const el = h('div', 'plate loot', `<div class="nm" style="color:${RARITY[it.rarity].color}">${it.name}</div>`);
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
      const show = e.alive && e.state !== 'spawn' && d < (e.isBoss ? 40 : 22);
      const sc = show && this.project(e.pos, 2.75 * e.scale + 0.2);
      if (!sc) { pl.el.style.display = 'none'; continue; }
      pl.el.style.display = '';
      pl.el.style.transform = `translate(${sc[0]}px, ${sc[1]}px) translate(-50%, -100%)`;
      const hurt = e.hp < e.maxHp;
      pl.el.classList.toggle('hurt', hurt || p.target === e);
      pl.el.classList.toggle('sel', p.target === e);
      pl.bar.style.width = (e.hp / e.maxHp) * 100 + '%';
      const diff = e.level - p.level;
      pl.el.dataset.diff = diff >= 3 ? 'red' : diff <= -4 ? 'grey' : diff >= 1 ? 'orange' : 'white';
    }
    let near = null;
    for (const { n, el } of this.npcPlates) {
      const sc = dist2d(n.pos, p.pos) < 25 && this.project(n.pos, 2.9);
      if (!sc) { el.style.display = 'none'; continue; }
      el.style.display = ''; el.style.transform = `translate(${sc[0]}px, ${sc[1]}px) translate(-50%, -100%)`;
      if (dist2d(n.pos, p.pos) < 4.5) near = n;
    }
    if (near !== this.nearNpc) {
      this.nearNpc = near;
      const b = $('#npc-btn'); b.classList.toggle('hidden', !near);
      if (near) b.innerHTML = near.role === 'smith' ? '⚒️ Demirci' : '💰 Market';
    }
    for (const [l, el] of this.lootPlates) {
      const sc = this.project(l.mesh.position, 0.9);
      if (!sc || l.flying) { el.style.display = 'none'; continue; }
      el.style.display = ''; el.style.transform = `translate(${sc[0]}px, ${sc[1]}px) translate(-50%, -100%)`;
    }

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
    const box = $('#announce'); const el = h('div', 'ann ' + kind, text);
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
    for (let i = 0; i < 24; i++) {
      const it = s.bag[i];
      const el = h('div', 'bslot', it ? this.itemCard(it, { compact: true }) : '');
      if (it) el.onclick = () => this.itemDetail(it, false);
      bag.appendChild(el);
    }
    $('#bagcount').textContent = `${s.bag.length}/24`;
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
    if (n.role === 'smith') this.openSmith(); else this.openShop();
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
    $('#qual').textContent = '🎨 Grafik: ' + { auto: 'Otomatik', high: 'Yüksek', medium: 'Orta', low: 'Düşük' }[q];
    $('#qual').onclick = () => {
      const order = ['auto', 'high', 'medium', 'low']; const n = order[(order.indexOf(q) + 1) % 4];
      try { localStorage.setItem('kv-quality', n); } catch { /* ignore */ }
      this.openMenu(); $('#qnote').classList.remove('hidden');
    };
    $('#tomenu').onclick = () => { saveGame(this.g.save, this.g.player); location.reload(); };
    this.openModal('#menu');
  }
}
