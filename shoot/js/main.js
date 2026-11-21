// Shoot — the 3D sports town. Walk around, go into a stadium, play, earn tokens.
import * as THREE from 'three';
import { loadCharacter, makeCharacter } from './character.js';
import { Town, collidePush, LOTS } from './town.js';
import { viewFor, colorOf } from './arena.js';
import { E, Baseball, Football, Basketball, Soccer, Training, guess } from './sports.js';
import { Server, ONLINE_OK } from './net.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-US');
const COLORS = ['#ff6b3d', '#3a6fd8', '#9b59b6', '#27ae60', '#f1c40f', '#e84393'];
const WIN = 150000, GYMCOST = 50000, PRICES = { soccer: 25000, small: 100000, big: 300000 };
const BLANK = () => ({ tokens: 0, str: 5, gym: 1, soccer: false, house: null, abs: false, bicep: false, color: '#ff6b3d' });
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('shoot3_' + k)) ?? d; } catch (e) { return d; } }, put(k, v) { try { localStorage.setItem('shoot3_' + k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem('shoot3_' + k); } catch (e) {} } };

let S = { ...BLANK(), ...store.get('guest', {}) };
let me = { name: '', token: null };
const signedIn = () => !!me.token;

/* ---------------- renderer ---------------- */
const canvas = $('gl');
const PHONE = /iPhone|iPod|Android.+Mobile/.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 500;
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !PHONE, powerPreference: PHONE ? 'default' : 'high-performance' }); }
catch (e) { $('loading').innerHTML = '<div style="max-width:420px;text-align:center;padding:20px">This browser has 3D graphics (WebGL) turned off, so the town can\'t be drawn. Try Safari or Chrome on an iPad, or turn on "Use graphics acceleration" in Chrome settings → System, then reload.</div>'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, PHONE ? 1.25 : 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95; renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(55, 1, .1, 400);
function resize() { renderer.setSize(innerWidth, innerHeight, false); }
addEventListener('resize', resize); resize();

/* ---------------- input: keyboard, joystick, on-screen buttons ---------------- */
const keys = {}, held = E.held, joy = { x: 0, y: 0, id: null };
E.dir = () => ({ x: clampN(joy.x + (keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0)), y: clampN(-joy.y + (keys.arrowdown ? 1 : 0) - (keys.arrowup ? 1 : 0)) });
function clampN(v) { return Math.max(-1, Math.min(1, v)); }
const normKey = k => k.length === 1 ? k.toLowerCase() : k;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = normKey(e.key); if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
  keys[k.toLowerCase()] = true; if (e.repeat) return; held.add(k); press(k);
});
addEventListener('keyup', e => { const k = normKey(e.key); keys[k.toLowerCase()] = false; held.delete(k); release(k); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; held.clear(); });
function press(k) {
  if (modalOpen()) { if (/^[1-9]$/.test(k)) { const b = $('modal').querySelectorAll('.acts .btn')[+k - 1]; if (b) b.click(); } if (k === 'Escape') { const all = $('modal').querySelectorAll('.acts .btn'); if (all.length) all[all.length - 1].click(); } return; }
  if (k === 'c') { openChat(); return; }
  if (active === 'town') { if (k === 'Enter' && promptDoor) enter(promptDoor.id); return; }
  if (!game) return;
  if (k === 'Escape') return quitAsk();
  if (!game.over) game.key(k);
  flashBtn(k, true);
}
function release(k) { if (game && !game.over && !modalOpen()) game.keyup(k); flashBtn(k, false); }
function flashBtn(k, on) { const b = $('acts').querySelector(`[data-k="${k}"]`); if (b) b.classList.toggle('on', on); }
(function joystick() {
  const pad = $('joy'), knob = $('knob'), R = 46;
  function set(e) { const r = pad.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; joy.x = dx / R; joy.y = -dy / R; }
  pad.addEventListener('pointerdown', e => { joy.id = e.pointerId; pad.setPointerCapture(e.pointerId); set(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === joy.id) set(e); });
  const end = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
})();
let actsSig = '';
function setActs(labels) {
  const sig = JSON.stringify(labels); if (sig === actsSig) return; actsSig = sig;
  const box = $('acts'); box.innerHTML = '';
  const order = ['q', 'w', 'e', 'r', 't'];
  for (const k of order) if (labels[k]) box.insertAdjacentHTML('beforeend', `<button data-k="${k}"><b>${k.toUpperCase()}</b>${esc(labels[k])}</button>`);
  if (labels.digits) [1, 2, 3, 4].forEach(n => box.insertAdjacentHTML('beforeend', `<button class="num" data-k="${n}"><b>${n}</b>${n === 4 ? 'Home' : ['', '1st', '2nd', '3rd'][n]}</button>`));
  box.querySelectorAll('button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); held.add(k); press(k); });
    const up = () => { if (held.has(k)) { held.delete(k); release(k); } };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  });
}
// drag on the town to turn the camera
const cam = { yaw: Math.PI, pitch: .42, dist: 7.5, height: 1.5, drag: null, target: new THREE.Vector3() };
canvas.addEventListener('pointerdown', e => { if (active === 'town' && !modalOpen()) { cam.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); } });
canvas.addEventListener('pointermove', e => { if (cam.drag && cam.drag.id === e.pointerId) { cam.yaw -= (e.clientX - cam.drag.x) * .0065; cam.pitch = Math.max(.1, Math.min(1.2, cam.pitch + (e.clientY - cam.drag.y) * .004)); cam.drag.x = e.clientX; cam.drag.y = e.clientY; } });
const dragEnd = e => { if (cam.drag && cam.drag.id === e.pointerId) cam.drag = null; };
canvas.addEventListener('pointerup', dragEnd); canvas.addEventListener('pointercancel', dragEnd);
document.addEventListener('gesturestart', e => e.preventDefault());

