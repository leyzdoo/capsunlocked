// Robot homes. Apartment buildings: a lobby, stairs up to hallways of little apartments — knock and go in to see
// what each robot is doing. Suburb and country houses: one robot's home.
import * as THREE from 'three';
import { G, toast, modal } from '../game.js';
import { sofa, table, rug, plant, lamp, shelf, box, std, env } from './common.js';
import { mat, rng, signTexture } from '../tex.js';
import { robotName } from '../world.js';

const BOT_COLORS = [0xd7dbe0, 0xe0b04a, 0x6fb7e8, 0xe87a6f, 0x8fd18a, 0xb79ce8, 0xf2f2f2, 0xff9f43, 0x5ad1c8];
const ACTS = ['cooking', 'tv', 'painting', 'guitar', 'sleeping', 'exercise', 'gaming', 'reading', 'dancing', 'fixing', 'blocks', 'plants'];
const SAY = {
  cooking: ['is cooking pancakes 🥞', 'Want a pancake? They\'re extra crispy — I like them with motor oil syrup!'],
  tv: ['is watching cartoons 📺', 'Shh, this is my favorite show! It\'s about a robot who learns to swim.'],
  painting: ['is painting a picture 🎨', 'I\'m painting a sunset. Do you like it so far?'],
  guitar: ['is playing guitar 🎸', 'I\'m learning a new song. Want to hear it? ♪ ♫'],
  sleeping: ['is taking a nap 😴', 'Zzz… beep… zzz… (it\'s recharging!)'],
  exercise: ['is running on the treadmill 🏃', 'Gotta keep my gears in shape! 10 more laps!'],
  gaming: ['is playing video games 🎮', 'I just beat level 99! Want to play next?'],
  reading: ['is reading a book 📖', 'This book is about the first robot on the moon. So good!'],
  dancing: ['is dancing 🕺', 'Dance party! Come on, move your gears!'],
  fixing: ['is building a gadget 🔧', 'I\'m building a robot dog. Just need one more bolt!'],
  blocks: ['is building a block tower 🧱', 'How tall can it get? Let\'s find out!'],
  plants: ['is watering plants 🪴', 'My plants love sunshine and a little bit of water. Just like me!']
};

