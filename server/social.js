// Social systems between players: chat, parties, trading and duels. The server relays and validates;
// trades are applied to the stored characters here so items can't be duplicated by a client.
import { store } from './store.js';

const PARTY_MAX = 4;
const parties = new Map(); // party id -> { id, leader (uid), members: Set<uid> }
let nextParty = 1;
const trades = new Set();
const duels = new Set();

export function createSocial({ clients, reply, online }) {
  const joined = () => [...clients.values()];
  const byName = (name) => { const k = String(name || '').toLocaleLowerCase('tr'); return joined().find((w) => w.uname.toLocaleLowerCase('tr') === k) || null; };
  const byId = (id) => clients.get(+id) || null;
  const sys = (ws, text) => reply(ws, { t: 'chat', ch: 'sys', text });
  const partyOf = (ws) => (ws.party ? parties.get(ws.party) : null);
  const partyWs = (p) => [...p.members].map((uid) => online.get(uid)).filter((w) => w && w.joined);

  // ---------- chat ----------
  function chat(ws, m) {
    const now = Date.now();
    ws.chatT = (ws.chatT || []).filter((t) => now - t < 5000);
    if (ws.chatT.length >= 5) { sys(ws, 'Çok hızlı yazıyorsun, biraz bekle.'); return; }
    ws.chatT.push(now);
    const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!text) return;
    const out = { t: 'chat', ch: m.ch, from: ws.uname, fid: ws.id, text };
    if (m.ch === 'all') for (const w of joined()) reply(w, out);
    else if (m.ch === 'map') for (const w of joined()) { if (w.map === ws.map) reply(w, out); }
    else if (m.ch === 'party') { const p = partyOf(ws); if (!p) { sys(ws, 'Bir partide değilsin.'); return; } for (const w of partyWs(p)) reply(w, out); }
    else if (m.ch === 'w') {
      const to = byName(m.to);
      if (!to) { sys(ws, `${m.to} şu an çevrimiçi değil.`); return; }
      reply(to, { ...out, to: to.uname }); if (to !== ws) reply(ws, { ...out, to: to.uname });
    }
  }

  // ---------- party ----------
  function partyState(p) {
    const list = p ? [...p.members].map((uid) => { const w = online.get(uid); return w ? { uid, id: w.id, name: w.uname, cls: w.char?.cls, lv: w.lv || w.char?.level || 1, map: w.map, hp: w.hp ?? 1, mh: w.mh ?? 1, on: !!w.joined } : null; }).filter(Boolean) : null;
    return { t: 'party', p: p ? { leader: p.leader, m: list } : null };
  }
  function sendParty(p) { const st = partyState(p); for (const w of partyWs(p)) reply(w, st); }
  function leaveParty(ws, quiet) {
    const p = partyOf(ws); if (!p) return;
    p.members.delete(ws.uid); ws.party = null;
    if (!quiet) reply(ws, { t: 'party', p: null });
    if (p.members.size < 2) { for (const w of partyWs(p)) { w.party = null; reply(w, { t: 'party', p: null }); sys(w, 'Parti dağıldı.'); } parties.delete(p.id); return; }
    if (p.leader === ws.uid) p.leader = [...p.members][0];
    for (const w of partyWs(p)) sys(w, `${ws.uname} partiden ayrıldı.`);
    sendParty(p);
  }
  function partyMsg(ws, m) {
    if (m.t === 'pinv') {
      const to = byName(m.name) || byId(m.id);
      if (!to || to === ws) { sys(ws, 'Oyuncu bulunamadı.'); return; }
      const p = partyOf(ws);
      if (p && p.leader !== ws.uid) { sys(ws, 'Sadece parti lideri davet edebilir.'); return; }
      if (p && p.members.size >= PARTY_MAX) { sys(ws, 'Parti dolu (en fazla 4 kişi).'); return; }
      if (to.party) { sys(ws, `${to.uname} zaten bir partide.`); return; }
      to.invites ||= new Map(); to.invites.set(ws.id, Date.now());
      reply(to, { t: 'pinv', fid: ws.id, from: ws.uname }); sys(ws, `${to.uname} partiye davet edildi.`);
    } else if (m.t === 'pacc') {
      const from = byId(m.fid), at = ws.invites?.get(+m.fid);
      if (!from || !at || Date.now() - at > 60000) { sys(ws, 'Davetin süresi doldu.'); return; }
      ws.invites.delete(+m.fid);
      if (ws.party) leaveParty(ws, true);
      let p = partyOf(from);
      if (!p) { p = { id: nextParty++, leader: from.uid, members: new Set([from.uid]) }; parties.set(p.id, p); from.party = p.id; }
      if (p.members.size >= PARTY_MAX) { sys(ws, 'Parti dolu.'); return; }
      p.members.add(ws.uid); ws.party = p.id;
      for (const w of partyWs(p)) sys(w, `${ws.uname} partiye katıldı.`);
      sendParty(p);
    } else if (m.t === 'pdec') { const from = byId(m.fid); ws.invites?.delete(+m.fid); if (from) sys(from, `${ws.uname} parti davetini reddetti.`); }
    else if (m.t === 'pleave') leaveParty(ws);
    else if (m.t === 'pkick') {
      const p = partyOf(ws); if (!p || p.leader !== ws.uid) return;
      const w = online.get(+m.uid); if (!w || !p.members.has(w.uid) || w === ws) return;
      sys(w, 'Partiden çıkarıldın.'); leaveParty(w);
    }
  }

  // ---------- trade ----------
  const tradeOf = (ws) => [...trades].find((t) => t.a === ws || t.b === ws) || null;
  const other = (t, ws) => (t.a === ws ? t.b : t.a);
  function tradeState(t, extra = {}) {
    for (const w of [t.a, t.b]) {
      const o = other(t, w);
      reply(w, { t: 'trade', st: { with: o.uname, wid: o.id, mine: t.off.get(w), theirs: t.off.get(o), myReady: !!t.ready.get(w), theirReady: !!t.ready.get(o), myOk: !!t.ok.get(w), theirOk: !!t.ok.get(o) }, ...extra });
    }
  }
  function endTrade(t, msg) {
    trades.delete(t);
    for (const w of [t.a, t.b]) { reply(w, { t: 'trade', st: null }); if (msg) sys(w, msg); }
  }
  async function execTrade(t) {
    const A = t.a, B = t.b, oa = t.off.get(A), ob = t.off.get(B);
    const take = (w, off) => {
      const c = w.char; if (!c) return null;
      const items = off.items.map((uid) => c.bag.find((it) => it.uid === uid));
      if (items.some((x) => !x) || off.gold > c.gold) return null;
      return items;
    };
    const ia = take(A, oa), ib = take(B, ob);
    if (!ia || !ib) { endTrade(t, 'Takas iptal: eşyalar değişmiş.'); return; }
    if (A.char.bag.length - ia.length + ib.length > (A.char.bagMax || 24) || B.char.bag.length - ib.length + ia.length > (B.char.bagMax || 24)) { endTrade(t, 'Takas iptal: çantada yer yok.'); return; }
    const apply = (w, give, get, gGive, gGet) => {
      const c = w.char; const ids = new Set(give.map((x) => x.uid));
      c.bag = c.bag.filter((x) => !ids.has(x.uid)).concat(get); c.gold = c.gold - gGive + gGet;
      w.gen = (w.gen || 0) + 1; // older saves from this client are ignored from now on
      reply(w, { t: 'tdone', give: [...ids], get, gold: gGet - gGive, gen: w.gen });
    };
    apply(A, ia, ib, oa.gold, ob.gold); apply(B, ib, ia, ob.gold, oa.gold);
    trades.delete(t);
    await Promise.all([store.putChar(A.uid, A.char), store.putChar(B.uid, B.char)]).catch((e) => console.error('trade save', e.message));
  }
  function tradeMsg(ws, m) {
    if (m.t === 'trq') {
      const to = byId(m.id);
      if (!to || to === ws || to.map !== ws.map) { sys(ws, 'Oyuncu yakında değil.'); return; }
      if (tradeOf(to) || tradeOf(ws)) { sys(ws, 'Şu an takas yapılamıyor.'); return; }
      to.tradeReq = { from: ws.id, t: Date.now() };
      reply(to, { t: 'trq', fid: ws.id, from: ws.uname }); sys(ws, `${to.uname} kullanıcısına takas isteği gönderildi.`);
      return;
    }
    if (m.t === 'tacc') {
      const from = byId(m.fid);
      if (!from || ws.tradeReq?.from !== from.id || Date.now() - ws.tradeReq.t > 60000 || tradeOf(from) || tradeOf(ws)) { sys(ws, 'Takas isteği geçersiz.'); return; }
      ws.tradeReq = null;
      const t = { a: from, b: ws, off: new Map([[from, { items: [], gold: 0 }], [ws, { items: [], gold: 0 }]]), ready: new Map(), ok: new Map() };
      trades.add(t); tradeState(t); return;
    }
    if (m.t === 'tdec') { const from = byId(m.fid); ws.tradeReq = null; if (from) sys(from, `${ws.uname} takas isteğini reddetti.`); return; }
    const t = tradeOf(ws); if (!t) return;
    if (m.t === 'tcancel') { endTrade(t, `${ws.uname} takası iptal etti.`); return; }
    if (m.t === 'toff') {
      const c = ws.char, uids = [...new Set((m.items || []).map(String))].slice(0, 12);
      const items = uids.map((u) => c.bag.find((it) => it.uid === u)).filter(Boolean);
      const gold = Math.max(0, Math.min(c.gold, Math.floor(+m.gold || 0)));
      t.off.set(ws, { items: items.map((x) => x.uid), gold, full: items });
      t.ready.clear(); t.ok.clear(); tradeState(t); return;
    }
    if (m.t === 'tready') { t.ready.set(ws, !t.ready.get(ws)); t.ok.clear(); tradeState(t); return; }
    if (m.t === 'tok') {
      if (!t.ready.get(t.a) || !t.ready.get(t.b)) return;
      t.ok.set(ws, true);
      if (t.ok.get(t.a) && t.ok.get(t.b)) execTrade(t); else tradeState(t);
    }
  }

  // ---------- duels ----------
  const duelOf = (ws) => [...duels].find((d) => d.a === ws || d.b === ws) || null;
  function endDuel(d, winner, why) {
    duels.delete(d);
    for (const w of [d.a, d.b]) reply(w, { t: 'duel', on: false, win: w === winner, with: (w === d.a ? d.b : d.a).id });
    if (winner) { const loser = winner === d.a ? d.b : d.a; for (const w of joined()) if (w.map === winner.map) reply(w, { t: 'chat', ch: 'sys', text: `⚔️ ${winner.uname} düelloda ${loser.uname} karşısında kazandı!` }); }
    else if (why) for (const w of [d.a, d.b]) sys(w, why);
  }
  function duelMsg(ws, m) {
    if (m.t === 'dreq') {
      const to = byId(m.id);
      if (!to || to === ws || to.map !== ws.map) { sys(ws, 'Oyuncu yakında değil.'); return; }
      if (duelOf(to) || duelOf(ws)) { sys(ws, 'Şu an düello yapılamıyor.'); return; }
      to.duelReq = { from: ws.id, t: Date.now() };
      reply(to, { t: 'dreq', fid: ws.id, from: ws.uname }); sys(ws, `${to.uname} düelloya davet edildi.`);
    } else if (m.t === 'dacc') {
      const from = byId(m.fid);
      if (!from || ws.duelReq?.from !== from.id || Date.now() - ws.duelReq.t > 60000 || duelOf(from) || duelOf(ws)) { sys(ws, 'Düello daveti geçersiz.'); return; }
      ws.duelReq = null;
      const d = { a: from, b: ws, t0: Date.now() }; duels.add(d);
      reply(from, { t: 'duel', on: true, with: ws.id, name: ws.uname }); reply(ws, { t: 'duel', on: true, with: from.id, name: from.uname });
    } else if (m.t === 'ddec') { const from = byId(m.fid); ws.duelReq = null; if (from) sys(from, `${ws.uname} düelloyu reddetti.`); }
    else if (m.t === 'pdmg') {
      const d = duelOf(ws); if (!d) return;
      const to = d.a === ws ? d.b : d.a; if (to.id !== +m.id) return;
      reply(to, { t: 'phit', fid: ws.id, d: Math.max(1, Math.min(1e6, Math.round(+m.d || 0))) });
    } else if (m.t === 'dlose') { const d = duelOf(ws); if (d) endDuel(d, d.a === ws ? d.b : d.a); }
    else if (m.t === 'dquit') { const d = duelOf(ws); if (d) endDuel(d, d.a === ws ? d.b : d.a); }
  }
  setInterval(() => { for (const d of duels) if (Date.now() - d.t0 > 180000) endDuel(d, null, 'Düello berabere bitti (süre doldu).'); }, 5000).unref();
  // Party frames: hp/level of members every 2 s.
  setInterval(() => { for (const p of parties.values()) sendParty(p); }, 2000).unref();

  return {
    handle(ws, m) {
      if (m.t === 'chat') chat(ws, m);
      else if (['pinv', 'pacc', 'pdec', 'pleave', 'pkick'].includes(m.t)) partyMsg(ws, m);
      else if (['trq', 'tacc', 'tdec', 'tcancel', 'toff', 'tready', 'tok'].includes(m.t)) tradeMsg(ws, m);
      else if (['dreq', 'dacc', 'ddec', 'pdmg', 'dlose', 'dquit'].includes(m.t)) duelMsg(ws, m);
      else return false;
      return true;
    },
    // Called when a player leaves the world (disconnect or map travel).
    gone(ws) {
      const t = tradeOf(ws); if (t) endTrade(t, `${ws.uname} ayrıldı, takas iptal.`);
      const d = duelOf(ws); if (d) endDuel(d, d.a === ws ? d.b : d.a);
    },
    // Disconnected: the party slot is kept for a minute (map travel reloads the game).
    left(ws) {
      this.gone(ws);
      const p = partyOf(ws); if (!p) return;
      const uid = ws.uid;
      setTimeout(() => {
        if (online.get(uid)?.party === p.id || !p.members.has(uid)) return;
        p.members.delete(uid);
        if (p.members.size < 2) { for (const w of partyWs(p)) { w.party = null; reply(w, { t: 'party', p: null }); sys(w, 'Parti dağıldı.'); } parties.delete(p.id); return; }
        if (p.leader === uid) p.leader = [...p.members][0];
        for (const w of partyWs(p)) sys(w, `${ws.uname} oyundan ayrıldı.`);
        sendParty(p);
      }, 60000);
    },
    joinedMap(ws) { const p = partyOf(ws); if (p) sendParty(p); },
    restoreParty(ws) { for (const p of parties.values()) if (p.members.has(ws.uid)) { ws.party = p.id; sendParty(p); } },
  };
}