/* ---------------- UI helpers ---------------- */
const modalOpen = () => !$('overlay').classList.contains('hide');
function modal({ title, html = '', acts = [] }) {
  const m = $('modal');
  m.innerHTML = `<h2>${title}</h2>${html}<div class="acts">${acts.filter(Boolean).map((a, i) => `<button class="btn ${a.cls || ''}" data-i="${i}" ${a.dis ? 'disabled' : ''}><kbd>${i + 1}</kbd> ${a.label}</button>`).join('')}</div>`;
  const list = acts.filter(Boolean);
  m.querySelectorAll('.acts .btn').forEach(b => b.onclick = () => { const a = list[+b.dataset.i]; if (a.keep) return a.fn(); closeModal(); a.fn && a.fn(); });
  $('overlay').classList.remove('hide');
}
function closeModal() { $('overlay').classList.add('hide'); }
let toastT; function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2200); }
E.msg = t => { $('msg').innerHTML = t || ''; };
E.S = () => S;
E.pitchBox = on => $('pitchBox').classList.toggle('hide', !on);
E.pitchValue = () => $('pitchIn').value;
E.setPitchValue = v => { $('pitchIn').value = v; };
$('pitchIn').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); const r = guess(e.target.value); if (e.target.value.trim() && !r.exact) E.msg(`Did you mean <b>${r.p}</b>? Got it — ${r.p}. Now press <kbd>E</kbd> to pitch.`); else E.msg(`${r.p[0].toUpperCase() + r.p.slice(1)} ready. Aim with the arrows, then <kbd>E</kbd>.`); e.target.value = r.p; e.target.blur(); } });
function hud() { $('sTok').textContent = fmt(S.tokens); $('sStr').textContent = Math.floor(S.str); $('sGym').textContent = S.gym; }

/* ---------------- saving ---------------- */
let saveT = null;
function save() {
  hud();
  if (!signedIn()) { store.put('guest', S); return; }
  store.put('cache_' + me.name.toLowerCase(), S);
  clearTimeout(saveT); saveT = setTimeout(() => Server.do('save', { token: me.token, data: S }).catch(err => { if (/sign in/i.test(err.message)) lostSession(); else toast('Could not save — will retry.'); }), 1200);
}

