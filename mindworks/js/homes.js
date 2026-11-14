// Describe-a-house: turns words like "blue castle with a pool" into 20 house designs you can pick from.
import * as THREE from 'three';
import { G } from './game.js';
import { HOUSE_TIERS, buildHouse } from './town.js';
import { rng } from './tex.js';
import { env } from './rooms/common.js';

/** the house you live in now (older saves stored a level number) */
export function currentHome() {
  const u = G.S.data.up;
  if (u.home && u.home.kind) return u.home;
  return HOUSE_TIERS[Math.max(0, Math.min(HOUSE_TIERS.length - 1, u.house || 0))];
}

const COLOR_WORDS = {
  red: '#b5463a', blue: '#6f93b8', green: '#8fae86', yellow: '#e8cf7a', pink: '#e8a8b8', purple: '#9c86b8', white: '#efebe2', black: '#3a3a3e',
  gray: '#a6a6a6', grey: '#a6a6a6', orange: '#d98a4a', brown: '#8a6a4a', gold: '#d9bf6a', silver: '#c9ccd1', teal: '#5aa6a0', tan: '#cdb894'
};
const GLASS_WORDS = { blue: '#3b6f9c', green: '#3f7f6a', gold: '#a8843a', black: '#22262c', silver: '#8a97a6', purple: '#5a4a7f', pink: '#b07088', red: '#8a3a3a', teal: '#2f7f86', white: '#a9bccb' };
const has = (q, ...w) => w.some(x => new RegExp('\\b' + x).test(q));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** what kind of building the words describe */
function kindOf(q) {
  if (has(q, 'sky', 'tower', 'tall', 'high', 'office', 'hotel', 'apartment', 'condo', 'building', 'city')) return 'tower';
  if (has(q, 'castle', 'palace', 'fort', 'king', 'queen', 'prince', 'knight')) return 'castle';
  if (has(q, 'modern', 'futur', 'glass house', 'cool', 'cube')) return 'modern';
  if (has(q, 'cabin', 'log', 'cottage', 'tiny', 'small', 'little', 'cozy', 'hut', 'wood')) return 'cabin';
  if (has(q, 'mansion', 'huge', 'giant', 'rich', 'fancy', 'gold', 'big', 'biggest', 'luxury')) return 'mansion';
  if (has(q, 'beach', 'pool', 'tropical', 'island', 'spanish', 'villa')) return 'villa';
  if (has(q, 'farm', 'barn', 'ranch', 'country')) return 'farm';
  return 'any';
}

export function describeKind(q) {
  const k = kindOf(q.toLowerCase());
  return { tower: 'skyscraper', castle: 'castle', modern: 'modern house', cabin: 'cabin', mansion: 'mansion', villa: 'villa', farm: 'farmhouse', any: 'house' }[k];
}

/** 20 designs for a description */
export function designHomes(text) {
  const q = (text || '').toLowerCase().trim() || 'house';
  const kind = kindOf(q), color = Object.keys(COLOR_WORDS).find(c => has(q, c));
  const big = has(q, 'big', 'huge', 'giant', 'tall', 'biggest', 'mega', 'super'), small = has(q, 'small', 'tiny', 'little');
  const out = [];
  for (let i = 0; i < 20; i++) {
    const seed = (hash(q) + i * 7919) % 100000, r = rng(seed + 1);
    let k = kind;
    if (k === 'any') k = pick(r, ['cabin', 'farm', 'modern', 'villa', 'mansion', 'family', 'family', 'castle']);
    const T = k === 'tower' ? towerSpec(r, q, color, big, small, seed, i) : houseSpec(r, k, q, color, big, small, seed);
    const seen = out.filter(o => o.name.replace(/ (II|III|IV|V|VI)$/, '') === T.name).length;
    if (seen) T.name += ' ' + ['II', 'III', 'IV', 'V', 'VI'][Math.min(4, seen - 1)];
    out.push(T);
  }
  return out;
}