const W = 9, D = 8, H = 3.2;
function shell(group, cols, o) {
  const floorM = mat(o.floor ? o.floor[0] : 'wood', o.floor ? o.floor[1] : [o.wood || '#9a6a40', 6, 401], (o.w || W) / 2.4, (o.d || D) / 2.4, { roughness: .55 });
  const w = o.w || W, d = o.d || D, h = o.h || H;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorM); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; group.add(fl);
  const wm = mat('plaster', [o.wall || '#efe4d0', 9], w / 3, h / 3, { roughness: .92 });
  [[w, h, .3, 0, h / 2, -d / 2 - .15], [w, h, .3, 0, h / 2, d / 2 + .15], [.3, h, d, -w / 2 - .15, h / 2, 0], [.3, h, d, w / 2 + .15, h / 2, 0]].forEach(a => { const m = box(a[0], a[1], a[2], wm, a[3], a[4], a[5]); m.castShadow = false; group.add(m); });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(0xf4f1ea, .95)); ceil.rotation.x = Math.PI / 2; ceil.position.y = h; group.add(ceil);
  const n = Math.max(1, Math.round(w / 6));
  for (let i = 0; i < n; i++) { const x = -w / 2 + w * (i + .5) / n; const p = new THREE.Mesh(new THREE.BoxGeometry(1, .04, 1), new THREE.MeshBasicMaterial({ color: 0xfffaf0 })); p.position.set(x, h - .02, 0); group.add(p); const l = new THREE.PointLight(0xfff1dc, 5, Math.max(w, d) * .9, 1.6); l.position.set(x, h - .4, 0); group.add(l); }
  // a window with daylight
  if (o.window !== false) { const gw = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), new THREE.MeshBasicMaterial({ color: 0xcfe6ff })); gw.position.set(w / 2 - .02, 1.8, -d / 4); gw.rotation.y = -Math.PI / 2; group.add(gw); group.add(box(.08, 1.6, 2, std(0xf6f2ea, .6), w / 2 - .01, 1.8, -d / 4)); }
  cols.push({ x1: -w / 2 - 1, x2: w / 2 + 1, z1: -d / 2 - 1, z2: -d / 2 }, { x1: -w / 2 - 1, x2: w / 2 + 1, z1: d / 2, z2: d / 2 + 1 }, { x1: -w / 2 - 1, x2: -w / 2, z1: -d / 2, z2: d / 2 }, { x1: w / 2, x2: w / 2 + 1, z1: -d / 2, z2: d / 2 });
}
function door(group, x, z, ry, color = 0x6b4226, label) {
  const g = new THREE.Group(); g.add(box(1.2, 2.3, .1, std(color, .5), 0, 1.15, 0)); g.add(box(1.5, 2.5, .05, std(0xf6f2ea, .6), 0, 1.25, -.03)); g.add(box(.08, .08, .12, std(0xd4af37, .3, 1), .42, 1.1, .08));
  if (label) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .3), new THREE.MeshBasicMaterial({ map: signTexture(label, { bg: '#2a2520', fg: '#ffe9b0', font: '600 70px Fredoka, Arial', h: 192 }) })); s.position.set(0, 2.65, .06); g.add(s); }
  g.position.set(x, 0, z); g.rotation.y = ry; group.add(g); return g;
}
function caption(text, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = 'rgba(20,18,50,.82)'; x.beginPath(); x.roundRect(4, 4, 504, 120, 30); x.fill();
  x.fillStyle = '#fff'; x.font = '600 46px Fredoka, Arial'; x.textAlign = 'center'; x.fillText(text, 256, 56);
  x.fillStyle = '#ffd34d'; x.font = '700 30px Nunito, Arial'; x.fillText(sub, 256, 100);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true })); s.scale.set(1.8, .45, 1); return s;
}