/* ---------------- world ---------------- */
let town, player, active = 'town', game = null, view = null, promptDoor = null;
function muscles(ch) {
  if (!ch.bones) ch.bones = { arms: ['LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'].map(n => ch.bone(n)).filter(Boolean), chest: ch.bone('Spine2') };
  const k = 1 + Math.min(S.str, 100) / 140 + (S.bicep ? .45 : 0); ch.bones.arms.forEach(b => b.scale.setScalar(k));
  if (ch.bones.chest) ch.bones.chest.scale.set(1 + Math.min(S.str, 100) / 400 + (S.abs ? .12 : 0), 1, 1 + (S.abs ? .1 : 0));
}
function makePlayer() {
  const p = player ? player.root.position.clone() : new THREE.Vector3(0, 0, 14), r = player ? player.root.rotation.y : Math.PI;
  if (player) town.scene.remove(player.root);
  player = makeCharacter('player', colorOf(S.color)); player.root.position.copy(p); player.root.rotation.y = r; town.scene.add(player.root);
}
function meOwner() { return { name: me.name, house: S.house, color: S.color }; }
function refreshTown() { town.setGym(S.gym); town.setSoccer(S.soccer); town.setLots(meOwner(), lastHouses); }
let lastHouses = [];

function walk(dt) {
  const d = E.dir(); let mx = d.x, my = -d.y; if (modalOpen()) mx = my = 0;
  const len = Math.min(1, Math.hypot(mx, my)), run = held.has('w') || keys.shift, p = player.root.position;
  let speed = 0;
  if (len > .08) {
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let vx = rx * mx + fx * my, vz = rz * mx + fz * my; const vl = Math.hypot(vx, vz); vx /= vl; vz /= vl;
    speed = (run ? 6.6 + S.str * .02 : 3.4) * len; p.x += vx * speed * dt; p.z += vz * speed * dt;
    let dr = Math.atan2(vx, vz) - player.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); player.root.rotation.y += dr * Math.min(1, dt * 12);
    if (!cam.drag && my > .5) { let dy = player.root.rotation.y + Math.PI - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cam.yaw += dy * Math.min(1, dt * 1.2); }
  }
  collidePush(p, .4, town.colliders);
  player.speedBlend(speed / 3.3); player.lastSp = speed;
  cam.target.lerp(new THREE.Vector3(p.x, p.y + cam.height, p.z), Math.min(1, dt * 10));
  const cp = Math.cos(cam.pitch);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * cam.dist * cp, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cam.dist * cp);
  camera.lookAt(cam.target);
  // nearest door
  let best = null, bd = 3.2; for (const dd of town.doors) { const dist = Math.hypot(p.x - dd.x, p.z - dd.z); if (dist < bd) { bd = dist; best = dd; } }
  if ((best && best.id) !== (promptDoor && promptDoor.id)) {
    promptDoor = best; $('prompt').classList.toggle('hide', !best);
    if (best) $('promptBtn').innerHTML = `${esc(best.name)} <kbd>Enter</kbd>`;
  }
}
$('promptBtn').onclick = () => { if (promptDoor) enter(promptDoor.id); };

