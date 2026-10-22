// Kemik Vadisi co-op relay server.
// Rooms are identified by a 4-digit code. The player who creates a room is the host: their game
// simulates the world (enemies, bosses, loot); the server only relays messages between room members.
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const VERSION = (process.env.RENDER_GIT_COMMIT || 'dev').slice(0, 7);
const MAX_PLAYERS = 4;
const rooms = new Map(); // code -> { code, host, members: Map<id, ws>, created }
let nextId = 1;

const server = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (req.url === '/health') { res.writeHead(200, cors); res.end('{"ok":true}'); return; }
  if (req.url === '/version' || req.url.startsWith('/v/')) { res.writeHead(200, cors); res.end(JSON.stringify({ version: VERSION })); return; }
  if (req.url === '/stats') {
    let players = 0; for (const r of rooms.values()) players += r.members.size;
    res.writeHead(200, cors); res.end(JSON.stringify({ rooms: rooms.size, players, version: VERSION })); return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Kemik Vadisi sunucusu çalışıyor. Sürüm ' + VERSION);
});

const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 });

function newCode() {
  for (let i = 0; i < 1000; i++) {
    const c = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(c)) return c;
  }
  return null;
}
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); };

function leave(ws) {
  const room = ws.room; if (!room) return;
  room.members.delete(ws.id);
  ws.room = null;
  if (room.host === ws.id) {
    for (const m of room.members.values()) { send(m, { t: 'closed', reason: 'host' }); m.room = null; }
    rooms.delete(room.code);
  } else {
    for (const m of room.members.values()) send(m, { t: 'peerLeft', id: ws.id });
    if (!room.members.size) rooms.delete(room.code);
  }
}

wss.on('connection', (ws) => {
  ws.id = nextId++;
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'create') {
      leave(ws);
      const code = newCode(); if (!code) { send(ws, { t: 'error', msg: 'Sunucu dolu' }); return; }
      const room = { code, host: ws.id, members: new Map([[ws.id, ws]]), created: Date.now() };
      rooms.set(code, room); ws.room = room; ws.info = m.info || {};
      send(ws, { t: 'joined', id: ws.id, code, host: ws.id, peers: [] });
      return;
    }
    if (m.t === 'join') {
      const room = rooms.get(String(m.code || ''));
      if (!room) { send(ws, { t: 'error', msg: 'Oda bulunamadı' }); return; }
      if (room.members.size >= MAX_PLAYERS) { send(ws, { t: 'error', msg: 'Oda dolu (en fazla 4 kişi)' }); return; }
      leave(ws);
      ws.room = room; ws.info = m.info || {};
      const peers = [...room.members.values()].map((p) => ({ id: p.id, info: p.info }));
      room.members.set(ws.id, ws);
      send(ws, { t: 'joined', id: ws.id, code: room.code, host: room.host, peers });
      for (const p of room.members.values()) if (p !== ws) send(p, { t: 'peerJoined', id: ws.id, info: ws.info });
      return;
    }
    if (m.t === 'leave') { leave(ws); return; }
    if (m.t === 'ping') { send(ws, { t: 'pong', ts: m.ts }); return; }
    // Relay: to a single member when `to` is set, otherwise to everyone else in the room.
    const room = ws.room; if (!room) return;
    m.f = ws.id;
    const out = JSON.stringify(m);
    if (m.to != null) { const dst = room.members.get(m.to); if (dst) send(dst, out); return; }
    for (const p of room.members.values()) if (p !== ws) send(p, out);
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});

// Drop dead connections so rooms don't linger.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; ws.ping();
  }
}, 15000);

server.listen(PORT, () => console.log(`Kemik Vadisi sunucusu :${PORT} (sürüm ${VERSION})`));
