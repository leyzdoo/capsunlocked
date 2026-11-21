// 3D stadiums for each sport. Each view reads the game's field-map positions and places
// characters, the ball and the camera in a real 3D scene.
import * as THREE from 'three';
import { makeCharacter } from './character.js';
import { HOME, MOUND, BASES, FX, HOOP, GL, D } from './sports.js';

const YOU = 0xff6b3d, MATE = 0xffa36b, CPU = 0x3a6fd8;
export const colorOf = c => typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;

/* ---------- shared bits ---------- */
export function lights(scene, sky = 0x9fd4ff, size = 60) {
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 80, 260);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a6b3a, 1.15));
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.1); sun.position.set(30, 60, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const c = sun.shadow.camera; c.left = c.bottom = -size; c.right = c.top = size; c.near = 1; c.far = 220; sun.shadow.bias = -.0004;
  scene.add(sun, sun.target); return sun;
}
export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; const g = cv.getContext('2d'); g.scale(2, 2); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export function textSprite(text, { size = 34, color = '#fff', bg = 'rgba(11,34,20,.82)', scale = 1 } = {}) {
  const g0 = document.createElement('canvas').getContext('2d'); g0.font = `700 ${size}px Fredoka, Nunito, sans-serif`;
  const w = Math.ceil(g0.measureText(text).width) + size, h = Math.ceil(size * 1.5);
  const tex = canvasTex(w, h, g => { g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, h, h / 2); g.fill(); g.font = `700 ${size}px Fredoka, Nunito, sans-serif`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.scale.set(w / h * .42 * scale, .42 * scale, 1); s.renderOrder = 10; return s;
}
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, ...o });
export function box(w, h, d, c, x = 0, y = 0, z = 0, o) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o)); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; return m; }
function cyl(r, h, c, x, y, z, seg = 12) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat(c)); m.position.set(x, y + h / 2, z); m.castShadow = true; return m; }
function ground(scene, w, d, tex, x = 0, z = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex || null, color: tex ? 0xffffff : 0x2f7d36, roughness: .95 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z); m.receiveShadow = true; scene.add(m); return m; }
function stands(scene, x, z, w, rows, rotY, color = 0x6b7480) {
  const g = new THREE.Group();
  for (let i = 0; i < rows; i++) g.add(box(w, .6 + i * .7, 1.2, i % 2 ? color : 0x7d8792, 0, 0, i * 1.2));
  // crowd dots
  const crowd = new THREE.InstancedMesh(new THREE.SphereGeometry(.28, 8, 6), new THREE.MeshStandardMaterial({ roughness: .9 }), Math.floor(w / 1.1) * rows);
  let n = 0; const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < rows; i++) for (let j = 0; j < Math.floor(w / 1.1); j++) { if (Math.random() < .25) continue; m4.makeTranslation(-w / 2 + .55 + j * 1.1, .6 + i * .7 + .45, i * 1.2); crowd.setMatrixAt(n, m4); crowd.setColorAt(n, col.setHSL(Math.random(), .6, .55)); n++; }
  crowd.count = n; g.add(crowd); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g); return g;
}
function lightPole(scene, x, z) { scene.add(cyl(.2, 16, 0x9aa3ad, x, 0, z, 8)); scene.add(box(3, 1.2, .4, 0xf5f2d0, x, 16, z, { emissive: 0xfff3b0, emissiveIntensity: .6 })); }

