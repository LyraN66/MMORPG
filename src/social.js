// Client side of chat, parties, trading and duels (server: server/social.js).
import * as THREE from 'three';
import { sfx } from './audio.js';
import { saveGame } from './save.js';
import { account } from './account.js';
import { dist2d } from './units.js';
import { CLASSES } from './data.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CH = { all: ['Genel', '#ffffff'], map: ['Harita', '#9fe0ff'], party: ['Parti', '#7dff9a'], w: ['Fısıltı', '#ff9af0'], sys: ['Sistem', '#ffd36b'] };

export class Social {
  constructor(game) {
    this.g = game; this.log = []; this.party = null; this.duel = null; this.trade = null; this.channel = 'map'; this.whisperTo = '';
    this.buildDom();
  }
  get net() { return this.g.coop?.net; }
  send(m) { this.g.coop?.send(m); }
  sysMsg(text) { this.addLine({ ch: 'sys', text }); }

  buildDom() {
    if (!$('#chatlog')) {
      const hud = $('#hud');
      hud.insertAdjacentHTML('beforeend', `
        <div id="chatlog"></div>
        <div id="party" class="hidden"></div>
        <div id="chatbar" class="hidden"><select id="chat-ch"><option value="map">Harita</option><option value="all">Genel</option><option value="party">Parti</option><option value="w">Fısıltı</option></select>
          <input id="chat-to" class="hidden" maxlength="14" placeholder="Kime" autocomplete="off" spellcheck="false" />
          <input id="chat-in" maxlength="140" placeholder="Mesaj yaz…" autocomplete="off" />
          <button class="btn" id="chat-send">Gönder</button><button class="btn ghost" id="chat-x">✕</button></div>
        <div id="pmenu" class="hidden"></div>
        <div id="invite" class="hidden"></div>
        <div id="duelbar" class="hidden"></div>`);
      $('.mmbtns').insertAdjacentHTML('afterbegin', '<button id="btn-chat" class="rbtn">💬</button>');
      document.body.insertAdjacentHTML('beforeend', `
        <div id="trade" class="modal hidden"><div class="panel">
          <div class="ph"><h3>🤝 Takas</h3><button class="close" id="tr-x">✕</button></div>
          <div class="trgrid"><div><h4>Senin teklifin</h4><div id="tr-mine" class="troff"></div><label class="trgold">🪙 <input id="tr-gold" type="number" min="0" step="1" value="0" /></label></div>
          <div><h4 id="tr-theirh">Karşı taraf</h4><div id="tr-theirs" class="troff"></div><div id="tr-tgold" class="trgold"></div></div></div>
          <p class="trhint">Çantandan eklemek istediğin eşyalara dokun:</p><div id="tr-bag"></div>
          <div class="row trbtns"><button class="btn" id="tr-ready">Hazırım</button><button class="btn" id="tr-ok" disabled>✔ Takası Onayla</button><button class="btn ghost" id="tr-cancel">İptal</button></div>
          <p id="tr-status" class="trstatus"></p>
        </div></div>`);
    }
    $('#btn-chat').onclick = () => this.openChat();
    $('#chat-x').onclick = () => this.closeChat();
    $('#chat-send').onclick = () => this.submit();
    $('#chat-in').onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') this.submit(); if (e.key === 'Escape') this.closeChat(); };
    $('#chat-to').onkeydown = (e) => e.stopPropagation();
    $('#chat-ch').onchange = () => { this.channel = $('#chat-ch').value; $('#chat-to').classList.toggle('hidden', this.channel !== 'w'); };
    $('#tr-x').onclick = $('#tr-cancel').onclick = () => this.send({ t: 'tcancel' });
    $('#tr-ready').onclick = () => this.send({ t: 'tready' });
    $('#tr-ok').onclick = () => this.send({ t: 'tok' });
    $('#tr-gold').onchange = () => this.sendOffer();
  }

