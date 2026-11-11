/* ============================================================
   Wild Survival — 3D world engine (three.js r128)
   Realistic-looking terrain, forests, water, animals, camp,
   campgrounds, a way out to civilization, minimap, joystick.
   ============================================================ */
(function(){
'use strict';
const SIZE = 400, HALF = 200, SEG = 160, LIMIT = 192;

/* ---------- per-world 3D settings ---------- */
const W3 = {
  yellowstone: {
    seed: 11, hills: 14, detail: 2.5, treeType: 'pine', treeCount: 2000, forestCut: .05, forestScale: .011,
    bushes: 260, grass: 18000, rocks: 260,
    river: { z: 28, w: 8, amp: 30, name: 'Firehole River' },
    water: 0x2e5a63, start: { x: 6, z: 2 },
    colors: { meadow: 0x67743f, meadow2: 0x8c8a58, forest: 0x46472c, rock: 0x847d70, bank: 0x8a7d5c, special: 0xd9d2c0 },
    fog: [35, 175], ring: 0x6f8196, ringH: 55,
    geysers: [[72, 70], [92, 86], [58, 96], [104, 62]],
    exit: { x: 0, z: -186, label: 'Grand Loop Road', town: 'Mammoth Hot Springs', axis: 'z' },
    camps: [['Madison Campground', -120, 60], ['Norris Campground', 110, -70], ['Canyon Campground', -70, -110]],
    campKind: 'camp'
  },
  amazon: {
    seed: 23, hills: 5, detail: 1.6, treeType: 'broad', treeCount: 2600, forestCut: -.35, forestScale: .02,
    bushes: 2600, grass: 3500, rocks: 60,
    river: { z: 22, w: 15, amp: 34, name: 'Tambopata River' },
    water: 0x6b5634, start: { x: -10, z: -4 },
    colors: { meadow: 0x3f5d27, meadow2: 0x55692c, forest: 0x2f3f1c, rock: 0x6d6658, bank: 0x6a5233, special: 0x6a5233 },
    fog: [18, 120], ring: null,
    geysers: [],
    exit: { x: 186, z: 0, label: 'river port road', town: 'Puerto Maldonado', axis: 'x' },
    camps: [['Baltimore Village', -110, -70], ['Tres Chimbadas Village', 90, 95], ['Sachavacayoc Village', -60, 120]],
    campKind: 'village'
  },
  yosemite: {
    seed: 37, hills: 4, detail: 2, treeType: 'pine', treeCount: 1900, forestCut: -.05, forestScale: .014,
    bushes: 300, grass: 16000, rocks: 420, cliffs: true,
    river: { z: 6, w: 7, amp: 18, name: 'Merced River' },
    water: 0x2f5a66, start: { x: 20, z: -14 },
    colors: { meadow: 0x76823f, meadow2: 0x9a9358, forest: 0x4a4430, rock: 0xb3ada0, bank: 0x8f8466, special: 0xc9c3b6 },
    fog: [40, 200], ring: 0x8a93a3, ringH: 30,
    geysers: [],
    exit: { x: -186, z: 10, label: 'Wawona Road', town: 'Wawona', axis: 'x' },
    camps: [['Upper Pines Campground', 110, 30], ['Bridalveil Creek Camp', -90, -40], ['Housekeeping Camp', 40, 60]],
    campKind: 'camp'
  }
};

/* ---------- seeded random + noise ---------- */
function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makeNoise(seed){
  const r = mulberry(seed), p = new Uint8Array(512), base = [...Array(256).keys()];
  for (let i = 255; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  const val = (x, z) => p[(p[x & 255] + z) & 255] / 255;
  const n = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = val(ix, iz), b = val(ix + 1, iz), c = val(ix, iz + 1), d = val(ix + 1, iz + 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  };
  n.fbm = (x, z, o = 5) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++){ s += a * n(x * f, z * f); f *= 2.03; a *= .5; } return s; };
  return n;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- module state ---------- */
let renderer, scene, camera, cfg, noise, rng, T = window.THREE;
let terrain, waterMesh, skyMesh, skyMat, sunLight, hemi, stars, rainPts, ringMesh;
let trees = [], treeGrid = new Map(), treeInst = {}, animals = [], campgrounds = [], exitInfo = null;
let fire = null, shelterGroup = null, shelterLevel = -1, campPos = { x: 0, z: 0 };
let steam = [], flames = [], smokeTex, flameTex, waterfall = null;
let player = { x: 0, z: 0, y: 0, yaw: 0, pitch: -.05 };
let keys = {}, joy = { x: 0, y: 0, id: null }, look = { id: null, x: 0, y: 0, mouse: false };
let running = false, raf = 0, lastT = 0, api = null, S = null, worldId = null;
let explored = null, mapBase = null, mmCanvas = null, mmCtx = null;
const EXP = 50;  // explored grid 50x50 cells (8 m)

/* ---------- terrain height ---------- */
function riverZ(x){ const r = cfg.river; return r.z + Math.sin(x * .018) * r.amp + Math.sin(x * .047 + 1) * r.amp * .3; }
function forestMask(x, z){ return noise.fbm(x * cfg.forestScale + 40, z * cfg.forestScale - 20, 4); }
function rawHeight(x, z){
  let h = 2.2 + noise.fbm(x * .008, z * .008) * cfg.hills + noise.fbm(x * .035 + 9, z * .035 - 3, 3) * cfg.detail;
  if (cfg.cliffs){
    const e = Math.abs(z - 4) - 78;
    if (e > 0){ h += Math.pow(e / 40, 1.7) * 38 + noise.fbm(x * .02, z * .02, 4) * e * .5; }
    // Half Dome–style monolith at the east end of the north wall
    const dx = x - 150, dz = z + 120, d = Math.sqrt(dx * dx + dz * dz);
    if (d < 45) h += Math.pow(1 - d / 45, .55) * 110 * (dx > 0 ? 1 : Math.max(.3, 1 + dx / 25));
  }
  // carve the river
  const d = Math.abs(z - riverZ(x)), w = cfg.river.w;
  const t = smooth(w * 1.9, w * .45, d);
  h = h * (1 - t) + (-2.2) * t;
  // flatten the exit road area and campgrounds
  const ex = exitInfo || cfg.exit;
  const de = cfg.exit.axis === 'z' ? Math.abs(z - ex.z) : Math.abs(x - ex.x);
  if (de < 16) h = h * smooth(4, 16, de) + Math.max(1.5, h * .3) * (1 - smooth(4, 16, de));
  for (const [, cx, cz] of cfg.camps){ const dd = Math.hypot(x - cx, z - cz); if (dd < 18) { const k = smooth(18, 8, dd); h = h * (1 - k) + Math.max(1.6, heightNoCamp(cx, cz)) * k; } }
  return h;
}
function heightNoCamp(x, z){ let h = 2.2 + noise.fbm(x * .008, z * .008) * cfg.hills; const d = Math.abs(z - riverZ(x)); const t = smooth(cfg.river.w * 1.9, cfg.river.w * .45, d); return h * (1 - t) + (-2.2) * t; }
let hCache = null;
function heightAt(x, z){
  // bilinear from cache grid (matches the mesh exactly)
  const gx = (x + HALF) / SIZE * SEG, gz = (z + HALF) / SIZE * SEG;
  const ix = Math.max(0, Math.min(SEG - 1, Math.floor(gx))), iz = Math.max(0, Math.min(SEG - 1, Math.floor(gz)));
  const fx = Math.max(0, Math.min(1, gx - ix)), fz = Math.max(0, Math.min(1, gz - iz)), R = SEG + 1;
  const a = hCache[iz * R + ix], b = hCache[iz * R + ix + 1], c = hCache[(iz + 1) * R + ix], d = hCache[(iz + 1) * R + ix + 1];
  return fx + fz < 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
}
function slopeAt(x, z){ const e = 1.5; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); }

/* ---------- canvas textures ---------- */
function canvasTex(w, h, draw, repeat){
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); if (repeat){ t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 4; return t;
}
function groundDetail(){
  return canvasTex(256, 256, (g, w, h) => {
    const r = mulberry(5); g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++){ const v = 150 + r() * 105 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    g.strokeStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 900; i++){ const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 4, y - 3 - r() * 5); g.stroke(); }
    g.fillStyle = 'rgba(120,120,120,.18)'; for (let i = 0; i < 40; i++){ g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 3, 0, 7); g.fill(); }
  }, 140);
}
function barkTex(){
  return canvasTex(64, 256, (g, w, h) => {
    const r = mulberry(9); g.fillStyle = '#6a5642'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++){ const x = r() * w; g.strokeStyle = `rgba(${30 + r() * 30},${22 + r() * 20},${15},${.5 + r() * .4})`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y < h; y += 16) g.lineTo(x + (r() - .5) * 6, y); g.stroke(); }
  });
}
function grassTex(){
  return canvasTex(64, 64, (g, w, h) => {
    const r = mulberry(3);
    for (let i = 0; i < 46; i++){
      const x = 4 + r() * 56, top = 4 + r() * 26, c = 70 + r() * 70 | 0;
      g.strokeStyle = `rgb(${c * .75 | 0},${c + 30},${c * .45 | 0})`; g.lineWidth = 1.2 + r() * 1.4;
      g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + (r() - .5) * 8, (h + top) / 2, x + (r() - .5) * 14, top); g.stroke();
    }
  });
}
function glowTex(inner, outer){
  return canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, inner); gr.addColorStop(.4, outer); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
}
function plankTex(base, lines, seed){
  return canvasTex(128, 128, (g, w, h) => {
    const r = mulberry(seed); g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16){ g.fillStyle = `rgba(0,0,0,${.25 + r() * .2})`; g.fillRect(0, y, w, 2); for (let i = 0; i < 6; i++){ g.fillStyle = `rgba(255,255,255,${r() * .06})`; g.fillRect(r() * w, y + 3 + r() * 10, 20 + r() * 40, 1); } }
    if (lines) for (let i = 0; i < 400; i++){ g.fillStyle = `rgba(0,0,0,${r() * .15})`; g.fillRect(r() * w, r() * h, 1, 2 + r() * 6); }
  });
}
function thatchTex(){
  return canvasTex(128, 128, (g, w, h) => { const r = mulberry(14); g.fillStyle = '#8a7a48'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++){ const x = r() * w, y = r() * h; g.strokeStyle = `rgba(${60 + r() * 80},${50 + r() * 60},${20 + r() * 25},.8)`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 3, y + 10 + r() * 14); g.stroke(); } });
}
function canvasClothTex(col){
  return canvasTex(128, 128, (g, w, h) => { const r = mulberry(21); g.fillStyle = col; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++){ g.fillStyle = `rgba(0,0,0,${r() * .07})`; g.fillRect(r() * w, r() * h, 2, 1); }
    g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 1); });
}