/** a pool of characters reused frame to frame */
class Pool {
  constructor(scene) { this.scene = scene; this.m = new Map(); this.used = new Set(); }
  get(key, look, color, tag) {
    let c = this.m.get(key);
    if (!c) {
      c = makeCharacter(look, color); this.scene.add(c.root); this.m.set(key, c);
      if (tag) { const s = textSprite(tag, { size: 30 }); s.position.y = 2.2; c.root.add(s); }
    }
    this.used.add(key); c.root.visible = true; return c;
  }
  frame(dt) { for (const [k, c] of this.m) { if (!this.used.has(k)) c.root.visible = false; else c.update(dt); } this.used.clear(); }
}
function place(c, X, Z, dt, faceYaw, Y = 0) {
  const r = c.root, dx = X - r.position.x, dz = Z - r.position.z, d = Math.hypot(dx, dz), sp = dt > 0 ? d / dt : 0;
  r.position.set(X, Y, Z);
  let want = null;
  if (d > .004 && sp < 25) want = Math.atan2(dx, dz); else if (faceYaw != null) want = faceYaw;
  if (want != null) { let dr = want - r.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); r.rotation.y += dr * Math.min(1, dt * 10); }
  c.speedBlend(sp < 25 ? Math.min(sp, 9) / 3.3 : 0);
}
const faceTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz);
function ringMesh(color = 0xffd447, r = .55) { const m = new THREE.Mesh(new THREE.RingGeometry(r, r + .12, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .05; return m; }
function ballMesh(r, color = 0xffffff) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color, { roughness: .5 })); m.castShadow = true; return m; }

class View {
  constructor(sky, shadowSize) { this.scene = new THREE.Scene(); this.sun = lights(this.scene, sky, shadowSize); this.camera = new THREE.PerspectiveCamera(55, 1, .1, 400); this.pool = new Pool(this.scene); this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); this.first = true; }
  aim(pos, look, dt, k = 4) {
    if (this.first) { this.camPos.copy(pos); this.camLook.copy(look); this.first = false; }
    this.camPos.lerp(pos, Math.min(1, dt * k)); this.camLook.lerp(look, Math.min(1, dt * k * 1.4));
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
  }
  dispose() { this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } }); }
}