function towerSpec(r, q, color, big, small, seed, i) {
  const skin = has(q, 'brick') ? 'brick' : has(q, 'stone', 'old', 'classic') ? 'stone' : has(q, 'gold') && r() < .5 ? 'gold' : pick(r, ['glass', 'glass', 'glass', 'stone', 'brick']);
  const gl = color && GLASS_WORDS[color] ? GLASS_WORDS[color] : pick(r, ['#3b6f9c', '#2f5a7a', '#4a6f86', '#3f7f6a', '#22262c', '#8a97a6', '#a8843a']);
  const frame = skin === 'glass' ? pick(r, ['#2a2d33', '#9aa3ad', '#1d2128', '#c9ccd1']) : skin === 'stone' ? (color ? COLOR_WORDS[color] : pick(r, ['#cfc6b4', '#b9b2a6', '#ddd3c0'])) : '#8e4a38';
  let floors = Math.round(12 + r() * 24); if (big) floors += 14; if (small) floors = Math.round(6 + r() * 6);
  const crown = has(q, 'helicopter', 'helipad') ? 'helipad' : has(q, 'spire', 'pointy') ? 'spire' : pick(r, ['flat', 'spire', 'helipad', 'dome', 'crown', 'flat']);
  const real = i % 2 === 0; // half look like real skyscrapers inside, half are fun
  const adj = { glass: pick(r, ['Glass', 'Sky', 'Crystal', 'Skyline', 'Mirror']), stone: pick(r, ['Grand', 'Old Town', 'Empire', 'Stone']), brick: pick(r, ['Brick', 'Red Brick', 'Union']), gold: pick(r, ['Golden', 'Gold']) }[skin];
  const noun = pick(r, ['Tower', 'Tower', 'Heights', 'Plaza', 'Skyscraper', 'Center']);
  return {
    kind: 'tower', name: (color && !adj.toLowerCase().includes(color) ? color[0].toUpperCase() + color.slice(1) + ' ' : '') + adj + ' ' + noun, q, seed,
    w: Math.round(11 + r() * 5), d: Math.round(10 + r() * 4), floors, skin, glass: gl, frame, crown, setbacks: r() < .45, real,
    grand: 5, fence: 'iron', hedges: r() < .5, fountain: r() < .5, gate: true,
    blurb: floors + ' floors · ' + (real ? 'offices, apartments and a penthouse' : 'fun floors — arcade, pool, trampolines and more')
  };
}

