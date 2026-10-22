// WebSocket connection to the co-op relay server.
export const DEFAULT_SERVER = 'wss://mmorpg-1rq2.onrender.com';

export function serverUrl() {
  let u = DEFAULT_SERVER;
  try { u = localStorage.getItem('kv-server') || DEFAULT_SERVER; } catch { /* ignore */ }
  u = u.trim().replace(/\/+$/, '');
  if (/^https?:\/\//.test(u)) u = u.replace(/^http/, 'ws');
  else if (!/^wss?:\/\//.test(u)) u = 'wss://' + u;
  return u;
}
export function setServerUrl(u) { try { if (u) localStorage.setItem('kv-server', u); else localStorage.removeItem('kv-server'); } catch { /* ignore */ } }

export class Net {
  constructor(url = serverUrl()) {
    this.url = url; this.ws = null; this.id = null; this.host = null; this.code = null; this.peers = [];
    this.onMessage = null; this.onClose = null; this.waiters = [];
  }
  get isHost() { return this.id != null && this.id === this.host; }

  connect(timeout = 75000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const t = setTimeout(() => { if (!done) { done = true; ws.close(); reject(new Error('Sunucuya bağlanılamadı (zaman aşımı)')); } }, timeout);
      ws.onopen = () => { if (!done) { done = true; clearTimeout(t); resolve(); } };
      ws.onerror = () => { if (!done) { done = true; clearTimeout(t); reject(new Error('Sunucuya bağlanılamadı')); } };
      ws.onclose = () => { if (done) this.onClose?.(); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        for (const w of [...this.waiters]) if (w.types.includes(m.t)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(m); }
        this.onMessage?.(m);
      };
    });
  }
  waitFor(types, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const w = { types, resolve };
      this.waiters.push(w);
      setTimeout(() => { const i = this.waiters.indexOf(w); if (i >= 0) { this.waiters.splice(i, 1); reject(new Error('Sunucu yanıt vermedi')); } }, timeout);
    });
  }
  async enter(msg) {
    const p = this.waitFor(['joined', 'error']);
    this.send(msg);
    const r = await p;
    if (r.t === 'error') throw new Error(r.msg);
    this.id = r.id; this.host = r.host; this.code = r.code; this.peers = r.peers || [];
    return r;
  }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  close() { this.onClose = null; try { this.ws?.close(); } catch { /* ignore */ } }
}