/* ================= BASEBALL ================= */
const BS = .145, bX = x => (x - 480) * BS, bZ = y => (y - 560) * BS;
export class BaseballView extends View {
  constructor(me) {
    super(0x8fcaf5, 90); this.me = me;
    const tex = canvasTex(960, 640, g => {
      g.fillStyle = '#2f7d36'; g.fillRect(0, 0, 960, 640);
      g.fillStyle = '#3f9a45'; g.beginPath(); g.moveTo(HOME.x, HOME.y); g.arc(HOME.x, HOME.y, 520, -Math.PI / 2 - .785, -Math.PI / 2 + .785); g.closePath(); g.fill();
      g.fillStyle = '#46a34c'; for (let r = 80; r < 520; r += 80) { g.beginPath(); g.arc(HOME.x, HOME.y, r + 40, -Math.PI / 2 - .785, -Math.PI / 2 + .785); g.arc(HOME.x, HOME.y, r, -Math.PI / 2 + .785, -Math.PI / 2 - .785, true); g.fill(); }
      g.fillStyle = '#c48a52'; g.beginPath(); g.moveTo(480, 250); g.lineTo(665, 428); g.lineTo(480, 610); g.lineTo(295, 428); g.closePath(); g.fill();
      g.fillStyle = '#3f9a45'; g.beginPath(); g.moveTo(480, 338); g.lineTo(578, 428); g.lineTo(480, 520); g.lineTo(382, 428); g.closePath(); g.fill();
      g.fillStyle = '#c48a52'; g.beginPath(); g.arc(MOUND.x, MOUND.y, 18, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(HOME.x, HOME.y); g.lineTo(HOME.x + 390, HOME.y - 390); g.moveTo(HOME.x, HOME.y); g.lineTo(HOME.x - 390, HOME.y - 390); g.stroke();
      g.strokeRect(452, 544, 18, 26); g.strokeRect(490, 544, 18, 26);
    });
    ground(this.scene, 960 * BS, 640 * BS, tex, 0, bZ(320));
    ground(this.scene, 400, 400, null, 0, -40).position.y = -.02;
    // outfield wall + stands
    for (let a = -.8; a <= .8; a += .05) { const x = Math.sin(a) * 520 * BS, z = -Math.cos(a) * 520 * BS; const w = box(4, 3, .6, 0x1f5a2a, x, 0, z); w.rotation.y = -a; this.scene.add(w); }
    for (let a = -.75; a <= .75; a += .25) { const r = 520 * BS + 4; stands(this.scene, Math.sin(a) * r, -Math.cos(a) * r, 19, 7, Math.PI - a); }
    stands(this.scene, -26, 14, 30, 6, Math.PI * .78); stands(this.scene, 26, 14, 30, 6, -Math.PI * .78);
    this.scene.add(box(18, 4, .4, 0x2b3138, 0, 0, 9));
    [-60, 60].forEach(x => lightPole(this.scene, x, -40)); lightPole(this.scene, -30, 12); lightPole(this.scene, 30, 12);
    BASES.forEach((p, i) => { if (i) this.scene.add(box(.45, .1, .45, 0xffffff, bX(p.x), 0, bZ(p.y))); });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .05, 5), mat(0xffffff)); plate.position.set(0, .03, 0); this.scene.add(plate);
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, .25, 24), mat(0xc48a52)); mound.position.set(bX(MOUND.x), .1, bZ(MOUND.y)); mound.receiveShadow = true; this.scene.add(mound);
    this.ball = ballMesh(.16); this.scene.add(this.ball);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(.22, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .35, depthWrite: false })); this.shadow.rotation.x = -Math.PI / 2; this.scene.add(this.shadow);
    this.bat = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(.035, .06, .95, 10), mat(0x8a5a2b)); b.rotation.z = Math.PI / 2; b.position.x = .47; this.bat.add(b); this.scene.add(this.bat);
    this.ctrlRing = ringMesh(); this.scene.add(this.ctrlRing);
    this.aimRing = ringMesh(0xffd447, .14); this.aimRing.rotation.x = 0; this.scene.add(this.aimRing);
    this.zone = new THREE.Mesh(new THREE.PlaneGeometry(.55, .7), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .14, depthWrite: false })); this.zone.position.set(0, .95, -.1); this.scene.add(this.zone);
    this.landRing = ringMesh(0xffffff, .5); this.scene.add(this.landRing);
  }
  sync(g, dt) {
    const youDef = g.half === 'cpu', defC = youDef ? this.me : CPU, offC = youDef ? CPU : this.me;
    const toHome = (x, y) => faceTo(bX(x), bZ(y), 0, 0);
    g.fld.forEach(f => place(this.pool.get('f' + f.n + (youDef ? 'u' : 'c'), youDef ? 'player' : 'bot', defC), bX(f.x), bZ(f.y), dt, toHome(f.x, f.y)));
    g.runners.forEach((r, i) => { r.key = r.key || 'r' + Math.random().toString(36).slice(2, 7); place(this.pool.get(r.key + (youDef ? 'c' : 'u'), youDef ? 'bot' : 'player', offC), bX(r.x), bZ(r.y), dt, r.moving ? faceTo(bX(r.x), bZ(r.y), bX(BASES[r.target % 4].x), bZ(BASES[r.target % 4].y)) : null); });
    const batting = g.mode === 'ready' || g.mode === 'pitch';
    this.bat.visible = batting;
    if (batting) {
      const bc = this.pool.get('batter' + (youDef ? 'c' : 'u'), youDef ? 'bot' : 'player', offC); place(bc, -.75, .1, dt, Math.PI / 2);
      const sw = g.swingT > 0 ? 1 - g.swingT / .25 : 0; this.bat.position.set(-.55, 1.15, .05); this.bat.rotation.set(0, Math.PI * .75 - sw * Math.PI * 1.25, .35 - sw * .3);
    }
    this.pool.frame(dt);
    const b = g.ball, by = .25 + b.z * BS * .7;
    this.ball.visible = b.state !== 'dead'; this.ball.position.set(bX(b.x), by, bZ(b.y)); this.shadow.position.set(bX(b.x), .04, bZ(b.y)); this.shadow.visible = this.ball.visible;
    if (g.mode === 'pitch') this.ball.position.y = .95 + Math.sin(Math.min(1, g.pt) * Math.PI) * .5;
    this.ctrlRing.visible = !!(youDef && g.ctrl && g.mode === 'play'); if (this.ctrlRing.visible) this.ctrlRing.position.set(bX(g.ctrl.x), .05, bZ(g.ctrl.y));
    this.aimRing.visible = youDef && g.mode === 'ready'; this.aimRing.position.set(g.aimX * BS, .95, .05);
    this.zone.visible = batting;
    const land = youDef && g.mode === 'play' && b.state === 'air'; this.landRing.visible = land; if (land) { const l = g.landing(); this.landRing.position.set(bX(l.x), .05, bZ(l.y)); }
    // camera
    const V = THREE.Vector3;
    if (batting && !youDef) this.aim(new V(.5, 2.4, 5.6), new V(0, 1.2, -14), dt, 6);
    else if (batting) this.aim(new V(0, 3, bZ(MOUND.y) - 6.5), new V(0, .9, 0), dt, 6);
    else {
      const f = g.ctrl || null, tx = f ? (bX(b.x) + bX(f.x)) / 2 : bX(b.x), tz = f ? (bZ(b.y) + bZ(f.y)) / 2 : bZ(b.y);
      this.aim(new V(tx, 20, tz + 22), new V(tx, 0, tz - 4), dt, 3);
    }
  }
}