/** a robot's home with the robot doing something. returns {start, acts} */
function robotHome(ctx, R, name, act, r) {
  const { group, cols, anim, makeCharacter, add } = ctx;
  shell(group, cols, { wall: ['#efe4d0', '#e6ece8', '#f1e9dc', '#e8e0f0', '#fdf0e0', '#e0eef0'][Math.floor(r() * 6)], wood: ['#9a6a40', '#a0703f', '#8a5a35', '#b08a5a'][Math.floor(r() * 4)] });
  add(rug(3.4, 2.4, ['#7a3b3b', '#3b5a7a', '#6b5a3a', '#4a3b6b', '#2f6b4a'][Math.floor(r() * 5)]), 0, .6);
  add(plant(1.1), -W / 2 + .5, -D / 2 + .5, 0, .5, .5);
  const bot = makeCharacter('bot', BOT_COLORS[Math.floor(r() * BOT_COLORS.length)]), root = bot.root; group.add(root);
  let bx = 0, bz = -1, face = Math.PI, pose = 'idle';
  const P = (o, x, z, ry = 0, cw = 0, cd = 0) => add(o, x, z, ry, cw, cd);
  // furniture everyone has: a bed, a table, a sofa
  const bed = new THREE.Group(), wd = std(0x5a3c26, .5); bed.add(box(1.6, .35, 2.1, wd, 0, .18, 0)); bed.add(box(1.5, .25, 2, std(0xf4f1ea, .9), 0, .48, 0)); bed.add(box(1.52, .12, 1.2, std([0x3b5a7a, 0x6b3b5a, 0x2f6b4a][Math.floor(r() * 3)], .9), 0, .6, .35)); bed.add(box(1.7, 1, .1, wd, 0, .5, -1.05));
  P(bed, W / 2 - 1, -D / 2 + 1.15, 0, 1.7, 2.2);
  if (act !== 'tv' && act !== 'gaming') P(sofa(0x56606e, 2), -W / 2 + .6, .8, Math.PI / 2, .95, 2.2);
  P(table(1.1, .7, .76, '#5a3c26'), -2.2, D / 2 - 1.3, 0, 1.1, .7);
  const flick = (mesh, speed = 1) => anim.push(t => mesh.material.color.setHSL((t * .15 * speed) % 1, .6, .45 + Math.sin(t * 7) * .05));
  const screenAt = (x, z, ry, w = 1.8) => { const g = new THREE.Group(); g.add(box(w + .1, w * .58, .06, std(0x111111, .3, .5), 0, 0, 0)); const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w * .56), new THREE.MeshBasicMaterial({ color: 0x2a6fb0 })); s.position.z = .04; g.add(s); g.position.y = 1.4; P(g, x, z, ry); return s; };
  if (act === 'cooking') {
    const c = new THREE.Group(); c.add(box(2.4, .92, .7, mat('wood', ['#e8e2d6', 2, 402], 2, 1), 0, .46, 0)); c.add(box(.7, .05, .6, std(0x222222, .3, .6), .5, .95, 0));
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(.22, .2, .06, 20), std(0x333333, .3, .7)); pan.position.set(.5, 1.02, 0); c.add(pan);
    const cake = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .04, 16), std(0xe0b060, .8)); cake.position.set(.5, 1.07, 0); c.add(cake);
    P(c, 0, -D / 2 + .4, 0, 2.4, .7); bx = .5; bz = -D / 2 + 1.15; face = Math.PI;
    anim.push(t => { const k = (t * .8) % 2; cake.position.y = 1.07 + (k < .5 ? Math.sin(k * Math.PI * 2) * .35 : 0); cake.rotation.x = k < .5 ? k * Math.PI * 2 : 0; });
  } else if (act === 'tv' || act === 'gaming') {
    const s = screenAt(0, -D / 2 + .1, 0, 2.2); flick(s, act === 'gaming' ? 3 : .5);
    P(sofa(0x56606e, 2.2), 0, .4, Math.PI, 2.4, 1); bx = 0; bz = -.6; face = Math.PI;
    if (act === 'gaming') { pose = 'cheer'; }
  } else if (act === 'painting') {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 200; const x = cv.getContext('2d'); x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 256, 200);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const easel = new THREE.Group(); [-1, 1].forEach(s => { const l = box(.06, 1.7, .06, std(0x8a6440, .7), s * .4, .85, 0); l.rotation.z = s * .1; easel.add(l); });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1, .8), new THREE.MeshBasicMaterial({ map: tex })); pic.position.set(0, 1.35, .05); easel.add(pic);
    P(easel, 0, -1.6, 0, 1, .4); bx = 0; bz = -.6; face = Math.PI;
    const pr = rng(Math.floor(r() * 1e6)); let last = 0;
    x.fillStyle = '#9fd0ff'; x.fillRect(0, 0, 256, 110);
    anim.push(t => { if (t - last < .35) return; last = t; const k = Math.floor(t / .35) % 40; if (k === 0) { x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 256, 200); x.fillStyle = ['#9fd0ff', '#ffb38a', '#c9a8ff'][Math.floor(pr() * 3)]; x.fillRect(0, 0, 256, 110); }
      x.fillStyle = ['#ff6f4a', '#ffd23f', '#2fae6a', '#4f8f3a', '#ffffff', '#3b5a7a'][Math.floor(pr() * 6)]; x.beginPath(); x.ellipse(pr() * 256, 60 + pr() * 140, 6 + pr() * 22, 4 + pr() * 12, pr() * 3, 0, 7); x.fill(); tex.needsUpdate = true; });
  } else if (act === 'guitar') {
    const gt = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .1, 20), std(0xb5651d, .5)); body.rotation.x = Math.PI / 2; gt.add(body); gt.add(box(.07, .8, .05, std(0x3a2416), 0, .5, 0));
    gt.position.set(.15, 1.05, .32); gt.rotation.z = -1.1; root.add(gt); bx = 0; bz = .2; face = 0;
    notes(ctx, root);
  } else if (act === 'sleeping') {
    bx = W / 2 - 1; bz = -D / 2 + 1.2; face = 0; pose = 'lie'; zzz(ctx, root);
  } else if (act === 'exercise') {
    const tm = new THREE.Group(); tm.add(box(.9, .2, 2, std(0x222222, .6), 0, .1, 0)); tm.add(box(.9, 1.2, .1, std(0x333333, .5, .5), 0, .8, -.95)); P(tm, 2, .8, Math.PI, .9, 2);
    bx = 2; bz = .8; face = Math.PI; pose = 'run';
  } else if (act === 'reading') {
    P(shelf(2, 2.2), -1.5, -D / 2 + .3, 0, 2.1, .5); P(lamp(), 1.2, -1.6, 0, .4, .4);
    const book = box(.35, .45, .06, std(0x8b2b2b, .7), 0, 0, 0); book.position.set(0, 1.25, .35); root.add(book); bx = .3; bz = -1; face = 0;
  } else if (act === 'dancing') {
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 1), std(0xeeeeee, .1, 1)); ball.position.set(0, H - .5, 0); group.add(ball);
    const pl = new THREE.PointLight(0xff4fd8, 4, 8); pl.position.set(0, H - 1, 0); group.add(pl); anim.push(t => { ball.rotation.y = t; pl.color.setHSL(t * .3 % 1, 1, .5); });
    bx = 0; bz = .5; face = 0; pose = 'dance';
  } else if (act === 'fixing') {
    const wb = new THREE.Group(); wb.add(box(2, .08, .8, mat('wood', ['#8a6440', 4, 403], 1, 1), 0, .9, 0)); [-1, 1].forEach(s => wb.add(box(.08, .9, .7, std(0x555555, .5, .5), s * .9, .45, 0)));
    const gears = []; for (let k = 0; k < 3; k++) { const gr = new THREE.Mesh(new THREE.TorusGeometry(.12 + k * .04, .04, 6, 10), std(0xc9a64a, .3, 1)); gr.position.set(-.5 + k * .45, 1.1, 0); gr.rotation.x = Math.PI / 2; wb.add(gr); gears.push(gr); }
    P(wb, 0, -D / 2 + .5, 0, 2, .8); bx = 0; bz = -D / 2 + 1.3; face = Math.PI; anim.push(t => gears.forEach((gr, k) => gr.rotation.z = t * (k % 2 ? -2 : 2)));
  } else if (act === 'blocks') {
    const cs = [0xff5d73, 0x4fb0ff, 0xffd23f, 0x2fd3a7, 0x9d8cff], blocks = [];
    for (let k = 0; k < 12; k++) { const b = box(.4, .4, .4, std(cs[k % 5], .5), 0, .2 + k * .4, 0); b.rotation.y = k * .3; b.position.set(.8, .2 + k * .4, -1); group.add(b); blocks.push(b); }
    anim.push(t => { const n = Math.floor(t / .8) % 14; blocks.forEach((b, k) => b.visible = k < n); });
    bx = 0; bz = -.6; face = Math.PI * .75;
  } else { // plants
    const pots = [[-3, -3], [3, 2], [-3, 2.5], [1, -3]]; pots.forEach(([x, z]) => P(plant(1.3), x, z, 0, .5, .5));
    const path = pots.map(([x, z]) => new THREE.Vector3(x * .75, 0, z * .75)); let seg = 0;
    anim.push((t, dt) => { const tg = path[seg], p = root.position, dx = tg.x - p.x, dz = tg.z - p.z, d = Math.hypot(dx, dz); if (d < .1) { seg = (seg + 1) % path.length; bot.speedBlend(0); } else { p.x += dx / d * dt * .9; p.z += dz / d * dt * .9; root.rotation.y = Math.atan2(dx, dz); bot.speedBlend(.4); } });
    pose = 'walk';
  }
  root.position.set(bx, 0, bz); root.rotation.y = face;
  if (pose === 'lie') { bot.model.rotation.x = -Math.PI / 2; bot.model.position.set(0, .75, .85); }
  const tag = caption(name, SAY[act][0]); tag.position.y = pose === "lie" ? 1.6 : 2.1; root.add(tag);
  let gt = 2;
  anim.push((t, dt) => {
    bot.update(dt);
    if (pose === 'run') bot.speedBlend(1.6);
    else if (pose === 'dance') { root.rotation.y = Math.sin(t * 2) * 1.2; root.position.y = Math.abs(Math.sin(t * 4)) * .15; gt -= dt; if (gt < 0) { gt = 1.2; bot.play('agree'); } }
    else if (pose === 'cheer') { gt -= dt; if (gt < 0) { gt = 2.5 + Math.random() * 3; bot.play('agree'); } bot.speedBlend(0); }
    else if (pose !== 'walk') bot.speedBlend(0);
  });
  return {
    say: { pos: root.position, r: 2.4, label: '👋 Say hi to ' + name, sub: SAY[act][0], fn: () => { if (pose !== 'lie') bot.play('agree'); toast('🤖 ' + name + ': "' + SAY[act][1] + '"'); } }
  };
}
function floaty(ctx, root, chars, color) {
  const { group, anim } = ctx, items = [];
  for (let k = 0; k < 3; k++) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = color; x.font = 'bold 50px Arial'; x.textAlign = 'center'; x.fillText(chars[k % chars.length], 32, 50);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); s.scale.setScalar(.35); group.add(s); items.push(s); }
  anim.push(t => items.forEach((s, k) => { const ph = (t * .5 + k / 3) % 1; s.position.set(root.position.x + Math.sin(t + k) * .3 + .3, 1.6 + ph * 1.2, root.position.z); s.material.opacity = 1 - ph; }));
}
const notes = (ctx, root) => floaty(ctx, root, ['♪', '♫', '♬'], '#ffd34d');
const zzz = (ctx, root) => floaty(ctx, root, ['z', 'Z', 'z'], '#9fd0ff');

