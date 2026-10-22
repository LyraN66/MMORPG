// Account storage: PostgreSQL when DATABASE_URL is set (production), otherwise a JSON file (local testing).
// Tables: users (login), sessions ("beni hatırla" tokens), characters (one saved character per account).
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

class FileStore {
  constructor(file) {
    this.file = file;
    try { this.d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { this.d = { users: {}, sessions: {}, chars: {}, nextId: 1 }; }
    this.dirty = false;
    setInterval(() => this.flush(), 3000).unref();
  }
  flush() { if (!this.dirty) return; this.dirty = false; fs.mkdirSync(new URL('.', 'file://' + this.file).pathname, { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.d)); }
  async init() {}
  async userByName(key) { return Object.values(this.d.users).find((u) => u.key === key) || null; }
  async createUser(key, name, hash) {
    if (await this.userByName(key)) return null;
    const u = { id: this.d.nextId++, key, name, hash, created: Date.now() };
    this.d.users[u.id] = u; this.dirty = true; return u;
  }
  async userById(id) { return this.d.users[id] || null; }
  async addSession(uid, token, days) { this.d.sessions[sha(token)] = { uid, exp: Date.now() + days * 864e5 }; this.dirty = true; }
  async sessionUser(token) { const s = this.d.sessions[sha(token)]; return s && s.exp > Date.now() ? s.uid : null; }
  async dropSession(token) { delete this.d.sessions[sha(token)]; this.dirty = true; }
  async getChar(uid) { return this.d.chars[uid] || null; }
  async putChar(uid, data) { this.d.chars[uid] = data; this.dirty = true; }
  async top(n) { return Object.entries(this.d.chars).map(([, c]) => c).sort((a, b) => b.level - a.level || b.xp - a.xp).slice(0, n); }
}

class PgStore {
  constructor(url) { this.url = url; }
  async init() {
    const { default: pg } = await import('pg');
    // SSL is configured here (verified certificate) instead of through ?sslmode= in the URL, which makes pg print a warning.
    const u = new URL(this.url); for (const k of ['sslmode', 'channel_binding', 'uselibpqcompat']) u.searchParams.delete(k);
    const local = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
    this.pool = new pg.Pool({ connectionString: u.toString(), ssl: local ? false : { rejectUnauthorized: true }, max: 5 });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, hash TEXT NOT NULL, created TIMESTAMPTZ DEFAULT now());
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, uid INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, exp TIMESTAMPTZ NOT NULL);
      CREATE TABLE IF NOT EXISTS characters (uid INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data JSONB NOT NULL, level INT NOT NULL DEFAULT 1, updated TIMESTAMPTZ DEFAULT now());`);
  }
  q(sql, args) { return this.pool.query(sql, args); }
  async userByName(key) { return (await this.q('SELECT * FROM users WHERE key=$1', [key])).rows[0] || null; }
  async createUser(key, name, hash) {
    try { return (await this.q('INSERT INTO users(key,name,hash) VALUES($1,$2,$3) RETURNING *', [key, name, hash])).rows[0]; } catch (e) { if (e.code === '23505') return null; throw e; }
  }
  async userById(id) { return (await this.q('SELECT * FROM users WHERE id=$1', [id])).rows[0] || null; }
  async addSession(uid, token, days) { await this.q(`INSERT INTO sessions(token,uid,exp) VALUES($1,$2,now() + ($3 || ' days')::interval)`, [sha(token), uid, String(days)]); }
  async sessionUser(token) { return (await this.q('SELECT uid FROM sessions WHERE token=$1 AND exp > now()', [sha(token)])).rows[0]?.uid ?? null; }
  async dropSession(token) { await this.q('DELETE FROM sessions WHERE token=$1', [sha(token)]); }
  async getChar(uid) { return (await this.q('SELECT data FROM characters WHERE uid=$1', [uid])).rows[0]?.data || null; }
  async putChar(uid, data) {
    await this.q(`INSERT INTO characters(uid,data,level,updated) VALUES($1,$2,$3,now()) ON CONFLICT (uid) DO UPDATE SET data=EXCLUDED.data, level=EXCLUDED.level, updated=now()`, [uid, data, data.level | 0]);
  }
  async top(n) { return (await this.q('SELECT data FROM characters ORDER BY level DESC, (data->>\'xp\')::int DESC LIMIT $1', [n])).rows.map((r) => r.data); }
}

export const store = process.env.DATABASE_URL ? new PgStore(process.env.DATABASE_URL) : new FileStore(process.env.STORE_FILE || new URL('./data/store.json', import.meta.url).pathname);
export const persistent = !!process.env.DATABASE_URL;

// Passwords: scrypt with a random salt, compared in constant time.
export function hashPass(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pass, salt, 32).toString('hex')}`;
}
export function checkPass(pass, stored) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const a = crypto.scryptSync(pass, salt, 32), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const newToken = () => crypto.randomBytes(24).toString('base64url');