  // ---------- chat ----------
  openChat(ch, to) {
    if (ch) { this.channel = ch; $('#chat-ch').value = ch; }
    if (to) $('#chat-to').value = to;
    $('#chat-to').classList.toggle('hidden', this.channel !== 'w');
    $('#chatbar').classList.remove('hidden'); $('#chatlog').classList.add('open');
    this.g.input.enabled = false; this.chatOpen = true;
    setTimeout(() => $(this.channel === 'w' && !$('#chat-to').value ? '#chat-to' : '#chat-in').focus(), 30);
    this.renderLog();
  }
  closeChat() {
    $('#chatbar').classList.add('hidden'); $('#chatlog').classList.remove('open'); $('#chat-in').blur();
    this.g.input.enabled = true; this.chatOpen = false; this.renderLog();
  }
  submit() {
    let text = $('#chat-in').value.trim(); if (!text) { this.closeChat(); return; }
    let ch = this.channel, to = $('#chat-to').value.trim();
    const m = /^\/(w|f|p|g|h)\s+(.*)$/i.exec(text);
    if (m) {
      const c = m[1].toLowerCase();
      if (c === 'w' || c === 'f') { const sp = m[2].indexOf(' '); to = sp > 0 ? m[2].slice(0, sp) : m[2]; text = sp > 0 ? m[2].slice(sp + 1) : ''; ch = 'w'; }
      else { ch = { p: 'party', g: 'all', h: 'map' }[c]; text = m[2]; }
    }
    if (!text) return;
    if (ch === 'w' && !to) { this.sysMsg('Kime fısıldayacağını yaz.'); return; }
    this.send({ t: 'chat', ch, to, text });
    $('#chat-in').value = '';
  }
  addLine(l) {
    l.at = performance.now(); this.log.push(l); if (this.log.length > 60) this.log.shift();
    if (l.ch === 'w' && l.from !== account.user) { this.whisperTo = l.from; sfx.ui(); }
    if (l.fid != null && l.ch !== 'w') { const r = this.g.coop?.remotes.get(l.fid); if (r) r.say = { text: l.text, t: this.g.time }; }
    this.renderLog();
  }
  renderLog() {
    const now = performance.now(), open = this.chatOpen;
    const lines = this.log.filter((l) => open || now - l.at < 15000).slice(open ? -12 : -5);
    $('#chatlog').innerHTML = lines.map((l) => {
      const [nm, col] = CH[l.ch] || CH.map;
      const who = l.ch === 'sys' ? '' : l.ch === 'w' ? (l.from === account.user ? `→ ${esc(l.to)}: ` : `${esc(l.from)} → sen: `) : `${esc(l.from)}: `;
      return `<div style="color:${col}"><span class="cch">[${nm}]</span> ${who}${esc(l.text)}</div>`;
    }).join('');
    clearTimeout(this.fadeT); if (!open && lines.length) this.fadeT = setTimeout(() => this.renderLog(), 4000);
  }

