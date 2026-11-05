// The Mindworks town: a street lined with real-looking buildings. Each game is a building with a door.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, signTexture, stripes, rng, COLORS } from './tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, rough = .7, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

export const SHARED = {};
function shared() {
  if (SHARED.glass) return SHARED;
  SHARED.glass = new THREE.MeshStandardMaterial({ color: 0x23323f, roughness: .06, metalness: .9, transparent: true, opacity: .78 });
  SHARED.glassDark = new THREE.MeshStandardMaterial({ color: 0x1b2530, roughness: .05, metalness: .95 });
  SHARED.frame = std(0x2c2a28, .45, .6);
  SHARED.trimWhite = std(0xf1eee6, .6);
  SHARED.stone = mat('concrete', ['#c9c1b2', 0, 21], 1, 1, { roughness: .85, bump: .6 });
  SHARED.concreteDark = mat('concrete', ['#8f8c86', 0, 22], 1, 1);
  SHARED.metal = std(0x3a3d42, .4, .8);
  SHARED.black = std(0x151515, .5, .3);
  SHARED.interior = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  return SHARED;
}

function box(w, h, d, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); if (shadow) { m.castShadow = true; m.receiveShadow = true; } return m;
}
function texBox(w, h, d, kind, args, tileW, tileH, x, y, z, opts) {
  const m = mat(kind, args, w / tileW, h / tileH, opts);
  return box(w, h, d, m, x, y, z);
}

/* ---------------- a commercial building (front faces +z in local space) ---------------- */
function shopBuilding(o) {
  const S = shared(), g = new THREE.Group();
  const w = o.w, d = o.d, floors = o.floors, fh = 3.6, h = floors * fh + .6;
  // main mass
  const wall = texBox(w, h, d, o.wall.kind, o.wall.args, o.wall.tile || 1.3, o.wall.tile || 1.3, 0, h / 2, 0, { bump: 1.4 });
  g.add(wall);
  // plinth + cornice + parapet
  g.add(box(w + .12, .55, d + .12, S.stone, 0, .275, 0));
  g.add(box(w + .5, .35, d + .5, S.stone, 0, h + .15, 0));
  g.add(box(w + .3, .5, d + .3, S.stone, 0, h - .3, 0));
  g.add(box(w + .2, .25, d + .2, S.stone, 0, fh + .05, 0)); // belt course between ground floor and upper floors
  const roofTop = box(w - .2, .1, d - .2, S.concreteDark, 0, h + .36, 0); g.add(roofTop);
  // rooftop units
  const r = rng(o.seed || 1);
  for (let i = 0; i < 2; i++) g.add(box(1.6 + r(), 1.1, 1.2 + r(), std(0x9aa0a6, .5, .5), (r() - .5) * (w - 4), h + .9, -d / 4 + (r() - .5) * 3));

  const fz = d / 2;
  // storefront: two big glass bays + door in the middle
  const doorW = 1.8, doorH = 2.7, bayW = (w - doorW - 2.2) / 2, bayH = 2.6;
  [-1, 1].forEach(s => {
    const cx = s * (doorW / 2 + .5 + bayW / 2);
    // warm interior glow behind glass, then glass, then frame
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(bayW, bayH), S.interior.clone()); glow.material.color.set(o.glow || 0xffdcaa);
    glow.position.set(cx, .55 + bayH / 2 + .1, fz - .25); g.add(glow);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(bayW, bayH), S.glass); glass.position.set(cx, .55 + bayH / 2 + .1, fz + .02); g.add(glass);
    g.add(box(bayW + .16, .14, .2, S.frame, cx, .62, fz + .04)); g.add(box(bayW + .16, .14, .2, S.frame, cx, .55 + bayH + .17, fz + .04));
    g.add(box(.12, bayH + .1, .2, S.frame, cx - bayW / 2, .55 + bayH / 2 + .1, fz + .04)); g.add(box(.12, bayH + .1, .2, S.frame, cx + bayW / 2, .55 + bayH / 2 + .1, fz + .04));
    g.add(box(.08, bayH, .16, S.frame, cx, .55 + bayH / 2 + .1, fz + .04));
    // display-window decal (game teaser) inside glass
    if (o.decal) { const dm = new THREE.Mesh(new THREE.PlaneGeometry(bayW * .55, bayW * .55 * .6), new THREE.MeshBasicMaterial({ map: o.decal, transparent: true })); dm.position.set(cx, 1.9, fz - .1); g.add(dm); }
    // awning
    if (o.awning) {
      const aw = new THREE.Mesh(new THREE.BoxGeometry(bayW + .5, .06, 1.3), new THREE.MeshStandardMaterial({ map: stripes(o.awning[0], o.awning[1], 10), roughness: .9 }));
      aw.position.set(cx, .55 + bayH + .55, fz + .62); aw.rotation.x = .32; aw.castShadow = true; g.add(aw);
      const val = new THREE.Mesh(new THREE.BoxGeometry(bayW + .5, .28, .04), new THREE.MeshStandardMaterial({ map: stripes(o.awning[0], o.awning[1], 10) }));
      val.position.set(cx, .55 + bayH + .2, fz + 1.24); g.add(val);
    }
  });
  // door: recessed opening with glass door
  g.add(box(doorW + .5, doorH + .35, .25, S.stone, 0, (doorH + .35) / 2, fz + .05));
  const recess = box(doorW, doorH, .3, std(0x2a2522, .8), 0, doorH / 2 + .02, fz + .08); g.add(recess);
  const door = new THREE.Group();
  const df = o.doorColor ?? 0x1f3b2c;
  door.add(box(doorW - .1, doorH - .1, .08, std(df, .5, .2), 0, 0, 0));
  const dg = new THREE.Mesh(new THREE.PlaneGeometry(doorW - .6, doorH - .9), S.glass); dg.position.set(0, .2, .05); door.add(dg);
  door.add(box(.08, .8, .08, std(0xc9a64a, .3, 1), doorW / 2 - .35, -.05, .1));
  door.position.set(0, doorH / 2, fz + .26); g.add(door);
  // step
  g.add(box(doorW + .8, .14, .7, S.stone, 0, .07, fz + .45));
  // sign over the storefront
  const signW = Math.min(w - 2, 9), signH = 1.1;
  g.add(box(signW + .25, signH + .25, .2, std(o.signBack || 0x1c1c22, .5, .4), 0, fh - .55, fz + .12));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), new THREE.MeshStandardMaterial({ map: signTexture(o.sign, { bg: o.signBg || '#1c1c22', fg: o.signFg || '#ffffff', border: o.signBorder || null }), emissive: 0xffffff, emissiveIntensity: .35, emissiveMap: null, roughness: .5 }));
  sign.material.emissiveMap = sign.material.map;
  sign.position.set(0, fh - .55, fz + .23); g.add(sign);
  // gooseneck lamps over sign
  [-signW / 3, 0, signW / 3].forEach(lx => { g.add(box(.05, .05, .5, S.metal, lx, fh + .1, fz + .4)); g.add(box(.22, .1, .18, S.metal, lx, fh + .05, fz + .65)); });
  // upper floor windows (instanced)
  const cols = Math.max(2, Math.floor((w - 1.4) / 2.6)), span = (w - 1.4) / cols;
  const n = cols * (floors - 1);
  if (n > 0) {
    const winW = 1.25, winH = 1.9;
    const frameI = new THREE.InstancedMesh(new THREE.BoxGeometry(winW + .22, winH + .22, .12), o.trim === 'white' ? S.trimWhite : S.frame, n);
    const glassI = new THREE.InstancedMesh(new THREE.PlaneGeometry(winW, winH), S.glassDark, n);
    const sillI = new THREE.InstancedMesh(new THREE.BoxGeometry(winW + .45, .12, .3), S.stone, n);
    const lintI = new THREE.InstancedMesh(new THREE.BoxGeometry(winW + .45, .26, .14), S.stone, n);
    const muntI = new THREE.InstancedMesh(new THREE.BoxGeometry(.05, winH, .05), S.trimWhite, n);
    const mt = new THREE.Matrix4(); let k = 0;
    for (let f = 1; f < floors; f++) for (let c = 0; c < cols; c++) {
      const x = -w / 2 + .7 + span * (c + .5), y = f * fh + 1.85;
      mt.makeTranslation(x, y, fz + .02); frameI.setMatrixAt(k, mt);
      mt.makeTranslation(x, y, fz + .09); glassI.setMatrixAt(k, mt);
      mt.makeTranslation(x, y - winH / 2 - .14, fz + .12); sillI.setMatrixAt(k, mt);
      mt.makeTranslation(x, y + winH / 2 + .22, fz + .05); lintI.setMatrixAt(k, mt);
      mt.makeTranslation(x, y, fz + .1); muntI.setMatrixAt(k, mt);
      k++;
    }
    [frameI, glassI, sillI, lintI, muntI].forEach(m => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
    // a few lit windows for life
    const litN = Math.floor(n / 3);
    if (litN) { const litI = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.2, 1.85), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: .55 }), litN);
      for (let i = 0; i < litN; i++) { const f = 1 + Math.floor(r() * (floors - 1)), c = Math.floor(r() * cols); mt.makeTranslation(-w / 2 + .7 + span * (c + .5), f * fh + 1.85, fz + .1); litI.setMatrixAt(i, mt); }
      g.add(litI); }
  }
  // level plaque by the door (updated live)
  const pc = document.createElement('canvas'); pc.width = 512; pc.height = 256;
  const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(.9, .45), new THREE.MeshStandardMaterial({ map: ptex, roughness: .4, metalness: .3, emissive: 0xffffff, emissiveMap: ptex, emissiveIntensity: .25 }));
  plaque.position.set(doorW / 2 + .75, 1.55, fz + .07); g.add(plaque);
  g.userData.plaque = { canvas: pc, tex: ptex };
  g.userData.door = V(0, 0, fz + .9);
  return g;
}