/* ---------- build terrain ---------- */
function buildTerrain(){
  const geo = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, n = pos.count; hCache = new Float32Array(n);
  for (let i = 0; i < n; i++){ const x = pos.getX(i), z = pos.getZ(i), h = rawHeight(x, z); pos.setY(i, h); hCache[i] = h; }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal, col = new Float32Array(n * 3), C = cfg.colors, tmp = new T.Color(), a = new T.Color(), b = new T.Color();
  for (let i = 0; i < n; i++){
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), ny = nor.getY(i);
    a.setHex(C.meadow); b.setHex(C.meadow2); tmp.copy(a).lerp(b, smooth(-.3, .5, noise.fbm(x * .02 + 3, z * .02, 3)));
    const fm = forestMask(x, z); if (fm > cfg.forestCut) tmp.lerp(a.setHex(C.forest), smooth(cfg.forestCut, cfg.forestCut + .15, fm));
    if (y < .9) tmp.lerp(a.setHex(C.bank), smooth(.9, -.2, y));
    for (const [gx, gz] of cfg.geysers){ const d = Math.hypot(x - gx, z - gz); if (d < 26) tmp.lerp(a.setHex(C.special), smooth(26, 8, d)); }
    if (ny < .8) tmp.lerp(a.setHex(C.rock), smooth(.8, .6, ny));
    const v = .78 + noise(x * .4, z * .4) * .07 + noise(x * .06 + 50, z * .06) * .1; tmp.multiplyScalar(v);
    if (noise(x * .05 - 7, z * .05 + 3) > .45 && y > 1) tmp.lerp(a.setHex(C.bank), .35);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new T.BufferAttribute(col, 3));
  terrain = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true, map: groundDetail() }));
  terrain.receiveShadow = true; scene.add(terrain);
  // water
  const wg = new T.PlaneGeometry(SIZE * 1.6, SIZE * 1.6, 1, 1); wg.rotateX(-Math.PI / 2);
  waterMesh = new T.Mesh(wg, new T.MeshPhongMaterial({ color: cfg.water, shininess: 90, specular: 0x667788, transparent: true, opacity: .88 }));
  waterMesh.position.y = -.35; scene.add(waterMesh);
  // distant ridges
  if (cfg.ring){
    const rg = new T.CylinderGeometry(330, 330, 1, 160, 6, true), rp = rg.attributes.position;
    for (let i = 0; i < rp.count; i++){ const x = rp.getX(i), z = rp.getZ(i), y = rp.getY(i); const ang = Math.atan2(z, x);
      const hh = cfg.ringH * (.45 + .55 * (noise.fbm(Math.cos(ang) * 3 + 7, Math.sin(ang) * 3, 5) + .5)); rp.setY(i, y > 0 ? hh : -20); }
    rg.computeVertexNormals();
    ringMesh = new T.Mesh(rg, new T.MeshBasicMaterial({ color: cfg.ring, side: T.BackSide, fog: false })); scene.add(ringMesh);
  }
  // Yosemite waterfall on the north wall
  if (cfg.cliffs){
    const ft = canvasTex(32, 256, (g, w, h) => { const r = mulberry(4); g.fillStyle = 'rgba(235,242,248,.0)'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++){ g.fillStyle = `rgba(240,246,252,${.25 + r() * .5})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 10 + r() * 40); } });
    ft.wrapT = T.RepeatWrapping; ft.repeat.set(1, 3);
    const x = -60, z = -96, top = heightAt(x, z - 26), bot = heightAt(x, z);
    waterfall = new T.Mesh(new T.PlaneGeometry(6, Math.max(20, top - bot) + 6), new T.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }));
    waterfall.position.set(x, (top + bot) / 2, z - 13); waterfall.rotation.x = -.42; scene.add(waterfall);
  }
}

/* ---------- vegetation ---------- */
function pineGeo(){
  const pts = [], tiers = 6;
  pts.push(new T.Vector2(0, .15));
  for (let i = 0; i < tiers; i++){ const t = i / tiers, y0 = .15 + t * .85, r = (1 - t) * .95 + .08;
    pts.push(new T.Vector2(r, y0 + .02)); pts.push(new T.Vector2(r * .45, y0 + .85 / tiers)); }
  pts.push(new T.Vector2(0, 1.05));
  const g = new T.LatheGeometry(pts, 9), p = g.attributes.position, c = new Float32Array(p.count * 3), r = mulberry(2);
  for (let i = 0; i < p.count; i++){ const y = p.getY(i), k = .55 + y * .45 + (r() - .5) * .12;
    p.setX(i, p.getX(i) * (1 + (r() - .5) * .25)); p.setZ(i, p.getZ(i) * (1 + (r() - .5) * .25));
    c[i * 3] = .16 * k; c[i * 3 + 1] = .3 * k; c[i * 3 + 2] = .17 * k; }
  g.setAttribute('color', new T.BufferAttribute(c, 3)); g.computeVertexNormals(); return g;
}
function blobGeo(seed, detail = 2, flat = .7){
  const g = new T.IcosahedronGeometry(1, detail), p = g.attributes.position, nz = makeNoise(seed);
  for (let i = 0; i < p.count; i++){ const v = new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)); const k = 1 + nz(v.x * 2.2 + 5, v.z * 2.2 + v.y * 1.7) * .28;
    v.multiplyScalar(k); p.setXYZ(i, v.x, v.y * flat, v.z); }
  g.computeVertexNormals(); return g;
}
function addTreeGrid(t){ const k = ((t.x + HALF) / 10 | 0) + ',' + ((t.z + HALF) / 10 | 0); if (!treeGrid.has(k)) treeGrid.set(k, []); treeGrid.get(k).push(t); }
function nearTrees(x, z, r){
  const out = [], c0 = (x - r + HALF) / 10 | 0, c1 = (x + r + HALF) / 10 | 0, d0 = (z - r + HALF) / 10 | 0, d1 = (z + r + HALF) / 10 | 0;
  for (let i = c0; i <= c1; i++) for (let j = d0; j <= d1; j++){ const a = treeGrid.get(i + ',' + j); if (a) for (const t of a) if (t.alive) out.push(t); }
  return out;
}
function clearOf(x, z, r){
  if (Math.hypot(x - campPos.x, z - campPos.z) < r + 9) return false;
  for (const [, cx, cz] of cfg.camps) if (Math.hypot(x - cx, z - cz) < r + 12) return false;
  const ex = cfg.exit; if ((ex.axis === 'z' ? Math.abs(z - ex.z) : Math.abs(x - ex.x)) < 14) return false;
  return true;
}
function buildVegetation(){
  const cut = new Set(S.cut || []);
  const bark = new T.MeshLambertMaterial({ map: barkTex() });
  const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(), col = new T.Color();
  const list = [];
  let tries = 0;
  while (list.length < cfg.treeCount && tries++ < cfg.treeCount * 12){
    const x = (rng() * 2 - 1) * (HALF - 4), z = (rng() * 2 - 1) * (HALF - 4), fm = forestMask(x, z), h = heightAt(x, z);
    if (h < .6 || slopeAt(x, z) > 1.1) continue;
    const dense = fm > cfg.forestCut ? 1 : .06;
    if (rng() > dense) continue;
    if (!clearOf(x, z, 2)) continue;
    list.push({ x, z, s: cfg.treeType === 'broad' ? 9 + rng() * 14 : 9 + rng() * 13 });
  }
  const N = list.length;
  const trunkGeo = new T.CylinderGeometry(.11, .2, 1, 7); trunkGeo.translate(0, .5, 0);
  const trunks = new T.InstancedMesh(trunkGeo, bark, N);
  let crown;
  if (cfg.treeType === 'pine'){
    crown = new T.InstancedMesh(pineGeo(), new T.MeshLambertMaterial({ vertexColors: true }), N);
  } else {
    crown = new T.InstancedMesh(blobGeo(7, 2, .55), new T.MeshLambertMaterial({ color: 0xffffff }), N);
  }
  list.forEach((t, i) => {
    const y = heightAt(t.x, t.z), ang = rng() * 6.28;
    q.setFromAxisAngle(new T.Vector3(0, 1, 0), ang);
    if (cfg.treeType === 'pine'){
      sc.set(t.s * .09, t.s * .45, t.s * .09); ps.set(t.x, y - .2, t.z); m4.compose(ps, q, sc); trunks.setMatrixAt(i, m4);
      sc.set(t.s * .2, t.s, t.s * .2); ps.set(t.x, y, t.z); m4.compose(ps, q, sc); crown.setMatrixAt(i, m4);
      col.setHSL(.27 + rng() * .06, .35 + rng() * .2, .75 + rng() * .35); crown.setColorAt(i, col);
    } else {
      sc.set(t.s * .1, t.s * .8, t.s * .1); ps.set(t.x, y - .2, t.z); m4.compose(ps, q, sc); trunks.setMatrixAt(i, m4);
      const w = t.s * (.28 + rng() * .14); sc.set(w, w * .8, w); ps.set(t.x, y + t.s * .8, t.z); m4.compose(ps, q, sc); crown.setMatrixAt(i, m4);
      col.setHSL(.24 + rng() * .08, .45 + rng() * .2, .17 + rng() * .1); crown.setColorAt(i, col);
    }
    t.i = i; t.alive = !cut.has(i); t.y = y; t.r = .45;
    if (!t.alive){ m4.makeScale(0, 0, 0); trunks.setMatrixAt(i, m4); crown.setMatrixAt(i, m4); }
    trees.push(t); addTreeGrid(t);
  });
  trunks.castShadow = crown.castShadow = true; crown.receiveShadow = true;
  scene.add(trunks); scene.add(crown); treeInst = { trunks, crown };
  // bushes / understory
  const bg = blobGeo(13, 1, .65), bushes = new T.InstancedMesh(bg, new T.MeshLambertMaterial({ color: 0xffffff }), cfg.bushes);
  let k = 0, bt = 0;
  while (k < cfg.bushes && bt++ < cfg.bushes * 10){
    const x = (rng() * 2 - 1) * (HALF - 4), z = (rng() * 2 - 1) * (HALF - 4), h = heightAt(x, z);
    if (h < .5 || slopeAt(x, z) > 1 || !clearOf(x, z, 1)) continue;
    if (cfg.treeType !== 'broad' && forestMask(x, z) < cfg.forestCut - .1 && rng() < .6) continue;
    const s = .5 + rng() * (cfg.treeType === 'broad' ? 1.6 : .8);
    m4.compose(ps.set(x, h + s * .25, z), q.setFromAxisAngle(new T.Vector3(0, 1, 0), rng() * 6), sc.set(s * (1 + rng() * .5), s, s));
    bushes.setMatrixAt(k, m4); col.setHSL(.22 + rng() * .1, .4 + rng() * .25, .16 + rng() * .1); bushes.setColorAt(k, col); k++;
  }
  bushes.count = k; bushes.castShadow = true; scene.add(bushes);
  // rocks
  const rocks = new T.InstancedMesh(blobGeo(31, 1, .6), new T.MeshLambertMaterial({ color: 0xffffff, map: groundDetail() }), cfg.rocks);
  k = 0; bt = 0;
  while (k < cfg.rocks && bt++ < cfg.rocks * 10){
    const x = (rng() * 2 - 1) * (HALF - 4), z = (rng() * 2 - 1) * (HALF - 4), h = heightAt(x, z);
    if (h < -.2 || !clearOf(x, z, 1)) continue;
    const s = .3 + Math.pow(rng(), 3) * 3;
    m4.compose(ps.set(x, h + s * .1, z), q.setFromEuler(new T.Euler(rng(), rng() * 6, rng() * .5)), sc.set(s * (1 + rng()), s, s * (1 + rng() * .6)));
    rocks.setMatrixAt(k, m4); const v = .45 + rng() * .25; col.setRGB(v, v * .97, v * .92); rocks.setColorAt(k, col); k++;
  }
  rocks.count = k; rocks.castShadow = rocks.receiveShadow = true; scene.add(rocks);
  // grass tufts (crossed quads)
  const gq = new T.PlaneGeometry(.55, .34); gq.translate(0, .16, 0); const g2 = gq.clone().rotateY(Math.PI / 2);
  const merged = new T.BufferGeometry(), A = gq.attributes, B = g2.attributes;
  const posArr = new Float32Array(A.position.array.length * 2); posArr.set(A.position.array); posArr.set(B.position.array, A.position.array.length);
  const uvArr = new Float32Array(A.uv.array.length * 2); uvArr.set(A.uv.array); uvArr.set(B.uv.array, A.uv.array.length);
  const nArr = new Float32Array(posArr.length); for (let i = 0; i < nArr.length; i += 3){ nArr[i + 1] = 1; }
  const fwd = [...gq.index.array, ...[...g2.index.array].map(v => v + A.position.count)], back = [];
  for (let i = 0; i < fwd.length; i += 3) back.push(fwd[i], fwd[i + 2], fwd[i + 1]);
  const idx = [...fwd, ...back];
  merged.setAttribute('position', new T.BufferAttribute(posArr, 3)); merged.setAttribute('uv', new T.BufferAttribute(uvArr, 2)); merged.setAttribute('normal', new T.BufferAttribute(nArr, 3)); merged.setIndex(idx);
  const grass = new T.InstancedMesh(merged, new T.MeshLambertMaterial({ map: grassTex(), alphaTest: .5, color: cfg.treeType === 'broad' ? 0x5d7a3c : 0x7f7c50 }), cfg.grass);
  k = 0; bt = 0;
  while (k < cfg.grass && bt++ < cfg.grass * 6){
    const x = (rng() * 2 - 1) * (HALF - 2), z = (rng() * 2 - 1) * (HALF - 2), h = heightAt(x, z);
    if (h < .4 || slopeAt(x, z) > .7) continue;
    if (noise(x * .08 + 11, z * .08) < -.15 && rng() < .8) continue;
    const s = .6 + rng() * .9;
    m4.compose(ps.set(x, h - .03, z), q.setFromAxisAngle(new T.Vector3(0, 1, 0), rng() * 6), sc.set(s, s * (.7 + rng() * .6), s));
    grass.setMatrixAt(k, m4); col.setHSL(.13 + rng() * .1, .25, .45 + rng() * .35); grass.setColorAt(k, col); k++;
  }
  grass.count = k; scene.add(grass);
}

/* ---------- small model helpers ---------- */
const box = (w, h, d, mat) => new T.Mesh(new T.BoxGeometry(w, h, d), mat);
const cyl = (r1, r2, h, mat, seg = 8) => new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg), mat);
function prism(w, h, d, mat){ // triangular roof/tent shape, ridge along z
  const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return new T.Mesh(g, mat);
}
function shadowAll(o){ o.traverse(m => { if (m.isMesh){ m.castShadow = true; m.receiveShadow = true; } }); return o; }

/* ---------- campfire ---------- */
function buildFire(x, z){
  const g = new T.Group(), y = heightAt(x, z);
  const stoneM = new T.MeshLambertMaterial({ color: 0x77736b, map: groundDetail() });
  for (let i = 0; i < 10; i++){ const a = i / 10 * 6.28, s = blobGeo(40 + i, 0, .7), m = new T.Mesh(s, stoneM); m.scale.setScalar(.22 + Math.random() * .08); m.position.set(Math.cos(a) * .75, .08, Math.sin(a) * .75); g.add(m); }
  const logM = new T.MeshLambertMaterial({ map: barkTex() }), ash = new T.Mesh(new T.CircleGeometry(.65, 16), new T.MeshLambertMaterial({ color: 0x2a2622 }));
  ash.rotation.x = -Math.PI / 2; ash.position.y = .03; g.add(ash);
  for (let i = 0; i < 4; i++){ const l = cyl(.08, .1, 1.1, logM); l.rotation.z = Math.PI / 2 - .35; l.rotation.y = i * Math.PI / 2; l.position.y = .2; g.add(l); }
  const glow = new T.Mesh(new T.CircleGeometry(.5, 16), new T.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0 })); glow.rotation.x = -Math.PI / 2; glow.position.y = .06; g.add(glow);
  const light = new T.PointLight(0xff8a3a, 0, 22, 1.6); light.position.set(0, 1, 0); light.castShadow = false; g.add(light);
  const fl = [];
  for (let i = 0; i < 26; i++){
    const sp = new T.Sprite(new T.SpriteMaterial({ map: flameTex, color: 0xffa040, blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
    sp.userData = { life: Math.random(), sx: (Math.random() - .5) * .5, sz: (Math.random() - .5) * .5 }; g.add(sp); fl.push(sp);
  }
  const sm = [];
  for (let i = 0; i < 10; i++){
    const sp = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, color: 0x888888, transparent: true, depthWrite: false, opacity: 0 }));
    sp.userData = { life: Math.random() }; g.add(sp); sm.push(sp);
  }
  g.position.set(x, y, z); scene.add(g);
  return { g, light, glow, fl, sm };
}
function updateFire(f, lit, fuel, dt, t){
  const inten = lit ? .4 + .6 * Math.min(1, fuel / 60) : 0;
  f.light.intensity = inten * (2.2 + Math.sin(t * 17) * .3 + Math.sin(t * 7.3) * .4);
  f.glow.material.opacity = lit ? .55 + Math.sin(t * 9) * .1 : 0;
  for (const s of f.fl){
    const u = s.userData; u.life += dt * (1.3 + Math.random() * .4);
    if (u.life > 1){ u.life = 0; u.sx = (Math.random() - .5) * .55; u.sz = (Math.random() - .5) * .55; }
    const L = u.life; s.visible = lit;
    s.position.set(u.sx * (1 - L) * .7, .12 + L * 1.1 * inten, u.sz * (1 - L) * .7);
    const k = (1 - L) * (.32 + inten * .5); s.scale.set(k, k * 1.5, 1);
    s.material.color.setRGB(1, .38 + (1 - L) * .4, .08 * (1 - L)); s.material.opacity = (1 - L) * .75;
  }
  for (const s of f.sm){
    const u = s.userData; u.life += dt * .18; if (u.life > 1) u.life = 0;
    const L = u.life; s.visible = lit || fuel > 0;
    s.position.set(Math.sin(L * 5 + t * .3) * .4, 1.6 + L * 6, L * .8); s.scale.setScalar(.8 + L * 3.5); s.material.opacity = (lit ? .22 : .08) * (1 - L) * Math.min(1, L * 6);
  }
}

/* ---------- shelters (campground upgrades) ---------- */
function buildShelter(level){
  if (shelterGroup){ scene.remove(shelterGroup); shelterGroup = null; }
  if (level < 1) return;
  const g = new T.Group(), tropical = cfg.treeType === 'broad';
  const x = campPos.x + 5.5, z = campPos.z - 2.5, y = heightAt(x, z);
  const cloth = new T.MeshLambertMaterial({ map: canvasClothTex(level === 1 ? '#5f6a48' : '#cfc6b0'), side: T.DoubleSide });
  const wood = new T.MeshLambertMaterial({ map: plankTex('#6d4f33', true, 3) });
  const logs = new T.MeshLambertMaterial({ map: barkTex() });
  const roofM = tropical ? new T.MeshLambertMaterial({ map: thatchTex() }) : new T.MeshLambertMaterial({ map: plankTex('#3d3530', false, 8) });
  const winM = new T.MeshBasicMaterial({ color: 0x223038 });
  if (level === 1){                                  // starter tent
    const t = prism(2.4, 1.6, 3, cloth); g.add(t);
    const door = new T.Mesh(new T.CircleGeometry(.55, 3), new T.MeshLambertMaterial({ color: 0x2a241c })); door.position.set(0, .45, 1.51); door.rotation.z = Math.PI / 2; door.scale.set(1, 1.2, 1); g.add(door);
    for (const s of [-1, 1]){ const pole = cyl(.03, .03, 1.7, logs, 5); pole.position.set(0, .85, s * 1.5); g.add(pole); }
  } else if (level === 2){                           // wall tent / palm shelter
    if (tropical){
      for (const [px, pz] of [[-1.8, -1.6], [1.8, -1.6], [-1.8, 1.6], [1.8, 1.6]]){ const p = cyl(.09, .11, 2.2, logs, 6); p.position.set(px, 1.1, pz); g.add(p); }
      const r = prism(4.6, 1.8, 4.2, roofM); r.position.y = 2.1; g.add(r);
      const floor = box(3.8, .12, 3.4, wood); floor.position.y = .5; g.add(floor);
      const ham = new T.Mesh(new T.CylinderGeometry(.35, .35, 2.6, 10, 1, true, 0, Math.PI), new T.MeshLambertMaterial({ color: 0xa8453a, side: T.DoubleSide }));
      ham.rotation.z = Math.PI / 2; ham.rotation.x = Math.PI; ham.position.set(0, 1.3, 0); g.add(ham);
    } else {
      const wall = box(3.2, 1.3, 4.2, cloth); wall.position.y = .65; g.add(wall);
      const roof = prism(3.6, 1.2, 4.4, cloth); roof.position.y = 1.3; g.add(roof);
      const flap = box(1, 1.2, .05, new T.MeshLambertMaterial({ color: 0x3a3226 })); flap.position.set(0, .6, 2.12); g.add(flap);
      const pipe = cyl(.08, .08, 1.4, new T.MeshLambertMaterial({ color: 0x3c3c3c })); pipe.position.set(.9, 2.2, -1.2); g.add(pipe);
    }
  } else {                                           // cabin / stilt hut, lodge = bigger with porch
    const big = level >= 4, W = big ? 6.4 : 4.4, D = big ? 5.6 : 3.8, H = 2.4, stilt = tropical ? 1.6 : 0;
    if (tropical){ for (let i = 0; i <= 3; i++) for (const sz of [-1, 1]){ const p = cyl(.12, .14, stilt + .2, logs, 6); p.position.set(-W / 2 + i * W / 3, stilt / 2, sz * D / 2); g.add(p); } }
    const base = new T.Group(); base.position.y = stilt; g.add(base);
    if (tropical){
      const f = box(W + .8, .15, D + .8, wood); f.position.y = 0; base.add(f);
      const walls = box(W, H, D, wood); walls.position.y = H / 2; base.add(walls);
    } else {
      for (let row = 0; row < 9; row++){ const y0 = .14 + row * .27;
        for (const sz of [-1, 1]){ const l = cyl(.14, .14, W + .5, logs, 7); l.rotation.z = Math.PI / 2; l.position.set(0, y0, sz * D / 2); base.add(l); }
        for (const sx of [-1, 1]){ const l = cyl(.14, .14, D + .5, logs, 7); l.rotation.x = Math.PI / 2; l.position.set(sx * W / 2, y0 + .13, 0); base.add(l); } }
      const fill = box(W - .1, H, D - .1, new T.MeshLambertMaterial({ color: 0x4a3524 })); fill.position.y = H / 2; base.add(fill);
      const ch = box(.8, H + 2.2, .8, new T.MeshLambertMaterial({ color: 0x6f6a62, map: groundDetail() })); ch.position.set(W / 2 + .2, (H + 2.2) / 2, -D / 4); base.add(ch);
    }
    const roof = prism(W + 1.2, big ? 2.2 : 1.7, D + 1.2, roofM); roof.rotation.y = Math.PI / 2; roof.position.y = H; base.add(roof);
    const door = box(.9, 1.8, .08, new T.MeshLambertMaterial({ color: 0x2b1c10 })); door.position.set(0, .9, D / 2 + .1); base.add(door);
    for (const sx of [-1, 1]){ const w = box(.8, .7, .06, winM); w.position.set(sx * W / 3.2, 1.4, D / 2 + .12); w.userData.win = true; base.add(w); }
    if (big){ const deck = box(W + .4, .15, 2, wood); deck.position.set(0, .08, D / 2 + 1); base.add(deck);
      for (let i = 0; i < 5; i++){ const p = cyl(.06, .06, 1, logs, 5); p.position.set(-W / 2 + i * W / 4, .55, D / 2 + 1.9); base.add(p); }
      const rail = cyl(.05, .05, W, logs, 5); rail.rotation.z = Math.PI / 2; rail.position.set(0, 1, D / 2 + 1.9); base.add(rail); }
  }
  g.position.set(x, y, z); g.rotation.y = -.5; shadowAll(g); scene.add(g); shelterGroup = g; shelterLevel = level;
}

/* ---------- campgrounds / villages + civilization ---------- */
function buildCampgrounds(){
  const cloth = ['#3f6b8f', '#a8453a', '#6b8f3f', '#c98b2a'].map(c => new T.MeshLambertMaterial({ map: canvasClothTex(c), side: T.DoubleSide }));
  const wood = new T.MeshLambertMaterial({ map: plankTex('#7a5a3a', true, 5) }), roofM = cfg.campKind === 'village' ? new T.MeshLambertMaterial({ map: thatchTex() }) : new T.MeshLambertMaterial({ map: plankTex('#4a3f37', false, 2) });
  cfg.camps.forEach(([name, cx, cz], i) => {
    const g = new T.Group(), y = heightAt(cx, cz);
    if (cfg.campKind === 'village'){
      for (let k = 0; k < 4; k++){ const a = k / 4 * 6.28 + .4, hx = Math.cos(a) * 8, hz = Math.sin(a) * 8;
        const h = new T.Group(); for (const [px, pz] of [[-1.5, -1.3], [1.5, -1.3], [-1.5, 1.3], [1.5, 1.3]]){ const p = cyl(.1, .1, 1.4, wood, 5); p.position.set(px, .7, pz); h.add(p); }
        const body = box(3.4, 2, 3, wood); body.position.y = 2.4; h.add(body); const r = prism(4.2, 1.6, 3.8, roofM); r.rotation.y = Math.PI / 2; r.position.y = 3.4; h.add(r);
        h.position.set(hx, 0, hz); h.rotation.y = -a + Math.PI / 2; g.add(h); }
      const canoe = new T.Mesh(new T.CylinderGeometry(.35, .35, 4, 8, 1, true, 0, Math.PI), new T.MeshLambertMaterial({ color: 0x5a3c22, side: T.DoubleSide })); canoe.rotation.set(Math.PI, 0, Math.PI / 2); canoe.position.set(0, .3, 12); g.add(canoe);
    } else {
      for (let k = 0; k < 3; k++){ const t = prism(2.4, 1.5, 2.8, cloth[(i + k) % 4]); t.position.set(-7 + k * 6, 0, -5 + (k % 2) * 3); t.rotation.y = k * .7; g.add(t); }
      const table = new T.Group(); const top = box(2, .08, .8, wood); top.position.y = .75; table.add(top); for (const s of [-1, 1]){ const b = box(2, .06, .3, wood); b.position.set(0, .45, s * .6); table.add(b); } table.position.set(3, 0, 4); g.add(table);
      const hut = new T.Group(), body = box(4, 2.6, 3.4, wood); body.position.y = 1.3; hut.add(body); const r = prism(4.8, 1.4, 4, roofM); r.rotation.y = Math.PI / 2; r.position.y = 2.6; hut.add(r);
      hut.position.set(-3, 0, 7); g.add(hut);
      const car = new T.Group(), carM = new T.MeshLambertMaterial({ color: [0x7a2a24, 0x2a4a6a, 0x5a5a52][i % 3] }); const cb = box(1.8, .8, 4.2, carM); cb.position.y = .7; car.add(cb); const cab = box(1.6, .7, 2.2, new T.MeshLambertMaterial({ color: 0x1d2328 })); cab.position.set(0, 1.4, -.2); car.add(cab); car.position.set(9, 0, 3); car.rotation.y = .3; g.add(car);
    }
    const sign = new T.Group(), post = cyl(.08, .08, 2, wood, 5); post.position.y = 1; sign.add(post);
    const st = canvasTex(256, 96, (c2) => { c2.fillStyle = '#4a3420'; c2.fillRect(0, 0, 256, 96); c2.strokeStyle = '#d9c39a'; c2.lineWidth = 4; c2.strokeRect(6, 6, 244, 84); c2.fillStyle = '#efe2c4'; c2.font = 'bold 22px sans-serif'; c2.textAlign = 'center'; c2.fillText(name.toUpperCase(), 128, 56, 230); });
    const board = new T.Mesh(new T.PlaneGeometry(1.8, .7), new T.MeshLambertMaterial({ map: st, side: T.DoubleSide })); board.position.y = 1.9; sign.add(board); sign.position.set(10, 0, -9); g.add(sign);
    const f = buildFire(cx + 2, cz); fireExtras.push(f);
    g.position.set(cx, y, cz); shadowAll(g); scene.add(g);
    campgrounds.push({ id: i, name, x: cx, z: cz });
  });
  // civilization at the exit: road, buildings, cars
  const ex = cfg.exit, roadM = new T.MeshLambertMaterial({ color: 0x3a3a3a, map: groundDetail() }), lineM = new T.MeshBasicMaterial({ color: 0xd9b84a });
  const g = new T.Group(); const along = ex.axis === 'z';
  const rd = new T.Mesh(new T.PlaneGeometry(along ? SIZE : 7, along ? 7 : SIZE), roadM); rd.rotation.x = -Math.PI / 2; rd.position.y = .06; g.add(rd);
  for (let i = -20; i < 20; i++){ const l = new T.Mesh(new T.PlaneGeometry(along ? 3 : .15, along ? .15 : 3), lineM); l.rotation.x = -Math.PI / 2; l.position.set(along ? i * 10 : 0, .08, along ? 0 : i * 10); g.add(l); }
  const bm = [0x8a7a64, 0x6f6458, 0x9a8c74].map(c => new T.MeshLambertMaterial({ color: c, map: plankTex('#' + c.toString(16), false, c % 7) }));
  for (let k = 0; k < 4; k++){ const b = new T.Group(), body = box(6, 3.4, 5, bm[k % 3]); body.position.y = 1.7; b.add(body); const r = prism(6.8, 1.6, 5.6, new T.MeshLambertMaterial({ color: 0x3a3430 })); r.rotation.y = Math.PI / 2; r.position.y = 3.4; b.add(r);
    const off = (k - 1.5) * 14; b.position.set(along ? off : -9, 0, along ? -9 : off); if (!along) b.rotation.y = Math.PI / 2; g.add(b); }
  const st = canvasTex(256, 96, (c2) => { c2.fillStyle = '#1f4d2e'; c2.fillRect(0, 0, 256, 96); c2.strokeStyle = '#fff'; c2.lineWidth = 3; c2.strokeRect(5, 5, 246, 86); c2.fillStyle = '#fff'; c2.font = 'bold 24px sans-serif'; c2.textAlign = 'center'; c2.fillText(ex.town.toUpperCase(), 128, 44, 230); c2.font = '18px sans-serif'; c2.fillText(ex.label, 128, 72, 230); });
  const sign = new T.Mesh(new T.PlaneGeometry(3, 1.1), new T.MeshLambertMaterial({ map: st, side: T.DoubleSide })); sign.position.set(along ? 6 : 6, 2.4, along ? 6 : 6); if (!along) sign.rotation.y = Math.PI / 2; g.add(sign);
  for (const s of [-1, 1]){ const p = cyl(.06, .06, 2.4, new T.MeshLambertMaterial({ color: 0x777777 })); p.position.set(along ? 6 + s * 1.3 : 6, 1.2, along ? 6 : 6 + s * 1.3); g.add(p); }
  const ey = heightAt(ex.x, ex.z); g.position.set(along ? 0 : ex.x, ey, along ? ex.z : 0); shadowAll(g); scene.add(g);
  exitInfo = { x: ex.x, z: ex.z };
}
let fireExtras = [];

/* ---------- geysers (Yellowstone) ---------- */
function buildGeysers(){
  for (const [gx, gz] of cfg.geysers){
    const y = heightAt(gx, gz);
    const pool = new T.Mesh(new T.CircleGeometry(3.2, 32), new T.MeshBasicMaterial({ map: canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, '#1d6f9a'); gr.addColorStop(.45, '#3fa6c4'); gr.addColorStop(.62, '#a9d1b0'); gr.addColorStop(.75, '#e7c44a'); gr.addColorStop(.9, '#d27a2c'); gr.addColorStop(1, 'rgba(200,120,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }), transparent: true }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(gx, y + .05, gz); scene.add(pool);
    const ps = [];
    for (let i = 0; i < 16; i++){ const sp = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 })); sp.userData = { life: Math.random() }; sp.position.set(gx, y, gz); scene.add(sp); ps.push(sp); }
    steam.push({ x: gx, y, z: gz, ps, phase: Math.random() * 100 });
  }
}
function updateSteam(dt, t, hour){
  for (const s of steam){
    const cyc = ((hour * 60 + s.phase) % 90) / 90, erupt = cyc < .06;   // Old Faithful-ish: every 90 game minutes
    for (const sp of s.ps){
      const u = sp.userData; u.life += dt * (erupt ? .9 : .25); if (u.life > 1) u.life = 0;
      const L = u.life, hgt = erupt ? 30 : 7;
      sp.position.set(s.x + Math.sin(L * 4 + u.life) * L * 2, s.y + L * hgt, s.z + L * 3);
      sp.scale.setScalar((erupt ? 3 : 2) + L * (erupt ? 9 : 6)); sp.material.opacity = (erupt ? .55 : .25) * (1 - L) * Math.min(1, L * 8);
    }
  }
}

/* ---------- animals ---------- */
const SPEC = {
  hare:{ len:.45, h:.28, col:0x8a7a62, leg:.1, ears:1, sp:5 }, grouse:{ len:.35, h:.22, col:0x6b5a44, leg:.08, bird:1, sp:3 },
  squirrel:{ len:.35, h:.18, col:0x8c8a84, leg:.07, tail:1, sp:4 },
  deer:{ len:1.4, h:.95, col:0x8a6a4a, leg:.7, neck:1, sp:6 }, elk:{ len:2.1, h:1.35, col:0x7a5a3a, leg:.85, neck:1, antlers:1, sp:5 },
  bison:{ len:2.7, h:1.6, col:0x3a2a1c, leg:.55, hump:1, sp:2 }, bear:{ len:1.6, h:.9, col:0x1f1712, leg:.45, sp:3 },
  capybara:{ len:1.1, h:.55, col:0x7a5a3a, leg:.22, sp:2.5 }, agouti:{ len:.55, h:.3, col:0x8a5a2a, leg:.18, sp:5 },
  peccary:{ len:1, h:.55, col:0x3a3330, leg:.25, sp:4 }, tapir:{ len:2, h:1, col:0x2a2624, leg:.45, sp:2.5 },
  caiman:{ len:2.4, h:.28, col:0x3b4430, leg:.12, reptile:1, sp:1.5 }
};
function animalModel(id){
  const s = SPEC[id] || SPEC.deer, g = new T.Group(), m = new T.MeshLambertMaterial({ color: s.col }), dark = new T.MeshLambertMaterial({ color: 0x1a140e });
  const body = new T.Mesh(new T.SphereGeometry(.5, 12, 10), m); body.scale.set(s.h * .9, s.h * (s.reptile ? .5 : .75), s.len); body.position.y = s.leg + s.h * .3; g.add(body);
  if (s.hump){ const hp = new T.Mesh(new T.SphereGeometry(.5, 10, 8), m); hp.scale.set(s.h * .85, s.h * .7, s.len * .45); hp.position.set(0, s.leg + s.h * .62, s.len * .18); g.add(hp); }
  const head = new T.Mesh(new T.SphereGeometry(.5, 10, 8), m); const hs = s.reptile ? s.h * 1.3 : s.h * .45; head.scale.set(hs * .8, hs * .75, hs * (s.reptile ? 2.4 : 1.4));
  head.position.set(0, s.leg + s.h * (s.neck ? .95 : s.reptile ? .1 : .5), s.len * .55); g.add(head);
  if (s.neck){ const n = cyl(s.h * .14, s.h * .2, s.h * .7, m); n.position.set(0, s.leg + s.h * .65, s.len * .42); n.rotation.x = .6; g.add(n); }
  if (s.ears){ for (const e of [-1, 1]){ const ear = new T.Mesh(new T.SphereGeometry(.5, 6, 5), m); ear.scale.set(.04, .16, .03); ear.position.set(e * .05, s.leg + s.h * .9, s.len * .5); g.add(ear); } }
  if (s.tail){ const t = new T.Mesh(new T.SphereGeometry(.5, 8, 6), m); t.scale.set(.12, .3, .12); t.position.set(0, s.leg + .22, -s.len * .55); t.rotation.x = -.5; g.add(t); }
  if (s.antlers){ for (const e of [-1, 1]){ for (let k = 0; k < 3; k++){ const a = cyl(.02, .03, .6, new T.MeshLambertMaterial({ color: 0xcfc2a5 }), 4); a.position.set(e * (.15 + k * .1), s.leg + s.h * 1.25 + k * .12, s.len * .5 - k * .12); a.rotation.z = e * (.5 + k * .2); g.add(a); } } }
  const legs = [];
  if (!s.bird){ for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]){
    const piv = new T.Group(); piv.position.set(lx * s.h * .25, s.leg + s.h * .1, lz * s.len * .3);
    const L = cyl(s.h * .07 + .01, s.h * .05 + .01, s.leg + s.h * .1, s.reptile ? m : dark, 5); L.position.y = -(s.leg + s.h * .1) / 2; piv.add(L); g.add(piv); legs.push(piv); } }
  else { const L = cyl(.01, .01, s.leg, dark, 4); L.position.y = s.leg / 2; g.add(L); }
  shadowAll(g); return { g, legs, s };
}
function spawnAnimals(){
  const pool = Object.entries(WORLDS[worldId].regions).reduce((acc, [, r]) => { for (const [k, w] of Object.entries(r.animals)) acc[k] = (acc[k] || 0) + w; return acc; }, {});
  const ids = Object.entries(pool), total = ids.reduce((a, [, w]) => a + w, 0);
  for (let i = 0; i < 26; i++){
    let r = rng() * total, id = ids[0][0]; for (const [k, w] of ids){ if ((r -= w) <= 0){ id = k; break; } }
    spawnAnimal(id, true);
  }
}
function spawnAnimal(id, anywhere){
  let x, z, tries = 0;
  do { const a = rng() * 6.28, d = anywhere ? 25 + rng() * 170 : 70 + rng() * 60;
    x = (anywhere ? 0 : player.x) + Math.cos(a) * d; z = (anywhere ? 0 : player.z) + Math.sin(a) * d; }
  while ((Math.abs(x) > LIMIT || Math.abs(z) > LIMIT || heightAt(x, z) < (id === 'caiman' ? -1.5 : .5) || slopeAt(x, z) > .9) && tries++ < 40);
  const md = animalModel(id); md.g.position.set(x, heightAt(x, z), z); scene.add(md.g);
  animals.push({ id, ...md, x, z, tx: x, tz: z, wait: rng() * 3, phase: 0, alive: true });
}
function updateAnimals(dt){
  for (const a of animals){
    if (!a.alive) continue;
    const dp = Math.hypot(player.x - a.x, player.z - a.z);
    const flee = dp < (a.id === 'bison' || a.id === 'bear' || a.id === 'caiman' ? 6 : 14);
    if (flee){ const k = 20 / Math.max(dp, .1); a.tx = a.x + (a.x - player.x) * k * .5; a.tz = a.z + (a.z - player.z) * k * .5; a.wait = 0; }
    let dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz), moving = false;
    if (d < .5){ a.wait -= dt; if (a.wait <= 0){ const ang = Math.random() * 6.28, r = 6 + Math.random() * 25; a.tx = a.x + Math.cos(ang) * r; a.tz = a.z + Math.sin(ang) * r; a.wait = 2 + Math.random() * 6; } }
    else {
      const sp = a.s.sp * (flee ? 1.8 : .35) * dt, nx = a.x + dx / d * sp, nz = a.z + dz / d * sp, nh = heightAt(nx, nz);
      if (Math.abs(nx) < LIMIT && Math.abs(nz) < LIMIT && (nh > .2 || a.id === 'caiman' || a.id === 'capybara' || a.id === 'tapir')){ a.x = nx; a.z = nz; moving = true; }
      else { a.tx = a.x; a.tz = a.z; }
      a.g.rotation.y = Math.atan2(dx, dz);
    }
    a.phase += dt * (moving ? (flee ? 14 : 7) : 0);
    a.legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(a.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * .55 : 0);
    a.g.position.set(a.x, Math.max(heightAt(a.x, a.z), a.id === 'caiman' ? -.45 : -5) + (moving ? Math.abs(Math.sin(a.phase)) * .03 : 0), a.z);
  }
}

/* ---------- sky + weather ---------- */
function buildSky(){
  skyMat = new T.ShaderMaterial({ uniforms: { top: { value: new T.Color() }, bottom: { value: new T.Color() }, sunDir: { value: new T.Vector3() }, sunCol: { value: new T.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); vec3 c = mix(bottom, top, pow(h, 0.55)); float s = max(dot(normalize(vP), normalize(sunDir)), 0.0); c += sunCol * (pow(s, 600.0) * 1.5 + pow(s, 12.0) * 0.25); gl_FragColor = vec4(c, 1.0); }',
    side: T.BackSide, depthWrite: false, fog: false });
  skyMesh = new T.Mesh(new T.SphereGeometry(380, 32, 16), skyMat); scene.add(skyMesh);
  const sg = new T.BufferGeometry(), sp = []; const r = mulberry(77);
  for (let i = 0; i < 1400; i++){ const th = r() * 6.28, ph = Math.acos(r() * .95); sp.push(Math.sin(ph) * Math.cos(th) * 360, Math.cos(ph) * 360, Math.sin(ph) * Math.sin(th) * 360); }
  sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
  stars = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); scene.add(stars);
  const rg = new T.BufferGeometry(), rp = new Float32Array(2400 * 3); for (let i = 0; i < rp.length; i += 3){ rp[i] = (Math.random() - .5) * 60; rp[i + 1] = Math.random() * 30; rp[i + 2] = (Math.random() - .5) * 60; }
  rg.setAttribute('position', new T.BufferAttribute(rp, 3));
  rainPts = new T.Points(rg, new T.PointsMaterial({ color: 0xaab8c8, size: .08, transparent: true, opacity: .7 })); rainPts.visible = false; scene.add(rainPts);
}
const PAL = {
  night: { top: 0x050914, bot: 0x111a2a, sun: .0, hemi: .16 },
  dawn:  { top: 0x2c4470, bot: 0xe39a6c, sun: .5, hemi: .5 },
  day:   { top: 0x3f74b5, bot: 0xbcd3e3, sun: .95, hemi: .62 },
  dusk:  { top: 0x283a66, bot: 0xd9805a, sun: .45, hemi: .45 }
};
function lerpPal(a, b, t){ const c1 = new T.Color(a.top).lerp(new T.Color(b.top), t), c2 = new T.Color(a.bot).lerp(new T.Color(b.bot), t); return { top: c1, bot: c2, sun: a.sun + (b.sun - a.sun) * t, hemi: a.hemi + (b.hemi - a.hemi) * t }; }
function palette(h){
  if (h < 5) return lerpPal(PAL.night, PAL.night, 0);
  if (h < 7) return lerpPal(PAL.night, PAL.dawn, (h - 5) / 2);
  if (h < 9) return lerpPal(PAL.dawn, PAL.day, (h - 7) / 2);
  if (h < 17.5) return lerpPal(PAL.day, PAL.day, 0);
  if (h < 19.5) return lerpPal(PAL.day, PAL.dusk, (h - 17.5) / 2);
  if (h < 21) return lerpPal(PAL.dusk, PAL.night, (h - 19.5) / 1.5);
  return lerpPal(PAL.night, PAL.night, 0);
}
function updateSky(h, rain){
  const p = palette(h), green = cfg.treeType === 'broad';
  if (green){ p.bot.lerp(new T.Color(0xb7c2ae), .35 * p.hemi); }
  if (rain > 0){ const g = new T.Color(0x5a6470).multiplyScalar(.4 + p.hemi * .8); p.top.lerp(g, .7); p.bot.lerp(g, .7); p.sun *= .3; }
  skyMat.uniforms.top.value.copy(p.top); skyMat.uniforms.bottom.value.copy(p.bot);
  scene.fog.color.copy(p.bot); renderer.setClearColor(p.bot);
  if (ringMesh) ringMesh.material.color.setHex(cfg.ring).lerp(p.bot, .55).multiplyScalar(.6 + p.hemi * .5);
  const ang = (h - 6) / 12 * Math.PI, el = Math.sin(ang), dir = new T.Vector3(Math.cos(ang) * .8, Math.max(el, -.3), .45).normalize();
  skyMat.uniforms.sunDir.value.copy(dir); skyMat.uniforms.sunCol.value.setRGB(1, .85, .6).multiplyScalar(el > -.05 && rain <= 0 ? 1 : 0);
  sunLight.intensity = p.sun * Math.max(0, Math.min(1, el * 4 + .2)); hemi.intensity = p.hemi;
  sunLight.color.setRGB(1, .8 + Math.min(.2, el * .3), .65 + Math.min(.35, el * .5));
  sunLight.position.set(player.x + dir.x * 120, Math.max(10, dir.y * 120), player.z + dir.z * 120); sunLight.target.position.set(player.x, 0, player.z); sunLight.target.updateMatrixWorld();
  stars.material.opacity = Math.max(0, 1 - p.hemi * 2.4) * (rain > 0 ? .2 : 1);
  scene.fog.near = cfg.fog[0] * (rain > 0 ? .6 : 1); scene.fog.far = cfg.fog[1] * (rain > 0 ? .55 : 1) * (p.hemi < .3 ? .7 : 1);
  // cabin windows glow at night
  if (shelterGroup) shelterGroup.traverse(m => { if (m.userData && m.userData.win) m.material.color.setHex(p.hemi < .45 ? 0xffc46a : 0x223038); });
}

/* ---------- input ---------- */
function bindInput(canvas){
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', e => { look.mouse = true; look.x = e.clientX; look.y = e.clientY; });
  window.addEventListener('mouseup', () => look.mouse = false);
  window.addEventListener('mousemove', e => { if (!look.mouse || !running) return; turn(e.clientX - look.x, e.clientY - look.y); look.x = e.clientX; look.y = e.clientY; });
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (look.id === null){ look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; } e.preventDefault(); }, { passive: false });
  window.addEventListener('touchmove', e => { for (const t of e.changedTouches){ if (t.identifier === joy.id) moveJoy(t); else if (t.identifier === look.id){ turn((t.clientX - look.x) * 1.4, (t.clientY - look.y) * 1.4); look.x = t.clientX; look.y = t.clientY; } } }, { passive: true });
  window.addEventListener('touchend', e => { for (const t of e.changedTouches){ if (t.identifier === joy.id){ joy.id = null; joy.x = joy.y = 0; setKnob(); } if (t.identifier === look.id) look.id = null; } });
  const J = document.getElementById('joy');
  J.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); const t = e.changedTouches[0]; joy.id = t.identifier; moveJoy(t); }, { passive: false });
  J.addEventListener('mousedown', e => { e.stopPropagation(); joy.id = 'm'; moveJoy(e); const mm = ev => moveJoy(ev), up = () => { joy.id = null; joy.x = joy.y = 0; setKnob(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', mm); window.addEventListener('mouseup', up); });
}
function onKey(e){ if (!running || /input|textarea/i.test(e.target.tagName) || document.getElementById('veil').classList.contains('on')) return; keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'e' && api) api.use(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault(); }
function onKeyUp(e){ keys[e.key.toLowerCase()] = false; }
function turn(dx, dy){ player.yaw -= dx * .0045; player.pitch = Math.max(-1.2, Math.min(1, player.pitch - dy * .0035)); }
function moveJoy(t){ const r = document.getElementById('joy').getBoundingClientRect(); let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1){ dx /= l; dy /= l; } joy.x = dx; joy.y = dy; setKnob(); }
function setKnob(){ const k = document.getElementById('knob'); if (k) k.style.transform = `translate(${joy.x * 38}px, ${joy.y * 38}px)`; }

/* ---------- minimap ---------- */
function buildMapBase(){
  const c = document.createElement('canvas'); c.width = c.height = 200; const g = c.getContext('2d'), img = g.createImageData(200, 200), C = cfg.colors, tmp = new T.Color();
  for (let j = 0; j < 200; j++) for (let i = 0; i < 200; i++){
    const x = i * 2 - HALF + 1, z = j * 2 - HALF + 1, h = heightAt(x, z), sl = slopeAt(x, z); let col;
    if (h < -.3) col = cfg.treeType === 'broad' ? [120, 96, 60] : [64, 112, 130];
    else { tmp.setHex(C.meadow); if (forestMask(x, z) > cfg.forestCut) tmp.setHex(C.forest).multiplyScalar(.8); if (sl > .6) tmp.setHex(C.rock); for (const [gx, gz] of cfg.geysers) if (Math.hypot(x - gx, z - gz) < 18) tmp.setHex(C.special);
      const shade = .8 + Math.max(-.2, Math.min(.3, (heightAt(x - 2, z - 2) - h) * -.08)); col = [tmp.r * 255 * shade, tmp.g * 255 * shade, tmp.b * 255 * shade]; }
    const o = (j * 200 + i) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = 'rgba(20,40,20,.55)'; for (const t of trees) if (t.alive) g.fillRect((t.x + HALF) / 2, (t.z + HALF) / 2, 1, 1);
  g.fillStyle = '#555'; const ex = cfg.exit; if (ex.axis === 'z') g.fillRect(0, (ex.z + HALF) / 2 - 1.5, 200, 3); else g.fillRect((ex.x + HALF) / 2 - 1.5, 0, 3, 200);
  mapBase = c;
}
function markExplored(){
  const ci = (player.x + HALF) / 8 | 0, cj = (player.z + HALF) / 8 | 0, R = 4; let changed = false;
  for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++){
    if (i < 0 || j < 0 || i >= EXP || j >= EXP || (i - ci) ** 2 + (j - cj) ** 2 > R * R) continue;
    if (explored[j * EXP + i] !== '1'){ explored = explored.substring(0, j * EXP + i) + '1' + explored.substring(j * EXP + i + 1); changed = true; }
  }
  if (changed) S.explored = explored;
}
function drawMap(ctx, size, full){
  const k = size / 200; ctx.clearRect(0, 0, size, size);
  ctx.drawImage(mapBase, 0, 0, size, size);
  ctx.fillStyle = 'rgba(10,14,12,.62)';
  for (let j = 0; j < EXP; j++) for (let i = 0; i < EXP; i++) if (explored[j * EXP + i] !== '1') ctx.fillRect(i * 4 * k, j * 4 * k, 4 * k + .6, 4 * k + .6);
  const P = (x, z) => [(x + HALF) / 2 * k, (z + HALF) / 2 * k];
  const pin = (x, z, col, label, r = 4) => { const [px, py] = P(x, z); ctx.fillStyle = col; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, r * Math.max(1, k * .8), 0, 7); ctx.fill(); ctx.stroke();
    if (label && full){ ctx.font = 'bold 12px Inter, sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3; ctx.strokeText(label, px + 8, py + 4); ctx.fillText(label, px + 8, py + 4); } };
  pin(campPos.x, campPos.z, '#ff8a2a', 'Your camp');
  for (const c of campgrounds) if ((S.found || []).includes(c.id)) pin(c.x, c.z, '#6fb3d9', c.name);
  if (S.seenExit || S.escaped) pin(cfg.exit.x, cfg.exit.z, '#6fbf6a', cfg.exit.town);
  for (const a of animals) if (a.alive && Math.hypot(a.x - player.x, a.z - player.z) < 45){ const [px, py] = P(a.x, a.z); ctx.fillStyle = '#e8d9b0'; ctx.fillRect(px - 1.5, py - 1.5, 3, 3); }
  const [px, py] = P(player.x, player.z); ctx.save(); ctx.translate(px, py); ctx.rotate(-player.yaw + Math.PI);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 7 * Math.max(1, k * .6)); ctx.lineTo(4.5 * Math.max(1, k * .6), -5 * Math.max(1, k * .6)); ctx.lineTo(0, -2.5); ctx.lineTo(-4.5 * Math.max(1, k * .6), -5 * Math.max(1, k * .6)); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = 'rgba(217,164,65,.8)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, size - 2, size - 2);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${full ? 14 : 10}px Inter, sans-serif`; ctx.fillText('N', size / 2 - 4, full ? 16 : 11);
}

/* ---------- main loop ---------- */
let hintTimer = 0, sinceSave = 0;
function loop(t){
  if (!running) return;
  raf = requestAnimationFrame(loop);
  const now = t / 1000, dt = Math.min(.1, now - (lastT || now)); lastT = now;
  const veilOpen = document.getElementById('veil').classList.contains('on');
  // movement
  let mx = 0, mz = 0;
  if (!veilOpen){
    if (keys['w'] || keys['arrowup']) mz += 1; if (keys['s'] || keys['arrowdown']) mz -= 1;
    if (keys['a']) mx -= 1; if (keys['d']) mx += 1;
    if (keys['arrowleft']) player.yaw += dt * 1.8; if (keys['arrowright']) player.yaw -= dt * 1.8;
    if (joy.id !== null){ mx += joy.x; mz -= joy.y; }
  }
  const len = Math.hypot(mx, mz);
  if (len > .05 && !S.over){
    const run = keys['shift'] || len > .95 && joy.id !== null, sp = (run ? 7.5 : 3.6) * (S.energy < 10 ? .5 : 1) * Math.min(1, len);
    const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    let nx = player.x + (-fx * mz + fz * mx) / len * sp * dt * Math.min(1, len), nz = player.z + (-fz * mz - fx * mx) / len * sp * dt * Math.min(1, len);
    nx = Math.max(-LIMIT, Math.min(LIMIT, nx)); nz = Math.max(-LIMIT, Math.min(LIMIT, nz));
    const nh = heightAt(nx, nz), oh = heightAt(player.x, player.z);
    if (nh > -1.4 && (nh - oh) / (sp * dt + .001) < 1.6){
      for (const tr of nearTrees(nx, nz, 2)){ const d = Math.hypot(nx - tr.x, nz - tr.z); if (d < tr.r + .35){ nx = tr.x + (nx - tr.x) / d * (tr.r + .35); nz = tr.z + (nz - tr.z) / d * (tr.r + .35); } }
      player.x = nx; player.z = nz;
    }
    api.walked(sp * dt, run);
    player.bob = (player.bob || 0) + dt * sp * 2.2;
  }
  const gh = heightAt(player.x, player.z);
  player.y += ((Math.max(gh, -1.1) + 1.7 + Math.sin(player.bob || 0) * .045 * (len > .05 ? 1 : 0)) - player.y) * Math.min(1, dt * 12);
  camera.position.set(player.x, player.y, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  skyMesh.position.copy(camera.position); stars.position.copy(camera.position); if (ringMesh) ringMesh.position.set(player.x, 0, player.z);
  // world updates
  updateSky(S.hour, S.rain || 0);
  updateFire(fire, S.camp.lit, S.camp.fuel, dt, now);
  for (const f of fireExtras) updateFire(f, true, 70, dt, now);
  updateSteam(dt, now, S.hour);
  updateAnimals(dt);
  if (waterfall) waterfall.material.map.offset.y -= dt * .8;
  waterMesh.material.color.setHex(cfg.water).multiplyScalar(.55 + hemi.intensity * .5);
  if (S.rain > 0){ rainPts.visible = true; rainPts.position.set(player.x, player.y - 8, player.z); const p = rainPts.geometry.attributes.position; for (let i = 1; i < p.array.length; i += 3){ p.array[i] -= dt * 22; if (p.array[i] < 0) p.array[i] += 30; } p.needsUpdate = true; }
  else rainPts.visible = false;
  // game time runs while you explore: 1 real second = 1 game minute
  if (!veilOpen && !S.over) api.time(dt / 60);
  markExplored();
  // discoveries
  for (const c of campgrounds) if (Math.hypot(player.x - c.x, player.z - c.z) < 14 && !(S.found || []).includes(c.id)){ (S.found = S.found || []).push(c.id); api.foundCamp(c); }
  const de = cfg.exit.axis === 'z' ? Math.abs(player.z - cfg.exit.z) : Math.abs(player.x - cfg.exit.x);
  if (de < 70 && !S.seenExit){ S.seenExit = true; api.say(`You hear a car in the distance. A road must be close!`, 'good'); }
  if (de < 8 && !S.escaped){ S.escaped = true; api.escaped(cfg.exit); }
  S.pos = { x: player.x, z: player.z, yaw: player.yaw };
  renderer.render(scene, camera);
  drawMap(mmCtx, mmCanvas.width, false);
  hintTimer -= dt; if (hintTimer <= 0){ hintTimer = .25; api.hint(query()); }
  sinceSave += dt; if (sinceSave > 4){ sinceSave = 0; api.save(); }
}

/* ---------- what is near the player ---------- */
function query(){
  const near = { camp: Math.hypot(player.x - campPos.x, player.z - campPos.z) < 9 };
  let best = null, bd = 3.4; for (const t of nearTrees(player.x, player.z, 4)){ const d = Math.hypot(t.x - player.x, t.z - player.z); if (d < bd){ bd = d; best = t; } } near.tree = best;
  near.trees = nearTrees(player.x, player.z, 14).length;
  let wd = false; for (let a = 0; a < 6.28 && !wd; a += .8) if (heightAt(player.x + Math.cos(a) * 4.5, player.z + Math.sin(a) * 4.5) < -.4) wd = true; near.water = wd;
  let ba = null, bad = 32; const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  for (const a of animals){ if (!a.alive) continue; const dx = a.x - player.x, dz = a.z - player.z, d = Math.hypot(dx, dz); if (d < bad && (dx * fx + dz * fz) / d > .55){ bad = d; ba = a; } }
  near.animal = ba; near.animalDist = ba ? bad : 0;
  near.campground = campgrounds.find(c => Math.hypot(player.x - c.x, player.z - c.z) < 16) || null;
  near.where = near.camp ? 'Your camp' : near.campground ? near.campground.name : near.water ? cfg.river.name : near.trees > 6 ? (cfg.treeType === 'broad' ? 'Deep jungle' : 'Deep forest') : slopeAt(player.x, player.z) > .6 ? 'Rocky slope' : (cfg.treeType === 'broad' ? 'Jungle clearing' : 'Open meadow');
  return near;
}

/* ---------- public API ---------- */
window.World3D = {
  start(id, state, hooks){
    T = window.THREE; worldId = id; S = state; api = hooks; cfg = W3[id]; noise = makeNoise(cfg.seed); rng = mulberry(cfg.seed * 7 + 1);
    const canvas = document.getElementById('gl'); mmCanvas = document.getElementById('minimap'); mmCtx = mmCanvas.getContext('2d');
    if (!renderer){
      renderer = new T.WebGLRenderer({ canvas, antialias: true });
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; bindInput(canvas);
      window.addEventListener('resize', () => window.World3D.resize());
    }
    renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1));
    scene = new T.Scene(); scene.fog = new T.Fog(0xbcd3e3, cfg.fog[0], cfg.fog[1]);
    camera = new T.PerspectiveCamera(68, 1, .1, 800);
    hemi = new T.HemisphereLight(0xcfe0ee, 0x3d3826, .7); scene.add(hemi);
    sunLight = new T.DirectionalLight(0xfff2dd, 1); sunLight.castShadow = true;
    const mob = matchMedia('(max-width: 900px)').matches; sunLight.shadow.mapSize.set(mob ? 1024 : 2048, mob ? 1024 : 2048);
    Object.assign(sunLight.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 }); sunLight.shadow.bias = -.0008;
    scene.add(sunLight); scene.add(sunLight.target);
    flameTex = glowTex('rgba(255,240,200,1)', 'rgba(255,140,40,.6)'); smokeTex = glowTex('rgba(255,255,255,.9)', 'rgba(255,255,255,.35)');
    trees = []; treeGrid = new Map(); animals = []; campgrounds = []; steam = []; fireExtras = []; shelterGroup = null; shelterLevel = -1; waterfall = null; ringMesh = null; exitInfo = null;
    // camp position: the start point nudged onto dry ground
    exitInfo = null; hCache = null;
    // temporary height function before cache exists
    campPos = { x: cfg.start.x, z: cfg.start.z };
    buildTerrain();
    for (let k = 0; k < 40 && heightAt(campPos.x, campPos.z) < 1.2; k++) campPos.z -= 2;
    buildSky(); buildVegetation(); buildCampgrounds(); buildGeysers(); spawnAnimals();
    fire = buildFire(campPos.x, campPos.z);
    buildShelter(S.camp.shelter);
    const p = S.pos || { x: campPos.x - 1, z: campPos.z + 8, yaw: Math.atan2(-3, 9) };
    player.x = p.x; player.z = p.z; player.yaw = p.yaw; player.pitch = -.08; player.y = heightAt(p.x, p.z) + 1.7;
    explored = S.explored && S.explored.length === EXP * EXP ? S.explored : '0'.repeat(EXP * EXP);
    buildMapBase();
    this.resize(); running = true; lastT = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  },
  stop(){ running = false; cancelAnimationFrame(raf); keys = {}; if (scene){ scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } },
  resize(){ if (!renderer) return; const c = document.getElementById('gl'), r = c.parentElement.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); },
  query, setShelter(l){ buildShelter(l); },
  chop(t){ t.alive = false; (S.cut = S.cut || []).push(t.i); const m = new T.Matrix4().makeScale(0, 0, 0); treeInst.trunks.setMatrixAt(t.i, m); treeInst.crown.setMatrixAt(t.i, m); treeInst.trunks.instanceMatrix.needsUpdate = treeInst.crown.instanceMatrix.needsUpdate = true; buildMapBase(); },
  killAnimal(a){ a.alive = false; scene.remove(a.g); const id = a.id; setTimeout(() => { if (running) spawnAnimal(id, false); }, 45000); },
  scare(a){ a.tx = a.x + (a.x - player.x) * 3; a.tz = a.z + (a.z - player.z) * 3; },
  campDistance(){ return Math.hypot(player.x - campPos.x, player.z - campPos.z); },
  goCamp(){ player.x = campPos.x - 1; player.z = campPos.z + 8; player.yaw = Math.atan2(-(campPos.x + 2 - player.x), -(campPos.z - 1 - player.z)); player.pitch = -.12; },
  drawBigMap(c){ drawMap(c.getContext('2d'), c.width, true); },
  exitInfo(){ return cfg.exit; }
};
})();