/* ================= FOOTBALL ================= */
const FS = .109, fX = x => (x - 480) * FS, fZ = y => (y - 330) * FS;
export class FootballView extends View {
  constructor(me) {
    super(0x8fcaf5, 70); this.me = me;
    const tex = canvasTex(960, 600, g => {
      g.fillStyle = '#2f7d36'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#3f9a45' : '#469f4b'; g.fillRect(FX(i * 10), 90, 84, 482); }
      g.fillStyle = '#b8432f'; g.fillRect(0, 90, 60, 482); g.fillStyle = '#ff6b3d'; g.fillRect(900, 90, 60, 482);
      g.strokeStyle = '#ffffffcc'; g.lineWidth = 2; for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(FX(i * 10), 90); g.lineTo(FX(i * 10), 572); g.stroke(); }
      g.fillStyle = '#fff'; g.fillRect(0, 88, 960, 3); g.fillRect(0, 571, 960, 3);
      g.font = 'bold 18px Arial'; g.textAlign = 'center'; for (let i = 1; i < 10; i++) { const n = i <= 5 ? i * 10 : 100 - i * 10; g.fillText(n, FX(i * 10), 130); g.fillText(n, FX(i * 10), 545); }
      g.save(); g.translate(930, 330); g.rotate(Math.PI / 2); g.font = 'bold 30px Arial'; g.fillText('SHOOT', 0, 10); g.restore();
    });
    ground(this.scene, 960 * FS, 600 * FS, tex); ground(this.scene, 300, 300, null).position.y = -.02;
    stands(this.scene, 0, -36, 100, 9, Math.PI); stands(this.scene, 0, 36, 100, 9, 0);
    [-50, 50].forEach(x => [-34, 34].forEach(z => lightPole(this.scene, x, z)));
    [950, 10].forEach(px => { const x = fX(px), y = '#ffd447'; this.scene.add(cyl(.12, 3, 0xffd447, x, 0, 0, 8)); this.scene.add(box(.15, .15, 6.6, 0xffd447, x, 3, 0)); this.scene.add(cyl(.08, 7, 0xffd447, x, 3, -3.3, 8)); this.scene.add(cyl(.08, 7, 0xffd447, x, 3, 3.3, 8)); });
    this.los = box(.25, .02, 52, 0x3d8bff); this.fd = box(.25, .02, 52, 0xffd447); this.scene.add(this.los, this.fd);
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(.15, 14, 10), mat(0x7a3e14)); this.ball.scale.set(1, 1, 1.6); this.ball.castShadow = true; this.scene.add(this.ball);
    this.ctrlRing = ringMesh(); this.openRing = ringMesh(0xffd447, .7); this.scene.add(this.ctrlRing, this.openRing);
    this.aimLine = new THREE.Mesh(new THREE.BoxGeometry(14, .04, .08), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8 })); this.scene.add(this.aimLine);
  }
  sync(g, dt) {
    const V = THREE.Vector3; let ctrl = null;
    if (g.pos === 'Kicker') {
      if (g.kx == null) { this.pool.frame(dt); this.aim(new V(-10, 6, 0), new V(20, 0, 0), dt); return; }
      const kc = this.pool.get('kicker', 'player', this.me); place(kc, fX(g.kx) - .7, fZ(g.ky), dt, Math.PI / 2);
      ['h1', 'h2'].forEach((k, i) => place(this.pool.get(k, 'player', MATE), fX(g.kx) + .4, fZ(g.ky) + (i ? 1.2 : -1.2), dt, Math.PI / 2));
      this.pool.frame(dt);
      const f = g.fly; if (f) this.ball.position.set(fX(f.x), .2 + f.z * FS, fZ(f.y)); else this.ball.position.set(fX(g.kx), .2, fZ(g.ky));
      const ang = Math.atan2(330 - g.ky, 950 - g.kx) + g.aim; this.aimLine.visible = g.mode === 'aim';
      this.aimLine.position.set(fX(g.kx) + Math.cos(ang) * 7, .06, fZ(g.ky) + Math.sin(ang) * 7); this.aimLine.rotation.y = -ang;
      this.aimLine.material.color.setHSL(.13 - g.pow * .13, 1, .55);
      this.los.visible = this.fd.visible = this.ctrlRing.visible = this.openRing.visible = false;
      const bx = f ? Math.max(fX(g.kx), fX(f.x) - 8) : fX(g.kx);
      this.aim(new V(bx - 7, 3.2, fZ(g.ky) * .6), new V(fX(950), 2.5, 0), dt, 3); return;
    }
    this.aimLine.visible = false;
    if (!g.off) { this.pool.frame(dt); this.aim(new V(-20, 8, 0), new V(0, 0, 0), dt); return; }
    ctrl = g.ctrl();
    for (const k in g.off) { const p = g.off[k], mine = p === ctrl; place(this.pool.get('o' + k, 'player', mine ? this.me : MATE), fX(p.x), fZ(p.y), dt, Math.PI / 2); }
    g.def.forEach((d, i) => place(this.pool.get('d' + i, 'bot', CPU), fX(d.x), fZ(d.y), dt, -Math.PI / 2));
    this.pool.frame(dt);
    this.los.visible = this.fd.visible = true; this.los.position.x = fX(FX(g.los)); this.fd.position.x = fX(FX(Math.min(100, g.first)));
    this.ctrlRing.visible = true; this.ctrlRing.position.set(fX(ctrl.x), .05, fZ(ctrl.y));
    const showOpen = g.me === 'QB' && !g.thrown && g.mode === 'live'; this.openRing.visible = showOpen; if (showOpen) { const o = g.openest(); this.openRing.position.set(fX(o.x), .05, fZ(o.y)); }
    const bf = g.ballF;
    if (bf) { const prog = 1 - D(bf, { x: bf.tx, y: bf.ty }) / Math.max(bf.dist + 20, 1); this.ball.position.set(fX(bf.x), 1.6 + Math.sin(Math.max(0, Math.min(1, prog)) * Math.PI) * 3, fZ(bf.y)); this.ball.rotation.y = Math.PI / 2; }
    else if (g.carrier) this.ball.position.set(fX(g.carrier.x) + .25, 1.05, fZ(g.carrier.y) + .2);
    this.aim(new V(fX(ctrl.x) - 9, 5.5, fZ(ctrl.y) * .85), new V(fX(ctrl.x) + 7, .6, fZ(ctrl.y)), dt, 3.5);
  }
}