/* ---------------- buildings ---------------- */
const SPORT = { base: ['Baseball', () => new Baseball()], foot: ['Football', () => new Football()], bask: ['Basketball', () => new Basketball()], soc: ['Soccer', () => new Soccer()] };
function enter(id) {
  if (id === 'gym') return gymMenu();
  if (id === 'shop') return shopMenu();
  if (id === 'home') return homeMenu();
  if (id === 'soc' && !S.soccer) return modal({ title: 'Soccer is locked', html: '<p>Buy Soccer at the Game Shop for 25,000 tokens to unlock penalty kicks.</p>', acts: [{ label: 'OK' }] });
  const [name, make] = SPORT[id];
  const blurb = { base: 'Bat first, then pitch and field. 3 innings. <kbd>Q</kbd> swing · <kbd>W</kbd> run · <kbd>E</kbd> pitch · <kbd>R</kbd> catch · <kbd>1</kbd>–<kbd>4</kbd> throw to a base.', foot: 'You get a random position. Arrows to run, hold <kbd>W</kbd> to sprint, <kbd>T</kbd> throw, <kbd>R</kbd> catch, hold <kbd>Q</kbd> to kick.', bask: 'You get a random position. Drive with the arrows, <kbd>Q</kbd> shoot, <kbd>T</kbd> pass, <kbd>R</kbd> catch.', soc: 'Penalty shootout. Arrows aim, <kbd>Q</kbd> shoot. In goal: arrows slide, <kbd>R</kbd> dive.' }[id];
  modal({ title: name, html: `<p>${blurb}</p><p class="big">Win = 150,000 tokens</p>`, acts: [{ label: 'Play', cls: 'go', fn: () => startGame(make()) }, id === 'foot' && { label: 'Practice kicks', fn: () => startGame(new Football(true)) }, { label: 'Watch a game', fn: () => watch(name) }, { label: 'Back to town' }] });
}
function startGame(g) {
  if (view) view.dispose(); game = g; view = viewFor(g, colorOf(S.color), S.gym); active = 'game'; actsSig = '';
  ['prompt', 'chat'].forEach(id => $(id).classList.add('hide')); $('board').classList.remove('hide'); $('esc').classList.remove('hide');
  $('chat').classList.add('hide'); document.body.classList.add('ingame');
}
function backToTown() {
  game = null; if (view) { view.dispose(); view = null; } active = 'town'; actsSig = ''; E.msg(''); E.pitchBox(false);
  $('board').classList.add('hide'); $('esc').classList.add('hide'); document.body.classList.remove('ingame'); $('chat').classList.remove('hide'); promptDoor = null;
  refreshTown();
}
$('esc').onclick = () => quitAsk();
function quitAsk() { modal({ title: 'Leave the game?', html: '<p>You only get tokens if you finish and win.</p>', acts: [{ label: 'Keep playing', cls: 'go' }, { label: 'Leave', fn: backToTown }] }); }
E.finish = (g, win, detail) => {
  if (win) S.tokens += WIN; save();
  const tie = g.sc && g.sc.you === g.sc.cpu;
  modal({ title: win ? 'You win!' : tie ? 'Tie game' : 'You lost', html: `<p>${detail}</p><p class="big">${win ? '+150,000 tokens' : 'No tokens this time — win to earn 150,000.'}</p>`, acts: [{ label: 'Play again', cls: 'go', fn: () => startGame(g.again()) }, { label: 'Back to town', fn: backToTown }] });
};
function watch(sport) {
  const TEAMS = ['Portland Pines', 'Rain City Rockets', 'Harbor Hawks', 'Ridge Rams', 'Lakeside Lions', 'Bay Bears'];
  const EV = { Baseball: [['{t} smacks a home run!', 1], ['{t} singles to left.', 0], ['Strikeout for {t}.', 0], ['{t} doubles in a run!', 1], ['Diving catch by {t}!', 0]], Football: [['{t} throws a 40-yard touchdown!', 7], ['{t} kicks a field goal.', 3], ['{t} fumbles!', 0], ['Big sack by {t}.', 0], ['{t} runs it in for six!', 7]], Basketball: [['{t} drains a three!', 3], ['{t} slam dunk!', 2], ['Block by {t}!', 0], ['{t} layup.', 2], ['{t} free throw.', 1]], Soccer: [['{t} scores a header!', 1], ['Great save by {t}.', 0], ['{t} hits the post!', 0], ['{t} curls one into the corner!', 1], ['Yellow card for {t}.', 0]] };
  const a = TEAMS[Math.floor(Math.random() * 6)], t2 = [a, TEAMS.filter(x => x !== a)[Math.floor(Math.random() * 5)]], s = [0, 0], lines = []; let n = 0;
  const draw = done => modal({ title: done ? 'Final' : `Watching ${sport}`, html: `<p class="big">${esc(t2[0])} ${s[0]} – ${s[1]} ${esc(t2[1])}</p>${lines.slice(0, 6).map((l, i) => `<p style="opacity:${1 - i * .13}">${esc(l)}</p>`).join('')}${done ? '<p>Watching is free. Play a game to earn tokens.</p>' : ''}`, acts: [{ label: done ? 'Back to town' : 'Stop watching', fn: () => clearInterval(iv) }] });
  const iv = setInterval(() => { if (!modalOpen()) return clearInterval(iv); n++; const i = Math.random() < .5 ? 0 : 1, ev = EV[sport][Math.floor(Math.random() * 5)]; s[i] += ev[1]; lines.unshift(ev[0].replace('{t}', t2[i])); draw(n >= 12); if (n >= 12) clearInterval(iv); }, 1400);
  draw(false);
}
const cap = () => S.gym * 20;
function gymMenu() {
  const L = S.gym;
  modal({ title: `Gym · level ${L} of 5`, html: `<p>Strength <b>${Math.floor(S.str)}</b> — this gym lets you reach <b>${cap()}</b>. Stronger means harder hits, longer kicks, faster running and bigger arms.</p>${L < 5 ? '<p>At level 5 you get free six-pack abs and giant biceps.</p>' : ''}<p>You have <b>${fmt(S.tokens)}</b> tokens.</p>`,
    acts: [{ label: 'Train (mash Q)', cls: 'go', fn: () => startGame(new Training()) },
      { label: L >= 5 ? 'Gym is max level' : `Upgrade to level ${L + 1} — 50,000`, dis: L >= 5 || S.tokens < GYMCOST, fn: () => { S.tokens -= GYMCOST; S.gym++; save(); refreshTown(); toast(`Gym upgraded to level ${S.gym}!`); gymMenu(); } },
      L >= 5 && { label: `Free six-pack abs — ${S.abs ? 'on' : 'off'}`, fn: () => { S.abs = !S.abs; save(); gymMenu(); } },
      L >= 5 && { label: `Free giant biceps — ${S.bicep ? 'on' : 'off'}`, fn: () => { S.bicep = !S.bicep; save(); gymMenu(); } },
      { label: 'Back to town' }] });
}
E.trainDone = reps => {
  const room = Math.max(0, cap() - S.str), g = Math.min(room, Math.round(reps * 1.2) / 10); S.str = Math.round((S.str + g) * 10) / 10; save();
  modal({ title: 'Workout done', html: `<p>${reps} reps. Strength +${g.toFixed(1)} → <b>${Math.floor(S.str)}</b> (your gym's limit is ${cap()}).</p>${room - g <= .05 ? "<p>You've hit this gym's limit. Upgrade the gym to get even stronger.</p>" : ''}`, acts: [{ label: 'Train again', cls: 'go', fn: () => startGame(new Training()) }, { label: 'Back to town', fn: backToTown }] });
};
function shopMenu(note) {
  const buy = (c, f, t) => () => { S.tokens -= c; f(); save(); refreshTown(); toast(t); shopMenu('Bought! Go see it in town.'); };
  modal({ title: 'Game Shop', html: `${note ? `<p class="big">${note}</p>` : ''}<p>You have <b>${fmt(S.tokens)}</b> tokens. More games coming soon.</p>`, acts: [
    { label: S.soccer ? 'Soccer — owned' : 'Soccer (penalty kicks) — 25,000', dis: S.soccer || S.tokens < PRICES.soccer, fn: buy(PRICES.soccer, () => S.soccer = true, 'Soccer unlocked!') },
    { label: S.house ? 'Small house — owned' : 'Small house — 100,000', dis: !!S.house || S.tokens < PRICES.small, fn: buy(PRICES.small, () => S.house = 'small', 'Your new house is built!') },
    { label: S.house === 'big' ? 'Big house — owned' : 'Big house — 300,000', dis: S.house === 'big' || S.tokens < PRICES.big, fn: buy(PRICES.big, () => S.house = 'big', 'Your big house is built!') },
    { label: 'Back to town' }] });
}
function homeMenu() {
  modal({ title: S.house === 'big' ? 'Your big house' : S.house ? 'Your house' : 'Your land', html: `<p>${S.house === 'big' ? 'The biggest house on the street.' : S.house ? 'A cozy small house. Save up for the big one at the Game Shop.' : 'Just land for now. Win games, earn tokens, and buy a house at the Game Shop.'}</p>`, acts: [{ label: 'Back to town' }] });
}

