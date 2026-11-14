// Shared game state + UI helpers used by the town and every building.
import * as THREE from 'three';

export const MASTER = 25;
export const GAMES = [
  { id: 'maze', name: 'Mazes', color: '#2fd3a7' },
  { id: 'picture', name: 'Picture Puzzles', color: '#ff8a5b' },
  { id: 'pattern', name: 'Patterns', color: '#ffc53d' },
  { id: 'chess', name: 'Chess', color: '#9d8cff' },
  { id: 'pong', name: 'Ping Pong', color: '#4fb0ff' }
];
export const COLORS = ['#3f7fd9', '#e0473f', '#2fae6a', '#f2a51c', '#9b59d0', '#ff6fae', '#22b5c4', '#333a44'];
export const $ = id => document.getElementById(id);
export function el(tag, attrs, html) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); }
  if (html != null) e.innerHTML = html; return e;
}

/* ---------------- state ---------------- */
export const G = {
  S: { name: null, pin: null, data: null },
  renderer: null, input: null,
  preview: /preview=jigsaw/.test(location.search),
  // set by main.js
  enterRoom: null, backToTown: null, refresh: null, openStore: null
};
export function defaultData(color) {
  return {
    avatar: '🙂', color: color || COLORS[0], coins: 0,
    levels: { maze: 0, picture: 0, pattern: 0, chess: 0, pong: 0 },
    up: { paddle: 0, lives: 0, chessSet: 'classic', sets: ['classic'], chessHints: 0, picHints: 0, mazeHints: 0, house: 0, teleporter: false, cars: [], car: null, boats: [], boat: null },
    jigsaws: [], wins2p: { chess: 0, pong: 0 }, bag: {}, got: { day: '', keys: [] }
  };
}
export function normalize(d) {
  const base = defaultData(d && d.color); d = d || {};
  for (const k in base) if (d[k] == null) d[k] = base[k];
  for (const k in base.levels) if (d.levels[k] == null) d.levels[k] = 0;
  for (const k in base.up) if (d.up[k] == null) d.up[k] = base.up[k];
  return d;
}
export const coinsFor = level => Math.min(5, 1 + Math.floor((level - 1) / 5));
export const masteredCount = () => GAMES.filter(g => G.S.data.levels[g.id] >= MASTER).length;
export const jigsawUnlocked = () => masteredCount() === GAMES.length;

/* ---------------- saving: Google Sheet through the Mindworks Apps Script ---------------- */
export const API = 'https://script.google.com/macros/s/AKfycbw9OLwWLT-gMhEBS-aS4Rr7ra6JzMdX6_Qdve74J2C0FrhIA9rh9l56EGoXunglILsb/exec';
const LOCAL = /local=1/.test(location.search);
async function call(action, payload) {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...payload }) });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'Something went wrong.');
  return j.result;
}
const Local = {
  all() { try { return JSON.parse(localStorage.getItem('mw3_profiles') || '{}'); } catch (e) { return {}; } },
  put(m) { try { localStorage.setItem('mw3_profiles', JSON.stringify(m)); } catch (e) {} }
};
export const Store = {
  local: LOCAL,
  signUp(name, pin, data) {
    if (!LOCAL) return call('signUp', { name, pin, data });
    const m = Local.all(), k = name.toLowerCase(); if (m[k]) return Promise.reject(new Error('That name is taken — try signing in instead.'));
    m[k] = { name, pin, data }; Local.put(m); return Promise.resolve({ name, data });
  },
  signIn(name, pin) {
    if (!LOCAL) return call('signIn', { name, pin });
    const p = Local.all()[name.toLowerCase()];
    if (!p) return Promise.reject(new Error('No profile with that name yet. Tap "New player".'));
    if (p.pin !== pin) return Promise.reject(new Error('That PIN does not match.'));
    return Promise.resolve({ name: p.name, data: p.data });
  },
  save(name, pin, data) {
    if (!LOCAL) return call('saveProgress', { name, pin, data });
    const m = Local.all(), k = name.toLowerCase(); if (m[k]) { m[k].data = data; Local.put(m); } return Promise.resolve(true);
  }
};
let saveTimer = null, saving = false, again = false;
export function save(now) {
  if (!G.S.name) return;
  try { localStorage.setItem('mw3_cache_' + G.S.name.toLowerCase(), JSON.stringify(G.S.data)); } catch (e) {}
  clearTimeout(saveTimer); saveTimer = setTimeout(flush, now ? 0 : 800);
}
export function flush() {
  if (!G.S.name) return;
  if (saving) { again = true; return; }
  saving = true;
  Store.save(G.S.name, G.S.pin, G.S.data).then(() => { saving = false; if (again) { again = false; flush(); } })
    .catch(() => { saving = false; toast('Could not reach the save sheet — will retry.'); setTimeout(flush, 6000); });
}

