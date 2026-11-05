// Building interiors: a lit room shell plus furniture pieces.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mat } from '../tex.js';
import { G } from '../game.js';

export const std = (color, rough = .7, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
export function box(w, h, d, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; }
let envTex = null;
export function env() { if (!envTex) { const p = new THREE.PMREMGenerator(G.renderer); envTex = p.fromScene(new RoomEnvironment(), .04).texture; } return envTex; }

/** room shell centred on the origin; floor at y=0, door in the middle of the +z wall */
export function makeRoom({ ceiling = true, w = 16, d = 14, h = 4.2, floor = ['wood', ['#a0703f', 6, 7]], floorTile = 2.4, wall = '#ece6da', wallTex = null, trim = '#f6f2ea', light = 0xfff1dc, lamps = 4, doorColor = 0x5a3a24, windows = true } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0d1c);
  scene.environment = env();
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(floor[0], floor[1], w / floorTile, d / floorTile, { roughness: .55, bump: .5 }));
  fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  const wm = wallTex ? mat(wallTex[0], wallTex[1], w / 3, h / 3, { roughness: .9, bump: .6 }) : mat('plaster', [wall, 9], w / 3, h / 3, { roughness: .92 });
  const walls = [
    [w, h, .3, 0, h / 2, -d / 2 - .15], [w, h, .3, 0, h / 2, d / 2 + .15],
    [.3, h, d, -w / 2 - .15, h / 2, 0], [.3, h, d, w / 2 + .15, h / 2, 0]
  ];
  walls.forEach(a => { const m = box(a[0], a[1], a[2], wm, a[3], a[4], a[5]); m.castShadow = false; scene.add(m); });
  if (ceiling) { const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(0xf4f1ea, .95)); ceil.rotation.x = Math.PI / 2; ceil.position.y = h; scene.add(ceil); }
  // baseboards + crown
  const tm = std(trim, .6);
  [[w, -d / 2 + .02, 0], [w, d / 2 - .02, 0]].forEach(([len, z]) => { scene.add(box(len, .14, .04, tm, 0, .07, z)); scene.add(box(len, .12, .06, tm, 0, h - .06, z)); });
  [[-w / 2 + .02], [w / 2 - .02]].forEach(([x]) => { scene.add(box(.04, .14, d, tm, x, .07, 0)); scene.add(box(.06, .12, d, tm, x, h - .06, 0)); });
  // door back to the street (on the +z wall)
  scene.add(box(1.6, 2.6, .08, std(doorColor, .5), 0, 1.3, d / 2 - .05));
  scene.add(box(1.9, 2.8, .05, tm, 0, 1.4, d / 2 - .02));
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(.7, .25), new THREE.MeshBasicMaterial({ color: 0x2bd46a })); exitSign.position.set(0, 3.0, d / 2 - .06); exitSign.rotation.y = Math.PI; scene.add(exitSign);
  // daylight windows on the side walls
  if (windows) [-1, 1].forEach(s => { for (let i = 0; i < Math.floor(d / 5); i++) {
    const z = -d / 2 + 2.5 + i * 5;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.9), new THREE.MeshBasicMaterial({ color: 0xcfe6ff })); glow.position.set(s * (w / 2 - .02), 2.1, z); glow.rotation.y = -s * Math.PI / 2; scene.add(glow);
    scene.add(box(.08, 2.1, 1.8, tm, s * (w / 2 - .01), 2.1, z)); scene.add(box(.06, 1.9, .05, tm, s * (w / 2 - .06), 2.1, z)); scene.add(box(.25, .08, 1.9, tm, s * (w / 2 - .1), 1.1, z));
  } });
  // lights
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x3a3228, .55));
  const key = new THREE.DirectionalLight(0xfff3e0, 1.1); key.position.set(w * .3, h * 2.5, d * .4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); const c = key.shadow.camera; c.left = -w / 2 - 2; c.right = w / 2 + 2; c.top = d / 2 + 2; c.bottom = -d / 2 - 2; c.far = 60; key.shadow.bias = -.0005; key.shadow.normalBias = .02;
  scene.add(key);
  const cols = Math.max(1, Math.round(Math.sqrt(lamps * w / d))), rows = Math.max(1, Math.ceil(lamps / cols));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = -w / 2 + w * (i + .5) / cols, z = -d / 2 + d * (j + .5) / rows;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, .05, 1.2), new THREE.MeshBasicMaterial({ color: 0xfffaf0 })); panel.position.set(x, h - .03, z); scene.add(panel);
    const pl = new THREE.PointLight(light, 6, Math.max(w, d) * .8, 1.6); pl.position.set(x, h - .4, z); scene.add(pl);
  }
  const colliders = [
    { x1: -w / 2 - 1, x2: w / 2 + 1, z1: -d / 2 - 1, z2: -d / 2 }, { x1: -w / 2 - 1, x2: w / 2 + 1, z1: d / 2, z2: d / 2 + 1 },
    { x1: -w / 2 - 1, x2: -w / 2, z1: -d / 2, z2: d / 2 }, { x1: w / 2, x2: w / 2 + 1, z1: -d / 2, z2: d / 2 }
  ];
  return { scene, colliders, w, d, h, door: new THREE.Vector3(0, 0, d / 2 - 1) };
}

