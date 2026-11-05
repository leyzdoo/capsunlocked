// Chess — a giant board on the floor of the hall. Tap or drag your pieces; the robot plays across from you.
import * as THREE from 'three';
import { G, save, toast, modal, levelComplete, levelFailed, setHelp } from '../game.js';
import { ChessEngine as E, rng } from '../logic.js';
import { makeRoom, box, std, chandelier, at } from './common.js';
import { mat } from '../tex.js';

export const CHESS_SETS = {
  classic: { name: 'Classic', price: 0, w: '#f3ead8', b: '#2a2420', light: '#e9dcc0', dark: '#8a5e3c' },
  ocean: { name: 'Ocean', price: 20, w: '#e6f7fb', b: '#0d4a6e', light: '#cdeef7', dark: '#3a8fb7' },
  forest: { name: 'Forest', price: 35, w: '#f1f7e6', b: '#244a1c', light: '#dfeccf', dark: '#6f9a4f' },
  gold: { name: 'Royal Gold', price: 60, w: '#f2d27a', b: '#5a1030', light: '#f7e7c2', dark: '#a36b2c' },
  neon: { name: 'Neon', price: 90, w: '#9ffcff', b: '#ff4fd8', light: '#2c2a5e', dark: '#1a1840' }
};
const SQ = 1.5;
const sqPos = i => new THREE.Vector3(((i & 7) - 3.5) * SQ, 0, ((i >> 3) - 3.5) * SQ);

