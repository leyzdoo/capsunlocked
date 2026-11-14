// The endless world: your town sits in the middle of a grid of city-sized blocks.
// Walk toward the edge and the next block loads — cities, suburbs, small towns, hills, mountains, desert and lakes.
// Every building is owned by a robot, and robots live and work everywhere.
import * as THREE from 'three';
import { bakeGroup } from './bake.js';
import { shopBuilding, buildHouse, tree, streetLight, bench, car, box, shared, SETBACK } from './town.js';
import { randomSpec } from './homes.js';
import { mat, rng, signTexture } from './tex.js';
import { makeCharacter } from './character.js';
import { G, toast } from './game.js';
import { makeItem, BIOME_ITEMS, today } from './vehicles.js';

export const CH = 160, HALF = 80, VX = 70;     // block size; the north–south road runs at local x = 70 in every block
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (c, r = .7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------------- noise + what each block is ---------------- */
function hash2(i, j, s = 0) { let h = Math.imul(i * 374761393 + j * 668265263 + s * 2246822519, 1274126177) >>> 0; h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z, s = 0) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x, z, 1) * .55 + vnoise(x * 2.1, z * 2.1, 2) * .28 + vnoise(x * 4.3, z * 4.3, 3) * .17;
const BIOMES = {
  home: { amp: 0, name: 'Your hometown', icon: '🏠' },
  city: { amp: 0, icon: '🏙️', names: ['Bolt City', 'Gear City', 'Chrome Heights', 'Circuit City', 'Robo Metro', 'Sprocket City', 'New Rivet'] },
  suburb: { amp: 0, icon: '🏡', names: ['Maple Bots', 'Cog Grove', 'Willow Wires', 'Sunny Sprockets', 'Oak Circuit', 'Piston Park'] },
  town: { amp: 0, icon: '🏘️', names: ['Little Bolt', 'Gadget Town', 'Tinker Falls', 'Rusty Creek', 'Copperton', 'Widget Village'] },
  hills: { amp: 9, icon: '⛰️', names: ['Green Hills', 'Rolling Gears', 'Clover Hills', 'Meadow Ridge'] },
  mountains: { amp: 46, icon: '🏔️', names: ['Pine Peak', 'Snowcap Mountains', 'Granite Range', 'Thunder Peak'] },
  desert: { amp: 3.5, icon: '🏜️', names: ['Dusty Mesa', 'Cactus Flats', 'Sunbake Desert', 'Red Rock Canyon'] },
  lake: { amp: 3, icon: '🏞️', names: ['Lake Rivet', 'Blue Lake', 'Silver Lake', 'Mirror Lake'] },
  sea: { amp: 0, icon: '🌊', names: ['Bolt Bay', 'Gear Sea', 'Sunny Ocean', 'Coral Coast', 'Rivet Reef'] }
};
export function biomeOf(i, j) {
  if (!i && !j) return 'home';
  const h = hash2(i, j, 9);
  if (Math.max(Math.abs(i), Math.abs(j)) === 1) return h < .45 ? 'city' : h < .75 ? 'suburb' : 'town';
  const wet = vnoise(i * .33 + 11.3, j * .33 - 4.1, 6); if (wet > .64) return 'sea';
  const wild = vnoise(i * .42 + 3.1, j * .42 + 7.7, 4), dry = vnoise(i * .3 - 5.3, j * .3 + 2.2, 5);
  if (wild < .4) return h < .4 ? 'city' : h < .7 ? 'suburb' : 'town';
  if (wild < .62) return dry > .6 ? 'desert' : h < .4 ? 'lake' : 'hills';
  return dry > .62 ? 'desert' : 'mountains';
}
export function blockName(i, j) { const b = biomeOf(i, j), B = BIOMES[b]; return B.name || B.names[Math.floor(hash2(i, j, 11) * B.names.length)]; }
export const blockIcon = (i, j) => BIOMES[biomeOf(i, j)].icon;
const LAKE = { x: -20, z: -48, r: 28 };

/* height of the ground anywhere in the world (continuous across blocks; flat on roads) */
const wf = d => d < 56 ? 1 : d > 104 ? 0 : 1 - sstep(56, 104, d);
export function heightAt(x, z) {
  const ci = Math.round(x / CH), cj = Math.round(z / CH);
  let amp = 0, ws = 0, lake = 0, sea = 0;
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
    const w = wf(Math.abs(x - i * CH)) * wf(Math.abs(z - j * CH)); if (!w) continue;
    const b = biomeOf(i, j); amp += BIOMES[b].amp * w; ws += w; if (b === 'sea') sea += w;
    if (b === 'lake') { const d = Math.hypot(x - i * CH - LAKE.x, z - j * CH - LAKE.z); if (d < LAKE.r * 1.3) lake = Math.max(lake, 4.2 * (1 - sstep(LAKE.r * .55, LAKE.r * 1.3, d))); }
  }
  amp /= ws || 1; sea /= ws || 1;
  const rx = Math.abs(((x - VX) % CH + CH * 1.5) % CH - CH / 2), rz = Math.abs(((z % CH) + CH * 1.5) % CH - CH / 2); // distance to nearest roads
  const road = sstep(7, 24, Math.min(rx, rz));
  let n = fbm(x * .011, z * .011); n = amp > 20 ? Math.pow(n, 1.7) * 1.6 : n;
  return amp * n * road - lake * road - 7 * sstep(.15, .8, sea) * road;
}
export const WATER_Y = -.45;

/* ---------------- shared bits ---------------- */
let groundTex = null;
function groundMat() {
  if (!groundTex) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = rng(5);
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { const g = 190 + r() * 65; x.fillStyle = `rgb(${g},${g},${g})`; x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 3); }
    groundTex = new THREE.CanvasTexture(c); groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(40, 40); groundTex.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshStandardMaterial({ vertexColors: true, map: groundTex, roughness: 1 });
}
const M = {};
function mats() {
  if (M.asphalt) return M;
  M.asphalt = mat('asphalt', [], 1, 1, { roughness: .95, bump: .8 }); M.asphalt.map.repeat.set(160 / 6, 10 / 6);
  M.asphaltV = mat('asphalt', [], 1, 1, { roughness: .95, bump: .8 }); M.asphaltV.map.repeat.set(10 / 6, 160 / 6);
  M.yellow = std(0xe8c547, .8); M.white = std(0xf2f2ee, .8);
  M.walk = mat('concrete', ['#c4c0b8', 256, 61], 1, 1, { bump: .8 }); M.curb = shared().stone;
  M.water = new THREE.MeshStandardMaterial({ color: 0x1d6a9a, roughness: .18, metalness: 0, transparent: true, opacity: .9, envMapIntensity: .35 });
  M.pine = std(0x2a4f2a, .9); M.trunk = std(0x4a3628, 1); M.rock = std(0x8a857c, .95); M.redrock = std(0xb0603a, .95); M.cactus = std(0x3f7a3a, .8);
  M.sand = std(0xd8c08a, 1); M.wood = mat('wood', ['#8a6440', 4, 49], 1, 1);
  return M;
}