/* ---------------- menu / profile ---------------- */
$('menuBtn').onclick = () => menu();
function menu() {
  const top = lastHouses.slice().sort((a, b) => b.tokens - a.tokens).slice(0, 8);
  modal({ title: signedIn() ? esc(me.name) : 'Playing as a guest', html: `
    <p>Tokens <b>${fmt(S.tokens)}</b> · Strength <b>${Math.floor(S.str)}</b> · Gym <b>${S.gym}</b>${S.house ? ` · ${S.house} house` : ''}</p>
    <p style="margin:0">Shirt colour</p><div class="swatches" id="mSw">${COLORS.map(c => `<button type="button" data-c="${c}" class="${c === S.color ? 'on' : ''}" style="background:${c}" aria-label="Shirt colour"></button>`).join('')}</div>
    ${signedIn() && top.length ? `<p style="margin:0">Top players</p><div class="players">${top.map(p => `<div><span>${esc(p.name)}</span><span>${fmt(p.tokens)}</span></div>`).join('')}</div>` : ''}
    <div class="keys"><kbd>←↑↓→</kbd><span>Walk / move / aim (or the joystick)</span><kbd>Enter</kbd><span>Go into a building</span><kbd>Q</kbd><span>Hit · shoot · kick · lift</span><kbd>W</kbd><span>Run / sprint</span><kbd>E</kbd><span>Pitch</span><kbd>R</kbd><span>Catch (baseball: R then 1–4 throws to a base)</span><kbd>T</kbd><span>Throw · pass</span><kbd>C</kbd><span>Chat</span><kbd>Esc</kbd><span>Leave a game</span></div>`,
    acts: [signedIn() ? { label: 'Sign out', fn: signOut } : { label: 'Sign in / new player', cls: 'gold', fn: showLogin }, { label: 'Close' }] });
  $('mSw').querySelectorAll('button').forEach(b => b.onclick = () => { S.color = b.dataset.c; save(); makePlayer(); refreshTown(); $('mSw').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
}

/* ---------------- login ---------------- */
let newMode = false, newColor = COLORS[0];
$('lSw').innerHTML = COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" aria-label="Shirt colour"></button>`).join('');
$('lSw').querySelectorAll('button').forEach(b => b.onclick = () => { newColor = b.dataset.c; $('lSw').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
$('lSw').firstElementChild.classList.add('on');
function setTab(n) { newMode = n; $('tabIn').classList.toggle('on', !n); $('tabNew').classList.toggle('on', n); $('newBits').classList.toggle('hide', !n); $('lGo').textContent = n ? 'Make my player' : 'Sign in'; $('lErr').textContent = ''; }
if (!ONLINE_OK) { $('loginForm').classList.add('hide'); document.querySelector('#login .tabs').classList.add('hide'); document.querySelector('#login .note').textContent = 'The shared town (sign in, other players and chat) is being switched on. For now, play as a guest — your progress saves on this device.'; }
$('tabIn').onclick = () => setTab(false); $('tabNew').onclick = () => setTab(true);
function showLogin() { $('login').classList.remove('hide'); }
$('guestBtn').onclick = () => { $('login').classList.add('hide'); startTown(); };
$('loginForm').onsubmit = async e => {
  e.preventDefault(); const name = $('lName').value.trim(), pin = $('lPin').value.trim(); $('lErr').textContent = ''; $('lGo').disabled = true;
  try {
    const r = newMode ? await Server.do('signUp', { name, pin, data: { ...S, color: newColor } }) : await Server.do('signIn', { name, pin });
    me = { name: r.name, token: r.token }; S = { ...BLANK(), ...(r.data || {}) }; store.put('session', me); store.put('cache_' + r.name.toLowerCase(), S);
    $('login').classList.add('hide'); $('lPin').value = ''; makePlayer(); startTown(); toast(`Welcome, ${r.name}!`); tick();
  } catch (err) { $('lErr').textContent = err.message || 'Could not reach the server.'; }
  $('lGo').disabled = false;
};
function signOut() { me = { name: '', token: null }; store.del('session'); S = { ...BLANK(), ...store.get('guest', {}) }; lastHouses = []; town.showPeople([], 0); makePlayer(); refreshTown(); renderChat(null); hud(); toast('Signed out — playing as a guest.'); }
function lostSession() { if (!signedIn()) return; signOut(); toast('Please sign in again.'); showLogin(); }

/* ---------------- shared town: presence, houses, chat ---------------- */
let ticking = false;
async function tick() {
  if (!signedIn() || ticking) return; ticking = true;
  const p = player.root.position;
  try {
    const r = await Server.do('tick', { token: me.token, pos: { x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +player.root.rotation.y.toFixed(2), sp: +((player.lastSp || 0) / 3.3).toFixed(2), where: active === 'town' ? 'town' : game ? game.sport : 'town', color: S.color } });
    if (!signedIn()) return;
    town.showPeople(r.others || [], 0); lastHouses = (r.houses || []).map(h => ({ ...h, house: h.house || null }));
    town.setLots(meOwner(), lastHouses); renderChat(r.chat || []);
    $('me').textContent = `${me.name} · ${(r.others || []).length ? (r.others.length + ' other' + (r.others.length > 1 ? 's' : '') + ' online') : 'nobody else online'}`;
  } catch (err) { if (/sign in/i.test(err.message)) lostSession(); }
  finally { ticking = false; }
}
setInterval(tick, 2500);
function renderChat(list) {
  const log = $('chatLog'), inp = $('chatIn');
  if (!signedIn()) { log.innerHTML = '<div style="color:var(--muted)">Sign in to chat with other players.</div>'; inp.disabled = true; inp.placeholder = 'Sign in to chat'; $('me').innerHTML = 'Guest · <a id="meSign">Sign in</a>'; $('meSign').onclick = showLogin; return; }
  inp.disabled = false; inp.placeholder = 'Say something… (C)';
  if (!list.length) { log.innerHTML = '<div style="color:var(--muted)">No messages yet — say hi!</div>'; return; }
  log.replaceChildren(...list.slice().reverse().map(m => { const d = document.createElement('div'), b = document.createElement('b'); b.textContent = String(m.name || '').slice(0, 16) + ':'; b.style.color = COLORS.includes(m.color) ? m.color : '#ffd447'; d.append(b, document.createTextNode(String(m.text || '').slice(0, 140))); return d; }));
}
$('chatForm').onsubmit = async e => { e.preventDefault(); const t = $('chatIn').value.trim(); if (!t || !signedIn()) return; $('chatIn').value = ''; try { renderChat(await Server.do('chat', { token: me.token, text: t })); } catch (err) { toast('Message not sent.'); } };
$('chatIn').addEventListener('keydown', e => { if (e.key === 'Escape') e.target.blur(); });
function openChat() { $('chat').classList.remove('mini'); $('chatToggle').textContent = 'hide'; if (!$('chatIn').disabled) setTimeout(() => $('chatIn').focus(), 0); else if (!signedIn()) showLogin(); }
$('chatToggle').onclick = () => { const c = $('chat'); c.classList.toggle('mini'); $('chatToggle').textContent = c.classList.contains('mini') ? 'show' : 'hide'; };

/* ---------------- loop ---------------- */
const clock = new THREE.Clock();
let started = false;
function startTown() {
  started = true; active = 'town';
  ['stats', 'chat', 'joy', 'acts'].forEach(id => $(id).classList.remove('hide'));
  hud(); refreshTown(); renderChat(null); if (signedIn()) { $('me').textContent = me.name; tick(); }
  E.msg('Walk with the arrow keys or the joystick. Walk up to a gold circle and press <kbd>Enter</kbd> to go in.'); setTimeout(() => { if (active === 'town') E.msg(''); }, 7000);
}
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, clock.getDelta());
  if (!town) return;
  if (active === 'town') {
    if (started) walk(dt); player.update(dt); muscles(player); town.update(dt);
    setActs({ w: 'Run' });
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.render(town.scene, camera);
  } else if (game && view) {
    if (!modalOpen() && !game.over) game.update(dt);
    if (game && view) {
      view.sync(game, dt); setActs(game.labels || {});
      $('bScore').textContent = game.sc ? `You ${game.sc.you} – ${game.sc.cpu} CPU` : `Strength ${Math.floor(S.str)}`; $('bInfo').textContent = game.board ? game.board() : '';
      view.camera.aspect = innerWidth / innerHeight; view.camera.updateProjectionMatrix();
      renderer.render(view.scene, view.camera);
    }
  }
}

/* ---------------- boot ---------------- */
(async function boot() {
  $('loadBar').style.width = '30%';
  await loadCharacter('/mindworks/models/Xbot.glb');
  $('loadBar').style.width = '75%';
  town = new Town(); town.doors.push({ id: 'home', name: 'Your house', x: LOTS[0][0], z: LOTS[0][1] - 7 });
  makePlayer(); refreshTown(); hud();
  cam.target.copy(player.root.position);
  $('loadBar').style.width = '100%';
  loop();
  setTimeout(() => $('loading').classList.add('hide'), 200);
  const sess = store.get('session', null);
  if (sess && sess.token) { me = sess; S = { ...BLANK(), ...store.get('cache_' + sess.name.toLowerCase(), {}) }; makePlayer(); startTown(); }
  else showLogin();
  window.__shoot = { get game() { return game; }, get view() { return view; }, get S() { return S; }, set S(v) { S = v; }, town: () => town, player: () => player, startGame, Baseball, Football, Basketball, Soccer, Training, backToTown, enter };
})();
