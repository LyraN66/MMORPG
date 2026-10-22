// Kemik Vadisi world server.
// One persistent shared world: the server simulates enemies, bosses and loot (sim.js); players
// connect, say hello with their character, and play. Characters are saved on each player's device.
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Sim } from './sim.js';
import { PROTOCOL } from './shared/version.js';

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
    res.end(JSON.stringify({ protocol: PROTOCOL, players: clients.size, names: [...sim.players.values()].map((p) => p.name), enemies: sim.enemies.size, version: VERSION }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Kemik Vadisi sunucusu çalışıyor. Sürüm ' + VERSION + ' · Protokol ' + PROTOCOL + ' · Çevrimiçi: ' + clients.size);
});

const raw = (ws, s) => { if (ws.readyState === 1) ws.send(s); };
const sendTo = (id, msg) => { const ws = clients.get(id); if (ws) raw(ws, JSON.stringify({ ...msg, f: SERVER_ID })); };
const broadcast = (msg, except) => {
  const s = JSON.stringify({ ...msg, f: msg.f ?? SERVER_ID });
  for (const [id, ws] of clients) if (id !== except) raw(ws, s);
};
const sim = new Sim({ send: sendTo, broadcast: (m) => broadcast(m) });

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

function leave(ws) {
  if (!ws.joined) return;
  ws.joined = false;
  clients.delete(ws.id);
  sim.removePlayer(ws.id);
  broadcast({ t: 'peerLeft', id: ws.id });
}

wss.on('connection', (ws) => {
  ws.id = nextId++;
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') { raw(ws, JSON.stringify({ t: 'pong', ts: m.ts })); return; }
    if (m.t === 'hello') {
      if (ws.joined) return;
      if (m.proto !== PROTOCOL) { raw(ws, JSON.stringify({ t: 'error', msg: 'Oyunun yeni sürümü var. Uygulamayı kapatıp yeniden aç ya da en son APK\'yı kur — güncellemeden sonra girebilirsin.' })); return; }
      if (clients.size >= MAX_PLAYERS) { raw(ws, JSON.stringify({ t: 'error', msg: 'Dünya dolu, biraz sonra tekrar dene' })); return; }
      const info = { name: String(m.info?.name || 'Oyuncu').slice(0, 14), cls: m.info?.cls === 'mage' ? 'mage' : 'knight', lv: +m.info?.lv || 1 };
      ws.info = info; ws.joined = true;
      const peers = [...clients.entries()].map(([id, c]) => ({ id, info: c.info }));
      clients.set(ws.id, ws);
      sim.addPlayer(ws.id, info);
      raw(ws, JSON.stringify({ t: 'joined', id: ws.id, host: SERVER_ID, code: 'world', peers, f: SERVER_ID }));
      broadcast({ t: 'peerJoined', id: ws.id, info }, ws.id);
      sim.welcome(ws.id);
      return;
    }
    if (!ws.joined) return;
    m.f = ws.id;
    switch (m.t) {
      case 'ps': sim.onState(ws.id, m); broadcast(m, ws.id); break; // own state → everyone
      case 'act': broadcast(m, ws.id); break; // attack/skill visuals → everyone
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
  try { sim.tick(dt); } catch (e) { console.error('sim error', e); }
}, 50);

server.listen(PORT, () => console.log(`Kemik Vadisi dünya sunucusu :${PORT} (sürüm ${VERSION})`));
