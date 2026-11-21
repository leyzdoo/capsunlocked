// The Shoot town: stadiums, the gym, the game shop and a neighbourhood of houses.
import * as THREE from 'three';
import { lights, canvasTex, textSprite, box, colorOf } from './arena.js';
import { makeCharacter } from './character.js';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, ...o });
function add(g, m, x, y, z) { m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; }
function roofPrism(w, h, d, color) { // gable roof along x
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(0, h); s.lineTo(d / 2, 0); s.lineTo(-d / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, M(color)); m.castShadow = true; return m;
}
const ROBOTS = ['Gizmo', 'Bolt', 'Sprocket', 'Widget', 'Nova', 'Cog', 'Rivet', 'Dynamo', 'Pixel', 'Servo', 'Turbo'];
export const LOTS = [[-12, 40], [4, 40], [-28, 40], [20, 40], [-44, 40], [36, 40], [-12, 62], [4, 62], [-28, 62], [20, 62], [-44, 62], [36, 62]];

export class Town {
  constructor() {
    const s = this.scene = new THREE.Scene(); lights(s, 0x9fd4ff, 80);
    this.colliders = []; this.doors = []; this.lots = []; this.people = new Map();
    this.base(); this.venues(); this.trees();
    this.gym = null; this.setGym(1);
    this.robots = ROBOTS.map((name, i) => ({ name, robot: true, house: ['small', 'big', null, 'small', 'big', 'small', null, 'big', 'small', null, 'small'][i], gym: 1 + (i * 3) % 5, tokens: 0 }));
    this.bots = [];
  }
  solid(x1, z1, x2, z2) { this.colliders.push({ x1, z1, x2, z2 }); }
  base() {
    const s = this.scene;
    const tex = canvasTex(1024, 1024, g => {
      g.fillStyle = '#4c9a4a'; g.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${110 + Math.random() * 50},${50 + Math.random() * 30},.35)`; g.fillRect(Math.random() * 1024, Math.random() * 1024, 6, 6); }
      const W = v => 512 + v * 1024 / 160; // world metres → canvas (160 m square)
      g.fillStyle = '#5b5f66';
      g.fillRect(W(-64), W(28), W(64) - W(-64), W(33) - W(28)); g.fillRect(W(-64), W(50), W(64) - W(-64), W(54) - W(50));
      g.fillRect(W(-2.5), W(-24), W(2.5) - W(-2.5), W(54) - W(-24)); g.fillRect(W(-50), W(-24), W(56) - W(-50), W(-19) - W(-24));
      g.fillStyle = '#d8c79a'; g.beginPath(); g.arc(W(0), W(4), W(13) - W(0), 0, 7); g.fill();
      g.strokeStyle = '#f2e6b8'; g.setLineDash([14, 14]); g.lineWidth = 3; [[30.5], [52]].forEach(([z]) => { g.beginPath(); g.moveTo(W(-64), W(z)); g.lineTo(W(64), W(z)); g.stroke(); });
      g.beginPath(); g.moveTo(W(0), W(-24)); g.lineTo(W(0), W(-10)); g.moveTo(W(0), W(18)); g.lineTo(W(0), W(54)); g.stroke();
    });
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: tex, roughness: .95 })); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; s.add(gr);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), M(0x3f8a3f)); far.rotation.x = -Math.PI / 2; far.position.y = -.05; s.add(far);
    // fountain
    const f = new THREE.Group(); add(f, new THREE.Mesh(new THREE.CylinderGeometry(4, 4.3, .8, 32), M(0xc9c2b0)), 0, .4, 0);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, .1, 32), M(0x4fb0ff, { roughness: .15, metalness: .2 })); add(f, water, 0, .82, 0);
    add(f, new THREE.Mesh(new THREE.CylinderGeometry(.4, .6, 2.6, 12), M(0xc9c2b0)), 0, 1.3, 0);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.8, 20, 14), M(0xffd447, { metalness: .6, roughness: .3 })); add(f, ball, 0, 3.2, 0); this.trophy = ball;
    f.position.set(0, 0, 4); s.add(f); this.solid(-4.3, -.3, 4.3, 8.3);
    const sign = textSprite('SHOOT', { size: 64, bg: 'rgba(255,107,61,.95)' }); sign.scale.multiplyScalar(4); sign.position.set(0, 7.5, 4); s.add(sign);
    // boundary fence
    const fm = M(0xe8e2c8); [[-80, 0, .4, 160], [80, 0, .4, 160], [0, -80, 160, .4], [0, 80, 160, .4]].forEach(([x, z, w, d]) => { s.add(box(w, 1.1, d, 0xe8e2c8, x, 0, z)); });
    this.solid(-81, -81, -79, 81); this.solid(79, -81, 81, 81); this.solid(-81, -81, 81, -79); this.solid(-81, 79, 81, 81);
    // lamp posts
    for (const [x, z] of [[-8, 26], [8, 26], [-30, 26], [30, 26], [-8, -16], [8, -16], [-40, 48], [40, 48]]) { s.add(box(.18, 4.2, .18, 0x30363c, x, 0, z)); const l = new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 8), M(0xfff3b0, { emissive: 0xfff3b0, emissiveIntensity: .8 })); l.position.set(x, 4.4, z); s.add(l); }
  }
  label(text, x, y, z, k = 2.6, bg = 'rgba(11,34,20,.88)') { const t = textSprite(text, { size: 48, bg }); t.scale.multiplyScalar(k); t.position.set(x, y, z); this.scene.add(t); return t; }
  door(id, name, x, z) { this.doors.push({ id, name, x, z }); const mat = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.4, 32), new THREE.MeshBasicMaterial({ color: 0xffd447, transparent: true, opacity: .85, depthWrite: false })); mat.rotation.x = -Math.PI / 2; mat.position.set(x, .06, z); this.scene.add(mat); }
  venues() {
    const s = this.scene;
    // --- Baseball stadium (open bowl you can see into)
    { const cx = -36, cz = -44, g = new THREE.Group();
      const field = canvasTex(512, 512, c => { c.fillStyle = '#3f9a45'; c.fillRect(0, 0, 512, 512); c.fillStyle = '#c48a52'; c.beginPath(); c.moveTo(256, 380); c.lineTo(350, 290); c.lineTo(256, 200); c.lineTo(162, 290); c.closePath(); c.fill(); c.fillStyle = '#3f9a45'; c.beginPath(); c.moveTo(256, 350); c.lineTo(318, 290); c.lineTo(256, 232); c.lineTo(194, 290); c.closePath(); c.fill(); c.fillStyle = '#fff'; [[256, 380], [350, 290], [256, 200], [162, 290]].forEach(([x, y]) => c.fillRect(x - 5, y - 5, 10, 10)); });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(13, 40), new THREE.MeshStandardMaterial({ map: field })); disc.rotation.x = -Math.PI / 2; disc.position.y = .05; g.add(disc);
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 16, 5, 40, 1, true, .55, Math.PI * 2 - 1.1), M(0x7d8792, { side: THREE.DoubleSide })); wall.position.y = 2.5; wall.castShadow = true; g.add(wall);
      for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(15.2 + i * .9, 15.2 + i * .9, .5, 40, 1, true, .55, Math.PI * 2 - 1.1), M(i % 2 ? 0xff6b3d : 0x3a6fd8, { side: THREE.DoubleSide })); t.position.y = 1.4 + i * 1.3; g.add(t); }
      g.position.set(cx, 0, cz); g.rotation.y = 0; s.add(g);
      this.solid(cx - 16, cz - 16, cx - 4, cz + 13); this.solid(cx + 4, cz - 16, cx + 16, cz + 13); this.solid(cx - 16, cz - 16, cx + 16, cz - 10);
      this.label('BASEBALL', cx, 8, cz + 12); this.door('base', 'Baseball Stadium', cx, cz + 16.5); }
    // --- Football stadium
    { const cx = 10, cz = -46, g = new THREE.Group();
      const ft = canvasTex(512, 256, c => { c.fillStyle = '#3f9a45'; c.fillRect(0, 0, 512, 256); c.strokeStyle = '#fff'; c.lineWidth = 3; for (let i = 0; i <= 10; i++) { c.beginPath(); c.moveTo(46 + i * 42, 10); c.lineTo(46 + i * 42, 246); c.stroke(); } c.fillStyle = '#b8432f'; c.fillRect(0, 10, 46, 236); c.fillStyle = '#ff6b3d'; c.fillRect(466, 10, 46, 236); });
      const field = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshStandardMaterial({ map: ft })); field.rotation.x = -Math.PI / 2; field.position.y = .05; g.add(field);
      g.add(box(34, 4, 2, 0x7d8792, 0, 0, -9)); g.add(box(2, 4, 18, 0x7d8792, -17, 0, 0)); g.add(box(2, 4, 18, 0x7d8792, 17, 0, 0));
      g.add(box(12, 4, 2, 0x7d8792, -11, 0, 9)); g.add(box(12, 4, 2, 0x7d8792, 11, 0, 9));
      [-15, 15].forEach(x => { g.add(box(.2, 4, .2, 0xffd447, x, 0, -1.5)); g.add(box(.2, 4, .2, 0xffd447, x, 0, 1.5)); g.add(box(.2, .2, 3, 0xffd447, x, 1.8, 0)); });
      g.position.set(cx, 0, cz); s.add(g);
      this.solid(cx - 18, cz - 10, cx + 18, cz - 8); this.solid(cx - 18, cz - 10, cx - 16, cz + 10); this.solid(cx + 16, cz - 10, cx + 18, cz + 10); this.solid(cx - 17, cz + 8, cx - 5, cz + 10); this.solid(cx + 5, cz + 8, cx + 17, cz + 10);
      this.solid(cx - 16, cz - 8, cx + 16, cz + 8);
      this.label('FOOTBALL', cx, 8, cz + 9); this.door('foot', 'Football Stadium', cx, cz + 12); }
    // --- Basketball arena (round building with a basketball dome)
    { const cx = 46, cz = -30, g = new THREE.Group();
      add(g, new THREE.Mesh(new THREE.CylinderGeometry(9, 9.5, 6, 32), M(0x3a3360)), 0, 3, 0);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M(0xe06a1c)); add(g, dome, 0, 6, 0);
      const seam = new THREE.Mesh(new THREE.TorusGeometry(9.02, .12, 6, 48, Math.PI), M(0x2a1a10)); seam.rotation.y = Math.PI / 2; add(g, seam, 0, 6, 0);
      const seam2 = seam.clone(); seam2.rotation.y = 0; add(g, seam2, 0, 6, 0);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1), M(0x1b1838)), 0, 2, 9.1);
      g.position.set(cx, 0, cz); s.add(g); this.solid(cx - 9.5, cz - 9.5, cx + 9.5, cz + 9.5);
      this.label('BASKETBALL', cx, 16, cz); this.door('bask', 'Basketball Arena', cx, cz + 11.5); }
    // --- Soccer field (locked until you buy it)
    { const cx = 40, cz = 14, g = new THREE.Group();
      const st = canvasTex(512, 320, c => { c.fillStyle = '#469f4b'; c.fillRect(0, 0, 512, 320); c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(10, 10, 492, 300); c.beginPath(); c.moveTo(256, 10); c.lineTo(256, 310); c.stroke(); c.beginPath(); c.arc(256, 160, 40, 0, 7); c.stroke(); c.strokeRect(10, 90, 60, 140); c.strokeRect(442, 90, 60, 140); });
      const f = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), new THREE.MeshStandardMaterial({ map: st })); f.rotation.x = -Math.PI / 2; f.position.y = .05; g.add(f);
      [-12.6, 12.6].forEach(x => { g.add(box(.15, 2.2, .15, 0xffffff, x, 0, -2)); g.add(box(.15, 2.2, .15, 0xffffff, x, 0, 2)); g.add(box(.15, .15, 4, 0xffffff, x, 2.1, 0)); });
      g.position.set(cx, 0, cz); s.add(g);
      this.lock = new THREE.Group(); const fence = M(0x8a96a3, { transparent: true, opacity: .6 });
      [[0, -8.5, 28, .2], [0, 8.5, 28, .2], [14, 0, .2, 17]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, d), fence); m.position.set(cx + x, 1.2, cz + z); this.lock.add(m); });
      const gate = new THREE.Mesh(new THREE.BoxGeometry(.2, 2.4, 17), fence); gate.position.set(cx - 14, 1.2, cz); this.lock.add(gate); s.add(this.lock);
      this.lockLabel = this.label('SOCCER · locked', cx, 5, cz); this.solid(cx - 14, cz - 8.6, cx + 14, cz + 8.6);
      this.door('soc', 'Soccer Field', cx - 16, cz); }
    // --- Game Shop
    { const cx = -38, cz = 14, g = new THREE.Group();
      add(g, new THREE.Mesh(new THREE.BoxGeometry(12, 5, 9), M(0x2f6fd6)), 0, 2.5, 0);
      for (let i = 0; i < 8; i++) { const a = new THREE.Mesh(new THREE.BoxGeometry(.4, .12, 1.6), M(i % 2 ? 0xffffff : 0xe74c3c)); a.rotation.z = -.35; add(g, a, 6.6, 3.6, -3.5 + i); }
      add(g, new THREE.Mesh(new THREE.BoxGeometry(.2, 2.6, 2), M(0x1a3d7a)), 6.05, 1.3, 0);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(.1, 1.6, 2.4), M(0x8fd3ff, { emissive: 0x204060 })), 6.05, 2, -3);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(.1, 1.6, 2.4), M(0x8fd3ff, { emissive: 0x204060 })), 6.05, 2, 3);
      g.position.set(cx, 0, cz); s.add(g); this.solid(cx - 6, cz - 4.5, cx + 6, cz + 4.5);
      this.label('GAME SHOP', cx, 7, cz); this.door('shop', 'Game Shop', cx + 8, cz); }
  }
  setGym(level) {
    if (this.gymLevel === level) return; this.gymLevel = level;
    if (this.gym) { this.scene.remove(this.gym); this.gym.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.colliders = this.colliders.filter(c => !c.gym); this.doors = this.doors.filter(d => d.id !== 'gym'); }
    const cx = -40, cz = -12, w = 8 + level * 2, d = 7 + level * 1.4, h = 4 + level * .9, g = new THREE.Group();
    add(g, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(0xb4442f)), 0, h / 2, 0);
    add(g, new THREE.Mesh(new THREE.BoxGeometry(w + .8, .6, d + .8), M(level >= 5 ? 0xd4a63a : 0x5a2219, level >= 5 ? { metalness: .6, roughness: .35 } : {})), 0, h + .3, 0);
    [-1, 1].forEach(sg => add(g, new THREE.Mesh(new THREE.BoxGeometry(.1, 1.2, 1.6), M(0xffe9a8, { emissive: 0x806020 })), w / 2 + .02, h * .55, sg * (d / 2 - 1.6)));
    add(g, new THREE.Mesh(new THREE.BoxGeometry(.2, 2.6, 2.2), M(0x3b170f)), w / 2 + .05, 1.3, 0);
    const dumb = new THREE.Group(); add(dumb, new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, 3, 10), M(0x22282e)), 0, 0, 0); [-1.5, 1.5].forEach(y => add(dumb, new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, .4, 16), M(0x22282e)), 0, y, 0)); dumb.rotation.x = Math.PI / 2; dumb.position.set(0, h + 1.6, 0); g.add(dumb);
    for (let i = 0; i < level; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(.45), M(0xffd447, { emissive: 0x806000 })); add(g, st, w / 2 + .3, h - .7, -((level - 1) * .6) + i * 1.2); }
    g.position.set(cx, 0, cz); this.scene.add(g); this.gym = g;
    this.colliders.push({ x1: cx - w / 2, z1: cz - d / 2, x2: cx + w / 2, z2: cz + d / 2, gym: 1 });
    this.doors.push({ id: 'gym', name: `Gym · level ${level}`, x: cx + w / 2 + 2.2, z: cz });
    if (this.gymTag) this.scene.remove(this.gymTag); this.gymTag = this.label(`GYM · LV ${level}`, cx, h + 4.2, cz);
  }
  setSoccer(owned) { this.lock.visible = !owned; this.scene.remove(this.lockLabel); this.lockLabel = this.label(owned ? 'SOCCER' : 'SOCCER · locked', 40, 5, 14); }
  trees() {
    const trunk = new THREE.CylinderGeometry(.25, .35, 2, 8), crown = new THREE.ConeGeometry(1.8, 4.2, 9), tm = M(0x6b4423), cm = M(0x2e7d32);
    const spots = []; for (let i = 0; i < 70; i++) { const a = i / 70 * Math.PI * 2, r = 72 + (i % 3) * 2.5; spots.push([Math.cos(a) * r, Math.sin(a) * r]); }
    [[-58, -20], [-60, 0], [62, 0], [60, -10], [-20, -24], [28, -18], [-56, 30], [58, 30], [-20, 20], [20, 22]].forEach(p => spots.push(p));
    const T = new THREE.InstancedMesh(trunk, tm, spots.length), C = new THREE.InstancedMesh(crown, cm, spots.length), m4 = new THREE.Matrix4();
    spots.forEach(([x, z], i) => { const s = .8 + ((i * 37) % 10) / 20; m4.compose(new THREE.Vector3(x, s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); T.setMatrixAt(i, m4); m4.compose(new THREE.Vector3(x, 2 * s + 2 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); C.setMatrixAt(i, m4); });
    T.castShadow = C.castShadow = true; this.scene.add(T, C);
    spots.forEach(([x, z]) => { if (Math.hypot(x, z) < 70) this.solid(x - .5, z - .5, x + .5, z + .5); });
  }
  /* ---------- the neighbourhood ---------- */
  house(owner) {
    const g = new THREE.Group(), tier = owner.house, col = colorOf(owner.color || (owner.robot ? '#9aa3ad' : '#ff6b3d'));
    if (!tier) {
      add(g, new THREE.Mesh(new THREE.BoxGeometry(11, .1, 11), M(0x9b7246)), 0, .05, 0);
      for (let i = 0; i < 12; i++) add(g, new THREE.Mesh(new THREE.BoxGeometry(.15, .8, .15), M(0xe7d3a8)), -5.5 + (i % 6) * 2.2, .4, i < 6 ? -5.5 : 5.5);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, .1), M(0xe7d3a8)), 0, 1.3, 4.6); add(g, new THREE.Mesh(new THREE.BoxGeometry(.12, 1.3, .12), M(0x7a5634)), 0, .65, 4.6);
    } else if (tier === 'small') {
      add(g, new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 6), M(0xf1e3c2)), 0, 1.7, 0);
      const r = roofPrism(7.6, 2.4, 6.8, 0xb4442f); r.position.set(0, 3.4, 0); g.add(r);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, .1), M(col)), 0, 1.05, 3.02);
      [-2.2, 2.2].forEach(x => add(g, new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, .1), M(0x8fd3ff, { emissive: 0x203040 })), x, 2, 3.02));
      add(g, new THREE.Mesh(new THREE.BoxGeometry(.7, 1.6, .7), M(0x7a4a3a)), 2.2, 4.4, -1);
    } else {
      add(g, new THREE.Mesh(new THREE.BoxGeometry(10, 6.4, 8), M(0xe8eef2)), 0, 3.2, 0);
      const r = roofPrism(10.8, 3, 8.8, 0x34495e); r.position.set(0, 6.4, 0); g.add(r);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(4, 3, 6), M(0xd6dde2)), 6.8, 1.5, .8);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, .1), M(0x9aa3ad)), 6.8, 1.2, 3.82);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, .1), M(col)), 0, 1.2, 4.02);
      for (let row = 0; row < 2; row++) for (let c = 0; c < 4; c++) if (!(row === 0 && (c === 1 || c === 2))) add(g, new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, .1), M(0x8fd3ff, { emissive: 0x203040 })), -3.6 + c * 2.4, 2 + row * 2.6, 4.02);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(14, .1, 2), M(0xcfc6ae)), 2, .05, 6);
    }
    return g;
  }
  setLots(me, players) {
    const owners = [me];
    for (const p of players) { if (owners.length >= LOTS.length) break; if (p.name.toLowerCase() !== (me.name || '').toLowerCase()) owners.push(p); }
    let ri = 0; while (owners.length < LOTS.length) owners.push(this.robots[ri++ % this.robots.length]);
    owners.forEach((o, i) => {
      const sig = [o.name, o.house, o.color, o.robot ? 1 : 0, i === 0 ? 'me' : ''].join('|'), lot = this.lots[i];
      if (lot && lot.sig === sig) return;
      if (lot) { this.scene.remove(lot.g); this.scene.remove(lot.tag); }
      const [x, z] = LOTS[i], g = this.house(o); g.position.set(x, 0, z); g.rotation.y = Math.PI; this.scene.add(g);
      const name = i === 0 ? (me.name ? `${me.name} (you)` : 'Your land') : o.robot ? `${o.name} · robot` : o.name;
      const tag = textSprite(name, { size: 40, bg: i === 0 ? 'rgba(255,107,61,.95)' : o.robot ? 'rgba(60,68,80,.9)' : 'rgba(58,111,216,.95)' }); tag.scale.multiplyScalar(2); tag.position.set(x, o.house === 'big' ? 10.5 : o.house ? 7.5 : 3, z); this.scene.add(tag);
      this.lots[i] = { sig, g, tag, owner: o, x, z };
    });
    this.colliders = this.colliders.filter(c => !c.lot);
    this.lots.forEach(l => { if (l.owner.house === 'big') this.colliders.push({ x1: l.x - 5, z1: l.z - 4, x2: l.x + 9, z2: l.z + 4, lot: 1 }); else if (l.owner.house) this.colliders.push({ x1: l.x - 3.5, z1: l.z - 3, x2: l.x + 3.5, z2: l.z + 3, lot: 1 }); });
    // robots that live here walk around town
    const robotsHere = this.lots.filter(l => l.owner.robot);
    robotsHere.forEach(l => { if (!this.bots.find(b => b.name === l.owner.name)) this.addBot(l.owner.name, l.x, l.z + 7); });
    this.bots = this.bots.filter(b => { const keep = robotsHere.some(l => l.owner.name === b.name); if (!keep) this.scene.remove(b.ch.root); return keep; });
  }
  addBot(name, x, z) {
    const ch = makeCharacter('robot'); ch.root.position.set(x, 0, z); this.scene.add(ch.root);
    const t = textSprite(`${name} · robot`, { size: 30, bg: 'rgba(60,68,80,.85)' }); t.position.y = 2.2; ch.root.add(t);
    this.bots.push({ name, ch, home: { x, z }, goal: null, wait: Math.random() * 3 });
  }
  /* other real players, from the server */
  showPeople(list, dt) {
    const seen = new Set();
    for (const p of list) {
      const key = p.name.toLowerCase(); seen.add(key);
      let o = this.people.get(key);
      if (!o) { const ch = makeCharacter('player', colorOf(p.color)); const tag = textSprite(p.name, { size: 32, bg: 'rgba(58,111,216,.92)' }); tag.position.y = 2.25; ch.root.add(tag); ch.root.position.set(p.x, 0, p.z); this.scene.add(ch.root); o = { ch, tag, p }; this.people.set(key, o); }
      o.p = p; o.ch.root.visible = p.where === 'town';
    }
    for (const [k, o] of this.people) if (!seen.has(k)) { this.scene.remove(o.ch.root); this.people.delete(k); }
  }
  update(dt, t) {
    this.trophy.rotation.y += dt;
    for (const [, o] of this.people) {
      const r = o.ch.root, dx = o.p.x - r.position.x, dz = o.p.z - r.position.z, d = Math.hypot(dx, dz);
      if (d > 25) r.position.set(o.p.x, 0, o.p.z); else { const k = Math.min(1, dt * 4); r.position.x += dx * k; r.position.z += dz * k; }
      let dr = (o.p.yaw || 0) - r.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); r.rotation.y += dr * Math.min(1, dt * 8);
      o.ch.speedBlend(d > .15 ? Math.min(2, (o.p.sp || 1)) : 0); o.ch.update(dt);
    }
    const spots = [[0, 14], [-36, -27], [10, -32], [46, -17], [-28, 14], [-30, -12], [0, 30], [24, 30]];
    for (const b of this.bots) {
      const r = b.ch.root;
      if (b.wait > 0) { b.wait -= dt; b.ch.speedBlend(0); b.ch.update(dt); continue; }
      if (!b.goal) { const s = Math.random() < .3 ? [b.home.x, b.home.z] : spots[Math.floor(Math.random() * spots.length)]; b.goal = { x: s[0] + (Math.random() - .5) * 4, z: s[1] + (Math.random() - .5) * 4 }; }
      const dx = b.goal.x - r.position.x, dz = b.goal.z - r.position.z, d = Math.hypot(dx, dz);
      if (d < .4) { b.goal = null; b.wait = 2 + Math.random() * 5; continue; }
      const sp = 1.6; r.position.x += dx / d * sp * dt; r.position.z += dz / d * sp * dt;
      const p = r.position; collidePush(p, .35, this.colliders);
      let dr = Math.atan2(dx, dz) - r.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); r.rotation.y += dr * Math.min(1, dt * 6);
      b.ch.speedBlend(.5); b.ch.update(dt);
      b.stuck = (b.stuck || 0) + dt; if (b.stuck > 25) { b.stuck = 0; b.goal = null; }
    }
  }
}
export function collidePush(p, r, boxes) {
  for (const b of boxes) {
    if (p.x + r < b.x1 || p.x - r > b.x2 || p.z + r < b.z1 || p.z - r > b.z2) continue;
    const l = p.x + r - b.x1, rr = b.x2 - (p.x - r), t = p.z + r - b.z1, bb = b.z2 - (p.z - r), m = Math.min(l, rr, t, bb);
    if (m === l) p.x = b.x1 - r; else if (m === rr) p.x = b.x2 + r; else if (m === t) p.z = b.z1 - r; else p.z = b.z2 + r;
  }
}