  // ---------- player menu (tap on another player) ----------
  openMenu(r) {
    const inParty = this.party?.m.some((x) => x.id === r.netId), lead = this.party && this.party.leader === this.myUid();
    const el = $('#pmenu'); el.classList.remove('hidden');
    el.innerHTML = `<div class="pmh"><b>${esc(r.name)}</b><small>Sv.${r.level} · ${r.cls.name}${r.title ? ' · ' + esc(r.title) : ''}</small><button class="pmx">✕</button></div>
      <div class="pmb">${inParty ? '' : '<button data-a="party">👥 Partiye Davet</button>'}${inParty && lead ? '<button data-a="kick">🚪 Partiden At</button>' : ''}
      <button data-a="trade">🤝 Takas</button><button data-a="duel">⚔️ Düello</button><button data-a="w">💬 Fısılda</button></div>`;
    el.querySelector('.pmx').onclick = () => el.classList.add('hidden');
    el.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
      el.classList.add('hidden'); sfx.ui();
      const a = b.dataset.a;
      if (a === 'party') this.send({ t: 'pinv', id: r.netId });
      else if (a === 'kick') { const mm = this.party.m.find((x) => x.id === r.netId); if (mm) this.send({ t: 'pkick', uid: mm.uid }); }
      else if (a === 'trade') this.send({ t: 'trq', id: r.netId });
      else if (a === 'duel') { if (this.duel) this.sysMsg('Zaten düellodasın.'); else this.send({ t: 'dreq', id: r.netId }); }
      else if (a === 'w') this.openChat('w', r.name);
    }));
    clearTimeout(this.menuT); this.menuT = setTimeout(() => el.classList.add('hidden'), 8000);
  }
  myUid() { return this.party?.m.find((x) => x.id === this.g.coop?.id)?.uid; }

  ask(text, yes, no) {
    const el = $('#invite'); el.classList.remove('hidden'); sfx.ui();
    el.innerHTML = `<span>${text}</span><button class="btn" id="iv-y">Kabul</button><button class="btn ghost" id="iv-n">Reddet</button>`;
    const close = () => { el.classList.add('hidden'); clearTimeout(this.askT); };
    $('#iv-y').onclick = () => { close(); yes(); };
    $('#iv-n').onclick = () => { close(); no(); };
    clearTimeout(this.askT); this.askT = setTimeout(() => { close(); no(); }, 30000);
  }

  // ---------- party ----------
  inPartyNet(id) { return !!this.party?.m.some((x) => x.id === id && x.on); }
  renderParty() {
    const el = $('#party'), p = this.party;
    if (!p) { el.classList.add('hidden'); $('#qtrack').style.top = ''; return; }
    el.classList.remove('hidden');
    const me = this.g.coop?.id;
    el.innerHTML = `<div class="pth">👥 Parti <button id="pt-leave">Ayrıl</button></div>` + p.m.filter((x) => x.id !== me).map((x) => {
      const far = x.map !== this.g.save.map || !x.on;
      const w = Math.max(0, Math.min(100, Math.round((x.hp / Math.max(1, x.mh)) * 100)));
      return `<div class="pm${far ? ' far' : ''}" data-id="${x.id}"><div class="pn">${x.uid === p.leader ? '👑 ' : ''}${esc(x.name)} <small>Sv.${x.lv}</small></div><div class="pb"><i style="width:${far ? 0 : w}%"></i></div>${far ? `<small class="pfar">${x.on ? 'başka haritada' : 'çevrimdışı'}</small>` : ''}</div>`;
    }).join('');
    $('#pt-leave').onclick = () => this.send({ t: 'pleave' });
    el.querySelectorAll('.pm').forEach((d) => (d.onclick = () => { const r = this.g.coop?.remotes.get(+d.dataset.id); if (r) this.openMenu(r); }));
    $('#qtrack').style.top = `calc(${100 + el.offsetHeight}px + var(--st))`;
  }
  // XP bonus for party members fighting together.
  partyBonus(at) {
    if (!this.party) return 1;
    let n = 0;
    for (const x of this.party.m) { const r = this.g.coop?.remotes.get(x.id); if (r && !r.dead && dist2d(r.pos, at) < 32) n++; }
    return 1 + 0.15 * n;
  }

  // ---------- trade ----------
  sendOffer() {
    const sel = [...(this.tradeSel || [])];
    saveGame(this.g.save, this.g.player, true); // server checks the offer against the latest save
    this.send({ t: 'toff', items: sel, gold: Math.max(0, Math.min(this.g.save.gold, Math.floor(+$('#tr-gold').value || 0))) });
  }
  renderTrade() {
    const st = this.trade, ui = this.g.ui, s = this.g.save;
    if (!st) { $('#trade').classList.add('hidden'); if (this.g.input) this.g.input.enabled = true; return; }
    if ($('#trade').classList.contains('hidden')) { ui.closeModal(); $('#trade').classList.remove('hidden'); this.g.input.enabled = false; this.tradeSel = new Set(); $('#tr-gold').value = 0; }
    this.tradeSel = new Set(st.mine.items);
    const card = (it) => `<div class="bslot">${ui.itemCard(it, { compact: true })}</div>`;
    const mine = s.bag.filter((it) => this.tradeSel.has(it.uid));
    $('#tr-mine').innerHTML = mine.map(card).join('') || '<small class="dim">Boş</small>';
    $('#tr-theirh').textContent = st.with;
    $('#tr-theirs').innerHTML = (st.theirs.full || []).map((it) => `<div class="tritem">${ui.itemCard(it)}</div>`).join('') || '<small class="dim">Boş</small>';
    $('#tr-tgold').textContent = st.theirs.gold ? `🪙 ${st.theirs.gold.toLocaleString('tr-TR')}` : '';
    if (document.activeElement !== $('#tr-gold')) $('#tr-gold').value = st.mine.gold;
    const bag = $('#tr-bag'); bag.innerHTML = '';
    for (const it of s.bag) {
      const d = document.createElement('div'); d.className = 'bslot' + (this.tradeSel.has(it.uid) ? ' sel' : ''); d.innerHTML = ui.itemCard(it, { compact: true });
      d.onclick = () => { if (this.tradeSel.has(it.uid)) this.tradeSel.delete(it.uid); else this.tradeSel.add(it.uid); this.sendOffer(); };
      bag.appendChild(d);
    }
    $('#tr-ready').textContent = st.myReady ? '↩ Değiştir' : 'Hazırım';
    $('#tr-ok').disabled = !(st.myReady && st.theirReady) || st.myOk;
    $('#tr-status').textContent = st.myOk ? 'Karşı tarafın onayı bekleniyor…' : st.myReady && st.theirReady ? 'İkiniz de hazırsınız — onayla!' : st.theirReady ? `${st.with} hazır.` : st.myReady ? `${st.with} bekleniyor…` : 'Teklifinizi hazırlayın.';
  }
  tradeDone(m) {
    const s = this.g.save, give = new Set(m.give);
    s.bag = s.bag.filter((it) => !give.has(it.uid)).concat(m.get); s.gold += m.gold;
    account.gen = m.gen;
    this.trade = null; this.renderTrade();
    sfx.enhanceOk(); this.g.ui.announce('🤝 Takas tamamlandı', 'victory');
    s.stats.trades = (s.stats.trades || 0) + 1;
    this.g.ui.refreshInventory(); saveGame(s, this.g.player, true);
  }

  // ---------- duel ----------
  isFoe(r) { return !!this.duel && r?.netId === this.duel.with; }
  startDuel(m) {
    this.duel = { with: m.with, name: m.name };
    const el = $('#duelbar'); el.classList.remove('hidden');
    el.innerHTML = `⚔️ Düello: <b>${esc(m.name)}</b> <button id="du-q">Pes Et</button>`;
    $('#du-q').onclick = () => this.send({ t: 'dquit' });
    this.g.ui.announce(`⚔️ Düello başladı: ${m.name}`, 'unique'); sfx.roar?.();
    const r = this.g.coop?.remotes.get(m.with); if (r) { this.g.player.target = r; }
  }
  endDuel(m) {
    const name = this.duel?.name;
    this.duel = null; $('#duelbar').classList.add('hidden');
    const p = this.g.player; if (p.target?.remote) { p.target = null; p.autoAttack = false; }
    if (m.win) { this.g.ui.announce(`🏆 Düelloyu kazandın!`, 'victory'); this.g.save.stats.duelWins = (this.g.save.stats.duelWins || 0) + 1; sfx.levelUp(); }
    else if (name) this.g.ui.announce(`Düelloyu kaybettin…`, '');
    p.hp = Math.max(p.hp, p.maxHp * 0.3);
  }
  // Damage from the other duelist: never kills, the duel just ends.
  onPvpHit(m) {
    const p = this.g.player, r = this.g.coop?.remotes.get(m.fid);
    if (!this.isFoe(r) || p.dead) return;
    if (p.hp - m.d <= 1) { p.hp = 1; this.send({ t: 'dlose' }); this.g.fx.number(p.pos, '-' + m.d, 'hurt'); return; }
    p.takeHit(m.d, r);
  }
  update() {
    if (this.duel) { const r = this.g.coop?.remotes.get(this.duel.with); if (!r || r.gone || dist2d(r.pos, this.g.player.pos) > 45) this.send({ t: 'dquit' }); }
  }

  onMessage(m) {
    switch (m.t) {
      case 'chat': this.addLine(m); return true;
      case 'party': this.party = m.p; this.renderParty(); return true;
      case 'pinv': this.ask(`👥 <b>${esc(m.from)}</b> seni partiye davet ediyor`, () => this.send({ t: 'pacc', fid: m.fid }), () => this.send({ t: 'pdec', fid: m.fid })); return true;
      case 'trq': this.ask(`🤝 <b>${esc(m.from)}</b> seninle takas yapmak istiyor`, () => this.send({ t: 'tacc', fid: m.fid }), () => this.send({ t: 'tdec', fid: m.fid })); return true;
      case 'dreq': this.ask(`⚔️ <b>${esc(m.from)}</b> seni düelloya çağırıyor`, () => this.send({ t: 'dacc', fid: m.fid }), () => this.send({ t: 'ddec', fid: m.fid })); return true;
      case 'trade': this.trade = m.st; this.renderTrade(); return true;
      case 'tdone': this.tradeDone(m); return true;
      case 'duel': if (m.on) this.startDuel(m); else this.endDuel(m); return true;
      case 'phit': this.onPvpHit(m); return true;
      default: return false;
    }
  }
}
export { CLASSES, THREE };