function houseSpec(r, k, q, color, big, small, seed) {
  const base = {
    cabin: { name: pick(r, ['Log Cabin', 'Cozy Cottage', 'Woodland Cabin', 'Little Cottage']), grand: 0, w: 8 + Math.round(r() * 3), d: 7 + Math.round(r() * 2), stories: r() < .3 ? 2 : 1, wall: ['siding', pick(r, ['#8a6a4a', '#9a7a5a', '#c9b79a', '#7a5a3a'])], roof: ['gable', pick(r, ['#4a3a2a', '#6b4a3a', '#3f4a3a'])], porch: 'small', fence: 'picket' },
    farm: { name: pick(r, ['Farmhouse', 'Red Barn House', 'Ranch House', 'Country House']), grand: 2, w: 12 + Math.round(r() * 3), d: 10, stories: 2, wall: ['siding', pick(r, ['#b5463a', '#efebe2', '#e8cf7a'])], roof: ['gable', pick(r, ['#4a4b52', '#3a3a3e', '#6b4a3a'])], porch: 'wide', fence: 'picket', beds: true, garage: r() < .4 },
    family: { name: pick(r, ['Family House', 'Big House', 'Bungalow', 'Corner House', 'Two-Story House']), grand: 1 + Math.floor(r() * 3), w: 11 + Math.round(r() * 3), d: 9 + Math.round(r() * 2), stories: r() < .75 ? 2 : 1, wall: [pick(r, ['siding', 'siding', 'brick']), pick(r, ['#a7b89a', '#8fa8b8', '#c9b79a', '#9a5a44', '#e6d8b8'])], roof: ['gable', pick(r, ['#4a4b52', '#3f3a3a', '#6b4a3a'])], porch: 'wide', fence: 'picket', beds: r() < .7, garage: r() < .5 },
    modern: { name: pick(r, ['Modern House', 'Glass Box House', 'Cube House', 'Future House']), grand: 3 + Math.floor(r() * 2), w: 13 + Math.round(r() * 4), d: 10 + Math.round(r() * 3), stories: 2, wall: ['stucco', pick(r, ['#efebe2', '#d9d9d6', '#3a3a3e', '#cdb894'])], roof: ['flat', '#333'], balcony: r() < .6, fence: 'iron', hedges: true, pool: r() < .5, garage: r() < .5 },
    villa: { name: pick(r, ['Beach Villa', 'Spanish Villa', 'Palm Villa', 'Sunny Villa']), grand: 4, w: 14, d: 12, stories: 2, wall: ['stucco', pick(r, ['#e8dcc4', '#f2e2c8', '#e8c8a8', '#f4efe4'])], roof: ['hip', pick(r, ['#b5583a', '#a84a32', '#c56a42'])], wings: 1, balcony: true, fence: 'iron', hedges: true, beds: true, pool: r() < .7, fountain: r() < .4 },
    mansion: { name: pick(r, ['Mansion', 'Grand Mansion', 'Super Mansion', 'Golden Mansion', 'Hilltop Mansion']), grand: 5 + (r() < .5 ? 1 : 0), w: 16 + Math.round(r() * 2), d: 13 + Math.round(r() * 2), stories: 3, wall: ['stone', pick(r, ['#d9d2c2', '#efe9dc', '#e2d6c0'])], roof: ['hip', pick(r, ['#3d4452', '#2f3a4a', '#4a3a3a'])], wings: 2, portico: r() < .5 ? 4 : 6, fence: 'iron', hedges: true, fountain: true, gate: true },
    castle: { name: pick(r, ['Castle', 'Royal Castle', 'Stone Castle', 'Dragon Castle', 'Palace']), grand: 6, w: 16 + Math.round(r() * 2), d: 13 + Math.round(r() * 2), stories: 3, wall: ['stone', pick(r, ['#a8a49c', '#bdb6a8', '#8f8c86', '#d9d2c2'])], roof: ['castle', pick(r, ['#2f3a6a', '#6a2f3a', '#2f5a3a', '#3d4452'])], turrets: true, wings: r() < .6 ? 2 : 0, fence: 'iron', gate: true, hedges: r() < .5, flag: pick(r, [0xd8452f, 0x2f6fd8, 0xffd34d, 0x2fae6a]) }
  }[k];
  const T = { kind: 'house', q, seed, porch: null, ...base };
  if (k === 'castle') { T.stories = r() < .35 ? 2 : 3; T.w += Math.round((r() - .5) * 4); if (r() < .4) { T.tower = true; T.gold = r() < .5; } if (r() < .3) T.wall[1] = pick(r, ['#c9b48a', '#9a8f86', '#e8e2d6']); }
  if (k === 'mansion' && r() < .5) { T.tower = true; T.gold = true; T.pool = true; T.statues = true; T.bigWings = true; T.w = 18; T.d = 15; }
  if (k === 'family' && T.wall[0] === 'brick') T.wall[1] = pick(r, ['#9a5a44', '#8e3b2c', '#b8875c']);
  if (color) { if (T.wall[0] === 'brick') T.wall = ['siding', COLOR_WORDS[color]]; else T.wall = [T.wall[0], COLOR_WORDS[color]]; }
  if (has(q, 'gold')) T.gold = true;
  if (has(q, 'pool')) T.pool = true;
  if (has(q, 'fountain')) T.fountain = true;
  if (has(q, 'garage', 'car')) T.garage = true;
  if (big && T.stories < 3 && k !== 'cabin') T.stories++;
  if (small) { T.w = Math.max(8, T.w - 3); T.stories = Math.min(T.stories, 2); T.wings = 0; }
  if (T.wings) T.garage = false;
  T.blurb = T.stories + (T.stories > 1 ? ' floors' : ' floor') + [T.pool && 'pool', T.fountain && 'fountain', T.garage && 'garage', T.turrets && 'towers', T.tower && 'gold dome', T.balcony && 'balcony'].filter(Boolean).map(x => ' · ' + x).join('');
  return T;
}

/* ---------------- pictures of a design (rendered with the real 3D model) ---------------- */
let rt = null;
export function renderHome(T, W = 320, H = 220) {
  const R = G.renderer;
  if (!rt || rt.width !== W || rt.height !== H) { if (rt) rt.dispose(); rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); }
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xcfe3f4); sc.fog = new THREE.Fog(0xcfe3f4, 160, 400);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x6a6050, 1.3));
  const dl = new THREE.DirectionalLight(0xfff1dc, 2.4); dl.position.set(-14, 22, 18); sc.add(dl);
  sc.environment = env();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x5f8f3e, roughness: 1 })); ground.rotation.x = -Math.PI / 2; sc.add(ground);
  const hse = buildHouse(T); sc.add(hse);
  const bb = new THREE.Box3().setFromObject(hse), size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(32, W / H, .5, 900);
  const tall = size.y > size.x * 1.3;
  const fitH = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(16))), fitW = Math.max(size.x, size.z) / (2 * Math.tan(THREE.MathUtils.degToRad(16)) * W / H);
  const dist = Math.max(fitH, fitW) * (tall ? 1.05 : 1.25) + Math.max(size.x, size.z) * .3;
  const dir = new THREE.Vector3(.5, tall ? .25 : .42, 1).normalize();
  cam.position.copy(ctr).addScaledVector(dir, dist); cam.lookAt(ctr.x, ctr.y * (tall ? 1 : .8), ctr.z);
  R.setRenderTarget(rt); R.render(sc, cam);
  const pix = new Uint8Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, pix); R.setRenderTarget(null);
  hse.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) img.data.set(pix.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  x.putImageData(img, 0, 0);
  return c;
}

