// Mindworks 3D — boot, sign-in, walking around town, entering buildings.
import * as THREE from 'three';
import { G, $, el, GAMES, MASTER, COLORS, Store, defaultData, normalize, save, flush, toast, modal, closeModal, modalOpen, refreshCoins, setHelp, setTitle, setRoomButtons, openPanel, closePanel, jigsawUnlocked, masteredCount } from './game.js';
import { createTown, paintPlaque, HOUSE_TIERS } from './town.js';
import { loadCharacter, makeCharacter } from './character.js';
import { setAnisotropy } from './tex.js';
import { ROOMS } from './rooms/index.js';

const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
G.renderer = renderer; setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 700);
const fade = el('div', { style: 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .25s;z-index:35' }); document.body.appendChild(fade);
const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

/* ---------------- input ---------------- */
const keys = {}, joy = { x: 0, y: 0, id: null }, input = { run: false };
G.input = input;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  keys[e.key.toLowerCase()] = true;
  if ((e.key === 'Enter' || e.key === 'e' || e.key === 'E') && !modalOpen() && !$('prompt').classList.contains('hide')) $('promptBtn').click();
  if (e.key === 'Escape' && active && active !== townPlace && !modalOpen()) leaveBuilding();
  if (active && active.key) active.key(e);
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
(function joystick() {
  const pad = $('joy'), knob = $('knob'), R = 50;
  function set(e) { const r = pad.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; joy.x = dx / R; joy.y = -dy / R; }
  pad.addEventListener('pointerdown', e => { joy.id = e.pointerId; pad.setPointerCapture(e.pointerId); set(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === joy.id) set(e); });
  const end = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  $('runBtn').addEventListener('pointerdown', e => { e.preventDefault(); input.run = !input.run; $('runBtn').classList.toggle('on', input.run); });
})();
// canvas: buildings get first chance at pointer events; otherwise drag turns the camera
const cam = { yaw: 0, pitch: .38, dist: 6.5, height: 1.45, tYaw: 0, drag: null, target: new THREE.Vector3() };
canvas.addEventListener('pointerdown', e => {
  if (modalOpen()) return;
  if (active && active.pointer && active.pointer.down(e) === true) { canvas.setPointerCapture(e.pointerId); (active._ptrs = active._ptrs || new Set()).add(e.pointerId); return; }
  if (active && active.walks) { cam.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener('pointermove', e => {
  if (active && active._ptrs && active._ptrs.has(e.pointerId)) { if (active.pointer.move) active.pointer.move(e); return; }
  if (active && active.pointer && active.pointer.hover) active.pointer.hover(e);
  if (cam.drag && cam.drag.id === e.pointerId) {
    cam.yaw -= (e.clientX - cam.drag.x) * .0065; cam.pitch = THREE.MathUtils.clamp(cam.pitch + (e.clientY - cam.drag.y) * .004, .12, 1.15);
    cam.drag.x = e.clientX; cam.drag.y = e.clientY;
  }
});
const ptrEnd = e => {
  if (active && active._ptrs && active._ptrs.has(e.pointerId)) { active._ptrs.delete(e.pointerId); active.pointer.up && active.pointer.up(e); }
  if (cam.drag && cam.drag.id === e.pointerId) cam.drag = null;
};
canvas.addEventListener('pointerup', ptrEnd); canvas.addEventListener('pointercancel', ptrEnd);
document.addEventListener('gesturestart', e => e.preventDefault());

/* ---------------- collisions ---------------- */
export function collide(p, r, boxes) {
  for (let pass = 0; pass < 2; pass++) for (const b of boxes) {
    const cx = Math.max(b.x1, Math.min(p.x, b.x2)), cz = Math.max(b.z1, Math.min(p.z, b.z2));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else { // centre inside the box: push out the shortest way
        const opts = [[b.x1 - r - p.x, 0], [b.x2 + r - p.x, 0], [0, b.z1 - r - p.z], [0, b.z2 + r - p.z]].sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]));
        p.x += opts[0][0]; p.z += opts[0][1];
      }
    }
  }
}

/* ---------------- world ---------------- */
let town = null, player = null, townPlace = null, active = null, lastDoor = null;
function setProgress(p, t) { $('loadBar').style.width = Math.round(p * 100) + '%'; if (t) $('loadTxt').textContent = t; }
async function boot() {
  setProgress(.15, 'Loading your character…');
  await loadCharacter(new URL('../models/Xbot.glb', import.meta.url).href);
  setProgress(.55, 'Building the town…');
  await new Promise(r => setTimeout(r, 30));
  town = createTown(renderer);
  setProgress(.9, 'Opening the doors…');
  townPlace = {
    id: 'town', scene: town.scene, walks: true, cam: { dist: 6.5, pitch: .38 },
    get colliders() { return town.colliders; }, get camBlockers() { return town.camBlockers; },
    interact() { return town.doors.map(d => ({ pos: d.pos, r: 2.0, ...doorAction(d) })); },
    update() { town.followShadow(player.root.position); }
  };
  // warm-up render so the first frame after sign-in is quick
  player = makeCharacter('player', 0x3f7fd9); placeInTown(town.spawn.pos, town.spawn.yaw);
  active = townPlace; renderer.compile(town.scene, camera);
  setProgress(1);
  $('loading').classList.add('hide'); $('login').classList.remove('hide');
  requestAnimationFrame(loop);
}
function placeInTown(pos, faceYaw) {
  camera.fov = 55; camera.updateProjectionMatrix();
  town.scene.add(player.root); player.root.position.copy(pos); player.root.rotation.y = faceYaw;
  cam.yaw = cam.tYaw = faceYaw; cam.pitch = .38; cam.dist = 6.5; cam.target.copy(pos);
}
function doorAction(d) {
  const lv = G.S.data ? G.S.data.levels : {};
  if (d.id === 'home') return { label: 'Go inside your ' + HOUSE_TIERS[G.S.data.up.house || 0].name, sub: 'Your home', fn: () => G.enterRoom('home', {}) };
  if (d.id === 'store') return { label: 'Go into the Game Store', sub: 'Upgrades and your house', fn: () => G.enterRoom('store', {}) };
  if (d.id === 'jigsaw') {
    if (!jigsawUnlocked() && !G.preview) return { label: '🔒 Jigsaw is locked', sub: masteredCount() + ' of 5 games at level 25', fn: () => modal({ big: '🔒', title: 'Not yet!', text: 'The Jigsaw opens when all five games reach level 25. You have ' + masteredCount() + ' of 5.', acts: [{ label: 'OK', cls: 'go' }] }) };
    return { label: 'Go into Jigsaw', sub: (G.S.data.jigsaws || []).length + ' finished', fn: () => G.enterRoom('jigsaw', {}) };
  }
  const g = GAMES.find(x => x.id === d.id), next = (lv[d.id] || 0) + 1;
  return {
    label: 'Go into ' + g.name, sub: 'Level ' + next + (lv[d.id] >= MASTER ? ' · ★ mastered' : ' · ' + Math.min(lv[d.id], MASTER) + '/25'),
    fn: () => {
      if (d.id === 'chess' || d.id === 'pong') modal({ big: d.id === 'chess' ? '♟️' : '🏓', title: g.name, text: 'Who are you playing?', acts: [
        { label: 'Play the robot · Level ' + next, cls: 'go', fn: () => G.enterRoom(d.id, { level: next }) },
        { label: '2 players on this iPad', cls: 'primary', fn: () => G.enterRoom(d.id, { mode: 'pvp' }) },
        { label: 'Not now', cls: 'ghost' }] });
      else G.enterRoom(d.id, { level: next });
    }
  };
}

/* ---------------- entering / leaving buildings ---------------- */
let switching = false;
G.enterRoom = async (id, opts = {}) => {
  if (switching) return; switching = true;
  closeModal(); closePanel();
  fade.style.opacity = 1; await wait(260);
  if (active && active !== townPlace && active.exit) active.exit();
  if (active === townPlace) lastDoor = town.doors.find(d => d.id === id) || lastDoor;
  try {
    const level = opts.level != null ? opts.level : (G.S.data.levels[id] || 0) + 1;
    const room = await ROOMS[id].enter({ level, mode: opts.mode || 'robot', player, camera, makeCharacter });
    room.id = id; active = room;
    camera.up.set(0, 1, 0);
    if (room.walks) {
      camera.fov = 55; camera.updateProjectionMatrix();
      room.scene.add(player.root); player.root.position.copy(room.start || new THREE.Vector3()); player.root.rotation.y = room.startYaw || Math.PI;
      cam.yaw = cam.tYaw = room.camYaw ?? 0; cam.target.copy(player.root.position);
    }
    setTitle(room.title || id); setHelp(room.help || '');
    const btns = (room.buttons || []).concat([{ label: '🚪 Leave', fn: leaveBuilding, cls: 'ghost' }]);
    setRoomButtons(btns);
  } catch (err) { console.error(err); toast('That building had a problem opening.'); active = townPlace; }
  showJoy(); fade.style.opacity = 0; switching = false;
};
function leaveBuilding() { G.backToTown(); }
G.backToTown = async () => {
  if (switching) return; switching = true;
  closeModal(); closePanel(); fade.style.opacity = 1; await wait(260);
  if (active && active !== townPlace && active.exit) active.exit();
  active = townPlace; setTitle(G.S.name); setHelp(''); setRoomButtons(null);
  const d = lastDoor || town.doors.find(x => x.id === 'home');
  const out = d.pos.clone(); out.z += d.facing === 0 ? .6 : -.6;
  placeInTown(out, d.facing);
  refreshPlaques(); showJoy(); fade.style.opacity = 0; switching = false;
};
G.refresh = () => { refreshPlaques(); refreshCoins(); if (town && G.S.data) town.setHouse(G.S.data.up.house || 0); };
function showJoy() { const walk = active && active.walks && touch; $('joy').classList.toggle('hide', !walk); $('runBtn').classList.toggle('hide', !walk); }
const wait = ms => new Promise(r => setTimeout(r, ms));

function refreshPlaques() {
  if (!town || !G.S.data) return;
  GAMES.forEach(g => { const p = town.plaques[g.id]; if (!p) return; const lv = G.S.data.levels[g.id]; paintPlaque(p, g.name, lv >= MASTER ? '★ Mastered · L' + lv : 'Level ' + (lv + 1) + ' next', lv / MASTER, g.color); });
  if (town.plaques.store) paintPlaque(town.plaques.store, 'Game Store', 'Open · ' + G.S.data.coins + ' coins', 1, '#ffd34d');
  if (town.plaques.jigsaw) paintPlaque(town.plaques.jigsaw, 'Jigsaw', jigsawUnlocked() ? 'Open!' : '🔒 ' + masteredCount() + '/5 mastered', masteredCount() / 5, '#ff6fae');
}

/* ---------------- loop ---------------- */
const clock = new THREE.Clock(), tmp = new THREE.Vector3();
let promptFor = null;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, clock.getDelta());
  if (!active) return;
  if (active.walks && G.S.data) walk(dt);
  if (active.update) active.update(dt);
  player.update(dt);
  if (active.walks && G.S.data) updatePrompt();
  const c = active.walks ? camera : (active.camera || camera);
  if (c.aspect !== innerWidth / innerHeight) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); }
  renderer.render(active.scene, c);
}
function walk(dt) {
  let mx = joy.x, my = joy.y;
  if (keys.a || keys.arrowleft) mx -= 1; if (keys.d || keys.arrowright) mx += 1;
  if (keys.w || keys.arrowup) my += 1; if (keys.s || keys.arrowdown) my -= 1;
  if (modalOpen() || switching) mx = my = 0;
  const len = Math.min(1, Math.hypot(mx, my)), run = input.run || keys.shift;
  const p = player.root.position;
  let speed = 0;
  if (len > .08) {
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let vx = rx * mx + fx * my, vz = rz * mx + fz * my; const vl = Math.hypot(vx, vz); vx /= vl; vz /= vl;
    speed = (run ? 6.4 : 3.3) * len;
    p.x += vx * speed * dt; p.z += vz * speed * dt;
    const target = Math.atan2(vx, vz); let dr = target - player.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    player.root.rotation.y += dr * Math.min(1, dt * 12);
    // ease the camera round behind you when walking forward
    if (!cam.drag && my > .5) { let dy = player.root.rotation.y + Math.PI - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cam.yaw += dy * Math.min(1, dt * 1.2); }
  }
  collide(p, .38, active.collidersAt ? active.collidersAt(p) : active.colliders);
  if (active.heightAt) { const ty = active.heightAt(p); p.y += (ty - p.y) * Math.min(1, dt * 16); if (Math.abs(ty - p.y) < .005) p.y = ty; }
  player.speedBlend(speed / 3.3);
  // camera
  const C = active.cam || { dist: 6.5, pitch: .38 };
  cam.dist += ((C.dist) - cam.dist) * Math.min(1, dt * 4);
  if (C.pitch != null && C.lockPitch) cam.pitch += (C.pitch - cam.pitch) * Math.min(1, dt * 4);
  cam.target.lerp(tmp.set(p.x, p.y + cam.height, p.z), Math.min(1, dt * 10));
  const cp = Math.cos(cam.pitch);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * cam.dist * cp, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cam.dist * cp);
  // keep the camera out of walls: shorten the boom where it would pass through a building
  const bl = active.camBlockers;
  if (bl && bl.length) {
    const ox = cam.target.x, oz = cam.target.z, dx = camera.position.x - ox, dz = camera.position.z - oz; let tMax = 1;
    for (const b of bl) {
      let t0 = 0, t1 = 1;
      if (Math.abs(dx) < 1e-6) { if (ox < b.x1 || ox > b.x2) continue; } else { let a = (b.x1 - ox) / dx, c = (b.x2 - ox) / dx; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
      if (Math.abs(dz) < 1e-6) { if (oz < b.z1 || oz > b.z2) continue; } else { let a = (b.z1 - oz) / dz, c = (b.z2 - oz) / dz; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
      if (t0 <= t1 && t1 > 0) tMax = Math.min(tMax, Math.max(.12, t0 - .06));
    }
    if (tMax < 1) { camera.position.x = ox + dx * tMax; camera.position.z = oz + dz * tMax; camera.position.y = cam.target.y + (camera.position.y - cam.target.y) * Math.max(tMax, .5); }
  }
  if (active.camClamp) active.camClamp(camera.position, cam.target);
  camera.lookAt(cam.target);
}
function updatePrompt() {
  const list = active.interact ? active.interact() : [];
  const p = player.root.position; let best = null, bd = 1e9;
  for (const it of list) { if (Math.abs((it.pos.y || 0) - p.y) > 1.2) continue; const d = Math.hypot(it.pos.x - p.x, it.pos.z - p.z); if (d < it.r && d < bd) { bd = d; best = it; } }
  const show = !!best && !modalOpen() && !switching;
  $('prompt').classList.toggle('hide', !show);
  if (show && promptFor !== best.label + best.sub) { promptFor = best.label + best.sub; $('promptBtn').textContent = best.label; $('promptSub').textContent = best.sub || ''; }
  $('promptBtn').onclick = show ? () => best.fn() : null;
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); });