/* ---------------- the player's house: 7 levels bought at the Game Store ---------------- */
export const HOUSE_TIERS = [
  { name: 'Cottage', price: 0, w: 8, d: 7, stories: 1, wall: ['siding', '#c9b79a'], roof: ['gable', '#6b4a3a'], porch: 'small', fence: 'picket', blurb: 'A cozy little start.' },
  { name: 'Bungalow', price: 20, w: 11, d: 8, stories: 1, wall: ['siding', '#8fa8b8'], roof: ['gable', '#4a4b52'], porch: 'wide', fence: 'picket', blurb: 'Wider, with a big front porch.' },
  { name: 'Family House', price: 45, w: 12, d: 10, stories: 2, wall: ['siding', '#a7b89a'], roof: ['gable', '#4a4b52'], porch: 'wide', fence: 'picket', beds: true, blurb: 'Two floors and a flower garden.' },
  { name: 'Big House', price: 80, w: 14, d: 11, stories: 2, wall: ['brick', '#9a5a44'], roof: ['gable', '#3f3a3a'], porch: 'wide', garage: true, fence: 'picket', beds: true, blurb: 'Brick, with a garage.' },
  { name: 'Villa', price: 130, w: 14, d: 12, stories: 2, wall: ['stucco', '#e8dcc4'], roof: ['hip', '#b5583a'], wings: 1, balcony: true, fence: 'iron', hedges: true, beds: true, blurb: 'Tile roof, balcony and a new wing.' },
  { name: 'Mansion', price: 200, w: 16, d: 13, stories: 3, wall: ['stone', '#d9d2c2'], roof: ['hip', '#3d4452'], wings: 2, portico: 4, fence: 'iron', hedges: true, fountain: true, gate: true, blurb: 'Three floors, columns and a fountain.' },
  { name: 'Super Mansion', price: 300, w: 18, d: 15, stories: 3, wall: ['stone', '#efe9dc'], roof: ['hip', '#2f3a4a'], wings: 2, bigWings: true, portico: 6, tower: true, gold: true, fence: 'iron', hedges: true, fountain: true, gate: true, pool: true, statues: true, blurb: 'A tower, a pool, gold trim — the biggest house in town.' }
];
const STORY = 3.2;
function wallMat(kind, color, w, h) {
  if (kind === 'siding') return mat('siding', [color, 31], w / 3, h / 3, { bump: 1.6, roughness: .8 });
  if (kind === 'brick') return mat('brick', [color, '#cfc3b3', 36], w / 1.3, h / 1.3, { bump: 1.4 });
  if (kind === 'stucco') return mat('concrete', [color, 0, 37], w / 4, h / 4, { bump: .4, roughness: .95 });
  return mat('concrete', [color, 128, 38], w / 3, h / 3, { bump: .7, roughness: .85 }); // dressed stone blocks
}
function roofMat(kind, color, w, d) {
  return mat('shingles', [color, kind === 'hip' ? 39 : 33], w / 3, d / 3, { bump: 2 });
}
function hipRoof(W, D, rise, material) {
  // ridge along the longer axis; four sloped faces
  const hw = W / 2, hd = D / 2, rl = Math.max(0, (W - D) / 2);
  const P = { a: [-hw, 0, -hd], b: [hw, 0, -hd], c: [hw, 0, hd], d: [-hw, 0, hd], r1: [-rl, rise, 0], r2: [rl, rise, 0] };
  const tris = [['d', 'c', 'r2'], ['d', 'r2', 'r1'], ['b', 'a', 'r1'], ['b', 'r1', 'r2'], ['c', 'b', 'r2'], ['a', 'd', 'r1']];
  const pos = [], uv = [];
  tris.forEach(t => t.forEach(k => { pos.push(...P[k]); uv.push((P[k][0] + hw) / 3, (P[k][2] + hd + P[k][1]) / 3); }));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material); m.castShadow = true; m.receiveShadow = true; return m;
}
function gableRoof(g, w, d, rise, material, wallM, y) {
  const over = .5, slopeLen = Math.hypot(w / 2 + over, rise);
  [-1, 1].forEach(s => { const p = box(slopeLen, .16, d + 1, material, s * (w / 4 + over / 2) * .98, y + rise / 2, 0); p.rotation.z = -s * Math.atan2(rise, w / 2 + over); g.add(p); });
  const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, rise); tri.closePath();
  const triG = new THREE.ShapeGeometry(tri);
  [-1, 1].forEach(s => { const m = new THREE.Mesh(triG, wallM); m.position.set(0, y, s * d / 2); if (s < 0) m.rotation.y = Math.PI; m.castShadow = true; g.add(m); });
}
function windowAt(g, x, y, z, T, lit) {
  const S = shared(), fancy = T.wall[0] === 'stone' || T.wall[0] === 'stucco', wh = fancy ? 2.1 : 1.7;
  g.add(box(1.5, wh + .25, .1, S.trimWhite, x, y, z + .02));
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.25, wh), lit ? S.glass : S.glassDark); gl.position.set(x, y, z + .08); g.add(gl);
  if (lit) { const gw = new THREE.Mesh(new THREE.PlaneGeometry(1.25, wh), new THREE.MeshBasicMaterial({ color: 0xffdcaa })); gw.position.set(x, y, z - .1); g.add(gw); }
  g.add(box(.05, wh, .05, S.trimWhite, x, y, z + .1)); g.add(box(1.25, .05, .05, S.trimWhite, x, y + .2, z + .1));
  if (!fancy) [-1, 1].forEach(s => g.add(box(.5, wh + .25, .06, std(0x2f4858, .6), x + s * 1.02, y, z + .06)));
  else g.add(box(1.8, .3, .16, T.gold ? std(0xc9a64a, .35, .9) : S.stone, x, y + wh / 2 + .3, z + .08));
  g.add(box(1.7, .12, .25, S.trimWhite, x, y - wh / 2 - .1, z + .1));
}
function block(g, T, w, d, stories, cx, cz, roofKind, lit) {
  const S = shared(), h = stories * STORY, wm = wallMat(T.wall[0], T.wall[1], w, h);
  g.add(box(w, h, d, wm, cx, h / 2 + .5, cz));
  g.add(box(w + .2, .6, d + .2, T.wall[0] === 'siding' ? mat('brick', ['#7d5a4a', '#bdb3a6', 32], (w + .2) / 2.4, .25) : S.stone, cx, .3, cz));
  [-1, 1].forEach(s => [-1, 1].forEach(t => g.add(box(.2, h, .2, T.wall[0] === 'siding' ? S.trimWhite : S.stone, cx + s * w / 2, h / 2 + .5, cz + t * d / 2))));
  g.add(box(w + .3, .3, d + .3, T.gold ? std(0xc9a64a, .35, .9) : (T.wall[0] === 'siding' ? S.trimWhite : S.stone), cx, h + .6, cz));
  const rm = roofMat(roofKind, T.roof[1], w, d);
  if (roofKind === 'hip') { const r = hipRoof(w + 1, d + 1, Math.min(w, d) * .32, rm); r.position.set(cx, h + .75, cz); g.add(r); }
  else { const sub = new THREE.Group(); sub.position.set(cx, 0, cz); gableRoof(sub, w, d, Math.max(2, w * .22), rm, wm, h + .62); g.add(sub); }
  // windows on the front face
  const cols = Math.max(2, Math.round(w / 2.8)), span = w / cols;
  for (let st = 0; st < stories; st++) for (let c = 0; c < cols; c++) {
    const x = cx - w / 2 + span * (c + .5);
    if (st === 0 && lit === 'door' && Math.abs(x - cx) < 1.6) continue;
    windowAt(g, x, .5 + st * STORY + 1.7, cz + d / 2, T, st === 0);
  }
  return h;
}
function column(g, x, y0, z, hgt, T) {
  const S = shared(), m = T.gold ? std(0xf6f1e4, .5) : S.trimWhite;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.26, .32, hgt, 20), m); shaft.position.set(x, y0 + hgt / 2, z); shaft.castShadow = true; g.add(shaft);
  g.add(box(.8, .25, .8, m, x, y0 + .12, z)); g.add(box(.85, .3, .85, T.gold ? std(0xc9a64a, .35, .9) : m, x, y0 + hgt - .1, z));
}
export function buildHouse(tier) {
  const T = HOUSE_TIERS[Math.max(0, Math.min(HOUSE_TIERS.length - 1, tier))], S = shared(), g = new THREE.Group();
  const { w, d, stories } = T, fz = d / 2, cols = [];
  const h = block(g, T, w, d, stories, 0, 0, T.roof[0], 'door');
  cols.push([-w / 2, w / 2, -d / 2, d / 2]);
  // chimneys
  g.add(texBox(1.1, 3.6, 1.1, 'brick', ['#8a4b3a', '#c8bdb0', 34], 2.4, 2.4, w / 4, h + 2, -d / 5));
  if (tier >= 4) g.add(texBox(1.1, 4, 1.1, 'brick', ['#8a4b3a', '#c8bdb0', 34], 2.4, 2.4, -w / 4, h + 2.2, -d / 5));
  // wings
  if (T.wings) {
    const ww = T.bigWings ? 7 : 5.5, wd = d - 2, ws = T.bigWings ? stories - 1 : Math.max(1, stories - 1);
    (T.wings === 1 ? [1] : [-1, 1]).forEach(s => {
      const cx = s * (w / 2 + ww / 2), cz = -1;
      block(g, T, ww, wd, ws, cx, cz, 'hip', 'none');
      cols.push([cx - ww / 2, cx + ww / 2, cz - wd / 2, cz + wd / 2]);
    });
  }
  // garage
  if (T.garage) {
    const gw = 5, gd = 6, cx = w / 2 + gw / 2, cz = fz - gd / 2;
    g.add(box(gw, 3.2, gd, wallMat(T.wall[0], T.wall[1], gw, 3.2), cx, 1.6, cz));
    const gdoor = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.5), new THREE.MeshStandardMaterial({ map: stripes('#e9e6df', '#cfcac0', 10), roughness: .6 }));
    gdoor.material.map.rotation = Math.PI / 2; gdoor.position.set(cx, 1.3, fz + .01); g.add(gdoor);
    const groof = hipRoof(gw + .8, gd + .8, 1.2, roofMat('hip', T.roof[1], gw, gd)); groof.position.set(cx, 3.2, cz); g.add(groof);
    cols.push([cx - gw / 2, cx + gw / 2, cz - gd / 2, cz + gd / 2]);
  }
  // front door
  let front = 0;
  const doorM = std(tier >= 4 ? 0x3b2416 : 0x8b2b2b, .4, .1);
  if (tier >= 4) { g.add(box(1.0, 2.8, .12, doorM, -.52, 1.9, fz + .06)); g.add(box(1.0, 2.8, .12, doorM, .52, 1.9, fz + .06)); g.add(box(2.4, 3.3, .1, T.gold ? std(0xc9a64a, .35, .9) : S.stone, 0, 2.1, fz + .01)); }
  else { g.add(box(1.2, 2.4, .12, doorM, 0, 1.7, fz + .06)); g.add(box(1.6, 2.7, .1, S.trimWhite, 0, 1.85, fz + .01)); }
  g.add(box(.1, .1, .1, std(0xd4af37, .3, 1), .45, 1.75, fz + .16));
  // porch (small houses) / balcony (villa) / portico with columns (mansions)
  if (T.porch) {
    const pw = T.porch === 'small' ? 3.6 : w * .62, pd = 2.4;
    g.add(box(pw, .5, pd, mat('wood', ['#9a8f84', 6, 35], 2, 2), 0, .25, fz + pd / 2));
    g.add(box(2, .25, .6, S.stone, 0, .12, fz + pd + .3));
    const pr = box(pw + .3, .18, pd + .3, roofMat('gable', T.roof[1], pw, pd), 0, 3.1, fz + pd / 2); pr.rotation.x = .12; g.add(pr);
    [-1, 1].forEach(s => { g.add(box(.22, 2.6, .22, S.trimWhite, s * (pw / 2 - .15), 1.8, fz + pd - .15)); });
    front = pd + .6;
  }
  if (T.balcony) {
    g.add(box(4, .25, 1.6, S.stone, 0, STORY + .55, fz + .8));
    for (let i = 0; i <= 12; i++) g.add(box(.04, .9, .04, S.black, -1.9 + i * .32, STORY + 1.1, fz + 1.55));
    g.add(box(4, .06, .06, S.black, 0, STORY + 1.55, fz + 1.55));
    g.add(box(2.2, .2, 1, S.stone, 0, .1, fz + .5)); front = 1.2;
  }
  if (T.portico) {
    const n = T.portico, pw = n === 6 ? 9 : 6.5, pd = 3.2, ch = Math.min(h, STORY * 2) - .2;
    for (let i = 0; i < 3; i++) g.add(box(pw + 1.6 - i * .5, .2, pd + 1.2 - i * .4, S.stone, 0, .1 + i * .2, fz + (pd + 1.2) / 2 - i * .2));
    for (let i = 0; i < n; i++) column(g, -pw / 2 + .4 + i * (pw - .8) / (n - 1), .6, fz + pd - .3, ch, T);
    g.add(box(pw + .6, .6, pd + .3, T.gold ? std(0xc9a64a, .35, .9) : S.stone, 0, .6 + ch + .3, fz + pd / 2));
    const ped = new THREE.Shape(); ped.moveTo(-pw / 2 - .3, 0); ped.lineTo(pw / 2 + .3, 0); ped.lineTo(0, 1.6); ped.closePath();
    const pm = new THREE.Mesh(new THREE.ExtrudeGeometry(ped, { depth: .5, bevelEnabled: false }), S.trimWhite); pm.position.set(0, .6 + ch + .6, fz + pd - .4); pm.castShadow = true; g.add(pm);
    front = pd + 1.2;
  }
  /* ---- back porch: covered deck with railing, a back door, and a porch swing ---- */
  {
    const bz = -fz, pw = Math.min(w * .62, 9), pd = 2.8, deckM = mat('wood', ['#a07a55', 7, 46], pw / 2, pd / 2, { roughness: .7 });
    g.add(box(1.2, 2.4, .12, std(0x5a3a24, .5), 0, 1.7, bz - .06));
    g.add(box(1.6, 2.7, .1, S.trimWhite, 0, 1.85, bz - .01));
    const deck = box(pw, .16, pd, deckM, 0, .08, bz - pd / 2); g.add(deck);
    const rail = S.trimWhite, posts = [];
    [-1, 1].forEach(s => { posts.push([s * (pw / 2 - .12), bz - pd + .12]); posts.push([s * (pw / 2 - .12), bz - .2]); });
    posts.forEach(([x, z]) => g.add(box(.16, 2.9, .16, rail, x, 1.53, z)));
    [-1, 1].forEach(s => {
      g.add(box(.07, .07, pd, rail, s * (pw / 2 - .12), 1.0, bz - pd / 2));
      for (let k = 0; k < 8; k++) g.add(box(.04, .84, .04, rail, s * (pw / 2 - .12), .58, bz - .3 - k * (pd - .5) / 7));
      const fl = pw / 2 - 1.1; g.add(box(fl, .07, .07, rail, s * (1.1 + fl / 2), 1.0, bz - pd + .12));
      for (let k = 0; k < Math.floor(fl / .3); k++) g.add(box(.04, .84, .04, rail, s * (1.2 + k * .3), .58, bz - pd + .12));
    });
    const pr = box(pw + .4, .16, pd + .4, roofMat('gable', T.roof[1], pw, pd), 0, 3.05, bz - pd / 2); pr.rotation.x = -.1; g.add(pr);
    // porch swing hanging from the roof
    const sw = new THREE.Group(), wd = mat('wood', ['#7a5236', 3, 47], 1, 1);
    sw.add(box(1.5, .08, .5, wd, 0, .55, 0)); sw.add(box(1.5, .45, .06, wd, 0, .8, -.22));
    [-1, 1].forEach(k => { const ch = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 2.4, 4), std(0x333333, .4, .8)); ch.position.set(k * .7, 1.75, 0); sw.add(ch); });
    sw.position.set(-pw / 4, 0, bz - pd + .9); g.add(sw);
    // two steps down to the yard
    g.add(box(1.6, .1, .5, S.stone, 0, .05, bz - pd - .25));
    posts.forEach(([x, z]) => cols.push([x - .12, x + .12, z - .12, z + .12]));
    cols.push([-pw / 2, -1.1, bz - pd + .02, bz - pd + .22], [1.1, pw / 2, bz - pd + .02, bz - pd + .22]);
    [-1, 1].forEach(s => cols.push([s > 0 ? pw / 2 - .22 : -pw / 2, s > 0 ? pw / 2 : -pw / 2 + .22, bz - pd, bz]));
    g.userData.porchSwing = sw;
  }
  if (T.tower) {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 4, 24), wallMat('stone', T.wall[1], 6, 2)); tw.position.set(0, h + 2.4, -1); tw.castShadow = true; g.add(tw);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, wn = new THREE.Mesh(new THREE.PlaneGeometry(.6, 1.4), S.glassDark); wn.position.set(Math.sin(a) * 1.81, h + 2.6, -1 + Math.cos(a) * 1.81); wn.rotation.y = a; g.add(wn); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), std(0xc9a64a, .25, 1)); dome.position.set(0, h + 4.4, -1); dome.castShadow = true; g.add(dome);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(.15, 1.2, 12), std(0xe6c35a, .2, 1)); fin.position.set(0, h + 7, -1); g.add(fin);
  }
  cols.push([-Math.max(2, front ? w * .32 : 1), Math.max(2, front ? w * .32 : 1), fz, fz + front]);
  g.userData.door = V(0, 0, fz + front + 1.0);
  g.userData.cols = cols;
  g.userData.frontDepth = front;
  return g;
}
/** garden, fence, path and extras on the home lot — rebuilt with the house */
function lotExtras(T, tier, lot, side, frontZ, r) {
  const g = new THREE.Group(), cols = [], S = shared();
  const fenceZ = side * (SETBACK + .3), x0 = lot.x;
  // path from gate to door
  const pathLen = Math.abs(frontZ) - SETBACK;
  const path = new THREE.Mesh(new THREE.BoxGeometry(tier >= 5 ? 3 : 1.6, .06, pathLen), mat('concrete', [tier >= 5 ? '#d8d2c6' : '#b7b0a4', tier >= 5 ? 64 : 0, 62], 1, pathLen / 2));
  path.position.set(x0, .03, side * (SETBACK + pathLen / 2)); path.receiveShadow = true; g.add(path);
  // fence
  const gap = tier >= 5 ? 2 : 1.2, half = lot.w / 2;
  const fenceM = T.fence === 'iron' ? S.black : std(0xf4f1ea, .7);
  [-1, 1].forEach(s => {
    const len = half - gap;
    const n = Math.floor(len / (T.fence === 'iron' ? .25 : .35));
    for (let k = 0; k < n; k++) g.add(box(T.fence === 'iron' ? .04 : .09, T.fence === 'iron' ? 1.4 : .9, .05, fenceM, x0 + s * (gap + .15 + k * len / n), T.fence === 'iron' ? .7 : .45, fenceZ));
    [.3, T.fence === 'iron' ? 1.3 : .7].forEach(y => g.add(box(len, .06, .05, fenceM, x0 + s * (gap + len / 2), y, fenceZ)));
    cols.push({ x1: Math.min(x0 + s * gap, x0 + s * half), x2: Math.max(x0 + s * gap, x0 + s * half), z1: fenceZ - .15, z2: fenceZ + .15 });
    if (T.gate) { g.add(box(.6, 2.2, .6, S.stone, x0 + s * (gap + .3), 1.1, fenceZ)); const lan = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffefc0 })); lan.position.set(x0 + s * (gap + .3), 2.45, fenceZ); g.add(lan); cols.push({ x1: x0 + s * (gap + .3) - .35, x2: x0 + s * (gap + .3) + .35, z1: fenceZ - .35, z2: fenceZ + .35 }); }
  });
  // mailbox
  const mb = new THREE.Group(); mb.add(box(.08, 1.1, .08, std(0x4a3a2a), 0, .55, 0)); mb.add(box(.3, .3, .5, std(0x2b4a7a, .4, .5), 0, 1.2, 0)); mb.position.set(x0 + gap + .6, 0, side * (SETBACK - .1)); g.add(mb);
  // flower beds along the house front
  if (T.beds) [-1, 1].forEach(s => {
    const bed = box(4, .25, 1, std(0x4a3626, 1), x0 + s * (T.w / 2 - 2.2), .12, frontZ - side * 1.2); g.add(bed);
    for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), std([0xff5d8f, 0xffd23f, 0xffffff, 0xb07cff][i % 4], .8)); f.position.set(bed.position.x - 1.8 + i * .27, .35 + r() * .1, bed.position.z + (r() - .5) * .6); g.add(f); }
  });
  // hedges lining the path
  if (T.hedges) [-1, 1].forEach(s => { const hz = (SETBACK + 1.5 + Math.abs(frontZ)) / 2, hl = Math.abs(frontZ) - SETBACK - 2.5; if (hl > 1) { const hd = box(.8, 1, hl, mat('hedge', [], 1, hl / 2, { bump: 2 }), x0 + s * (tier >= 5 ? 2.3 : 1.6), .5, side * hz); g.add(hd); cols.push({ x1: hd.position.x - .4, x2: hd.position.x + .4, z1: Math.min(side * (hz - hl / 2), side * (hz + hl / 2)), z2: Math.max(side * (hz - hl / 2), side * (hz + hl / 2)) }); } });
  // fountain
  if (T.fountain) {
    const fx = x0 - lot.w * .28, fzc = side * (SETBACK + 4.2), big = tier >= 6 ? 1.35 : 1;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2 * big, 2.2 * big, .6, 32), S.stone); basin.position.set(fx, .3, fzc); basin.castShadow = true; g.add(basin);
    const wtr = new THREE.Mesh(new THREE.CircleGeometry(1.85 * big, 32), new THREE.MeshStandardMaterial({ color: 0x3f8fbf, roughness: .05, metalness: .3 })); wtr.rotation.x = -Math.PI / 2; wtr.position.set(fx, .58, fzc); g.add(wtr);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.25, .35, 1.6, 16), S.stone); ped.position.set(fx, 1.1, fzc); g.add(ped);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.9, .4, .3, 24), T.gold ? std(0xc9a64a, .3, 1) : S.stone); bowl.position.set(fx, 1.9, fzc); g.add(bowl);
    const spray = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.2, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: .45, roughness: .1 })); spray.position.set(fx, 2.5, fzc); spray.rotation.x = Math.PI; g.add(spray);
    cols.push({ x1: fx - 2.2 * big, x2: fx + 2.2 * big, z1: fzc - 2.2 * big, z2: fzc + 2.2 * big });
  }
  // pool + statues for the Super Mansion
  if (T.pool) {
    const px = x0 + lot.w * .28, pz = side * (SETBACK + 4.6);
    g.add(box(6.4, .3, 4.4, S.stone, px, .15, pz));
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.6), new THREE.MeshStandardMaterial({ color: 0x2bb6e0, roughness: .03, metalness: .2 })); pool.rotation.x = -Math.PI / 2; pool.position.set(px, .31, pz); g.add(pool);
    for (let i = 0; i < 2; i++) { const ch = box(.7, .3, 1.8, std(0xffffff, .5), px - 1.2 + i * 2.4, .45, pz + side * 3.1); g.add(ch); }
    cols.push({ x1: px - 3.2, x2: px + 3.2, z1: pz - 2.2, z2: pz + 2.2 });
  }
  if (T.statues) [-1, 1].forEach(s => {
    const sx = x0 + s * 3.6, sz = side * (SETBACK + 1.6);
    g.add(box(.9, 1, .9, S.stone, sx, .5, sz)); const ball = new THREE.Mesh(new THREE.SphereGeometry(.45, 20, 14), std(0xc9a64a, .25, 1)); ball.position.set(sx, 1.45, sz); ball.castShadow = true; g.add(ball);
    cols.push({ x1: sx - .5, x2: sx + .5, z1: sz - .5, z2: sz + .5 });
  });
  /* ---- the backyard: side fences, back fence, lawn toys ---- */
  {
    const backAbs = Math.abs(frontZ) + T.d, yardD = 11, bf = backAbs + yardD, Z = a => side * a;
    const fm = T.fence === 'iron' ? S.black : std(0xf4f1ea, .7), hgt = T.fence === 'iron' ? 1.4 : 1.1, sp = T.fence === 'iron' ? .25 : .35;
    const runX = (z, xa, xb) => { const len = Math.abs(xb - xa), n = Math.floor(len / sp); for (let k = 0; k <= n; k++) g.add(box(T.fence === 'iron' ? .04 : .09, hgt, .05, fm, Math.min(xa, xb) + k * len / n, hgt / 2, z)); [.3, hgt - .2].forEach(y => g.add(box(len, .06, .05, fm, (xa + xb) / 2, y, z))); cols.push({ x1: Math.min(xa, xb), x2: Math.max(xa, xb), z1: z - .15, z2: z + .15 }); };
    const runZ = (x, za, zb) => { const len = Math.abs(zb - za), n = Math.floor(len / sp); for (let k = 0; k <= n; k++) g.add(box(.05, hgt, T.fence === 'iron' ? .04 : .09, fm, x, hgt / 2, Math.min(za, zb) + k * len / n)); [.3, hgt - .2].forEach(y => g.add(box(.05, .06, len, fm, x, y, (za + zb) / 2))); cols.push({ x1: x - .15, x2: x + .15, z1: Math.min(za, zb), z2: Math.max(za, zb) }); };
    runX(Z(bf), x0 - half, x0 + half);
    runZ(x0 - half, Z(SETBACK + .3), Z(bf)); runZ(x0 + half, Z(SETBACK + .3), Z(bf));
    // patio pavers off the back porch
    const pav = new THREE.Mesh(new THREE.BoxGeometry(6, .05, 3), mat('concrete', ['#b9b2a6', 128, 48], 2, 1));
    pav.position.set(x0, .03, Z(backAbs + 4.3)); pav.receiveShadow = true; g.add(pav);
    // picnic table + grill on the patio
    const wd = mat('wood', ['#8a6440', 4, 49], 1, 1), pt = new THREE.Group();
    pt.add(box(1.8, .06, .8, wd, 0, .76, 0)); [-1, 1].forEach(k => { pt.add(box(1.8, .05, .3, wd, 0, .45, k * .65)); pt.add(box(.08, .76, .08, wd, -.75, .38, k * .3)); pt.add(box(.08, .76, .08, wd, .75, .38, k * .3)); });
    pt.position.set(x0 - 1.2, 0, Z(backAbs + 4.3)); g.add(pt); cols.push({ x1: x0 - 2.2, x2: x0 - .2, z1: Z(backAbs + 4.3) - .9, z2: Z(backAbs + 4.3) + .9 });
    const gr = new THREE.Group(); gr.add(box(.8, .5, .5, S.black, 0, .95, 0)); gr.add(box(.8, .08, .5, std(0x666666, .4, .8), 0, .72, 0)); [-1, 1].forEach(k => gr.add(box(.05, .7, .05, S.black, k * .35, .35, 0)));
    gr.position.set(x0 + 2, 0, Z(backAbs + 4)); g.add(gr); cols.push({ x1: x0 + 1.5, x2: x0 + 2.5, z1: Z(backAbs + 4) - .35, z2: Z(backAbs + 4) + .35 });
    // swing set
    const ss = new THREE.Group(), metal = std(0xd04a3a, .5, .4), L = 3.4;
    [-1, 1].forEach(k => [-1, 1].forEach(j => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.6, 8), metal); leg.position.set(k * L / 2, 1.2, j * .5); leg.rotation.x = j * .38; leg.castShadow = true; ss.add(leg); }));
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, L + .2, 8), metal); bar.rotation.z = Math.PI / 2; bar.position.y = 2.42; ss.add(bar);
    [-.7, .7].forEach(x => { [-.22, .22].forEach(dx => { const rope = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 1.9, 4), std(0x333333)); rope.position.set(x + dx, 1.47, 0); ss.add(rope); }); ss.add(box(.55, .05, .22, std(0x2b2b2b, .6), x, .52, 0)); });
    ss.position.set(x0 - half * .5, 0, Z(backAbs + 8)); g.add(ss); cols.push({ x1: x0 - half * .5 - 1.9, x2: x0 - half * .5 + 1.9, z1: Z(backAbs + 8) - .9, z2: Z(backAbs + 8) + .9 });
    // trampoline
    const tr = new THREE.Group();
    const ringT = new THREE.Mesh(new THREE.TorusGeometry(1.7, .07, 8, 40), std(0x2f6fd8, .5)); ringT.rotation.x = Math.PI / 2; ringT.position.y = .75; tr.add(ringT);
    const mat2 = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), std(0x111111, .9)); mat2.rotation.x = -Math.PI / 2; mat2.position.y = .74; tr.add(mat2);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, lg = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .75, 6), S.black); lg.position.set(Math.cos(a) * 1.65, .37, Math.sin(a) * 1.65); tr.add(lg); }
    tr.position.set(x0 + half * .5, 0, Z(backAbs + 7.5)); g.add(tr); cols.push({ x1: x0 + half * .5 - 1.8, x2: x0 + half * .5 + 1.8, z1: Z(backAbs + 7.5) - 1.8, z2: Z(backAbs + 7.5) + 1.8 });
    // a shade tree + a vegetable garden along the back fence
    const t1 = tree(r, 1.2); t1.position.set(x0 + half - 2.2, 0, Z(bf - 2)); g.add(t1); cols.push({ x1: t1.position.x - .4, x2: t1.position.x + .4, z1: t1.position.z - .4, z2: t1.position.z + .4 });
    const bed = box(4.5, .3, 1.1, std(0x4a3626, 1), x0, .15, Z(bf - .9)); g.add(bed); cols.push({ x1: x0 - 2.25, x2: x0 + 2.25, z1: Z(bf - .9) - .55, z2: Z(bf - .9) + .55 });
    for (let i = 0; i < 12; i++) { const pl = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), std(i % 3 ? 0x3f7d2f : 0xd8452f, .8)); pl.position.set(x0 - 2 + i * .36, .42, Z(bf - .9) + (i % 2 ? .25 : -.25)); g.add(pl); }
  }
  return { group: g, cols };
}