/* labels floating over robots */
function label(text, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = 'rgba(20,18,50,.82)'; x.beginPath(); x.roundRect(4, 4, 504, 120, 30); x.fill();
  x.fillStyle = '#fff'; x.font = '600 46px Fredoka, Arial'; x.textAlign = 'center'; x.fillText(text, 256, 56);
  x.fillStyle = '#ffd34d'; x.font = '700 32px Nunito, Arial'; x.fillText(sub, 256, 100);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true })); s.scale.set(1.7, .42, 1); s.position.y = 2.15; return s;
}
const FIRST = ['Robo', 'Bolt', 'Gizmo', 'Sparky', 'Rusty', 'Chip', 'Widget', 'Beep', 'Cog', 'Pixel', 'Nova', 'Zippy', 'Tinker', 'Dot', 'Volt', 'Gears', 'Bleep', 'Copper', 'Ziggy', 'Echo'];
const LAST = ['Sam', 'Lily', 'Max', 'Ruby', 'Leo', 'Mia', 'Jax', 'Ivy', 'Otto', 'Luna', 'Finn', 'Zoe', 'Theo', 'Pip', 'Kai', 'Nell'];
export const robotName = r => FIRST[Math.floor(r() * FIRST.length)] + '-' + LAST[Math.floor(r() * LAST.length)];
const BOT_COLORS = [0xd7dbe0, 0xe0b04a, 0x6fb7e8, 0xe87a6f, 0x8fd18a, 0xb79ce8, 0xf2f2f2, 0xff9f43, 0x5ad1c8];
const SHOPS = [['BAKERY', 'baking bread 🍞'], ['PIZZA', 'making pizza 🍕'], ['BOOKS', 'stacking books 📚'], ['TOY SHOP', 'fixing toys 🧸'], ['ROBOT REPAIR', 'fixing robots 🔧'], ['ICE CREAM', 'scooping ice cream 🍦'], ['BANK', 'counting coins 🪙'], ['FLOWERS', 'watering flowers 🌷'], ['HARDWARE', 'selling bolts 🔩'], ['CAFE', 'making cocoa ☕'], ['ARCADE', 'playing games 🕹️'], ['MUSIC', 'tuning guitars 🎸'], ['GROCERY', 'stacking apples 🍎'], ['HOTEL', 'greeting guests 🛎️'], ['LIBRARY', 'reading 📖'], ['POST OFFICE', 'sorting mail ✉️'], ['DINER', 'flipping pancakes 🥞'], ['GYM', 'lifting weights 🏋️']];
const WALK_JOBS = ['taking a walk', 'going to work', 'shopping', 'walking to the park', 'jogging', 'delivering mail ✉️', 'looking around'];
const WALLS = [['brick', ['#8e3b2c', '#cfc3b3']], ['brick', ['#b8875c', '#ded3c3']], ['brick', ['#5b5f66', '#b9bcc0']], ['brick', ['#a24a3a', '#d8cbbb']], ['brick', ['#6f7f8c', '#c9d0d6']], ['brick', ['#a8566d', '#e2d4d6']], ['concrete', ['#d8cfbf', 160]], ['concrete', ['#c9b79a', 160]]];
const AWN = [['#1f7a5a', '#f2efe6'], ['#c55a2c', '#f6eadb'], ['#3d3470', '#e9e6f5'], ['#2f6fa8', '#eef5fb'], ['#c7962a', '#fff6dc'], ['#b8436f', '#fbecf2'], null];