/* ---------------- sign in ---------------- */
let mode = 'in', color = COLORS[0];
function setMode(m) { mode = m; $('tabIn').classList.toggle('on', m === 'in'); $('tabNew').classList.toggle('on', m === 'new'); $('colorPick').classList.toggle('hide', m !== 'new'); $('loginGo').textContent = m === 'new' ? 'Create player' : 'Sign in'; $('loginErr').textContent = ''; }
function initLogin() {
  const sw = $('swatches');
  COLORS.forEach((c, i) => { const b = el('button', { type: 'button', class: i ? '' : 'on', style: 'background:' + c, 'aria-label': 'color ' + (i + 1) }); b.onclick = () => { color = c; [...sw.children].forEach(x => x.classList.remove('on')); b.classList.add('on'); }; sw.appendChild(b); });
  $('tabIn').onclick = () => setMode('in'); $('tabNew').onclick = () => setMode('new');
  $('inPin').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 4); });
  $('inPin').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('loginGo').onclick = doLogin;
  $('saveNote').textContent = Store.local ? 'Test mode: progress is saved on this device only.' : 'Your progress is saved to the Mindworks Google Sheet.';
  try { const last = localStorage.getItem('mw3_last'); if (last) $('inName').value = last; } catch (e) {}
  $('btnOut').onclick = () => { flush(); location.reload(); };
  $('btnHome').onclick = () => { if (active !== townPlace) { lastDoor = town.doors.find(d => d.id === 'home'); G.backToTown(); } else { const d = town.doors.find(x => x.id === 'home'); placeInTown(d.pos.clone().add(new THREE.Vector3(0, 0, -1.5)), Math.PI); toast('Back home!'); } };
  $('btnProgress').onclick = showProgress;
  $('panelClose').onclick = closePanel;
}
function doLogin() {
  const name = $('inName').value.trim(), pin = $('inPin').value;
  if (!/^[A-Za-z0-9 _-]{2,20}$/.test(name)) { $('loginErr').textContent = 'Names can be 2–20 letters or numbers.'; return; }
  if (!/^\d{4}$/.test(pin)) { $('loginErr').textContent = 'PIN must be 4 numbers.'; return; }
  const btn = $('loginGo'); btn.disabled = true; $('loginErr').textContent = ''; btn.textContent = 'One moment…';
  (mode === 'new' ? Store.signUp(name, pin, defaultData(color)) : Store.signIn(name, pin)).then(res => {
    G.S.name = res.name; G.S.pin = pin; G.S.data = normalize(res.data);
    try {
      const c = JSON.parse(localStorage.getItem('mw3_cache_' + G.S.name.toLowerCase()) || 'null');
      const score = d => Object.values(d.levels).reduce((a, b) => a + b, 0) * 1000 + d.coins + (d.up.house || 0) * 10;
      if (c && score(normalize(c)) > score(G.S.data)) { G.S.data = normalize(c); save(true); }
      localStorage.setItem('mw3_last', G.S.name);
    } catch (e) {}
    startPlaying();
  }).catch(e => { $('loginErr').textContent = e.message; }).finally(() => { btn.disabled = false; setMode(mode); });
}
function startPlaying() {
  $('login').classList.add('hide'); $('hud').classList.remove('hide');
  town.scene.remove(player.root);
  player = makeCharacter('player', new THREE.Color(G.S.data.color || COLORS[0]).getHex());
  const d = town.doors.find(x => x.id === 'home'); lastDoor = d;
  town.setHouse(G.S.data.up.house || 0);
  placeInTown(town.spawn.pos, town.spawn.yaw);
  setTitle(G.S.name); refreshCoins(); refreshPlaques(); showJoy();
  showProgress(true);
}
function showProgress(first) {
  openPanel(first ? 'Welcome, ' + G.S.name + '!' : 'My progress', body => {
    const pts = GAMES.reduce((a, g) => a + Math.min(MASTER, G.S.data.levels[g.id]), 0);
    body.appendChild(el('p', { style: 'color:var(--muted);font-weight:700;margin:0 0 12px' }, jigsawUnlocked() ? 'You mastered all five games — the Jigsaw building is open!' : pts + ' of 125 levels done. Reach level 25 in all five games to open the Jigsaw.'));
    const box = el('div', { class: 'prog' });
    GAMES.forEach(g => { const lv = G.S.data.levels[g.id]; box.appendChild(el('div', { class: 'prow' }, '<b>' + g.name + '</b><div class="bar"><i style="width:' + Math.min(100, lv / MASTER * 100) + '%;background:' + g.color + '"></i></div><span>' + Math.min(lv, MASTER) + ' / 25</span>')); });
    box.appendChild(el('div', { class: 'prow' }, '<b>Jigsaw</b><div class="bar"><i style="width:' + masteredCount() / 5 * 100 + '%;background:#ff6fae"></i></div><span>' + (jigsawUnlocked() ? 'Open' : '🔒') + '</span>'));
    box.appendChild(el('div', { class: 'prow' }, '<b>Your house</b><div class="bar"><i style="width:' + (G.S.data.up.house / (HOUSE_TIERS.length - 1) * 100) + '%;background:#ffd34d"></i></div><span>' + HOUSE_TIERS[G.S.data.up.house].name + '</span>'));
    body.appendChild(box);
    const go = el('div', { style: 'display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap' });
    const b = el('button', { class: 'btn go' }, first ? 'Start walking' : 'Close'); b.onclick = closePanel; go.appendChild(b);
    body.appendChild(go);
    body.appendChild(el('p', { class: 'note' }, touch ? 'Use the circle at bottom-left to walk. Drag the screen to look around. Walk up to a door to go in.' : 'Walk with WASD or the arrow keys (Shift to run). Drag to look around. Walk up to a door and press Enter.'));
  });
}

if (Store.local) window.__mw = { G, cam, camera, get player() { return player; }, get town() { return town; }, get active() { return active; }, placeInTown };
initLogin();
boot().catch(err => { console.error(err); setProgress(1, 'Something went wrong loading Mindworks: ' + err.message); });
addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