/* ---------------- props ---------------- */
const leafMats = [0x2f5a1f, 0x3a6a26, 0x2a4f1c, 0x46772c].map(c => std(c, .9));
const leafGeo = (function () { let g = new THREE.IcosahedronGeometry(1, 4); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 5.1) * Math.cos(v.y * 4.3) * Math.sin(v.z * 6.7) * .13 + Math.sin(v.x * 11 + v.z * 9) * .05; v.multiplyScalar(1 + n); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; })();
function tree(r, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.14 * s, .24 * s, 3.2 * s, 8), mat('concrete', ['#4a3628', 0, 41], 1, 3, { bump: 3, roughness: 1 }));
  trunk.position.y = 1.6 * s; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 11; i++) {
    const l = new THREE.Mesh(leafGeo, leafMats[Math.floor(r() * 4)]);
    const sc = (.9 + r() * .8) * s; l.scale.set(sc, sc * .8, sc);
    l.position.set((r() - .5) * 2.2 * s, (3.4 + r() * 2.2) * s, (r() - .5) * 2.2 * s); l.rotation.set(r() * 3, r() * 3, 0);
    l.castShadow = true; l.receiveShadow = true; g.add(l);
  }
  return g;
}
function streetLight() {
  const S = shared(), g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .11, 5.6, 10), S.black); pole.position.y = 2.8; pole.castShadow = true; g.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.2, .26, .5, 10), S.black); base.position.y = .25; g.add(base);
  const arm = box(.08, .08, 1.3, S.black, 0, 5.45, .6); g.add(arm);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(.18, .4, .35, 12), S.black); head.position.set(0, 5.35, 1.2); g.add(head);
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(.34, 16), new THREE.MeshBasicMaterial({ color: 0xfff1d0 })); bulb.rotation.x = Math.PI / 2; bulb.position.set(0, 5.17, 1.2); g.add(bulb);
  return g;
}
function bench() {
  const g = new THREE.Group(), wd = mat('wood', ['#8a5a35', 4, 42], 1, 1), S = shared();
  for (let i = 0; i < 3; i++) g.add(box(1.8, .06, .13, wd, 0, .48, -.2 + i * .16));
  for (let i = 0; i < 2; i++) { const b = box(1.8, .06, .13, wd, 0, .75 + i * .17, -.32); b.rotation.x = -.2; g.add(b); }
  [-.8, .8].forEach(x => { g.add(box(.06, .48, .5, S.black, x, .24, -.08)); g.add(box(.06, .5, .06, S.black, x, .7, -.33)); });
  return g;
}
function car(color, r) {
  const g = new THREE.Group(), S = shared();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: .25, metalness: .6, clearcoat: 1, clearcoatRoughness: .08 });
  const side = new THREE.Shape();
  side.moveTo(-2.15, .35); side.lineTo(2.15, .35); side.quadraticCurveTo(2.3, .38, 2.3, .7); side.lineTo(2.2, .95);
  side.quadraticCurveTo(1.5, 1.05, 1.0, 1.05); side.lineTo(.55, 1.55); side.quadraticCurveTo(0, 1.62, -.9, 1.58);
  side.lineTo(-1.6, 1.08); side.lineTo(-2.2, 1.0); side.quadraticCurveTo(-2.32, .7, -2.15, .35);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(side, { depth: 1.7, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 3 }), paint);
  body.position.z = -.85; body.castShadow = true; g.add(body);
  // windows
  const win = new THREE.Shape(); win.moveTo(.95, 1.08); win.lineTo(.52, 1.5); win.lineTo(-.85, 1.53); win.lineTo(-1.5, 1.1); win.closePath();
  const wg = new THREE.ShapeGeometry(win);
  [-.9, .9].forEach(z => { const m = new THREE.Mesh(wg, S.glassDark); m.position.z = z + (z > 0 ? .02 : -.02); if (z < 0) m.scale.z = -1; g.add(m); });
  const wind = box(.04, .5, 1.5, S.glassDark, .76, 1.3, 0); wind.rotation.z = .85; g.add(wind);
  const rear = box(.04, .45, 1.5, S.glassDark, -1.2, 1.3, 0); rear.rotation.z = -.95; g.add(rear);
  // wheels
  const tire = std(0x111111, .9), rim = std(0xb8bcc2, .3, 1);
  [[1.4, .9], [1.4, -.9], [-1.4, .9], [-1.4, -.9]].forEach(([x, z]) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .26, 20), tire); t.rotation.x = Math.PI / 2; t.position.set(x, .36, z); t.castShadow = true; g.add(t);
    const rm = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .27, 12), rim); rm.rotation.x = Math.PI / 2; rm.position.set(x, .36, z); g.add(rm);
  });
  // lights
  [-.6, .6].forEach(z => { g.add(box(.05, .12, .32, new THREE.MeshBasicMaterial({ color: 0xfff6dd }), 2.3, .78, z)); g.add(box(.05, .12, .3, new THREE.MeshBasicMaterial({ color: 0xaa1111 }), -2.28, .85, z)); });
  return g;
}