/* ================= BASKETBALL ================= */
const KS = .025, kX = x => (x - 600) * KS, kZ = y => (y - 300) * KS, RIM = 3.05;
export class BasketballView extends View {
  constructor(me) {
    super(0x2a2440, 30); this.me = me; this.scene.fog = null;
    this.scene.add(new THREE.AmbientLight(0xffffff, .5));
    const tex = canvasTex(960, 600, g => {
      g.fillStyle = '#4a3a2e'; g.fillRect(0, 0, 960, 600);
      g.fillStyle = '#d9a066'; g.fillRect(290, 50, 650, 500); g.fillStyle = '#cf955a'; for (let y = 50; y < 550; y += 14) g.fillRect(290, y, 650, 7);
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(290, 50, 650, 500); g.beginPath(); g.arc(HOOP.x, HOOP.y, 250, Math.PI * .5, Math.PI * 1.5); g.stroke();
      g.fillStyle = '#c0392bcc'; g.fillRect(720, 220, 220, 160); g.strokeRect(720, 220, 220, 160); g.beginPath(); g.arc(720, 300, 60, Math.PI * .5, Math.PI * 1.5); g.stroke();
      g.beginPath(); g.arc(290, 300, 60, -Math.PI / 2, Math.PI / 2); g.stroke();
      g.font = 'bold 40px Arial'; g.fillStyle = '#ffffff88'; g.textAlign = 'center'; g.fillText('SHOOT', 480, 140);
    });
    ground(this.scene, 960 * KS, 600 * KS, tex);
    const wallM = 0x3a3360; this.scene.add(box(30, 8, .3, wallM, 0, 0, -7.9), box(30, 8, .3, wallM, 0, 0, 7.9), box(.3, 8, 16, wallM, 9.6, 0, 0), box(.3, 8, 16, wallM, -9.6, 0, 0));
    stands(this.scene, 0, -6.6, 22, 4, Math.PI); stands(this.scene, 0, 6.6, 22, 4, 0);
    const hx = kX(HOOP.x); this.scene.add(cyl(.12, RIM + .6, 0x777777, kX(935), 0, 0, 10));
    this.scene.add(box(.08, 1.05, 1.8, 0xffffff, hx + .78, RIM - .15, 0, { transparent: true, opacity: .85 }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.23, .025, 8, 24), mat(0xff5a1f)); rim.rotation.x = Math.PI / 2; rim.position.set(hx, RIM, 0); this.scene.add(rim);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(.23, .15, .45, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })); net.position.set(hx, RIM - .23, 0); this.scene.add(net);
    const spot = new THREE.PointLight(0xfff4dd, 60, 30); spot.position.set(0, 7, 0); this.scene.add(spot);
    this.ball = ballMesh(.12, 0xe06a1c); this.scene.add(this.ball); this.ring = ringMesh(0xffd447, .45); this.scene.add(this.ring);
  }
  sync(g, dt) {
    const V = THREE.Vector3;
    if (!g.me) { this.pool.frame(dt); this.aim(new V(-8, 3.5, 0), new V(4, 1, 0), dt); return; }
    const hx = kX(HOOP.x), toHoop = (x, y) => faceTo(kX(x), kZ(y), hx, 0);
    const meC = this.pool.get('me', 'player', this.me); place(meC, kX(g.me.x), kZ(g.me.y), dt, toHoop(g.me.x, g.me.y));
    g.mates.forEach((m, i) => place(this.pool.get('m' + i, 'player', MATE), kX(m.x), kZ(m.y), dt, toHoop(m.x, m.y)));
    g.def.forEach((d, i) => place(this.pool.get('d' + i, 'bot', CPU), kX(d.x), kZ(d.y), dt, faceTo(kX(d.x), kZ(d.y), kX(g.me.x), kZ(g.me.y))));
    this.pool.frame(dt);
    this.ring.position.set(kX(g.me.x), .05, kZ(g.me.y));
    const bounce = Math.abs(Math.sin(performance.now() / 160)) * .7;
    if (g.has === 'me') this.ball.position.set(kX(g.me.x) + .3, .2 + bounce, kZ(g.me.y) + .2);
    else if (typeof g.has === 'number') { const m = g.mates[g.has]; this.ball.position.set(kX(m.x) + .3, 1.1, kZ(m.y)); }
    else if (g.ballF) this.ball.position.set(kX(g.ballF.x), 1.2, kZ(g.ballF.y));
    else if (g.shot) { const s = g.shot, t = Math.min(1, s.t), sx = kX(s.x), sz = kZ(s.y), ex = s.ok ? hx : hx - .5, ez = s.ok ? 0 : .4; this.ball.position.set(sx + (ex - sx) * t, 2 + (RIM + .1 - 2) * t + Math.sin(t * Math.PI) * 2.2 - (t >= 1 ? Math.min(2.8, (s.t - 1) * 6) : 0), sz + (ez - sz) * t); }
    const mx = kX(g.me.x), mz = kZ(g.me.y);
    this.aim(new V(mx - 5.5, 3.6, mz * .7), new V(mx + 4, 1, mz * .8), dt, 4);
  }
}

