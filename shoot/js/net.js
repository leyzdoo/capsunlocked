// Talking to the Shoot server (a Google Apps Script web app backed by a Google Sheet).
// ?local=1 swaps in a pretend server that lives in this browser (shared between tabs) for testing.
export const API = 'SHOOT_API_URL';
export const READY = /^https:/.test(API);
export const LOCAL = /local=1/.test(location.search) || !READY;
export const ONLINE_OK = READY || /local=1/.test(location.search);

async function call(action, payload) {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...payload }) });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'Something went wrong.');
  return j.result;
}

/* ---------- pretend server (same rules as Code.gs) ---------- */
const L = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('shootsrv_' + k)) ?? d; } catch (e) { return d; } },
  put(k, v) { try { localStorage.setItem('shootsrv_' + k, JSON.stringify(v)); } catch (e) {} }
};
const toks = {};
function lname(n) { n = String(n || '').trim().replace(/\s+/g, ' '); if (!/^[A-Za-z0-9 _.-]{2,16}$/.test(n)) throw new Error('Names are 2–16 letters or numbers.'); return n; }
function lpin(p) { p = String(p || ''); if (!/^\d{4}$/.test(p)) throw new Error('Your PIN is 4 numbers.'); return p; }
function lwho(t) { const n = toks[t] || L.get('tok_' + t); if (!n) throw new Error('Please sign in again.'); return n; }
function ltok(name) { const t = Math.random().toString(36).slice(2); toks[t] = name; L.put('tok_' + t, name); return t; }
const Local = {
  signUp({ name, pin, data }) { name = lname(name); pin = lpin(pin); const p = L.get('players', {}); if (p[name.toLowerCase()]) throw new Error('That name is taken — try signing in instead.'); p[name.toLowerCase()] = { name, pin, data, at: Date.now() }; L.put('players', p); return { name, data, token: ltok(name) }; },
  signIn({ name, pin }) { name = lname(name); pin = lpin(pin); const r = L.get('players', {})[name.toLowerCase()]; if (!r) throw new Error('No player with that name yet. Tap "New player".'); if (r.pin !== pin) throw new Error('That PIN does not match.'); return { name: r.name, data: r.data, token: ltok(r.name) }; },
  save({ token, data }) { const n = lwho(token), p = L.get('players', {}); if (p[n.toLowerCase()]) { p[n.toLowerCase()].data = data; p[n.toLowerCase()].at = Date.now(); L.put('players', p); } return true; },
  tick({ token, pos }) {
    const n = lwho(token), now = Date.now(), pres = L.get('pres', {});
    pres[n] = { ...pos, t: now }; for (const k in pres) if (now - pres[k].t > 20000) delete pres[k]; L.put('pres', pres);
    const houses = Object.values(L.get('players', {})).map(r => ({ name: r.name, house: r.data.house || null, gym: r.data.gym || 1, tokens: r.data.tokens || 0, color: r.data.color || '#ff6b3d', at: r.at })).sort((a, b) => b.at - a.at);
    return { others: Object.keys(pres).filter(k => k !== n).map(k => ({ name: k, ...pres[k] })), houses, chat: L.get('chat', []).slice(-30) };
  },
  chat({ token, text }) { const n = lwho(token), c = L.get('chat', []), pres = L.get('pres', {}); text = String(text || '').trim().slice(0, 140); if (text) c.push({ t: Date.now(), name: n, color: (pres[n] || {}).color || '#ff6b3d', text }); L.put('chat', c.slice(-300)); return c.slice(-30); }
};

export const Server = {
  local: LOCAL,
  async do(action, payload) {
    if (!LOCAL) return call(action, payload);
    await new Promise(r => setTimeout(r, 120));
    return Local[action](payload);
  }
};