/* ---------------- the whole town ---------------- */
export const BUILDINGS = [
  { id: 'maze', name: 'Mazes', side: -1, x: -36, w: 15, d: 13, floors: 3, wall: { kind: 'brick', args: ['#8e3b2c', '#cfc3b3', 51] }, signBg: '#103d33', signFg: '#e8fff6', awning: ['#1f7a5a', '#f2efe6'], trim: 'white', door: 0x1d4d3d },
  { id: 'picture', name: 'Picture Puzzles', side: -1, x: -12, w: 15, d: 13, floors: 4, wall: { kind: 'brick', args: ['#b8875c', '#ded3c3', 52] }, signBg: '#3a1d12', signFg: '#ffd7bd', awning: ['#c55a2c', '#f6eadb'], door: 0x5a2a16 },
  { id: 'pattern', name: 'Patterns', side: -1, x: 12, w: 15, d: 13, floors: 3, wall: { kind: 'concrete', args: ['#d8cfbf', 160, 53], tile: 3 }, signBg: '#2b2410', signFg: '#ffd463', trim: 'white', door: 0x3a3320 },
  { id: 'chess', name: 'Chess', side: -1, x: 36, w: 15, d: 13, floors: 4, wall: { kind: 'brick', args: ['#5b5f66', '#b9bcc0', 54] }, signBg: '#1a1530', signFg: '#d7cfff', awning: ['#3d3470', '#e9e6f5'], door: 0x241e45 },
  { id: 'home', name: 'Home', side: 1, x: -57, lotW: 34, house: true },
  { id: 'store', name: 'Game Store', side: 1, x: -24, w: 14, d: 13, floors: 2, wall: { kind: 'brick', args: ['#a24a3a', '#d8cbbb', 55] }, signBg: '#3d2d00', signFg: '#ffd34d', awning: ['#c7962a', '#fff6dc'], trim: 'white', door: 0x5c4300 },
  { id: 'pong', name: 'Ping Pong', side: 1, x: 0, w: 15, d: 13, floors: 3, wall: { kind: 'brick', args: ['#6f7f8c', '#c9d0d6', 56] }, signBg: '#0f2b45', signFg: '#cfe8ff', awning: ['#2f6fa8', '#eef5fb'], door: 0x14385a },
  { id: 'jigsaw', name: 'Jigsaw', side: 1, x: 24, w: 15, d: 13, floors: 4, wall: { kind: 'brick', args: ['#a8566d', '#e2d4d6', 57] }, signBg: '#3b0f22', signFg: '#ffd0e4', awning: ['#b8436f', '#fbecf2'], trim: 'white', door: 0x4a1028 }
];
const SETBACK = 10.5; // building front line distance from street centre