/* ---------------- entering ---------------- */
export async function enter({ player, makeCharacter, data }) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0e0d1c); scene.environment = env();
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x3a3228, .6));
  const key = new THREE.DirectionalLight(0xfff3e0, 1); key.position.set(4, 10, 6); scene.add(key);
  const R = rng(data.seed || 1);
  // residents of an apartment building: floors × 4 apartments
  const floors = data.kind === 'apts' ? Math.max(1, data.floors || 2) : 0;
  const residents = []; for (let f = 1; f <= floors; f++) for (let k = 0; k < 4; k++) { const rr = rng((data.seed || 1) * 31 + f * 7 + k); residents.push({ f, k, name: robotName(rr), act: ACTS[Math.floor(rr() * ACTS.length)], apt: (f + 1) + 'ABCD'[k] }); }
  let group = null, cols = [], acts = [], anim = [], where = null, t = 0, busy = false;
  const ctx = { get group() { return group; }, get cols() { return cols; }, get anim() { return anim; }, makeCharacter, add: (o, x, z, ry = 0, cw = 0, cd = 0) => { o.position.set(x, o.position.y, z); o.rotation.y = ry; group.add(o); if (cw) { const s2 = Math.abs(Math.sin(ry)) > .5, a = s2 ? cd : cw, b = s2 ? cw : cd; cols.push({ x1: x - a / 2, x2: x + a / 2, z1: z - b / 2, z2: z + b / 2 }); } return o; } };
  function clear() { if (group) { scene.remove(group); group.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) o.geometry.dispose(); }); } group = new THREE.Group(); scene.add(group); cols = []; acts = []; anim = []; }

  function goLobby(fromStairs) {
    clear(); where = 'lobby'; const w = 12, d = 9;
    shell(group, cols, { w, d, h: 3.6, wall: '#e6dccb', floor: ['tiles', ['#efe9dd', '#2f2a26', 8, 404]] });
    door(group, 0, d / 2 - .05, Math.PI, 0x2a2a30); // the way out
    // mailboxes
    const mb = new THREE.Group(); for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) mb.add(box(.42, .32, .3, std(0xc9a64a, .35, .9), -.66 + b * .44, .9 + a * .34, 0)); ctx.add(mb, -w / 2 + .3, -1, Math.PI / 2, .4, 1.8);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, .7), new THREE.MeshBasicMaterial({ map: signTexture(data.name || 'APARTMENTS', { bg: '#2a2520', fg: '#ffe9b0', border: '#c9a64a' }) })); sign.position.set(0, 2.8, -d / 2 + .05); group.add(sign);
    ctx.add(plant(1.3), w / 2 - .6, -d / 2 + .6, 0, .5, .5); ctx.add(sofa(0x7a4a3a, 2.2), 3, 1, -Math.PI / 2, 1, 2.4); ctx.add(rug(3, 2, '#5a3a3a'), 0, 1);
    stairsProp(group, ctx, -w / 2 + 2, -d / 2 + 1.2);
    // the manager
    const bot = makeCharacter('bot', 0xe0b04a); bot.root.position.set(1.5, 0, -2.6); bot.root.rotation.y = 0; group.add(bot.root); const tg = caption(data.owner, "the building manager 🔑"); tg.position.y = 2.1; bot.root.add(tg);
    anim.push((t2, dt) => { bot.update(dt); bot.speedBlend(0); });
    acts.push({ pos: new THREE.Vector3(1.5, 0, -2.6), r: 2.2, label: '👋 Say hi to ' + data.owner, sub: 'the building manager', fn: () => { bot.play('agree'); toast('🤖 ' + data.owner + ': "Welcome! ' + residents.length + ' robots live upstairs. Go knock on their doors — they love visitors!"'); } });
    acts.push({ pos: new THREE.Vector3(-w / 2 + 2, 0, -d / 2 + 2.6), r: 1.8, label: '🪜 Go upstairs', sub: 'Floor 2 · ' + floors * 4 + ' apartments', fn: () => move(() => goHall(1)) });
    acts.push({ pos: new THREE.Vector3(0, 0, d / 2 - 1), r: 1.6, label: 'Go back outside', sub: data.name, fn: () => G.backToTown() });
    place(fromStairs ? new THREE.Vector3(-w / 2 + 2, 0, -d / 2 + 3) : new THREE.Vector3(0, 0, d / 2 - 2), fromStairs ? 0 : Math.PI);
  }
  function stairsProp(g, c, x, z) { // decorative stairs going up into the ceiling
    for (let k = 0; k < 8; k++) g.add(box(1.6, .2 + k * .4, .4, std(0x8a5a35, .5), x, (.2 + k * .4) / 2, z + 1.4 - k * .4));
    c.cols.push({ x1: x - .8, x2: x + .8, z1: z - 1.6, z2: z + .4 });
  }
  function goHall(f, fromApt) {
    clear(); where = 'hall' + f; const w = 16, d = 5;
    shell(group, cols, { w, d, h: 3, wall: ['#e7eef5', '#f2ece0', '#e9e4f2'][f % 3], floor: ['carpet', [['#7a3b3b', '#3b5a7a', '#4a3b6b'][f % 3], 12]], window: false });
    const here = residents.filter(x => x.f === f);
    here.forEach((res, k) => {
      const x = -4.5 + (k % 2) * 9, side = k < 2 ? -1 : 1, z = side * (d / 2 - .05);
      door(group, x, z, side < 0 ? 0 : Math.PI, [0x6b4226, 0x2b4a7a, 0x2f6b4a, 0x8b2b2b][k], res.apt + ' · ' + res.name);
      acts.push({ pos: new THREE.Vector3(x, 0, side * (d / 2 - 1)), r: 1.4, label: '✊ Knock on ' + res.apt, sub: res.name + ' lives here', fn: () => move(() => goApt(res)) });
    });
    stairsProp(group, ctx, w / 2 - 1.2, -.5);
    acts.push({ pos: new THREE.Vector3(w / 2 - 2.4, 0, 1), r: 1.6, label: f < floors ? '🪜 Up or down?' : '🪜 Go downstairs', sub: 'Floor ' + (f + 1), fn: () => {
      if (f >= floors) return move(() => f > 1 ? goHall(f - 1, null, true) : goLobby(true));
      G.stairsChoice = [{ label: '⬆️ Up to floor ' + (f + 2), fn: () => move(() => goHall(f + 1)) }, { label: '⬇️ Down to ' + (f > 1 ? 'floor ' + f : 'the lobby'), fn: () => move(() => f > 1 ? goHall(f - 1) : goLobby(true)) }];
      modal({ big: '🪜', title: 'Stairs', text: 'Which way?', acts: G.stairsChoice.map(a => ({ ...a, cls: 'go' })).concat([{ label: 'Stay here', cls: 'ghost' }]) });
    } });
    // a robot walking down the hall now and then
    if (fromApt) { const res = fromApt, k = here.indexOf(res); place(new THREE.Vector3(-4.5 + (k % 2) * 9, 0, (k < 2 ? -1 : 1) * (d / 2 - 1.2)), k < 2 ? 0 : Math.PI); }
    else place(new THREE.Vector3(w / 2 - 2.6, 0, 1.2), -Math.PI / 2);
  }
  function goApt(res) {
    clear(); where = 'apt';
    const r = rng(res.name.length * 97 + res.f * 13 + res.k + (data.seed || 0));
    const home = robotHome(ctx, null, res.name, res.act, r);
    door(group, 0, D / 2 - .05, Math.PI, 0x6b4226);
    acts.push(home.say);
    acts.push({ pos: new THREE.Vector3(0, 0, D / 2 - 1), r: 1.5, label: 'Leave ' + res.name + '’s apartment', sub: 'Back to the hallway', fn: () => move(() => goHall(res.f, res)) });
    place(new THREE.Vector3(0, 0, D / 2 - 1.8), Math.PI);
    toast('🤖 ' + res.name + ' ' + SAY[res.act][0].replace(/^is /, 'is ') + '!');
  }
  function goHouse() {
    clear(); where = 'house';
    const act = ACTS[Math.floor(R() * ACTS.length)];
    const home = robotHome(ctx, null, data.owner, act, R);
    door(group, 0, D / 2 - .05, Math.PI, 0x8b2b2b);
    acts.push(home.say);
    acts.push({ pos: new THREE.Vector3(0, 0, D / 2 - 1), r: 1.5, label: 'Go back outside', sub: data.name, fn: () => G.backToTown() });
    place(new THREE.Vector3(0, 0, D / 2 - 1.8), Math.PI);
    setTimeout(() => toast('🤖 ' + data.owner + ' ' + SAY[act][0] + '!'), 400);
  }
  function place(p, yaw) { player.root.position.copy(p); player.root.rotation.y = yaw; G.camYawTo && G.camYawTo(yaw + Math.PI); }
  async function move(fn) {
    if (busy) return; busy = true;
    const f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;z-index:36;background:#000;opacity:0;transition:opacity .22s'; document.body.appendChild(f);
    requestAnimationFrame(() => f.style.opacity = 1); await new Promise(res => setTimeout(res, 240));
    fn(); f.style.opacity = 0; setTimeout(() => f.remove(), 260); busy = false;
  }

  if (data.kind === 'apts') goLobby(); else goHouse();
  return {
    scene, walks: true, title: data.name, cam: { dist: 4.6, pitch: .42 },
    get colliders() { return cols; }, get camBlockers() { return cols.slice(0, 4); },
    help: data.kind === 'apts' ? 'Go upstairs and knock on doors to visit the robots' : 'Say hi to the robot!',
    start: player.root.position.clone(), startYaw: player.root.rotation.y, camYaw: player.root.rotation.y + Math.PI,
    camClamp(p) { p.y = Math.min(p.y, 2.9); },
    interact: () => acts,
    update(dt) { t += dt; anim.forEach(f => f(t, dt)); },
    exit() {}
  };
}