/* ---- furniture ---- */
export function sofa(color = 0x56606e, len = 2.4) {
  const g = new THREE.Group(), m = std(color, .95), leg = std(0x2a1f17, .6);
  g.add(box(len, .45, .95, m, 0, .38, 0)); g.add(box(len, .75, .25, m, 0, .78, -.36));
  [-1, 1].forEach(s => g.add(box(.25, .62, .95, m, s * (len / 2 - .12), .58, 0)));
  for (let i = 0; i < 3; i++) g.add(box(len / 3 - .06, .16, .7, std(new THREE.Color(color).offsetHSL(0, 0, .05), .95), -len / 3 + i * len / 3, .68, .06));
  [-1, 1].forEach(s => [-1, 1].forEach(t => g.add(box(.06, .16, .06, leg, s * (len / 2 - .15), .08, t * .38))));
  return g;
}
export function table(w = 1.4, d = .8, h = .45, wood = '#6b4a30') {
  const g = new THREE.Group(), m = mat('wood', [wood, 4, 44], 1, 1, { roughness: .45 });
  g.add(box(w, .06, d, m, 0, h, 0));
  [-1, 1].forEach(s => [-1, 1].forEach(t => g.add(box(.06, h, .06, m, s * (w / 2 - .08), h / 2, t * (d / 2 - .08)))));
  return g;
}
export function rug(w, d, color = '#7a3b3b') { const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat('carpet', [color, 12], 2, 2, { roughness: 1 })); r.rotation.x = -Math.PI / 2; r.position.y = .01; r.receiveShadow = true; return r; }
export function plant(s = 1) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.22 * s, .17 * s, .42 * s, 16), std(0xb4653f, .8)); pot.position.y = .21 * s; pot.castShadow = true; g.add(pot);
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.16 * s, 8, 6), std([0x2f6b2a, 0x3d7d33, 0x4a8a3a][i % 3], .8)); l.scale.set(1, 2.2, .5); l.position.set(Math.sin(i * 2.4) * .18 * s, (.65 + (i % 3) * .18) * s, Math.cos(i * 2.4) * .18 * s); l.rotation.set(Math.sin(i) * .6, i, Math.cos(i) * .6); l.castShadow = true; g.add(l); }
  return g;
}
export function lamp() {
  const g = new THREE.Group(); g.add(box(.3, .04, .3, std(0x222222, .4, .7), 0, .02, 0));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.5, 8), std(0x222222, .4, .7)); pole.position.y = .77; g.add(pole);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.18, .26, .3, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xf6e9cf, emissive: 0xffd9a0, emissiveIntensity: .7, side: THREE.DoubleSide })); shade.position.y = 1.55; g.add(shade);
  const pl = new THREE.PointLight(0xffc98a, 2.5, 5, 2); pl.position.y = 1.45; g.add(pl); return g;
}
export function shelf(w = 2, h = 2.2, books = true) {
  const g = new THREE.Group(), m = mat('wood', ['#5a3c26', 3, 45], 1, 1, { roughness: .5 });
  g.add(box(w, h, .05, m, 0, h / 2, -.17)); [-1, 1].forEach(s => g.add(box(.05, h, .4, m, s * w / 2, h / 2, 0)));
  for (let i = 0; i <= 4; i++) g.add(box(w, .04, .4, m, 0, .05 + i * (h - .1) / 4, 0));
  if (books) { const cs = [0x8b2b2b, 0x2b4a7a, 0x2f6b4a, 0xc9a64a, 0x4a2b6b, 0xd9d2c2]; for (let i = 0; i < 4; i++) { let x = -w / 2 + .08; while (x < w / 2 - .15) { const bw = .05 + Math.random() * .05, bh = .25 + Math.random() * .12; g.add(box(bw, bh, .26, std(cs[Math.floor(Math.random() * cs.length)], .8), x + bw / 2, .07 + i * (h - .1) / 4 + bh / 2, .02)); x += bw + .01; } } }
  return g;
}
export function painting(w, h, canvas) {
  const g = new THREE.Group(); g.add(box(w + .14, h + .14, .05, std(0xb08a3a, .4, .8), 0, 0, 0));
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: .7 })); p.position.z = .03; g.add(p); return g;
}
export function chandelier(s = 1) {
  const g = new THREE.Group(), gold = std(0xd4af37, .25, 1);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .8, 6), gold); chain.position.y = .4; g.add(chain);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.6 * s, .04, 8, 32), gold); ring.rotation.x = Math.PI / 2; g.add(ring);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c8 })); b.position.set(Math.cos(a) * .6 * s, .1, Math.sin(a) * .6 * s); g.add(b);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(.05), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0, metalness: .2, transparent: true, opacity: .8 })); c.position.set(Math.cos(a) * .6 * s, -.12 - k * .1, Math.sin(a) * .6 * s); g.add(c); } }
  const pl = new THREE.PointLight(0xffe2b0, 8, 12, 1.6); pl.position.y = -.2; g.add(pl);
  return g;
}
export function staircase(width = 2.4, steps = 14, rise = .22, run = .3, m) {
  const g = new THREE.Group(); m = m || std(0xece6da, .6);
  for (let i = 0; i < steps; i++) g.add(box(width, rise * (i + 1), run, m, 0, rise * (i + 1) / 2, -i * run));
  const rail = std(0x3a2416, .5);
  [-1, 1].forEach(s => { const r = box(.06, .06, steps * run * 1.2, rail, s * width / 2, rise * steps / 2 + 1, -steps * run / 2 + .1); r.rotation.x = Math.atan2(rise, run); g.add(r);
    for (let i = 0; i < steps; i += 2) g.add(box(.04, 1, .04, rail, s * width / 2, rise * (i + 1) + .5, -i * run)); });
  return g;
}
export function at(o, x, y, z) { o.position.set(x, y, z); return o; }
