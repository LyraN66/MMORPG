// Kemik Vadisi world server.
// One persistent shared world: the server simulates enemies, bosses and loot (sim.js); players
// connect, say hello with their character, and play. Characters are saved on each player's device.
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Sim } from './sim.js';
import { PROTOCOL } from './shared/version.js';
import { mapById } from './shared/maps.js';
import { store, persistent, hashPass, checkPass, newToken } from './store.js';
import { createSocial } from './social.js';
import { MAX_LEVEL, CLASSES } from './shared/data.js';

const PORT = process.env.PORT || 8080;
const VERSION = (process.env.RENDER_GIT_COMMIT || 'dev').slice(0, 7);
const MAX_PLAYERS = 40;
const SERVER_ID = 0;
const clients = new Map(); // id -> ws (only players who said hello)
let nextId = 1;

const server = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (req.url === '/health') { res.writeHead(200, cors); res.end('{"ok":true}'); return; }
  if (req.url === '/version' || req.url.startsWith('/v/')) { res.writeHead(200, cors); res.end(JSON.stringify({ version: VERSION })); return; }
  if (req.url === '/stats') {
    res.writeHead(200, cors);
    const maps = {}; for (const [id, sm] of sims) maps[id] = { players: [...sm.players.values()].map((p) => p.name), enemies: sm.enemies.size };
    res.end(JSON.stringify({ protocol: PROTOCOL, players: clients.size, maps, version: VERSION }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Kemik Vadisi sunucusu çalışıyor. Sürüm ' + VERSION + ' · Protokol ' + PROTOCOL + ' · Çevrimiçi: ' + clients.size + ' · Kayıt: ' + (persistent ? 'veritabanı' : 'geçici dosya'));
});

const raw = (ws, s) => { if (ws.readyState === 1) ws.send(s); };
const reply = (ws, msg) => raw(ws, JSON.stringify({ ...msg, f: SERVER_ID }));

// ---------- accounts ----------
const NAME_RE = /^[A-Za-z0-9ğüşöçıİĞÜŞÖÇ_]{3,14}$/;
const keyOf = (name) => name.toLocaleLowerCase('tr');
const online = new Map(); // uid -> ws (one session per account)
const tries = new Map(); // ip -> { n, t } login attempts
function limited(ip) {
  const now = Date.now(), r = tries.get(ip) || { n: 0, t: now };
  if (now - r.t > 60000) { r.n = 0; r.t = now; }
  r.n++; tries.set(ip, r);
  return r.n > 12;
}
// Keep a client's save sane: account name, fixed class, bounded numbers.
function cleanSave(ws, s) {
  if (!s || typeof s !== 'object' || !CLASSES[s.cls]) return null;
  if (ws.char && ws.char.cls !== s.cls) return null;
  s.name = ws.uname;
  s.level = Math.max(1, Math.min(MAX_LEVEL, s.level | 0));
  s.gold = Math.max(0, Math.min(1e10, Math.floor(+s.gold || 0)));
  s.xp = Math.max(0, +s.xp || 0);
  return s;
}
async function authOk(ws, u, remember) {
  const prev = online.get(u.id);
  if (prev && prev !== ws) { reply(prev, { t: 'kicked', msg: 'Hesabına başka bir cihazdan giriş yapıldı.' }); try { prev.close(); } catch { /* ignore */ } }
  online.set(u.id, ws);
  ws.uid = u.id; ws.uname = u.name;
  const token = newToken();
  await store.addSession(u.id, token, remember ? 60 : 2);
  ws.char = await store.getChar(u.id);
  reply(ws, { t: 'authed', user: u.name, token, char: ws.char, persistent });
}
async function onAuth(ws, m) {
  if (m.proto !== PROTOCOL) { reply(ws, { t: 'error', msg: m.proto < PROTOCOL ? 'Oyunun yeni sürümü var. "Şimdi Güncelle" ile güncelle, sonra tekrar gir.' : 'Sunucu güncelleniyor, birkaç dakika sonra tekrar dene.' }); return; }
  if (m.mode === 'token') {
    const uid = await store.sessionUser(String(m.token || ''));
    const u = uid != null && await store.userById(uid);
    if (!u) { reply(ws, { t: 'error', msg: 'Oturumun sona erdi, tekrar giriş yap.', relogin: true }); return; }
    await authOk(ws, u, !!m.remember); return;
  }
  if (limited(ws.ip)) { reply(ws, { t: 'error', msg: 'Çok fazla deneme yaptın, bir dakika bekle.' }); return; }
  const name = String(m.user || '').trim(), pass = String(m.pass || '');
  if (!NAME_RE.test(name)) { reply(ws, { t: 'error', msg: 'Kullanıcı adı 3–14 karakter olmalı (harf, rakam, _).' }); return; }
  if (pass.length < 4 || pass.length > 64) { reply(ws, { t: 'error', msg: 'Şifre en az 4 karakter olmalı.' }); return; }
  if (m.mode === 'register') {
    const u = await store.createUser(keyOf(name), name, hashPass(pass));
    if (!u) { reply(ws, { t: 'error', msg: 'Bu kullanıcı adı alınmış.' }); return; }
    await authOk(ws, u, !!m.remember); return;
  }
  const u = await store.userByName(keyOf(name));
  if (!u || !checkPass(pass, u.hash)) { reply(ws, { t: 'error', msg: 'Kullanıcı adı ya da şifre hatalı.' }); return; }
  await authOk(ws, u, !!m.remember);
}
const saveT = new Map();
async function onSave(ws, s, now) {
  const c = cleanSave(ws, s); if (!c) return;
  ws.char = c;
  if (!now && Date.now() - (saveT.get(ws.uid) || 0) < 8000) { ws.pending = true; return; }
  saveT.set(ws.uid, Date.now()); ws.pending = false;
  try { await store.putChar(ws.uid, c); } catch (e) { console.error('save failed', e.message); }
}
const sendTo = (id, msg) => { const ws = clients.get(id); if (ws) raw(ws, JSON.stringify({ ...msg, f: SERVER_ID })); };
// Messages only go to players on the same map.
const broadcast = (map, msg, except) => {
  const s = JSON.stringify({ ...msg, f: msg.f ?? SERVER_ID });
  for (const [id, ws] of clients) if (id !== except && ws.map === map) raw(ws, s);
};
// One simulation per map, created when the first player arrives.
const sims = new Map();
const simFor = (id) => {
  if (!sims.has(id)) sims.set(id, new Sim({ map: mapById(id), send: sendTo, broadcast: (m) => broadcast(id, m) }));
  return sims.get(id);
};

const social = createSocial({ clients, reply, online });
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

function leave(ws) {
  if (ws.uid != null && ws.joined) social.left(ws);
  if (ws.uid != null) {
    if (ws.pending && ws.char) store.putChar(ws.uid, ws.char).catch(() => {});
    if (online.get(ws.uid) === ws) online.delete(ws.uid);
  }
  if (!ws.joined) return;
  ws.joined = false;
  clients.delete(ws.id);
  simFor(ws.map).removePlayer(ws.id);
  broadcast(ws.map, { t: 'peerLeft', id: ws.id });
}

wss.on('connection', (ws, req) => {
  ws.id = nextId++;
  ws.ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') { raw(ws, JSON.stringify({ t: 'pong', ts: m.ts })); return; }
    if (m.t === 'auth') { if (ws.uid == null) onAuth(ws, m).catch((e) => { console.error('auth', e); reply(ws, { t: 'error', msg: 'Sunucu hatası, tekrar dene.' }); }); return; }
    if (m.t === 'logout') { if (m.token) store.dropSession(String(m.token)).catch(() => {}); return; }
    if (m.t === 'create') { // first character of an account (or one brought over from this phone)
      if (ws.uid == null || ws.char) return;
      const c = cleanSave(ws, m.char); if (!c) { reply(ws, { t: 'error', msg: 'Karakter oluşturulamadı.' }); return; }
      ws.char = c; store.putChar(ws.uid, c).then(() => reply(ws, { t: 'created', char: c })).catch(() => reply(ws, { t: 'error', msg: 'Karakter kaydedilemedi.' }));
      return;
    }
    if (m.t === 'save') { if (ws.uid != null && ws.char && (m.g | 0) === (ws.gen | 0)) onSave(ws, m.s, !!m.now); return; }
    if (m.t === 'hello') {
      if (ws.joined) return;
      if (m.proto !== PROTOCOL) { reply(ws, { t: 'error', msg: 'Oyunun yeni sürümü var. "Şimdi Güncelle" ile güncelle, sonra tekrar gir.' }); return; }
      if (ws.uid == null || !ws.char) { reply(ws, { t: 'error', msg: 'Önce giriş yap.' }); return; }
      if (clients.size >= MAX_PLAYERS) { raw(ws, JSON.stringify({ t: 'error', msg: 'Dünya dolu, biraz sonra tekrar dene' })); return; }
      const info = { name: ws.uname, cls: ws.char.cls, lv: ws.char.level || 1 };
      ws.map = mapById(m.map || ws.char.map).id;
      ws.info = info; ws.joined = true;
      const peers = [...clients.entries()].filter(([, c]) => c.map === ws.map).map(([id, c]) => ({ id, info: c.info }));
      clients.set(ws.id, ws);
      const sim = simFor(ws.map);
      sim.addPlayer(ws.id, info);
      raw(ws, JSON.stringify({ t: 'joined', id: ws.id, host: SERVER_ID, code: ws.map, peers, f: SERVER_ID }));
      broadcast(ws.map, { t: 'peerJoined', id: ws.id, info }, ws.id);
      sim.welcome(ws.id);
      social.restoreParty(ws);
      return;
    }
    if (!ws.joined) return;
    if (social.handle(ws, m)) return;
    m.f = ws.id;
    const sim = simFor(ws.map);
    switch (m.t) {
      case 'ps': ws.hp = m.hp; ws.mh = m.mh; ws.lv = m.lv; sim.onState(ws.id, m); broadcast(ws.map, m, ws.id); break; // own state → same map
      case 'act': broadcast(ws.map, m, ws.id); break; // attack/skill visuals → same map
      case 'dmg': sim.onDamage(ws.id, m); break;
      case 'pick': sim.onPick(ws.id, m.lid); break;
      default: break;
    }
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; ws.ping();
  }
}, 15000);

// World simulation at 20 Hz.
let last = Date.now();
setInterval(() => {
  const now = Date.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now;
  for (const sim of sims.values()) { try { sim.tick(dt); } catch (e) { console.error('sim error', e); } }
}, 50);

store.init().then(() => server.listen(PORT, () => console.log(`Kemik Vadisi dünya sunucusu :${PORT} (sürüm ${VERSION}, kayıt: ${persistent ? 'PostgreSQL' : 'dosya'})`)))
  .catch((e) => { console.error('Veritabanına bağlanılamadı:', e.message); process.exit(1); });
