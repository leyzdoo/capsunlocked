/**
 * Shoot — shared-world server (Google Apps Script web app).
 *
 * Setup (one time):
 *   1. Open script.google.com → New project. Replace Code.gs with this file and save.
 *   2. Run the "setup" function once and allow access (it makes a Google Sheet called "Shoot World").
 *   3. Deploy → New deployment → type "Web app" → Execute as: Me → Who has access: Anyone → Deploy.
 *   4. Copy the web app URL (ends in /exec) into shoot/js/net.js (const API).
 *
 * Players sign in with a name and a 4-digit PIN. The sheet keeps each player's
 * saved game (tokens, strength, gym, houses …) and the town chat. Where everyone is
 * standing right now lives in the script cache (fast, forgets after a few minutes).
 */
const PLAYERS = 'Players', CHAT = 'Chat';
const ONLINE_MS = 20000, CHAT_KEEP = 300;

function doGet() { return ContentService.createTextOutput('Shoot server is running.'); }

function doPost(e) {
  let out;
  try { const req = JSON.parse(e.postData.contents || '{}'); out = { ok: true, result: route(req) }; }
  catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function route(r) {
  switch (r.action) {
    case 'signUp': return signUp(r.name, r.pin, r.data);
    case 'signIn': return signIn(r.name, r.pin);
    case 'save': return save(r.token, r.data);
    case 'tick': return tick(r.token, r.pos);
    case 'chat': return chat(r.token, r.text);
    default: throw new Error('Unknown action.');
  }
}

/* ---------- helpers ---------- */
function book() {
  let ss = null; try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (ss) return ss;
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  ss = SpreadsheetApp.create('Shoot World'); props.setProperty('SHEET_ID', ss.getId()); return ss;
}
function setup() { book(); players(); chats(); return 'ready'; }
function sheet(name, header) {
  const ss = book();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}
const players = () => sheet(PLAYERS, ['name', 'key', 'pin', 'data', 'updated']);
const chats = () => sheet(CHAT, ['time', 'name', 'color', 'text']);
function hash(s) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'shoot:' + s)); }
function cleanName(n) {
  n = String(n || '').trim().replace(/\s+/g, ' ');
  if (!/^[A-Za-z0-9 _.-]{2,16}$/.test(n)) throw new Error('Names are 2–16 letters or numbers.');
  return n;
}
function cleanPin(p) { p = String(p || ''); if (!/^\d{4}$/.test(p)) throw new Error('Your PIN is 4 numbers.'); return p; }
function findRow(key) {
  const sh = players(), n = sh.getLastRow();
  if (n < 2) return 0;
  const keys = sh.getRange(2, 2, n - 1, 1).getValues();
  for (let i = 0; i < keys.length; i++) if (keys[i][0] === key) return i + 2;
  return 0;
}
function newToken(name) {
  const t = Utilities.getUuid();
  CacheService.getScriptCache().put('tok:' + t, name, 21600);
  return t;
}
function who(token) {
  const n = token && CacheService.getScriptCache().get('tok:' + token);
  if (!n) throw new Error('Please sign in again.');
  return n;
}
function safeData(d) {
  const s = JSON.stringify(d || {});
  if (s.length > 40000) throw new Error('Saved game is too big.');
  return s;
}

/* ---------- accounts ---------- */
function signUp(name, pin, data) {
  name = cleanName(name); pin = cleanPin(pin);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    if (findRow(name.toLowerCase())) throw new Error('That name is taken — try signing in instead.');
    players().appendRow([name, name.toLowerCase(), hash(name.toLowerCase() + pin), safeData(data), new Date()]);
  } finally { lock.releaseLock(); }
  CacheService.getScriptCache().remove('houses');
  return { name, data: data || {}, token: newToken(name) };
}
function signIn(name, pin) {
  name = cleanName(name); pin = cleanPin(pin);
  const row = findRow(name.toLowerCase());
  if (!row) throw new Error('No player with that name yet. Tap "New player".');
  const v = players().getRange(row, 1, 1, 4).getValues()[0];
  if (v[2] !== hash(name.toLowerCase() + pin)) throw new Error('That PIN does not match.');
  return { name: v[0], data: JSON.parse(v[3] || '{}'), token: newToken(v[0]) };
}
function save(token, data) {
  const name = who(token), row = findRow(name.toLowerCase());
  if (!row) throw new Error('Player not found.');
  players().getRange(row, 4, 1, 2).setValues([[safeData(data), new Date()]]);
  CacheService.getScriptCache().remove('houses');
  return true;
}

/* ---------- the shared town ---------- */
function houses() {
  const c = CacheService.getScriptCache(), hit = c.get('houses');
  if (hit) return JSON.parse(hit);
  const sh = players(), n = sh.getLastRow(), out = [];
  if (n >= 2) sh.getRange(2, 1, n - 1, 5).getValues().forEach(r => {
    let d = {}; try { d = JSON.parse(r[3] || '{}'); } catch (e) {}
    out.push({ name: r[0], house: d.house || null, gym: d.gym || 1, tokens: d.tokens || 0, color: d.color || '#ff6b3d', at: new Date(r[4]).getTime() || 0 });
  });
  out.sort((a, b) => b.at - a.at);
  const list = out.slice(0, 40);
  c.put('houses', JSON.stringify(list), 60);
  return list;
}
function tick(token, pos) {
  const name = who(token), c = CacheService.getScriptCache(), now = Date.now();
  const lock = LockService.getScriptLock(); lock.waitLock(5000);
  let pres;
  try {
    pres = JSON.parse(c.get('pres') || '{}');
    const p = pos || {};
    pres[name] = { x: +p.x || 0, z: +p.z || 0, yaw: +p.yaw || 0, sp: +p.sp || 0, where: String(p.where || 'town').slice(0, 20), color: String(p.color || '#ff6b3d').slice(0, 9), t: now };
    for (const k in pres) if (now - pres[k].t > ONLINE_MS) delete pres[k];
    c.put('pres', JSON.stringify(pres), 600);
  } finally { lock.releaseLock(); }
  const others = Object.keys(pres).filter(k => k !== name).map(k => Object.assign({ name: k }, pres[k]));
  return { others, houses: houses(), chat: lastChat() };
}
function lastChat() {
  const c = CacheService.getScriptCache(), hit = c.get('chat');
  if (hit) return JSON.parse(hit);
  const sh = chats(), n = sh.getLastRow();
  const list = n < 2 ? [] : sh.getRange(Math.max(2, n - 29), 1, Math.min(30, n - 1), 4).getValues()
    .map(r => ({ t: new Date(r[0]).getTime(), name: r[1], color: r[2], text: r[3] }));
  c.put('chat', JSON.stringify(list), 30);
  return list;
}
function chat(token, text) {
  const name = who(token);
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  if (!text) return lastChat();
  const sh = chats();
  let color = '#ff6b3d';
  try { const p = JSON.parse(CacheService.getScriptCache().get('pres') || '{}'); if (p[name]) color = p[name].color; } catch (e) {}
  sh.appendRow([new Date(), name, color, text]);
  const n = sh.getLastRow();
  if (n > CHAT_KEEP + 50) sh.deleteRows(2, n - CHAT_KEEP);
  CacheService.getScriptCache().remove('chat');
  return lastChat();
}