/* ---------------- UI ---------------- */
let toastT;
export function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }
export function modal(o) {
  const m = $('modal'); m.innerHTML = '';
  if (o.big) m.appendChild(el('div', { class: 'big' }, o.big));
  m.appendChild(el('h2', null, o.title));
  if (o.text) m.appendChild(el('p', null, o.text));
  const acts = el('div', { class: 'acts' });
  (o.acts || []).filter(Boolean).forEach(a => {
    const b = el('button', { class: 'btn ' + (a.cls || '') }, a.label);
    b.onclick = () => { closeModal(); a.fn && a.fn(); }; acts.appendChild(b);
  });
  m.appendChild(acts); $('overlay').classList.add('on');
}
export function closeModal() { $('overlay').classList.remove('on'); }
export const modalOpen = () => $('overlay').classList.contains('on') || $('panel').classList.contains('on');
export function refreshCoins() { $('hudCoins').textContent = G.S.data.coins; $('panelCoins').querySelector('span').textContent = G.S.data.coins; G.refreshBag && G.refreshBag(); }
export function setHelp(txt) { $('roomHelp').classList.toggle('hide', !txt); $('roomHelpTxt').textContent = txt || ''; }
export function setTitle(txt) { $('hudTitle').textContent = txt; }
/** buttons in the bottom-right while inside a building: [{label, fn, cls}] */
export function setRoomButtons(list) {
  const box = $('roomBtns'); box.innerHTML = ''; box.classList.toggle('hide', !list || !list.length);
  (list || []).forEach(b => { const x = el('button', { class: 'btn small ' + (b.cls || '') }, b.label); x.onclick = b.fn; if (b.id) x.id = b.id; box.appendChild(x); });
}
export function openPanel(title, build) {
  $('panelTitle').textContent = title; const body = $('panelBody'); body.innerHTML = ''; build(body);
  refreshCoins(); $('panel').classList.add('on');
}
export function closePanel() { $('panel').classList.remove('on'); }

/* ---------------- level results ---------------- */
export function levelComplete(id, level, extra) {
  const earned = coinsFor(level), first = level > G.S.data.levels[id];
  G.S.data.coins += earned; if (first) G.S.data.levels[id] = level;
  save(true); refreshCoins(); G.refresh && G.refresh();
  const justMastered = first && level === MASTER, unlockedNow = justMastered && jigsawUnlocked();
  modal({
    big: unlockedNow ? '🧩' : justMastered ? '🏆' : '🎉',
    title: unlockedNow ? 'Jigsaw unlocked!' : justMastered ? 'Mastered!' : 'Level ' + level + ' complete!',
    text: (extra ? extra + ' ' : '') + '+' + earned + ' coin' + (earned > 1 ? 's' : '') + (unlockedNow ? ' — the Jigsaw building is open!' : justMastered ? ' — you reached level 25!' : ''),
    acts: [
      { label: 'Next level →', cls: 'go', fn: () => G.enterRoom(id, { level: level + 1 }) },
      { label: 'Go back outside', cls: 'ghost', fn: () => G.backToTown() }
    ]
  });
}
export function levelFailed(id, level, text, extraActs) {
  modal({
    big: '💪', title: 'So close!', text: text || 'Give it another try.',
    acts: (extraActs || []).concat([
      { label: 'Try again', cls: 'go', fn: () => G.enterRoom(id, { level }) },
      { label: 'Go back outside', cls: 'ghost', fn: () => G.backToTown() }
    ])
  });
}

/* ---------------- helpers for buildings ---------------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export function rayFrom(e, camera) {
  const r = G.renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera); return ray;
}
/** a big wall screen backed by a canvas; returns {mesh, canvas, ctx, tex, uvAt(e,camera)->{x,y}|null, update()} */
export function bigScreen(w, h, pxW, pxH) {
  const canvas = document.createElement('canvas'); canvas.width = pxW; canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const group = new THREE.Group();
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(w + .3, h + .3, .2), new THREE.MeshStandardMaterial({ color: 0x111215, roughness: .35, metalness: .6 }));
  bezel.position.z = -.11; bezel.castShadow = true; group.add(bezel);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  group.add(mesh);
  return {
    group, mesh, canvas, ctx, tex,
    uvAt(e, camera) { const hit = rayFrom(e, camera).intersectObject(mesh)[0]; return hit ? { x: hit.uv.x * pxW, y: (1 - hit.uv.y) * pxH } : null; },
    update() { tex.needsUpdate = true; }
  };
}
export function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