export function createTown(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc9dcef, 70, 190);
  const r = rng(4242);
  // sky + sun
  const sky = new Sky(); sky.scale.setScalar(4000);
  const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(210));
  const u = sky.material.uniforms; u.turbidity.value = 4; u.rayleigh.value = 1.4; u.mieCoefficient.value = .004; u.mieDirectionalG.value = .8; u.sunPosition.value.copy(sun);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(4000); Object.assign(sky2.material.uniforms.sunPosition.value, sun); ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'].forEach(k => sky2.material.uniforms[k].value = u[k].value); envScene.add(sky2);
  scene.environment = pmrem.fromScene(envScene).texture;
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x5a5040, .55); scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff1dc, 2.6); dir.position.copy(sun).multiplyScalar(60);
  dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048); const sc = dir.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 160; dir.shadow.bias = -.0004; dir.shadow.normalBias = .03;
  scene.add(dir); scene.add(dir.target);

  // ground
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('grass', [], 80, 80, { roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
  const L = 150;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(L, 10), mat('asphalt', [], L / 6, 10 / 6, { roughness: .95, bump: .8 }));
  road.rotation.x = -Math.PI / 2; road.position.y = .01; road.receiveShadow = true; scene.add(road);
  // lane markings
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe8c547, roughness: .8 }), white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: .8 });
  [-.1, .1].forEach(z => { const m = new THREE.Mesh(new THREE.PlaneGeometry(L, .1), yellow); m.rotation.x = -Math.PI / 2; m.position.set(0, .02, z); scene.add(m); });
  [-4.6, 4.6].forEach(z => { const m = new THREE.Mesh(new THREE.PlaneGeometry(L, .12), white); m.rotation.x = -Math.PI / 2; m.position.set(0, .02, z); scene.add(m); });
  [-24, 0, 24].forEach(x => { for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.5, 9), white); m.rotation.x = -Math.PI / 2; m.position.set(x - 2.6 + i * .75, .025, 0); scene.add(m); } });
  // sidewalks + curbs
  [-1, 1].forEach(s => {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(L, .18, 5.3), mat('concrete', ['#c4c0b8', 256, 61], L / 3.2, 5.3 / 3.2, { bump: .8 }));
    sw.position.set(0, .09, s * 7.65); sw.receiveShadow = true; scene.add(sw);
    const curb = box(L, .2, .25, shared().stone, 0, .1, s * 5.1); curb.material = curb.material.clone(); scene.add(curb);
  });
  // buildings
  const doors = [], base = [], plaques = {};
  let home = null;
  BUILDINGS.forEach((b, i) => {
    if (b.house) { home = b; doors.push({ id: 'home', name: 'Home', pos: V(b.x, 0, b.side * (SETBACK + 3)), facing: Math.PI }); return; }
    const g = shopBuilding({ ...b, sign: b.name.toUpperCase(), seed: 100 + i });
    // local front is +z; buildings on the north side (z<0) face +z, south side ones are turned around
    const cz = b.side < 0 ? -(SETBACK + b.d / 2) : (SETBACK + b.d / 2);
    g.position.set(b.x, 0, cz); if (b.side > 0) g.rotation.y = Math.PI;
    g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    scene.add(g);
    const dl = g.userData.door.clone().applyAxisAngle(V(0, 1, 0), g.rotation.y).add(g.position); dl.y = 0;
    doors.push({ id: b.id, name: b.name, pos: dl, facing: b.side < 0 ? 0 : Math.PI });
    const hw = b.w / 2 + .1, hd = b.d / 2 + .1;
    base.push({ x1: b.x - hw, x2: b.x + hw, z1: cz - hd, z2: cz + hd });
    plaques[b.id] = g.userData.plaque;
  });
  const colliders = base;
  const buildingBoxes = base.slice();
  // street trees, lights, benches, cars
  for (let x = -66; x <= 66; x += 12) [-1, 1].forEach(s => {
    if (BUILDINGS.some(b => Math.abs(b.x - x) < 3)) return;
    const t = tree(r, .9 + r() * .3); t.position.set(x + (r() - .5) * 2, 0, s * 8.6); scene.add(t); colliders.push(circleBox(t.position, .35));
    const pit = box(1.4, .02, 1.4, std(0x3d2e22, 1), t.position.x, .19, t.position.z, false); scene.add(pit);
  });
  for (let x = -60; x <= 60; x += 24) [-1, 1].forEach(s => { const l = streetLight(); l.position.set(x, .18, s * 5.6); l.rotation.y = s > 0 ? Math.PI : 0; scene.add(l); colliders.push(circleBox(l.position, .2)); });
  [[-24, -1], [24, -1], [-12, 1], [12, 1]].forEach(([x, s]) => { const b = bench(); b.position.set(x, .18, s * 9.4); b.rotation.y = s > 0 ? Math.PI : 0; scene.add(b); colliders.push({ x1: x - .95, x2: x + .95, z1: s * 9.4 - .4, z2: s * 9.4 + .4 }); });
  const carCols = [0x9b1c1c, 0x1f3f7a, 0xd9d9d9, 0x2b2b2b, 0x3f6e5a, 0xb08a2e];
  [-54, -30, 4, 30, 54].forEach((x, i) => { const s = i % 2 ? 1 : -1; const c = car(carCols[i], r); c.position.set(x + (r() - .5) * 4, 0, s * 3.4); if (s > 0) c.rotation.y = Math.PI; scene.add(c); });
  // background rows of buildings beyond the town (simple silhouettes for depth)
  for (let x = -90; x <= 90; x += 11) [-1, 1].forEach(s => {
    const hgt = 10 + r() * 22, m = box(9 + r() * 3, hgt, 9, mat('concrete', [COLORS.shade(['#9a8f86', '#8a8f99', '#b29f8f', '#7f8a86'][Math.floor(r() * 4)], 0), 0, 70 + Math.floor(r() * 5)], 3, hgt / 4), x, hgt / 2, s * (48 + r() * 10));
    scene.add(m);
  });
  // invisible world bounds
  base.push({ x1: -75, x2: 75, z1: -40, z2: -39 }, { x1: -40, x2: 75, z1: 39, z2: 40 }, { x1: -76, x2: -75, z1: -40, z2: 60 }, { x1: 75, x2: 76, z1: -40, z2: 40 });

  const town = {
    scene, doors, colliders: base.slice(), camBlockers: base.slice(), plaques, sun: dir, houseTier: -1,
    spawn: { pos: V(home.x, 0, home.side * (SETBACK - 1.8)), yaw: Math.PI },
    setHouse(tier) {
      tier = Math.max(0, Math.min(HOUSE_TIERS.length - 1, tier | 0));
      if (tier === town.houseTier) return;
      if (town._house) { scene.remove(town._house); scene.remove(town._lot); }
      const T = HOUSE_TIERS[tier], g = buildHouse(tier), frontZ = SETBACK + 9;
      const cz = home.side * (frontZ + T.d / 2);
      g.position.set(home.x, 0, cz); if (home.side > 0) g.rotation.y = Math.PI;
      g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
      scene.add(g);
      const cols = g.userData.cols.map(([x1, x2, z1, z2]) => {
        const a = V(x1, 0, z1).applyAxisAngle(V(0, 1, 0), g.rotation.y).add(g.position), b = V(x2, 0, z2).applyAxisAngle(V(0, 1, 0), g.rotation.y).add(g.position);
        return { x1: Math.min(a.x, b.x) - .1, x2: Math.max(a.x, b.x) + .1, z1: Math.min(a.z, b.z) - .1, z2: Math.max(a.z, b.z) + .1 };
      });
      const lot = lotExtras(T, tier, { x: home.x, w: home.lotW }, home.side, home.side * frontZ, rng(900 + tier));
      scene.add(lot.group);
      const dl = g.userData.door.clone().applyAxisAngle(V(0, 1, 0), g.rotation.y).add(g.position); dl.y = 0;
      doors.find(d => d.id === 'home').pos.copy(dl);
      town.colliders = base.concat(cols, lot.cols); town.camBlockers = buildingBoxes.concat(cols);
      town._house = g; town._lot = lot.group; town.houseTier = tier;
    },
    followShadow(p) { dir.position.copy(p).add(sun.clone().multiplyScalar(60)); dir.target.position.copy(p); }
  };
  town.setHouse(0);
  return town;
}
function circleBox(p, r) { return { x1: p.x - r, x2: p.x + r, z1: p.z - r, z2: p.z + r }; }

/** draws the little "Level 7 of 25" plaque by each door */
export function paintPlaque(pl, title, line, pct, color) {
  const c = pl.canvas, x = c.getContext('2d');
  x.fillStyle = '#1b1a22'; x.fillRect(0, 0, 512, 256);
  x.strokeStyle = '#c9a64a'; x.lineWidth = 10; x.strokeRect(8, 8, 496, 240);
  x.fillStyle = '#fff'; x.font = '600 58px Fredoka, Arial, sans-serif'; x.textAlign = 'center'; x.fillText(title, 256, 92);
  x.fillStyle = '#d9d4ff'; x.font = '700 40px Nunito, Arial, sans-serif'; x.fillText(line, 256, 152);
  x.fillStyle = '#34314a'; x.fillRect(56, 186, 400, 26); x.fillStyle = color; x.fillRect(56, 186, 400 * Math.min(1, pct), 26);
  pl.tex.needsUpdate = true;
}