/* ================= SOCCER ================= */
const SS = .0203, sX = x => (x - 480) * SS, sY = y => (GL.y2 - y) / 180 * 2.44, SPOT = 11;
export class SoccerView extends View {
  constructor(me) {
    super(0x8fcaf5, 30); this.me = me;
    const tex = canvasTex(800, 800, g => {
      for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#3f9a45' : '#469f4b'; g.fillRect(0, i * 80, 800, 80); }
      g.strokeStyle = '#fff'; g.lineWidth = 3; const m = 800 / 50; // 50 m square, goal line at z=0 → canvas y 100
      g.beginPath(); g.moveTo(0, 100); g.lineTo(800, 100); g.stroke();
      g.strokeRect(400 - 20.16 * m, 100, 40.32 * m, 16.5 * m); g.strokeRect(400 - 9.16 * m, 100, 18.32 * m, 5.5 * m);
      g.beginPath(); g.arc(400, 100 + 11 * m, 4, 0, 7); g.fillStyle = '#fff'; g.fill();
      g.beginPath(); g.arc(400, 100 + 11 * m, 9.15 * m, .64, Math.PI - .64); g.stroke();
    });
    ground(this.scene, 50, 50, tex, 0, 18.75);
    const W = 3.66, H = 2.44, post = 0xffffff;
    this.scene.add(cyl(.06, H, post, -W, 0, 0, 10), cyl(.06, H, post, W, 0, 0, 10)); const bar = box(2 * W + .12, .12, .12, post, 0, H - .06, 0); this.scene.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(2 * W, H, 2, 16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .35 })); net.position.set(0, H / 2, -1); this.scene.add(net);
    stands(this.scene, 0, -9, 40, 8, Math.PI); stands(this.scene, -22, 14, 30, 6, Math.PI / 2); stands(this.scene, 22, 14, 30, 6, -Math.PI / 2);
    this.ball = ballMesh(.13); this.scene.add(this.ball);
    this.cross = new THREE.Mesh(new THREE.RingGeometry(.22, .3, 28), new THREE.MeshBasicMaterial({ color: 0xffd447, side: THREE.DoubleSide })); this.scene.add(this.cross);
  }
  sync(g, dt) {
    const V = THREE.Vector3, k = g.kp || { x: 480 };
    const keeper = this.pool.get(g.mine ? 'gkCPU' : 'gkYou', g.mine ? 'bot' : 'player', g.mine ? CPU : this.me);
    place(keeper, sX(k.x), .3, dt, 0);
    let tilt = 0; if (!g.mine && k.dive > 0) tilt = -(k.dir || 1) * 1.1; if (g.mine && g.shot && g.shot.t > .18) tilt = Math.sign(g.shot.tx - 480) * -1.0 * Math.min(1, (g.shot.t - .18) * 5);
    keeper.root.rotation.z += (tilt - keeper.root.rotation.z) * Math.min(1, dt * 12);
    const kicker = this.pool.get(g.mine ? 'kYou' : 'kCPU', g.mine ? 'player' : 'bot', g.mine ? this.me : CPU);
    const runT = !g.mine && g.mode === 'runup' ? Math.max(0, Math.min(1, 1 - g.timer / 1.2)) : 1;
    place(kicker, -.6, SPOT + 1.2 + (1 - runT) * 3, dt, Math.PI);
    this.pool.frame(dt);
    const s = g.shot;
    if (s) {
      const t = Math.min(1.25, s.t / s.dur), ex = sX(s.tx), ey = Math.max(.13, sY(s.ty));
      let x = ex * t, y = .13 + (ey - .13) * t + Math.sin(Math.min(1, t) * Math.PI) * .4, z = SPOT - SPOT * t;
      if (g.mode === 'done' && s.goal === false && Math.abs(sX(k.x) - ex) < 1.6 && t >= 1) { x = sX(k.x); y = 1; z = .6; }
      this.ball.position.set(x, y, z);
    } else this.ball.position.set(0, .13, SPOT);
    this.cross.visible = g.mine && g.mode === 'aim'; if (g.cross) this.cross.position.set(sX(g.cross.x), sY(g.cross.y), .05);
    if (g.mine) this.aim(new V(0, 1.9, SPOT + 6.5), new V(0, 1.3, 0), dt, 5);
    else this.aim(new V(sX(k.x) * .4, 2.1, -4.2), new V(0, .9, SPOT), dt, 5);
  }
}

