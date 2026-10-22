// Player account: login/register over the game connection, the "beni hatırla" token, and save syncing.
import { PROTOCOL } from '../server/shared/version.js';

const LS = 'kv-token', SS = 'kv-token-s';
export const account = { user: null, token: null, remember: false, net: null };

export function storedToken() {
  try {
    const t = localStorage.getItem(LS); if (t) return { token: t, remember: true };
    const s = sessionStorage.getItem(SS); if (s) return { token: s, remember: false };
  } catch { /* ignore */ }
  return null;
}
function keepToken(token, remember) {
  try {
    localStorage.removeItem(LS); sessionStorage.removeItem(SS);
    // Even without "remember", keep it for this app session so map travel/reload logs straight back in.
    if (remember) localStorage.setItem(LS, token); else sessionStorage.setItem(SS, token);
  } catch { /* ignore */ }
}
export function forgetToken() { try { localStorage.removeItem(LS); sessionStorage.removeItem(SS); } catch { /* ignore */ } }

// mode: 'login' | 'register' | 'token'. Resolves with the server's 'authed' message.
export async function authenticate(net, mode, { user, pass, token, remember }) {
  const p = net.waitFor(['authed', 'error'], 30000);
  net.send({ t: 'auth', proto: PROTOCOL, mode, user, pass, token, remember });
  const r = await p;
  if (r.t === 'error') { const e = new Error(r.msg); e.relogin = !!r.relogin; throw e; }
  account.user = r.user; account.token = r.token; account.remember = !!remember; account.net = net;
  keepToken(r.token, !!remember);
  return r;
}
export function logout() {
  account.net?.send({ t: 'logout', token: account.token });
  forgetToken(); account.user = account.token = null;
}