/** pencil-sketch outline of a design, drawn bit by bit. returns a stop() function */
export function sketch(canvas, T, ms = 1800, done) {
  const x = canvas.getContext('2d'), W = canvas.width, H = canvas.height, r = rng((T && T.seed) || 1);
  const lines = [], L = (a, b, c, d) => lines.push([a, b, c, d]);
  if (!T || T.kind === 'tower') {
    const tw = W * (.22 + r() * .12), th = H * .78, x0 = W / 2 - tw / 2, y0 = H * .92 - th;
    L(x0, H * .92, x0, y0); L(x0, y0, x0 + tw, y0); L(x0 + tw, y0, x0 + tw, H * .92);
    for (let i = 1; i < 14; i++) L(x0, y0 + i * th / 14, x0 + tw, y0 + i * th / 14);
    for (let i = 1; i < 5; i++) L(x0 + i * tw / 5, y0, x0 + i * tw / 5, H * .92);
    L(W / 2, y0, W / 2, y0 - H * .1);
  } else {
    const hw = W * (.36 + r() * .14), hh = H * (.3 + (T.stories || 1) * .08), x0 = W / 2 - hw / 2, yb = H * .9, yt = yb - hh;
    L(x0, yb, x0, yt); L(x0 + hw, yb, x0 + hw, yt); L(x0, yb, x0 + hw, yb);
    if (T.roof && (T.roof[0] === 'flat' || T.roof[0] === 'castle')) { L(x0 - 6, yt, x0 + hw + 6, yt); if (T.roof[0] === 'castle') for (let i = 0; i < 8; i++) { const cx = x0 + i * hw / 7; L(cx - 5, yt, cx - 5, yt - 10); L(cx - 5, yt - 10, cx + 5, yt - 10); L(cx + 5, yt - 10, cx + 5, yt); } }
    else { L(x0 - 10, yt, W / 2, yt - hh * .55); L(W / 2, yt - hh * .55, x0 + hw + 10, yt); L(x0 - 10, yt, x0 + hw + 10, yt); }
    L(W / 2 - 10, yb, W / 2 - 10, yb - 30); L(W / 2 - 10, yb - 30, W / 2 + 10, yb - 30); L(W / 2 + 10, yb - 30, W / 2 + 10, yb);
    const st = T.stories || 1;
    for (let s = 0; s < st; s++) for (let c = 0; c < 4; c++) { const wx = x0 + hw * (c + .5) / 4, wy = yb - (s + .55) * hh / st; if (s === 0 && Math.abs(wx - W / 2) < 22) continue; L(wx - 7, wy - 8, wx + 7, wy - 8); L(wx + 7, wy - 8, wx + 7, wy + 8); L(wx + 7, wy + 8, wx - 7, wy + 8); L(wx - 7, wy + 8, wx - 7, wy - 8); }
  }
  let stop = false; const t0 = performance.now();
  (function frame() {
    if (stop) return;
    const k = Math.min(1, (performance.now() - t0) / ms), n = k * lines.length;
    x.fillStyle = '#eef3f8'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(40,60,90,.06)'; x.lineWidth = 1; for (let i = 0; i < W; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let i = 0; i < H; i += 16) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    x.strokeStyle = '#3a4a66'; x.lineWidth = 2; x.lineCap = 'round';
    let px = 0, py = 0;
    for (let i = 0; i < Math.ceil(n); i++) { const [a, b, c, d] = lines[i], f = Math.min(1, n - i), ex = a + (c - a) * f, ey = b + (d - b) * f; x.beginPath(); x.moveTo(a + (r() - .5) * .8, b); x.lineTo(ex, ey); x.stroke(); px = ex; py = ey; }
    if (k < 1) { x.fillStyle = '#ffb000'; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); requestAnimationFrame(frame); }
    else if (done) done();
  })();
  return () => { stop = true; };
}

/** a random design for a robot's house or a city tower (used by the endless world) */
export function randomSpec(kind, seed) {
  const r = rng(seed);
  if (kind === 'tower') { const T = towerSpec(r, 'tower', null, r() < .3, false, seed, seed); T.floors = Math.round(8 + r() * 30); return T; }
  const T = houseSpec(r, kind, '', null, false, false, seed);
  T.wings = 0; T.bigWings = false; T.tower = false; T.turrets = kind === 'castle'; T.statues = false;
  T.w = Math.min(T.w, 14); T.d = Math.min(T.d, 11); if (T.portico) T.portico = 4; T.stories = Math.min(T.stories, 2);
  return T;
}