/* ---------------- the world ---------------- */
export function createWorld(town) {
  const scene = town.scene, chunks = new Map(), queue = [];
  let banner = null, curKey = null, generating = false;
  const W = { chunks, ready: false };

  function chunkAt(x, z) { return [Math.round(x / CH), Math.round(z / CH)]; }
  function needed(p) {
    const [ci, cj] = chunkAt(p.x, p.z), lx = p.x - ci * CH, lz = p.z - cj * CH, T = 82, out = [[ci, cj]];
    const dx = lx > HALF - T ? 1 : lx < -HALF + T ? -1 : 0, dz = lz > HALF - T ? 1 : lz < -HALF + T ? -1 : 0;
    if (dx) out.push([ci + dx, cj]); if (dz) out.push([ci, cj + dz]); if (dx && dz) out.push([ci + dx, cj + dz]);
    return out;
  }
  function showBanner(on, text) {
    if (!banner) { banner = document.createElement('div'); banner.style.cssText = 'position:fixed;left:50%;top:76px;transform:translateX(-50%);z-index:26;background:rgba(20,18,50,.88);color:#fff;font:600 20px Fredoka,Arial;padding:12px 22px;border-radius:18px;box-shadow:0 8px 24px #0006;pointer-events:none;transition:opacity .3s;display:flex;gap:10px;align-items:center'; document.body.appendChild(banner); }
    if (text) banner.innerHTML = text; banner.style.opacity = on ? 1 : 0;
  }
  W.ensure = (p, sync) => {
    const [pi, pj] = chunkAt(p.x, p.z);
    for (let i = pi - 1; i <= pi + 1; i++) for (let j = pj - 1; j <= pj + 1; j++) { const k = i + ',' + j; if (!chunks.has(k)) chunks.set(k, buildChunk(i, j, true)); } // ground + roads right away
    for (const [i, j] of needed(p)) { const k = i + ',' + j, c = chunks.get(k); if ((!c || c.lite) && !queue.some(q => q[2] === k)) queue.push([i, j, k]); }
    const full = (i, j, k) => { const old = chunks.get(k); if (old) unload(old); chunks.set(k, buildChunk(i, j)); };
    if (sync) { while (queue.length) { const [i, j, k] = queue.shift(); full(i, j, k); } return; }
    if (queue.length && !generating) {
      generating = true; const [i, j, k] = queue[0];
      showBanner(true, '<span style="display:inline-block;animation:spin 1s linear infinite">⚙️</span> Loading the next block — ' + blockIcon(i, j) + ' ' + blockName(i, j) + '…');
      setTimeout(() => { // let the banner paint first
        try { full(i, j, k); } catch (e) { console.error(e); chunks.set(k, { i, j, group: new THREE.Group(), cols: [], blockers: [], doors: [], bots: [] }); }
        queue.shift(); generating = false; if (!queue.length) showBanner(false);
      }, 60);
    }
    // unload far blocks
    for (const [k, c] of chunks) { if (!c.i && !c.j) continue; const dx = Math.max(0, Math.abs(p.x - c.i * CH) - HALF), dz = Math.max(0, Math.abs(p.z - c.j * CH) - HALF); if (Math.hypot(dx, dz) > 190) { unload(c); chunks.delete(k); } }
    // tell the player when they walk into a new block
    const [ci, cj] = chunkAt(p.x, p.z), key = ci + ',' + cj;
    if (key !== curKey) { const first = curKey == null; curKey = key; W.block = { i: ci, j: cj }; if (!first) toast(blockIcon(ci, cj) + ' ' + blockName(ci, cj) + (ci || cj ? '' : ' — welcome home!')); G.onBlock && G.onBlock(ci, cj); }
  };
  function unload(c) {
    scene.remove(c.group);
    c.group.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && o.userData.own !== false) o.geometry.dispose(); });
  }
  W.near = p => { const [ci, cj] = chunkAt(p.x, p.z), out = []; for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) { const c = chunks.get(i + ',' + j); if (c) out.push(c); } return out; };
  W.collidersAt = p => { const out = []; for (const c of W.near(p)) out.push(...c.cols); return out; };
  W.camBlockers = p => { const out = []; for (const c of W.near(p)) out.push(...c.blockers); return out; };
  W.interact = p => { const out = []; for (const c of W.near(p)) { for (const d of c.doors) if (Math.abs(d.pos.x - p.x) < 4 && Math.abs(d.pos.z - p.z) < 4) out.push(d); for (const b of c.bots) if (b.root.visible && Math.abs(b.act.pos.x - p.x) < 2.2 && Math.abs(b.act.pos.z - p.z) < 2.2) out.push(b.act); } return out; };
  W.blocked = p => {
    if (heightAt(p.x, p.z) >= WATER_Y + .1) return false;
    for (const c of W.near(p)) for (const d of c.walkOn || []) { const lx = p.x - c.i * CH - d.cx, lz = p.z - c.j * CH - d.cz, cs = Math.cos(d.rot), sn = Math.sin(d.rot), u = lx * cs - lz * sn, v = lx * sn + lz * cs; if (Math.abs(u) < d.w / 2 && v < .5 && v > -d.l) return false; }
    return true;
  };
  let tUpd = 0;
  W.update = (dt, p) => {
    tUpd += dt; if (tUpd > .25) { tUpd = 0; W.ensure(p); }
    for (const c of W.near(p)) for (const it of c.items) {
      if (it.got) continue;
      const d = Math.hypot(it.pos.x - p.x, it.pos.z - p.z);
      if (d < 70) { it.mesh.userData.spin.rotation.y += dt * 1.6; it.mesh.userData.spin.position.y = .75 + Math.sin(performance.now() / 400 + it.pos.x) * .12; }
      if (d < 1.5 && Math.abs(it.pos.y - p.y) < 2 && G.collect && G.collect(it.type, it.key)) { it.got = true; c.live.remove(it.mesh); }
    }
    for (const c of W.near(p)) for (const b of c.bots) {
      const d = Math.hypot(b.act.pos.x - p.x, b.act.pos.z - p.z), vis = d < 62;
      if (b.root.visible !== vis) b.root.visible = vis;
      if (vis) b.tick(dt, d);
    }
  };

  /* ---------------- building one block ---------------- */
  function buildChunk(i, j, lite) {
    const biome = biomeOf(i, j), r = rng(Math.floor(hash2(i, j, 3) * 1e9)), m = mats();
    const g = new THREE.Group(); g.position.set(i * CH, 0, j * CH);
    const C = { i, j, biome, lite: !!lite, items: [], group: g, cols: [], blockers: [], doors: [], bots: [], live: new THREE.Group() };
    const ox = i * CH, oz = j * CH;
    const hAt = (x, z) => heightAt(ox + x, oz + z);
    const col = (x1, x2, z1, z2, blocker) => { const b = { x1: ox + Math.min(x1, x2), x2: ox + Math.max(x1, x2), z1: oz + Math.min(z1, z2), z2: oz + Math.max(z1, z2) }; C.cols.push(b); if (blocker) C.blockers.push(b); };
    const urban = biome === 'city' || biome === 'suburb' || biome === 'town' || biome === 'home';

    // ground
    const N = biome === 'mountains' || biome === 'hills' ? 64 : 40;
    const geo = new THREE.PlaneGeometry(CH, CH, N, N); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colr = new Float32Array(pos.count * 3), cc = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k), h = hAt(x, z); pos.setY(k, h);
      const n = vnoise((ox + x) * .05, (oz + z) * .05, 7) * .12;
      if (biome === 'desert') cc.setRGB(.86 - n, .72 - n, .5 - n * .5);
      else if (h > 30) cc.setRGB(.93, .94, .97);
      else if (h > 15) cc.setRGB(.5 - n, .48 - n, .45 - n);
      else if (h < -.2) cc.setRGB(.82, .74, .55);
      else cc.setRGB(.33 - n * .6, .52 - n * .5, .2 - n * .3);
      cc.convertSRGBToLinear(); colr.set([cc.r, cc.g, cc.b], k * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, groundMat()); ground.receiveShadow = true; ground.userData.noBake = true; g.add(ground);

    // roads (+ sidewalks in towns)
    const roadH = () => { const p = new THREE.Mesh(new THREE.PlaneGeometry(CH, 10), m.asphalt); p.rotation.x = -Math.PI / 2; p.position.y = .01; p.receiveShadow = true; g.add(p);
      [-.1, .1].forEach(z => { const l = new THREE.Mesh(new THREE.PlaneGeometry(CH, .1), m.yellow); l.rotation.x = -Math.PI / 2; l.position.set(0, .02, z); g.add(l); });
      [-4.6, 4.6].forEach(z => { const l = new THREE.Mesh(new THREE.PlaneGeometry(CH, .12), m.white); l.rotation.x = -Math.PI / 2; l.position.set(0, .02, z); g.add(l); }); };
    const roadV = () => { const p = new THREE.Mesh(new THREE.PlaneGeometry(10, CH), m.asphaltV); p.rotation.x = -Math.PI / 2; p.position.set(VX, .014, 0); p.receiveShadow = true; g.add(p);
      [-.1, .1].forEach(x => { [[-HALF, -5.2], [5.2, HALF]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(.1, b - a), m.yellow); l.rotation.x = -Math.PI / 2; l.position.set(VX + x, .024, (a + b) / 2); g.add(l); }); }); };
    roadH(); roadV();
    if (biome === 'sea') { const w = new THREE.Mesh(new THREE.PlaneGeometry(CH, CH), m.water); w.rotation.x = -Math.PI / 2; w.position.y = WATER_Y; w.userData.water = true; g.add(w); }
    if (lite) { if (biome === 'lake') { const w = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r * 1.2, 48), m.water); w.rotation.x = -Math.PI / 2; w.position.set(LAKE.x, WATER_Y, LAKE.z); g.add(w); } scene.add(g); return C; }
    if (urban) {
      const walk = (x1, x2, z1, z2) => { const w = x2 - x1, d = z2 - z1; if (w <= 0 || d <= 0) return; const bg = new THREE.BoxGeometry(w, .18, d), uv = bg.attributes.uv; for (let q = 0; q < uv.count; q++) uv.setXY(q, uv.getX(q) * w / 3.2, uv.getY(q) * d / 3.2); const b = new THREE.Mesh(bg, m.walk); b.position.set((x1 + x2) / 2, .09, (z1 + z2) / 2); b.receiveShadow = true; g.add(b); };
      [-1, 1].forEach(s => { walk(-HALF, VX - 5, s > 0 ? 5 : -10.3, s > 0 ? 10.3 : -5); walk(VX + 5, HALF, s > 0 ? 5 : -10.3, s > 0 ? 10.3 : -5); });
      [-1, 1].forEach(s => { walk(s < 0 ? VX - 10.3 : VX + 5, s < 0 ? VX - 5 : VX + 10.3, -HALF, -10.3); walk(s < 0 ? VX - 10.3 : VX + 5, s < 0 ? VX - 5 : VX + 10.3, 10.3, HALF); });
      // street lights along both roads
      if (biome !== 'home') for (let x = -72; x < VX - 12; x += 24) [-1, 1].forEach(s => { const l = streetLight(); l.position.set(x, .18, s * 5.6); l.rotation.y = s > 0 ? Math.PI : 0; g.add(l); col(x - .2, x + .2, s * 5.6 - .2, s * 5.6 + .2); });
      for (let z = -72; z < HALF; z += 24) { if (Math.abs(z) < 14) continue; const l = streetLight(); l.position.set(VX - 5.6, .18, z); l.rotation.y = Math.PI / 2; g.add(l); col(VX - 5.8, VX - 5.4, z - .2, z + .2); }
    }

    // ---- what's in the block ----
    const home = biome === 'home';
    // keep clear: the hometown buildings and your lot
    const clear = (x, z, w, d) => {
      if (!home) return true;
      if (Math.abs(z) < 52 && x > -78 && x < 50) return false;   // hometown street + your house + backyard
      return true;
    };
    const P = { g, C, r, col, hAt, m, ox, oz, clear };
    if (biome === 'city' || home) cityBlock(P, home);
    else if (biome === 'suburb') suburbBlock(P);
    else if (biome === 'town') townBlock(P);
    else if (biome === 'lake') lakeBlock(P);
    else if (biome === 'sea') seaBlock(P);
    else wildBlock(P, biome);

    spawnItems(P, biome);
    bakeGroup(g); g.add(C.live);
    scene.add(g);
    return C;
  }


  function seaBlock(P) {
    const { g, r, m, col, hAt, C } = P;
    // a lighthouse on the causeway corner, rocks in the water, a robot fishing off the causeway
    const lh = new THREE.Group(), white = std(0xf4f1ea, .5), red = std(0xc0392b, .5);
    for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(1.5 - k * .15, 1.6 - k * .15, 2.4, 20), k % 2 ? red : white); c.position.y = 1.2 + k * 2.4; lh.add(c); }
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 1.2, 16), new THREE.MeshBasicMaterial({ color: 0xfff1b0 })); lamp.position.y = 12.6; lamp.userData.noBake = true; lh.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.4, 16), std(0x222222, .5)); cap.position.y = 13.9; lh.add(cap);
    lh.position.set(VX - 9, 0, 9); g.add(lh); col(VX - 10.6, VX - 7.4, 7.4, 10.6, true);
    for (let k = 0; k < 18; k++) { const x = -78 + r() * 156, z = -78 + r() * 156; if (Math.abs(z) < 12 || Math.abs(x - VX) < 12) continue; const s = 1 + r() * 2.5, rk = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), m.rock); rk.position.set(x, hAt(x, z) + s * .5, z); rk.scale.y = .7; rk.castShadow = true; g.add(rk); }
    addBot(P, { x: 20, z: -6.4, face: Math.PI, job: 'fishing 🎣', say: 'The sea is huge! If you buy a boat at the Game Store, you can sail all the way out.' });
    addBot(P, { path: [[-60, 7.6], [40, 7.6]], job: 'walking on the causeway', pause: 3 });
  }
  /* things to find: a few in every block, gone for the day once you pick them up */
  function spawnItems(P, biome) {
    const { r, hAt, C } = P, kinds = BIOME_ITEMS[biome] || ['crate'], n = biome === 'home' ? 4 : 9;
    const got = G.S.data && G.S.data.got && G.S.data.got.day === today() ? G.S.data.got.keys : [];
    const inside = (x, z) => C.cols.some(b => x + P.ox > b.x1 - .6 && x + P.ox < b.x2 + .6 && z + P.oz > b.z1 - .6 && z + P.oz < b.z2 + .6);
    for (let k = 0; k < n; k++) {
      const type = kinds[k % kinds.length], key = C.i + ',' + C.j + ',' + k;
      let x, z, ok = false;
      for (let t = 0; t < 40 && !ok; t++) {
        x = -76 + r() * 152; z = -76 + r() * 152; const h = hAt(x, z);
        if (biome === 'home' && Math.abs(z) < 52 && x > -78 && x < 50) continue;
        ok = !inside(x, z) && (type === 'shell' ? h > WATER_Y + .15 && h < 1.5 : h > WATER_Y + .3) && Math.abs(h) < 30;
      }
      if (!ok || got.includes(key)) continue;
      const it = makeItem(type); it.position.set(x, hAt(x, z), z); C.live.add(it);
      C.items.push({ key, type, mesh: it, pos: new THREE.Vector3(x + P.ox, it.position.y, z + P.oz) });
    }
  }

  /* --- robots --- */
  function addBot(P, o) {
    const { C, r } = P;
    const name = o.name || robotName(r), color = BOT_COLORS[Math.floor(r() * BOT_COLORS.length)];
    const bot = makeCharacter('bot', color); const root = bot.root;
    root.position.set(P.ox + o.x, P.hAt(o.x, o.z), P.oz + o.z); root.rotation.y = o.face || 0;
    const tag = label(name, o.job); root.add(tag);
    C.live.add(root); root.position.sub(P.g.position);
    const path = o.path ? o.path.map(([x, z]) => V(x, 0, z)) : null; let seg = 0, wait = 0, gest = 3 + r() * 6;
    const b = {
      root, name, job: o.job,
      act: { pos: root.position.clone().add(P.g.position), r: 2.2, label: '👋 Say hi to ' + name, sub: o.job, fn: () => { bot.play('agree'); toast('🤖 ' + name + ': "' + (o.say || 'Hi! I\'m ' + o.job.replace(/ [^\w\s]+$/, '') + '. This is my ' + (o.owns || 'block') + '!') + '"'); } },
      tick(dt, dist) {
        if (dist > 40 && !path) return; // far away and standing still: skip animation
        bot.update(dt);
        if (path) {
          if (wait > 0) { wait -= dt; bot.speedBlend(0); }
          else {
            const tgt = path[(seg + 1) % path.length], p = root.position, dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz), sp = o.speed || 1.3;
            if (d < .2) { seg = (seg + 1) % path.length; if (o.pause) wait = o.pause * (.5 + r()); }
            else { p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; root.rotation.y = Math.atan2(dx, dz); p.y = heightAt(p.x + P.ox, p.z + P.oz); bot.speedBlend(sp / 3.3); }
          }
          b.act.pos.copy(root.position).add(P.g.position);
        } else { bot.speedBlend(0); gest -= dt; if (gest < 0) { gest = 4 + r() * 8; bot.play(r() < .7 ? 'agree' : 'headShake'); } }
      }
    };
    if (path) { root.position.copy(path[0]); root.position.y = P.hAt(path[0].x, path[0].z); b.act.pos.copy(root.position).add(P.g.position); }
    C.bots.push(b); return b;
  }
  const facing = (fx, fz) => Math.atan2(fx, fz);

  /* --- an enterable / owned building on a road --- */
  function roadBuilding(P, x, z, face, o) {
    // face: direction the front points (0:+z, PI:-z, PI/2:+x, -PI/2:-x)
    const { g, r, col } = P;
    const bld = shopBuilding({ w: o.w, d: o.d, floors: o.floors, wall: { kind: o.wall[0], args: [...o.wall[1], 300 + Math.floor(r() * 40)] }, signBg: '#1c1c22', signFg: '#ffe9b0', awning: o.awning, trim: r() < .5 ? 'white' : null, door: 0x2a2a30, sign: o.sign, seed: Math.floor(r() * 999) });
    bld.position.set(x, 0, z); bld.rotation.y = face; g.add(bld);
    const cs = Math.abs(Math.sin(face)) > .5, hw = (cs ? o.d : o.w) / 2 + .1, hd = (cs ? o.w : o.d) / 2 + .1;
    col(x - hw, x + hw, z - hd, z + hd, true);
    const door = bld.userData.door.clone().applyAxisAngle(V(0, 1, 0), face).add(V(x, 0, z));
    // plaque: who owns it
    const pl = bld.userData.plaque; if (pl) { const c = pl.canvas, cx = c.getContext('2d'); cx.fillStyle = '#1b1a22'; cx.fillRect(0, 0, 512, 256); cx.strokeStyle = '#c9a64a'; cx.lineWidth = 10; cx.strokeRect(8, 8, 496, 240); cx.fillStyle = '#d9d4ff'; cx.font = '700 40px Nunito, Arial'; cx.textAlign = 'center'; cx.fillText('Owned by', 256, 96); cx.fillStyle = '#fff'; cx.font = '600 56px Fredoka, Arial'; cx.fillText(o.owner, 256, 170); pl.tex.needsUpdate = true; }
    return { door, out: V(Math.sin(face), 0, Math.cos(face)) };
  }
  function lotsAlongRoads(P, depth, gapFn, skipFn) {
    const lots = [];
    [-1, 1].forEach(s => { // along the east–west road (local z = 0)
      let x = -HALF + 2;
      while (true) { const w = gapFn(); if (x + w > VX - 10.5 - 1) break; const cz = s * (SETBACK + depth / 2); lots.push({ x: x + w / 2, z: cz, w, face: s < 0 ? 0 : Math.PI }); x += w + 1.5 + P.r() * 2; }
    });
    // along the north–south road at x = 70 (west side, facing +x) and the neighbour's road at x = -90 (east side, facing -x)
    [[VX - SETBACK - depth / 2, Math.PI / 2], [-HALF - 10 + SETBACK + depth / 2, -Math.PI / 2]].forEach(([cx, face]) => {
      [-1, 1].forEach(s => { let z = 12.3 + depth + 2; while (true) { const w = gapFn(); if (z + w > HALF - 1) break; lots.push({ x: cx, z: s * (z + w / 2), w, face }); z += w + 1.5 + P.r() * 2; } });
    });
    return lots.filter(l => (!skipFn || !skipFn(l)) && Math.abs(P.hAt(l.x, l.z)) < 1.2);
  }

  function cityBlock(P, home) {
    const { g, r, C, col } = P, D = 13;
    const lots = lotsAlongRoads(P, D, () => 13 + Math.floor(r() * 4), l => !P.clear(l.x, l.z) || (home && Math.abs(l.z) < 30));
    lots.forEach((l, k) => {
      const owner = robotName(r), apt = r() < .3, shop = SHOPS[Math.floor(r() * SHOPS.length)];
      const o = { w: l.w, d: D, floors: apt ? 4 + Math.floor(r() * 3) : 2 + Math.floor(r() * 3), wall: WALLS[Math.floor(r() * WALLS.length)], awning: apt ? null : AWN[Math.floor(r() * AWN.length)], sign: apt ? ['ROBOT APARTMENTS', 'SUNNY APTS', 'GEAR TOWER APTS', 'BOLT HOUSE APTS'][Math.floor(r() * 4)] : shop[0], owner };
      const b = roadBuilding(P, l.x, l.z, l.face, o);
      const ox = P.ox, oz = P.oz, wpos = b.door.clone().add(V(ox, 0, oz));
      if (apt) C.doors.push({ pos: wpos, r: 2.0, label: '🏢 Go into ' + o.sign[0] + o.sign.slice(1).toLowerCase(), sub: 'Robots live upstairs · owned by ' + owner, fn: () => G.enterRoom('apartment', { data: { kind: 'apts', name: o.sign, owner, seed: Math.floor(r() * 1e6) + k, floors: Math.min(3, o.floors - 1) }, doorObj: { pos: wpos.clone(), facing: l.face } }) });
      if (r() < .45) addBot(P, { x: b.door.x + b.out.x * 1.2 + (r() - .5) * 2, z: b.door.z + b.out.z * 1.2 + (r() - .5) * 2, face: l.face, name: owner, job: apt ? 'the building manager 🔑' : shop[1], owns: apt ? 'apartment building' : o.sign.toLowerCase() });
    });
    // towers + a park in the back of the block (or the edges of your hometown)
    const spots = (home ? [[-20, -68], [10, -68], [-20, 68], [10, 68], [-48, -68]] : [[-50, -50], [-22, -52], [8, -50], [34, -52], [-50, 52], [-22, 54], [8, 50], [34, 52]]).filter(([x, z]) => P.clear(x, z) && Math.abs(P.hAt(x, z)) < 1);
    const parkAt = spots.splice(Math.floor(r() * spots.length), 1)[0];
    spots.forEach(([x, z]) => {
      if (r() < .25) return;
      const T = randomSpec('tower', Math.floor(r() * 1e6)); T.w = Math.min(T.w, 14); T.d = Math.min(T.d, 12); if (home) T.floors = Math.min(T.floors, 18);
      const t = buildHouse(T); t.position.set(x, 0, z); t.rotation.y = z > 0 ? Math.PI : 0; g.add(t);
      col(x - T.w / 2 - .2, x + T.w / 2 + .2, z - T.d / 2 - .2, z + T.d / 2 + .2, true);
    });
    if (parkAt) park(P, parkAt[0], parkAt[1]);
    // people (robots) out walking on the sidewalks
    const nWalk = home ? 2 : 3;
    for (let k = 0; k < nWalk; k++) { const s = r() < .5 ? -1 : 1, z = s * (7.4 + r() * 1.6), x0 = -70 + r() * 60; addBot(P, { path: [[x0, z], [x0 + 30 + r() * 30, z]], job: WALK_JOBS[Math.floor(r() * WALK_JOBS.length)], pause: 2 }); }
    for (let k = 0; k < 1; k++) { const x = VX - 7.6 - r() * 1.5, z0 = 15 + r() * 20, s = r() < .5 ? -1 : 1; addBot(P, { path: [[x, s * z0], [x, s * (z0 + 35)]], job: WALK_JOBS[Math.floor(r() * WALK_JOBS.length)], pause: 2 }); }
    if (!home) parkedCars(P);
  }
  function park(P, x, z) {
    const { g, r, col } = P;
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(30, 24), std(0x4f8f3a, 1)); grass.rotation.x = -Math.PI / 2; grass.position.set(x, .03, z); grass.receiveShadow = true; g.add(grass);
    for (let k = 0; k < 6; k++) { const t = tree(r, .9 + r() * .4); const tx = x - 12 + r() * 24, tz = z - 9 + r() * 18; t.position.set(tx, 0, tz); g.add(t); col(tx - .35, tx + .35, tz - .35, tz + .35); }
    [-1, 1].forEach(s => { const b = bench(); b.position.set(x + s * 4, 0, z); b.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(b); col(x + s * 4 - .4, x + s * 4 + .4, z - .95, z + .95); });
    const f = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, .6, 24), shared().stone); f.position.set(x, .3, z); g.add(f); col(x - 2.2, x + 2.2, z - 2.2, z + 2.2);
    const w = new THREE.Mesh(new THREE.CircleGeometry(1.85, 24), P.m.water); w.rotation.x = -Math.PI / 2; w.position.set(x, .62, z); g.add(w);
    addBot(P, { path: [[x - 8, z - 8], [x + 8, z - 8], [x + 8, z + 8], [x - 8, z + 8]], job: ['walking a robo-dog 🐕', 'jogging', 'feeding the birds 🐦', 'flying a kite 🪁'][Math.floor(r() * 4)], pause: 1.5, speed: 1.1 });
    addBot(P, { x: x + 4, z: z + 1.2, face: Math.PI, job: ['reading the news 📰', 'relaxing in the park', 'eating a sandwich 🥪'][Math.floor(r() * 3)] });
  }
  function parkedCars(P) {
    const { g, r } = P, cs = [0x9b1c1c, 0x1f3f7a, 0xd9d9d9, 0x2b2b2b, 0x3f6e5a, 0xb08a2e, 0x6a3a8a];
    for (let k = 0; k < 4; k++) { const s = k % 2 ? 1 : -1, x = -70 + r() * 125; const c = car(cs[Math.floor(r() * cs.length)], r); c.position.set(x, 0, s * 3.4); if (s > 0) c.rotation.y = Math.PI; g.add(c); P.col(x - 2.3, x + 2.3, s * 3.4 - 1, s * 3.4 + 1); }
  }

  function suburbBlock(P) {
    const { g, r, C } = P;
    const lots = lotsAlongRoads(P, 26, () => 22 + Math.floor(r() * 4));
    lots.forEach((l, k) => {
      const kind = ['cabin', 'farm', 'family', 'family', 'modern', 'villa'][Math.floor(r() * 6)], T = randomSpec(kind, Math.floor(r() * 1e6)), owner = robotName(r);
      T.w = Math.min(T.w, l.w - 6);
      const front = (T.porch ? 3 : 0) + (T.portico ? 4.4 : 0) + (T.balcony ? 1.2 : 0), setb = SETBACK + 3, dz = setb + front + T.d / 2;
      const h = buildHouse(T), dir = V(Math.sin(l.face), 0, Math.cos(l.face));
      // centre along the lot: back from the road by dz
      let x = l.x, z = l.z; if (l.face === 0 || l.face === Math.PI) z = -Math.sign(dir.z) * dz; else x = l.face > 0 ? VX - dz : -HALF - 10 + dz;
      h.position.set(x, 0, z); h.rotation.y = l.face; g.add(h);
      h.userData.cols.forEach(([x1, x2, z1, z2]) => { const a = V(x1, 0, z1).applyAxisAngle(V(0, 1, 0), l.face).add(h.position), b = V(x2, 0, z2).applyAxisAngle(V(0, 1, 0), l.face).add(h.position); P.col(Math.min(a.x, b.x) - .1, Math.max(a.x, b.x) + .1, Math.min(a.z, b.z) - .1, Math.max(a.z, b.z) + .1, true); });
      const door = h.userData.door.clone().applyAxisAngle(V(0, 1, 0), l.face).add(h.position), wpos = door.clone().add(V(P.ox, 0, P.oz));
      C.doors.push({ pos: wpos, r: 2.0, label: '🚪 Knock on ' + owner + '’s door', sub: 'Visit a robot’s ' + T.name.toLowerCase(), fn: () => G.enterRoom('apartment', { data: { kind: 'house', name: owner + '’s ' + T.name, owner, seed: Math.floor(r() * 1e6) + k }, doorObj: { pos: wpos.clone(), facing: l.face } }) });
      // little picket fence line + mailbox at the sidewalk
      const fz = l.face === 0 || l.face === Math.PI;
      const fx0 = fz ? l.x : (l.face > 0 ? VX - SETBACK - .6 : -HALF - 10 + SETBACK + .6), fz0 = fz ? -Math.sign(dir.z) * (SETBACK + .6) : l.z;
      const mb = new THREE.Group(); mb.add(box(.08, 1.1, .08, std(0x4a3a2a), 0, .55, 0)); mb.add(box(.3, .3, .5, std([0x2b4a7a, 0x8b2b2b, 0x2f6b4a][k % 3], .4, .5), 0, 1.2, 0));
      mb.position.set(fx0 + (fz ? 1.6 : 0), 0, fz0 + (fz ? 0 : 1.6)); g.add(mb);
      if (r() < .4) { const yard = door.clone().add(dir.clone().multiplyScalar(3.5)); addBot(P, r() < .5
        ? { path: [[yard.x - (fz ? 4 : 0), yard.z - (fz ? 0 : 4)], [yard.x + (fz ? 4 : 0), yard.z + (fz ? 0 : 4)]], job: ['mowing the lawn 🌱', 'raking leaves 🍂', 'walking the robo-dog 🐕'][Math.floor(r() * 3)], name: owner, owns: 'house', pause: .6, speed: .9 }
        : { x: yard.x, z: yard.z, face: l.face, job: ['watering the garden 🌻', 'washing the car 🚗', 'painting the fence 🎨', 'waving hello 👋'][Math.floor(r() * 4)], name: owner, owns: 'house' }); }
    });
    for (let k = 0; k < 2; k++) { const s = r() < .5 ? -1 : 1, z = s * (7.4 + r() * 1.6), x0 = -70 + r() * 60; addBot(P, { path: [[x0, z], [x0 + 30 + r() * 30, z]], job: WALK_JOBS[Math.floor(r() * WALK_JOBS.length)], pause: 2 }); }
    // trees along the streets, and a park or playground in the middle of the back area
    for (let x = -74; x < VX - 14; x += 14) [-1, 1].forEach(s => { if (r() < .4) return; const t = tree(r, .9 + r() * .3); t.position.set(x + r() * 3, 0, s * 9.4); g.add(t); P.col(t.position.x - .35, t.position.x + .35, s * 9.4 - .35, s * 9.4 + .35); });
    park(P, -10, r() < .5 ? 58 : -58);
  }

  function townBlock(P) {
    const { g, r, C } = P, D = 12;
    // main street: low shops near the middle of the east–west road; houses elsewhere
    const lots = lotsAlongRoads(P, D, () => 12 + Math.floor(r() * 3), l => !(l.face === 0 || l.face === Math.PI) || Math.abs(l.x) > 48);
    lots.forEach((l, k) => {
      const owner = robotName(r), shop = SHOPS[Math.floor(r() * SHOPS.length)], apt = r() < .18;
      const o = { w: l.w, d: D, floors: apt ? 3 : 1 + Math.floor(r() * 2), wall: WALLS[Math.floor(r() * WALLS.length)], awning: AWN[Math.floor(r() * AWN.length)], sign: apt ? 'APARTMENTS' : shop[0], owner };
      const b = roadBuilding(P, l.x, l.z, l.face, o), wpos = b.door.clone().add(V(P.ox, 0, P.oz));
      if (apt) C.doors.push({ pos: wpos, r: 2.0, label: '🏢 Go into the apartments', sub: 'Robots live upstairs · owned by ' + owner, fn: () => G.enterRoom('apartment', { data: { kind: 'apts', name: 'Main Street Apartments', owner, seed: Math.floor(r() * 1e6) + k, floors: 2 }, doorObj: { pos: wpos.clone(), facing: l.face } }) });
      if (r() < .5) addBot(P, { x: b.door.x + b.out.x * 1.2, z: b.door.z + b.out.z * 1.2, face: l.face, name: owner, job: apt ? 'the building manager 🔑' : shop[1], owns: o.sign.toLowerCase() });
    });
    // houses on the side road
    const hl = lotsAlongRoads(P, 26, () => 22, l => l.face === 0 || l.face === Math.PI);
    hl.forEach((l, k) => {
      const T = randomSpec(['cabin', 'farm', 'family'][k % 3], Math.floor(r() * 1e6)), owner = robotName(r);
      const front = T.porch ? 3 : 0, dz = SETBACK + 3 + front + T.d / 2, x = l.face > 0 ? VX - dz : -HALF - 10 + dz, h = buildHouse(T);
      h.position.set(x, 0, l.z); h.rotation.y = l.face; g.add(h);
      h.userData.cols.forEach(([x1, x2, z1, z2]) => { const a = V(x1, 0, z1).applyAxisAngle(V(0, 1, 0), l.face).add(h.position), b = V(x2, 0, z2).applyAxisAngle(V(0, 1, 0), l.face).add(h.position); P.col(Math.min(a.x, b.x) - .1, Math.max(a.x, b.x) + .1, Math.min(a.z, b.z) - .1, Math.max(a.z, b.z) + .1, true); });
      const door = h.userData.door.clone().applyAxisAngle(V(0, 1, 0), l.face).add(h.position), wpos = door.clone().add(V(P.ox, 0, P.oz));
      C.doors.push({ pos: wpos, r: 2.0, label: '🚪 Knock on ' + owner + '’s door', sub: 'Visit a robot’s house', fn: () => G.enterRoom('apartment', { data: { kind: 'house', name: owner + '’s ' + T.name, owner, seed: Math.floor(r() * 1e6) + k }, doorObj: { pos: wpos.clone(), facing: l.face } }) });
    });
    // water tower + a few trees
    const wt = new THREE.Group(), leg = std(0x8a8f99, .5, .6);
    [-1, 1].forEach(a => [-1, 1].forEach(b => wt.add(box(.3, 12, .3, leg, a * 2, 6, b * 2))));
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 4, 24), std(0xc9ccd1, .4, .6)); tank.position.y = 14; wt.add(tank);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 24), std(0xa8adb5, .4, .6)); cap.position.y = 16.8; wt.add(cap);
    const tx = -30, tz = 50; wt.position.set(tx, 0, tz); g.add(wt); P.col(tx - 2.3, tx + 2.3, tz - 2.3, tz + 2.3, true);
    for (let k = 0; k < 14; k++) { const x = -70 + r() * 130, z = (r() < .5 ? -1 : 1) * (40 + r() * 36); if (Math.abs(x - tx) < 6 && Math.abs(z - tz) < 6) continue; const t = tree(r, 1 + r() * .4); t.position.set(x, 0, z); g.add(t); P.col(x - .35, x + .35, z - .35, z + .35); }
    for (let k = 0; k < 3; k++) { const s = r() < .5 ? -1 : 1, z = s * (7.4 + r() * 1.6), x0 = -45 + r() * 40; addBot(P, { path: [[x0, z], [x0 + 25 + r() * 20, z]], job: WALK_JOBS[Math.floor(r() * WALK_JOBS.length)], pause: 2 }); }
    parkedCars(P);
  }

  function lakeBlock(P) {
    const { g, r, m, C } = P;
    const w = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r * 1.2, 48), m.water); w.rotation.x = -Math.PI / 2; w.position.set(LAKE.x, WATER_Y, LAKE.z); g.add(w); w.userData.water = true;
    // dock
    const dx = LAKE.x + LAKE.r * .55, dz = LAKE.z + LAKE.r * .62;
    const dock = new THREE.Group(); dock.add(box(2.4, .2, 12, m.wood, 0, .25, -6)); for (let k = 0; k < 4; k++) [-1, 1].forEach(s => dock.add(box(.2, 1.4, .2, m.trunk, s * 1.1, -.3, -1 - k * 3.4)));
    dock.position.set(dx, 0, dz); dock.rotation.y = -.75; g.add(dock); C.dock = { x: P.ox + dx, z: P.oz + dz, rot: -.75 };
    const tip = V(0, 0, -11).applyAxisAngle(V(0, 1, 0), -.75).add(V(dx, 0, dz));
    addBot(P, { x: tip.x, z: tip.z, face: -.75 + Math.PI, job: 'fishing 🎣', say: 'Shh! The fish are biting. I caught three today!' });
    C.walkOn = [{ cx: dx, cz: dz, rot: -.75, w: 2.4, l: 12 }]; // you can walk out on the dock
    wildBlock(P, 'lake', true);
  }

  function wildBlock(P, biome, lakeToo) {
    const { g, r, m, col, hAt, C } = P;
    const ok = (x, z) => Math.abs(z) > 9 && Math.abs(x - VX) > 9 && hAt(x, z) > WATER_Y + .6;
    const nT = biome === 'mountains' ? 70 : biome === 'hills' ? 55 : biome === 'lake' ? 45 : 0;
    // pines (instanced) on mountains, leafy trees elsewhere
    if (biome === 'mountains' || biome === 'hills') {
      const nP = biome === 'mountains' ? 140 : 40, cone = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 5, 8), m.pine, nP), stem = new THREE.InstancedMesh(new THREE.CylinderGeometry(.18, .25, 1.6, 6), m.trunk, nP), mt = new THREE.Matrix4();
      let k = 0;
      for (let t = 0; t < nP * 3 && k < nP; t++) { const x = -78 + r() * 156, z = -78 + r() * 156; if (!ok(x, z)) continue; const h = hAt(x, z); if (h > 30) continue; const s = .8 + r() * .8;
        mt.compose(V(x, h + 2.5 * s + .6, z), new THREE.Quaternion(), V(s, s, s)); cone.setMatrixAt(k, mt); mt.compose(V(x, h + .8 * s, z), new THREE.Quaternion(), V(s, s, s)); stem.setMatrixAt(k, mt); col(x - .3, x + .3, z - .3, z + .3); k++; }
      cone.count = stem.count = k; cone.castShadow = true; g.add(cone, stem);
    }
    for (let k = 0, t = 0; k < nT * (biome === 'mountains' ? .2 : 1) && t < 400; t++) { const x = -78 + r() * 156, z = -78 + r() * 156; if (!ok(x, z) || hAt(x, z) > 14) continue; const tr = tree(r, .9 + r() * .5); tr.position.set(x, hAt(x, z), z); g.add(tr); col(x - .35, x + .35, z - .35, z + .35); k++; }
    // rocks
    const nR = biome === 'desert' ? 30 : biome === 'mountains' ? 40 : 15;
    for (let k = 0; k < nR; k++) { const x = -78 + r() * 156, z = -78 + r() * 156; if (!ok(x, z)) continue; const s = .5 + r() * 1.6, rk = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), biome === 'desert' ? m.redrock : m.rock); rk.position.set(x, hAt(x, z) + s * .3, z); rk.rotation.set(r() * 3, r() * 3, r() * 3); rk.scale.y = .6; rk.castShadow = true; g.add(rk); if (s > .9) col(x - s * .7, x + s * .7, z - s * .7, z + s * .7); }
    if (biome === 'desert') {
      for (let k = 0; k < 45; k++) { const x = -78 + r() * 156, z = -78 + r() * 156; if (!ok(x, z)) continue; const cg = new THREE.Group(), hh = 2 + r() * 2.5;
        const main = new THREE.Mesh(new THREE.CapsuleGeometry(.3, hh, 4, 10), m.cactus); main.position.y = hh / 2 + .3; cg.add(main);
        [-1, 1].forEach(s2 => { if (r() < .35) return; const a = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .9, 4, 8), m.cactus); a.position.set(s2 * .55, hh * .55 + .5, 0); cg.add(a); const a2 = new THREE.Mesh(new THREE.CapsuleGeometry(.18, .5, 4, 8), m.cactus); a2.position.set(s2 * .35, hh * .5, 0); a2.rotation.z = Math.PI / 2; cg.add(a2); });
        cg.position.set(x, hAt(x, z), z); cg.rotation.y = r() * 6; cg.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(cg); col(x - .35, x + .35, z - .35, z + .35); }
      // mesas: big flat-topped red rocks
      for (let k = 0; k < 3; k++) { const x = -60 + r() * 110, z = (r() < .5 ? -1 : 1) * (30 + r() * 40); if (!ok(x, z)) continue; const rad = 6 + r() * 7, hh = 8 + r() * 14;
        const me = new THREE.Mesh(new THREE.CylinderGeometry(rad * .85, rad, hh, 9), m.redrock); me.position.set(x, hAt(x, z) + hh / 2 - .5, z); me.castShadow = true; me.receiveShadow = true; g.add(me); col(x - rad * .8, x + rad * .8, z - rad * .8, z + rad * .8, true); }
    }
    // a robot's cabin / adobe somewhere off the road, plus a couple of robots out exploring
    const hx = -40 + r() * 20, hz = (r() < .5 ? -1 : 1) * (22 + r() * 8);
    if (ok(hx, hz) && Math.abs(hAt(hx, hz)) < 3) {
      const T = randomSpec(biome === 'desert' ? 'villa' : 'cabin', Math.floor(r() * 1e6)), owner = robotName(r), h = buildHouse(T), face = hz > 0 ? Math.PI : 0, y0 = hAt(hx, hz);
      h.position.set(hx, y0 - .2, hz); h.rotation.y = face; g.add(h);
      h.userData.cols.forEach(([x1, x2, z1, z2]) => { const a = V(x1, 0, z1).applyAxisAngle(V(0, 1, 0), face).add(h.position), b = V(x2, 0, z2).applyAxisAngle(V(0, 1, 0), face).add(h.position); col(Math.min(a.x, b.x) - .1, Math.max(a.x, b.x) + .1, Math.min(a.z, b.z) - .1, Math.max(a.z, b.z) + .1, true); });
      const door = h.userData.door.clone().applyAxisAngle(V(0, 1, 0), face).add(h.position), wpos = door.clone().add(V(P.ox, 0, P.oz)); wpos.y = y0;
      C.doors.push({ pos: wpos, r: 2.0, label: '🚪 Knock on ' + owner + '’s door', sub: 'A robot lives out here', fn: () => G.enterRoom('apartment', { data: { kind: 'house', name: owner + '’s ' + T.name, owner, seed: Math.floor(r() * 1e6) }, doorObj: { pos: wpos.clone(), facing: face } }) });
      addBot(P, { x: door.x + Math.sin(face) * 2, z: door.z + Math.cos(face) * 2, face, name: owner, job: { desert: 'looking for fossils 🦴', mountains: 'chopping wood 🪓', hills: 'picking berries 🫐', lake: 'getting the boat ready ⛵' }[biome] || 'relaxing', owns: 'cabin' });
    }
    const jobs = { desert: ['exploring the desert 🌵', 'looking for gold ✨'], mountains: ['hiking ⛰️', 'climbing to the top 🧗'], hills: ['hiking 🥾', 'having a picnic 🧺'], lake: ['walking by the lake', 'looking for frogs 🐸'] }[biome] || ['hiking'];
    for (let k = 0; k < 2; k++) { const z = (r() < .5 ? -1 : 1) * (7.6 + r() * 1.4), x0 = -70 + r() * 50; addBot(P, { path: [[x0, z], [x0 + 40 + r() * 40, z]], job: jobs[k % jobs.length], pause: 3, speed: 1.1 }); }
  }

  W.heightAt = heightAt;
  return W;
}