/* ---------- 3D pieces (turned on a lathe, like real Staunton pieces) ---------- */
const PROFILES = {
  P: [[0, 0], [.5, 0], [.5, .1], [.42, .14], [.38, .22], [.24, .3], [.16, .55], [.27, .6], [.27, .64], [.14, .68], [0, .68]],
  R: [[0, 0], [.55, 0], [.55, .1], [.46, .15], [.42, .24], [.32, .3], [.28, .85], [.4, .9], [.4, 1.05], [.3, 1.05], [.3, .98], [0, .98]],
  B: [[0, 0], [.5, 0], [.5, .1], [.42, .15], [.38, .24], [.24, .32], [.16, .8], [.28, .85], [.28, .89], [.14, .93], [0, .93]],
  Q: [[0, 0], [.55, 0], [.55, .1], [.46, .16], [.42, .26], [.26, .34], [.17, 1.0], [.3, 1.06], [.3, 1.1], [.2, 1.14], [.26, 1.3], [.3, 1.38], [0, 1.38]],
  K: [[0, 0], [.56, 0], [.56, .1], [.47, .16], [.43, .26], [.27, .34], [.18, 1.08], [.31, 1.14], [.31, 1.18], [.21, 1.22], [.27, 1.4], [.24, 1.46], [0, 1.5]],
  N: [[0, 0], [.52, 0], [.52, .1], [.44, .15], [.4, .24], [.3, .32], [0, .32]]
};
const geoCache = {};
function lathe(k) { return geoCache[k] || (geoCache[k] = new THREE.LatheGeometry(PROFILES[k].map(p => new THREE.Vector2(p[0], p[1])), 40)); }
let knightHead = null;
function knightGeo() {
  if (knightHead) return knightHead;
  const s = new THREE.Shape();
  [[-.28, .3], [.26, .3], [.22, .6], [.3, .82], [.46, .98], [.44, 1.1], [.2, 1.18], [.1, 1.32], [.02, 1.2], [-.16, 1.1], [-.28, .82], [-.32, .52]].forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));
  s.closePath();
  knightHead = new THREE.ExtrudeGeometry(s, { depth: .28, bevelEnabled: true, bevelSize: .05, bevelThickness: .06, bevelSegments: 4, curveSegments: 6 });
  knightHead.translate(0, 0, -.14); return knightHead;
}
function pieceMesh(p, mats) {
  const white = p === p.toUpperCase(), t = p.toUpperCase(), m = white ? mats.w : mats.b, g = new THREE.Group();
  const add = (geo, y = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.scale.set(sx, sy, sz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(lathe(t));
  if (t === 'P') add(new THREE.SphereGeometry(.2, 24, 16), .84);
  if (t === 'R') for (let i = 0; i < 4; i++) { const b = add(new THREE.BoxGeometry(.16, .14, .14), 1.11); const a = i * Math.PI / 2; b.position.x = Math.cos(a) * .33; b.position.z = Math.sin(a) * .33; b.rotation.y = -a; }
  if (t === 'B') { add(new THREE.SphereGeometry(.21, 24, 16), 1.12, 1, 1.45, 1); add(new THREE.SphereGeometry(.07, 12, 10), 1.47); }
  if (t === 'Q') { for (let i = 0; i < 8; i++) { const b = add(new THREE.SphereGeometry(.065, 10, 8), 1.4); const a = i * Math.PI / 4; b.position.x = Math.cos(a) * .27; b.position.z = Math.sin(a) * .27; } add(new THREE.SphereGeometry(.11, 14, 10), 1.48); }
  if (t === 'K') { add(new THREE.BoxGeometry(.08, .32, .08), 1.66); add(new THREE.BoxGeometry(.26, .08, .08), 1.7); }
  if (t === 'N') { const h = add(knightGeo(), 0); h.rotation.y = white ? Math.PI / 2 : -Math.PI / 2; }
  g.userData.p = p; return g;
}

function robotPlan(level) {
  if (level <= 1) return { depth: 1, noise: 900, ms: 300 };
  if (level <= 3) return { depth: 1, noise: 450, ms: 300 };
  if (level <= 6) return { depth: 2, noise: 260, ms: 600 };
  if (level <= 10) return { depth: 2, noise: 120, ms: 800 };
  if (level <= 15) return { depth: 3, noise: 60, ms: 1200 };
  if (level <= 20) return { depth: 3, noise: 20, ms: 1500 };
  if (level <= 25) return { depth: 4, noise: 0, ms: 1800 };
  return { depth: 5, noise: 0, ms: 2500 };
}

export async function enter({ level, mode, camera, makeCharacter }) {
  const pvp = mode === 'pvp', set = CHESS_SETS[G.S.data.up.chessSet] || CHESS_SETS.classic;
  const R = makeRoom({ w: 22, d: 22, h: 7, floor: ['tiles', ['#d9d2c4', '#bfb6a6', 6, 121]], floorTile: 5, wall: '#ded6e8', lamps: 6, doorColor: 0x241e45 });
  const S = R.scene; [-1, 1].forEach(s => S.add(at(chandelier(1.3), s * 8, 5.6, 0)));
  const mats = {
    w: new THREE.MeshPhysicalMaterial({ color: set.w, roughness: .28, clearcoat: .8, clearcoatRoughness: .15 }),
    b: new THREE.MeshPhysicalMaterial({ color: set.b, roughness: .28, clearcoat: .8, clearcoatRoughness: .15 })
  };
  // board
  const frame = box(8 * SQ + 1, .16, 8 * SQ + 1, mat('wood', ['#4a2e1a', 6, 122], 4, 4, { roughness: .4 }), 0, .08, 0); S.add(frame);
  const lightM = std(set.light, .35), darkM = std(set.dark, .35);
  for (let i = 0; i < 64; i++) { const p = sqPos(i), sq = box(SQ, .06, SQ, ((i >> 3) + (i & 7)) % 2 ? darkM : lightM, p.x, .19, p.z); sq.castShadow = false; S.add(sq); }
  // file/rank letters on the frame
  // highlights
  const hlG = new THREE.PlaneGeometry(SQ * .98, SQ * .98);
  const HL = { sel: new THREE.MeshBasicMaterial({ color: 0x4be08a, transparent: true, opacity: .55, depthWrite: false }), last: new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: .4, depthWrite: false }), chk: new THREE.MeshBasicMaterial({ color: 0xff3b50, transparent: true, opacity: .6, depthWrite: false }), hint: new THREE.MeshBasicMaterial({ color: 0x4fb0ff, transparent: true, opacity: .55, depthWrite: false }) };
  const hl = []; for (let i = 0; i < 64; i++) { const m = new THREE.Mesh(hlG, HL.sel); m.rotation.x = -Math.PI / 2; const p = sqPos(i); m.position.set(p.x, .225, p.z); m.visible = false; S.add(m); hl.push(m); }
  const dotG = new THREE.CircleGeometry(.24, 24), ringG = new THREE.RingGeometry(.55, .68, 32), dotM = new THREE.MeshBasicMaterial({ color: 0x1a1a2a, transparent: true, opacity: .35, depthWrite: false });
  const dots = []; for (let i = 0; i < 64; i++) { const m = new THREE.Mesh(dotG, dotM); m.rotation.x = -Math.PI / 2; const p = sqPos(i); m.position.set(p.x, .23, p.z); m.visible = false; S.add(m); dots.push(m); }
  // players
  const me = makeCharacter('player', new THREE.Color(G.S.data.color).getHex()); me.root.position.set(4 * SQ + 1.6, 0, 3 * SQ); me.root.rotation.y = -Math.PI / 2 - .5; if (!pvp) S.add(me.root);
  const bot = makeCharacter('robot'); bot.root.position.set(0, 0, -4 * SQ - 1.7); if (!pvp) S.add(bot.root);

  // state
  let pos = E.initial(), sel = -1, last = null, over = false, thinking = false, hint = null, timers = [];
  const meshes = new Array(64).fill(null);
  pos.b.forEach((p, i) => { if (p !== '.') { const m = pieceMesh(p, mats); m.position.copy(sqPos(i)).setY(.22); S.add(m); meshes[i] = m; } });
  const anims = [];
  function animateTo(m, i, lift = .9) { const from = m.position.clone(), to = sqPos(i).setY(.22); anims.push({ m, from, to, t: 0, dur: .38, lift }); }
  function applyVisual(mv, mover) {
    const capSq = mv.ep ? mv.t + (mover === 'w' ? 8 : -8) : mv.t;
    if (meshes[capSq]) { const dead = meshes[capSq]; meshes[capSq] = null; anims.push({ m: dead, die: true, t: 0, dur: .35 }); }
    const m = meshes[mv.f]; meshes[mv.f] = null; meshes[mv.t] = m; animateTo(m, mv.t, mv.cap ? 1.4 : .8);
    if (mv.castle) { const home = mover === 'w' ? 60 : 4, rf = mv.castle === 'K' ? home + 3 : home - 4, rt = mv.castle === 'K' ? home + 1 : home - 1; const rm = meshes[rf]; meshes[rf] = null; meshes[rt] = rm; animateTo(rm, rt, .6); }
    if (mv.promo) timers.push(setTimeout(() => { S.remove(m); const q = pieceMesh(mover === 'w' ? 'Q' : 'q', mats); q.position.copy(sqPos(mv.t)).setY(.22); S.add(q); meshes[mv.t] = q; }, 400));
  }
  function paint() {
    const chk = E.inCheck(pos) ? E.kingSq(pos.b, pos.turn) : -1;
    const legalTo = sel >= 0 ? E.legal(pos).filter(m => m.f === sel) : [];
    for (let i = 0; i < 64; i++) {
      let m = null;
      if (i === chk) m = HL.chk; else if (i === sel) m = HL.sel; else if (hint && (hint.f === i || hint.t === i)) m = HL.hint; else if (last && (last.f === i || last.t === i)) m = HL.last;
      hl[i].visible = !!m; if (m) hl[i].material = m;
      const lm = legalTo.find(x => x.t === i); dots[i].visible = !!lm; dots[i].geometry = lm && (pos.b[i] !== '.' || lm.ep) ? ringG : dotG;
    }
    if (pvp) setHelp((pos.turn === 'w' ? 'White' : 'Black') + ' to move' + (chk >= 0 ? ' — check!' : ''));
    else setHelp(thinking ? '🤖 The robot is thinking…' : over ? '' : 'Your move — tap a white piece, then where it goes' + (chk >= 0 ? ' (you’re in check!)' : ''));
  }
  function doMove(mv) {
    const mover = pos.turn;
    applyVisual(mv, mover);
    if (!pvp && mv.cap) (mover === 'w' ? bot : bot).play(mover === 'w' ? 'headShake' : 'agree');
    pos = E.make(pos, mv); last = mv; sel = -1; hint = null; paint();
    const s = E.status(pos);
    if (s.over) return finish(s);
    if (!pvp && pos.turn === 'b') robotMove();
  }
  function robotMove() {
    thinking = true; paint();
    timers.push(setTimeout(() => {
      const plan = robotPlan(level), res = E.search(pos, plan.depth, plan.ms, plan.noise, rng(Date.now() % 1e9));
      thinking = false; doMove(res.move);
    }, 650));
  }
  function finish(s) {
    over = true; paint();
    timers.push(setTimeout(() => {
      if (pvp) { if (s.result !== 'draw') { G.S.data.wins2p.chess++; save(); }
        modal({ big: s.result === 'draw' ? '🤝' : '👑', title: s.result === 'draw' ? 'Draw' : (s.result === 'w' ? 'White' : 'Black') + ' wins!', text: s.result === 'draw' ? 'A draw by ' + s.why + '.' : 'By ' + s.why + '.', acts: [{ label: 'Play again', cls: 'go', fn: () => G.enterRoom('chess', { mode: 'pvp' }) }, { label: 'Go back outside', cls: 'ghost', fn: () => G.backToTown() }] }); }
      else if (s.result === 'w') { bot.play('sad_pose'); levelComplete('chess', level, 'Checkmate — you beat the robot!'); }
      else if (s.result === 'draw') modal({ big: '🤝', title: 'Draw', text: 'A draw by ' + s.why + '. Win to clear the level.', acts: [{ label: 'Play again', cls: 'go', fn: () => G.enterRoom('chess', { level }) }, { label: 'Go back outside', cls: 'ghost', fn: () => G.backToTown() }] });
      else { bot.play('agree'); levelFailed('chess', level, 'The robot got checkmate this time.'); }
    }, 900));
  }
  function useHint() {
    if (over || thinking || pos.turn !== 'w' || pvp) return; const u = G.S.data.up;
    if (u.chessHints <= 0) { toast('Get hint packs at the Game Store.'); return; }
    u.chessHints--; save(); document.getElementById('chHint').textContent = '💡 Hint (' + u.chessHints + ')';
    hint = E.search(pos, 3, 1200, 0, rng(1)).move; paint();
  }
  // camera framing
  function frameCamera() {
    const a = innerWidth / innerHeight;
    if (pvp) { camera.position.set(0, a < 1 ? 26 : 19, .01); camera.lookAt(0, 0, 0); camera.fov = 50; }
    else { const k = a < 1 ? 1.45 : 1; camera.position.set(0, 10.5 * k, 13.5 * k); camera.lookAt(0, 0, .6); camera.fov = 52; }
    camera.updateProjectionMatrix();
  }
  frameCamera(); let lastAspect = innerWidth / innerHeight;
  // input
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.22), hitP = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function squareAt(e) {
    const rc = G.renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, hitP)) return -1;
    const c = Math.floor(hitP.x / SQ + 4), r = Math.floor(hitP.z / SQ + 4); return c < 0 || c > 7 || r < 0 || r > 7 ? -1 : r * 8 + c;
  }
  const canMove = i => !over && !thinking && pos.b[i] !== '.' && E.colorOf(pos.b[i]) === pos.turn && (pvp || pos.turn === 'w');
  function tryMove(f, t) { const mv = E.legal(pos).find(x => x.f === f && x.t === t); if (!mv) return false; doMove(mv); return true; }
  let drag = null;
  paint();
  return {
    _dbg: () => ({ b: pos.b.join(''), turn: pos.turn, sel, over, thinking }),
    scene: S, camera, title: pvp ? 'Chess · 2 players' : 'Chess · Level ' + level, help: '',
    buttons: (pvp ? [] : [{ label: '💡 Hint (' + G.S.data.up.chessHints + ')', fn: useHint, id: 'chHint' }]).concat([{ label: '↺ Restart', fn: () => modal({ title: 'Start over?', acts: [{ label: 'Yes', cls: 'go', fn: () => G.enterRoom('chess', pvp ? { mode: 'pvp' } : { level }) }, { label: 'Keep playing', cls: 'ghost' }] }) }]),
    pointer: {
      down(e) {
        const i = squareAt(e); if (i < 0) return false;
        if (sel >= 0 && sel !== i && tryMove(sel, i)) return true;
        if (!canMove(i)) { sel = -1; paint(); return true; }
        sel = i; paint(); drag = { from: i, moved: false, m: meshes[i] }; return true;
      },
      move(e) {
        if (!drag || !drag.m) return; drag.moved = true;
        const rc = G.renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
        ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, hitP)) drag.m.position.set(hitP.x, .9, hitP.z);
      },
      up(e) {
        if (!drag) return; const d = drag; drag = null; if (!d.moved) return;
        const i = squareAt(e);
        if (i >= 0 && i !== d.from && tryMove(d.from, i)) return;
        if (d.m) animateTo(d.m, d.from, .3);
      }
    },
    update(dt) {
      if (Math.abs(innerWidth / innerHeight - lastAspect) > .01) { lastAspect = innerWidth / innerHeight; frameCamera(); }
      for (let k = anims.length - 1; k >= 0; k--) {
        const a = anims[k]; a.t += dt; const u = Math.min(1, a.t / a.dur);
        if (a.die) { const s = 1 - u; a.m.scale.setScalar(Math.max(.001, s)); if (u >= 1) { S.remove(a.m); anims.splice(k, 1); } continue; }
        const e2 = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        a.m.position.lerpVectors(a.from, a.to, e2); a.m.position.y = a.to.y + Math.sin(u * Math.PI) * a.lift * .6;
        if (u >= 1) anims.splice(k, 1);
      }
      if (!pvp) { me.speedBlend(0); me.update(dt); bot.speedBlend(0); bot.update(dt); }
    },
    exit() { timers.forEach(clearTimeout); }
  };
}