/* ================= GYM ================= */
export class GymView extends View {
  constructor(me, level) {
    super(0x3a2a26, 15); this.me = me; this.scene.fog = null;
    ground(this.scene, 30, 30, null).material.color.set(0x2f3a44);
    this.scene.add(box(20, 7, .3, 0x6b3428, 0, 0, -6), box(.3, 7, 14, 0x5a2a20, -8, 0, 0), box(.3, 7, 14, 0x5a2a20, 8, 0, 0));
    this.scene.add(box(8, 3, .1, 0x9fb8c8, 0, 1, -5.8, { metalness: .9, roughness: .1 }));
    for (let i = 0; i < level * 2; i++) this.scene.add(box(.5, 1.2, .5, 0x8a96a3, -6.5 + i * 1.4, 0, -4.5));
    const banner = textSprite(`Gym level ${level}`, { size: 40, bg: 'rgba(255,107,61,.95)' }); banner.position.set(0, 5.5, -5.5); banner.scale.multiplyScalar(2.5); this.scene.add(banner);
    this.bar = new THREE.Group(); this.bar.add(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 2.2, 8), mat(0xcfd6dc, { metalness: .8, roughness: .3 })));
    [-.95, .95].forEach(y => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .1, 20), mat(0x22282e)); p.position.y = y; this.bar.add(p); });
    this.bar.rotation.z = Math.PI / 2; this.scene.add(this.bar);
    const pl = new THREE.PointLight(0xfff0d0, 40, 20); pl.position.set(0, 5, 2); this.scene.add(pl);
  }
  sync(g, dt) {
    const c = this.pool.get('me', 'player', this.me); place(c, 0, 0, dt, 0); this.pool.frame(dt);
    this.bar.position.set(0, .95 + g.lift * 1.1, .35);
    this.aim(new THREE.Vector3(0, 2, 5.5), new THREE.Vector3(0, 1.3, 0), dt, 6);
  }
}

export function viewFor(game, me, gymLevel) {
  return { baseball: BaseballView, football: FootballView, basketball: BasketballView, soccer: SoccerView }[game.sport]
    ? new ({ baseball: BaseballView, football: FootballView, basketball: BasketballView, soccer: SoccerView }[game.sport])(me)
    : new GymView(me, gymLevel);
}
