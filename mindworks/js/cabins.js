// The insides of every plane — real size, so you can walk around in them.
// Inside a cabin the nose points to -z and the floor is y = 0.
// The 747's cabin is also shrunk down and put inside the flying plane (see jumbo.js).
import * as THREE from 'three';
import { mat } from './tex.js';

const std = (c, r = .7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const glowM = c => new THREE.MeshBasicMaterial({ color: c });

/* lots of boxes → one InstancedMesh per material (fast on iPad) */
function parts() {
  const L = new Map();
  return {
    add(m, w, h, d, x, y, z, ry = 0) { if (!L.has(m)) L.set(m, []); L.get(m).push([w, h, d, x, y, z, ry]); },
    build(g) {
      const geo = new THREE.BoxGeometry(1, 1, 1), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
      L.forEach((arr, m) => {
        const im = new THREE.InstancedMesh(geo, m, arr.length);
        arr.forEach((a, i) => { Q.setFromEuler(E.set(0, a[6], 0)); M.compose(V.set(a[3], a[4], a[5]), Q, S.set(a[0], a[1], a[2])); im.setMatrixAt(i, M); });
        im.frustumCulled = false; im.receiveShadow = true; g.add(im);
      });
    }
  };
}
const box = (x1, x2, z1, z2) => ({ x1, x2, z1, z2 });
/** a seat facing the nose (-z); flip = facing the back */
function seat(P, M, x, y0, z, { w = .46, len = .5, cushion, arms = false, head = true, flip = false, tall = .75 }) {
  const b = flip ? -1 : 1;
  P.add(M.frame, w * .8, .32, len * .6, x, y0 + .17, z);
  P.add(cushion, w, .16, len, x, y0 + .42, z);
  P.add(cushion, w, tall, .16, x, y0 + .5 + tall / 2, z + b * (len / 2 - .04));
  if (head) P.add(M.head, w * .82, .2, .17, x, y0 + .5 + tall - .14, z + b * (len / 2 - .04));
  if (arms) [-1, 1].forEach(s => P.add(M.frame, .08, .14, len * .85, x + s * (w / 2 + .03), y0 + .6, z));
}
function mats() {
  return {
    wall: std(0xf2efe8, .85), ceil: std(0xf8f6f1, .9), frame: std(0x3a3d44, .5, .3), head: std(0xf4f4f4, .9), bin: std(0xe9e7e2, .6),
    glass: glowM(0xcfe8ff), sky: glowM(0x9fd2ff), dark: std(0x1d2026, .5, .2), wood: std(0x6b3f22, .5), gold: std(0xd8b04a, .3, .9),
    metal: std(0xb8bcc4, .3, .9), screen: glowM(0x3aa0ff), screen2: glowM(0x52e08a), lightStrip: glowM(0xfff6e0), red: glowM(0xff4a4a), exit: glowM(0x2bd46a)
  };
}
function windowsAlong(P, M, x, y, z1, z2, step, skip = () => false) { for (let z = z1; z <= z2; z += step) if (!skip(z)) P.add(M.glass, .03, .42, .3, x, y, z); }

/* ================= the 747: two decks, cockpit upstairs ================= */
export const B747 = { W: 7, H: 2.6, Z0: -22, Z1: 22, UY: 3.0, UW: 5, UH: 2.3, UZ1: -8 };
export function build747(g, { lights = true } = {}) {
  const { W, H, Z0, Z1, UY, UW, UH, UZ1 } = B747, L = Z1 - Z0, P = parts(), M = mats();
  const carpet = mat('carpet', ['#24386a', 12], W / 2, L / 2, { roughness: 1 }), carpetUp = mat('carpet', ['#4a1f2e', 12], UW / 2, 7, { roughness: 1 });
  const econ = std(0x2f5aa8, .85), biz = std(0x6b2a3c, .7), first = std(0xe8d5b0, .45), lounge = std(0x8a5a35, .5);
  const main = [], up = [], mainWalls = [], upWalls = [], acts = [];
  const SW = { x1: 1.05, x2: 2.15, z1: -16.6, z2: -14 }; // the stairwell

  // ---------- main deck ----------
  P.add(carpet, W, .1, L, 0, -.05, 0);
  [[Z0, SW.z1, -W / 2, W / 2], [SW.z2, Z1, -W / 2, W / 2], [SW.z1, SW.z2, -W / 2, SW.x1], [SW.z1, SW.z2, SW.x2, W / 2]].forEach(([z1, z2, x1, x2]) => P.add(M.ceil, x2 - x1, .06, z2 - z1, (x1 + x2) / 2, H, (z1 + z2) / 2));
  [-1, 1].forEach(s => { P.add(M.wall, .1, H, L, s * W / 2, H / 2, 0); mainWalls.push(s < 0 ? box(-W / 2 - 1, -W / 2, Z0, Z1) : box(W / 2, W / 2 + 1, Z0, Z1)); });
  P.add(M.wall, W, H, .1, 0, H / 2, Z0); P.add(M.wall, W, H, .1, 0, H / 2, Z1);
  mainWalls.push(box(-W / 2, W / 2, Z0 - 1, Z0), box(-W / 2, W / 2, Z1, Z1 + 1));
  const doorZ = -13.4;
  windowsAlong(P, M, -W / 2 + .07, 1.35, -21.2, 21.2, .95, z => Math.abs(z - doorZ) < .8);
  windowsAlong(P, M, W / 2 - .07, 1.35, -21.2, 21.2, .95);
  // the big door you came in through
  P.add(M.metal, .1, 2.0, 1.1, -W / 2 + .06, 1.0, doorZ); P.add(M.dark, .12, .08, .3, -W / 2 + .12, 1.0, doorZ + .35);
  P.add(M.glass, .13, .3, .22, -W / 2 + .1, 1.55, doorZ); P.add(M.exit, .05, .16, .5, -W / 2 + .1, 2.25, doorZ);
  acts.push({ type: 'exit', pos: [-W / 2 + .8, 0, doorZ], r: 1.4, label: '🚪 Get off the plane', sub: 'Walk back outside' });
  // first class at the nose: big leather seats, 1-2-1
  for (const z of [-20.4, -18.6]) for (const x of [-2.65, -.45, .45, 2.65]) { seat(P, M, x, 0, z, { w: .85, len: 1.15, cushion: first, arms: true, tall: .9 }); main.push(box(x - .5, x + .5, z - .6, z + .6)); }
  P.add(M.wood, .1, .9, 1.1, 0, .45, -20.4); P.add(M.wood, .1, .9, 1.1, 0, .45, -18.6); // little divider between the middle pair
  // stairs up to the upper deck
  for (let k = 0; k < 10; k++) P.add(M.wood, SW.x2 - SW.x1, .3 * (k + 1), .26, (SW.x1 + SW.x2) / 2, .15 * (k + 1), SW.z2 - .13 - k * .26);
  [SW.x1, SW.x2].forEach(x => P.add(M.gold, .05, .05, 2.8, x, 1.9, (SW.z1 + SW.z2) / 2));
  main.push(box(SW.x1 - .05, SW.x2 + .05, SW.z1, SW.z2));
  acts.push({ type: 'up', pos: [1.6, 0, -13.3], r: 1.3, label: '🪜 Go upstairs', sub: 'The upper deck and the cockpit' });
  // business class 2-2-2
  for (let z = -11; z <= -4.4; z += 1.3) for (const x of [-2.95, -2.4, -.3, .3, 2.4, 2.95]) seat(P, M, x, 0, z, { w: .55, len: .9, cushion: biz, arms: true, tall: .85 });
  main.push(box(-3.4, -2.1, -11.5, -4), box(-.62, .62, -11.5, -4), box(2.1, 3.4, -11.5, -4));
  // galley in the middle
  P.add(M.metal, 1.8, 1.0, 1.4, 0, .5, -2.5); P.add(M.dark, .4, .35, .35, -.4, 1.18, -2.5); P.add(M.red, .06, .06, .02, -.4, 1.2, -2.32); P.add(M.wood, 1.8, .05, 1.4, 0, 1.02, -2.5);
  main.push(box(-.95, .95, -3.25, -1.75));
  // economy 3-4-3, lots of rows
  for (let z = -1; z <= 20; z += .85) for (const x of [-3.16, -2.68, -2.2, -.72, -.24, .24, .72, 2.2, 2.68, 3.16]) seat(P, M, x, 0, z, { cushion: econ });
  main.push(box(-3.5, -1.96, -1.3, 20.3), box(-.96, .96, -1.3, 20.3), box(1.96, 3.5, -1.3, 20.3));
  // overhead bins + ceiling lights
  [-1, 1].forEach(s => P.add(M.bin, 1.35, .42, 31.8, s * 2.78, 2.27, 4.4));
  P.add(M.bin, 1.7, .4, 21.3, 0, 2.3, 9.65);
  [-1.46, 1.46].forEach(x => P.add(M.lightStrip, .12, .02, 40, x, H - .04, 0));
  // toilets at the back
  [-1, 1].forEach(s => { P.add(M.wall, 2.1, H, 1.3, s * 2.4, H / 2, 21.3); P.add(M.dark, .8, 1.9, .04, s * 2.0, .95, 20.63); P.add(M.exit, .3, .12, .02, s * 2.0, 2.0, 20.6); main.push(box(s < 0 ? -3.5 : 1.35, s < 0 ? -1.35 : 3.5, 20.6, 22)); });

  // ---------- upper deck ----------
  const ul = -UW / 2, ur = UW / 2, ULEN = UZ1 - Z0, UT = UY + UH;
  const UH0 = { x1: .95, x2: 2.5, z1: SW.z1 - .1, z2: SW.z2 }; // hole for the stairs
  [[Z0, UH0.z1, ul, ur], [UH0.z2, UZ1, ul, ur], [UH0.z1, UH0.z2, ul, UH0.x1]].forEach(([z1, z2, x1, x2]) => P.add(carpetUp, x2 - x1, .3, z2 - z1, (x1 + x2) / 2, UY - .15, (z1 + z2) / 2));
  P.add(M.ceil, UW, .06, ULEN, 0, UT, (Z0 + UZ1) / 2);
  [-1, 1].forEach(s => { P.add(M.wall, .1, UH, ULEN, s * UW / 2, UY + UH / 2, (Z0 + UZ1) / 2); upWalls.push(s < 0 ? box(ul - 1, ul, Z0, UZ1) : box(ur, ur + 1, Z0, UZ1)); });
  P.add(M.wall, UW, UH, .1, 0, UY + UH / 2, UZ1);
  if (lights) P.add(M.wall, UW, UH, .1, 0, UY + UH / 2, Z0);
  else { P.add(M.wall, UW, 1.35, .1, 0, UY + .675, Z0); P.add(M.wall, UW, UH - 1.95, .1, 0, UY + 1.95 + (UH - 1.95) / 2, Z0); [-1, 1].forEach(s => P.add(M.wall, .6, .6, .1, s * 2.2, UY + 1.65, Z0)); }
  upWalls.push(box(ul, ur, UZ1, UZ1 + 1), box(ul, ur, Z0 - 1, Z0));
  windowsAlong(P, M, ul + .07, UY + 1.2, -18.8, -8.6, .95); windowsAlong(P, M, ur - .07, UY + 1.2, -18.8, -8.6, .95);
  // railing round the stairwell
  P.add(M.gold, .05, .9, UH0.z2 - UH0.z1, UH0.x1, UY + .45, (UH0.z1 + UH0.z2) / 2); P.add(M.gold, UH0.x2 - UH0.x1, .9, .05, (UH0.x1 + UH0.x2) / 2, UY + .45, UH0.z1);
  up.push(box(UH0.x1 - .05, UH0.x2, UH0.z1 - .05, UH0.z2 - .1));
  acts.push({ type: 'down', pos: [1.6, UY, -13.3], r: 1.3, label: '🪜 Go downstairs', sub: 'Back to the main deck' });
  // comfy lounge seats, 2-2
  for (let z = -18.4; z <= -8.9; z += 1.2) for (const x of [-1.95, -1.4]) seat(P, M, x, UY, z, { w: .55, len: .9, cushion: lounge, arms: true, tall: .85 });
  for (let z = -12; z <= -8.9; z += 1.2) for (const x of [1.4, 1.95]) seat(P, M, x, UY, z, { w: .55, len: .9, cushion: lounge, arms: true, tall: .85 });
  up.push(box(-2.3, -1.08, -18.9, -8.4), box(1.08, 2.3, -12.5, -8.4));
  P.add(M.lightStrip, .12, .02, 13, 0, UT - .04, -14.5);
  // the cockpit
  const CZ = -19.6;
  P.add(M.wall, 1.9, UH, .1, -1.5, UY + UH / 2, CZ); P.add(M.wall, 1.9, UH, .1, 1.5, UY + UH / 2, CZ); P.add(M.wall, 1.1, .4, .1, 0, UT - .2, CZ);
  up.push(box(ul, -.55, CZ - .05, CZ + .05), box(.55, ur, CZ - .05, CZ + .05));
  for (const x of [-.6, .6]) { seat(P, M, x, UY, -20.6, { w: .62, len: .7, cushion: M.dark, arms: true, tall: .85 }); P.add(M.dark, .3, .06, .06, x, UY + .95, -21.15); P.add(M.metal, .05, .4, .05, x, UY + .75, -21.15); }
  up.push(box(-.98, -.22, -21, -20.2), box(.22, .98, -21, -20.2));
  P.add(M.dark, 3.8, 1.0, .7, 0, UY + .5, -21.6); P.add(M.dark, 1.2, .5, .4, 0, UY + .8, -21.1);
  [-1.5, -.9, -.3, .3, .9, 1.5].forEach((x, k) => P.add(k % 2 ? M.screen2 : M.screen, .42, .3, .02, x, UY + 1.12, -21.24));
  if (lights) P.add(M.sky, 3.8, .6, .04, 0, UY + 1.65, Z0 + .07); // windshield (while flying it's a real opening — you see outside)
  up.push(box(ul, ur, Z0, -21.2));
  acts.push({ type: 'fly', pos: [0, UY, -20.0], r: 1.4, label: '👨‍✈️ Sit in the captain’s seat', sub: 'Take off and fly the 747!' });
  acts.push({ type: 'sit', pos: [-1.0, UY, -15], r: 1.0, label: '🛋️ Sit in the lounge', sub: 'So comfy up here', say: '🛋️ Ahh, comfy! When you fly, tap 🛋️ Relax in the back to sit here in the sky.' });
  acts.push({ type: 'sit', pos: [-1.46, 0, 8], r: 1.0, label: '💺 Find your seat', sub: 'Economy · seat 32A', say: '💺 Seat 32A — window seat! Buckle up.' });
  acts.push({ type: 'sit', pos: [-.6, 0, -2.5], r: 1.4, label: '🥤 Get a snack', sub: 'The galley', say: '🥤 Pretzels and apple juice — yum!' });

  P.build(g);
  if (lights) {
    for (const z of [-18, -9, 0, 9, 18]) { const l = new THREE.PointLight(0xfff1d6, 5, 14, 1.6); l.position.set(0, H - .3, z); g.add(l); }
    for (const z of [-17, -11]) { const l = new THREE.PointLight(0xfff1d6, 4, 10, 1.6); l.position.set(0, UT - .3, z); g.add(l); }
    const ck = new THREE.PointLight(0x9fd2ff, 2.5, 5, 1.6); ck.position.set(0, UY + 1.5, -21); g.add(ck);
  }
  return {
    title: '747 Jumbo Jet', camDist: 3.2,
    decks: [{ y: 0, top: H, cols: main.concat(mainWalls), walls: mainWalls }, { y: UY, top: UT, cols: up.concat(upWalls), walls: upWalls }],
    acts, start: { x: -2.2, y: 0, z: doorZ + .6, yaw: Math.PI }
  };
}

/* ================= the smaller planes ================= */
const SMALL = {
  sky: { W: 3.2, L: 6.4, H: 2.4, title: 'Sky Plane', seat: 0xc0392b, carpet: '#4a4a52' },
  sea: { W: 3.2, L: 7.6, H: 2.4, title: 'Seaplane', seat: 0x1f6fd1, carpet: '#3a5a6a' },
  jet: { W: 3.6, L: 11, H: 2.4, title: 'Jet', seat: 0xe8d5b0, carpet: '#2a2f3a' },
  heli: { W: 3.6, L: 6.0, H: 2.4, title: 'Helicopter', seat: 0x3a3d44, carpet: '#333338' }
};
export function buildSmall(g, kind, { lights = true } = {}) {
  const c = SMALL[kind] || SMALL.sky, { W, L, H } = c, P = parts(), M = mats(), cols = [], walls = [], acts = [];
  const cush = std(c.seat, .6), front = -L / 2, back = L / 2, side = kind === 'heli';
  P.add(mat('carpet', [c.carpet, 12], W, L, { roughness: 1 }), W, .1, L, 0, -.05, 0);
  P.add(M.ceil, W, .06, L, 0, H, 0);
  [-1, 1].forEach(s => { P.add(M.wall, .1, H, L, s * W / 2, H / 2, 0); walls.push(s < 0 ? box(-W / 2 - 1, -W / 2, front, back) : box(W / 2, W / 2 + 1, front, back)); });
  P.add(M.wall, W, H, .1, 0, H / 2, front); P.add(M.wall, W, H, .1, 0, H / 2, back);
  walls.push(box(-W / 2, W / 2, front - 1, front), box(-W / 2, W / 2, back, back + 1));
  windowsAlong(P, M, -W / 2 + .07, 1.25, front + 2, back - .8, .9, z => side && Math.abs(z - .3) < .8); windowsAlong(P, M, W / 2 - .07, 1.25, front + 2, back - .8, .9);
  // cockpit: two pilot seats, the panel, the windshield
  const pz = front + 1.15;
  for (const x of [-.6, .6]) { seat(P, M, x, 0, pz, { w: .6, len: .65, cushion: M.dark, arms: true, tall: .8 }); P.add(M.dark, .28, .06, .06, x, .92, pz - .6); P.add(M.metal, .05, .35, .05, x, .74, pz - .6); }
  cols.push(box(-.95, -.25, pz - .4, pz + .4), box(.25, .95, pz - .4, pz + .4));
  P.add(M.dark, W - .3, .85, .5, 0, .42, front + .3);
  [-.8, -.27, .27, .8].forEach((x, k) => P.add(k % 2 ? M.screen2 : M.screen, .4, .28, .02, x, .98, front + .54));
  P.add(M.sky, W - .4, .6, .04, 0, 1.45, front + .07);
  cols.push(box(-W / 2, W / 2, front, front + .6));
  acts.push({ type: 'fly', pos: [0, 0, pz + .9], r: 1.3, label: '👨‍✈️ Sit in the pilot seat', sub: 'Take off and fly your ' + c.title + '!' });
  // the passenger part
  if (kind === 'sky') { for (const x of [-.8, .8]) seat(P, M, x, 0, .6, { w: .55, len: .6, cushion: cush, arms: true }); cols.push(box(-1.1, -.5, .25, .95), box(.5, 1.1, .25, .95)); }
  if (kind === 'sea') {
    for (const z of [-.1, 1.1]) for (const x of [-.8, .8]) seat(P, M, x, 0, z, { w: .55, len: .6, cushion: cush, arms: true });
    cols.push(box(-1.1, -.5, -.45, 1.45), box(.5, 1.1, -.45, 1.45));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.32, .09, 10, 24), std(0xff5a2a, .6)); ring.position.set(W / 2 - .12, 1.3, 2.6); ring.rotation.y = Math.PI / 2; g.add(ring);
  }
  if (kind === 'jet') { // a fancy private jet: club seats facing each other, tables, a sofa
    for (const x of [-.95, .95]) { seat(P, M, x, 0, -1.4, { w: .65, len: .7, cushion: cush, arms: true, flip: true, tall: .85 }); seat(P, M, x, 0, .3, { w: .65, len: .7, cushion: cush, arms: true, tall: .85 }); P.add(M.wood, .7, .05, .5, x, .7, -.55); P.add(M.metal, .06, .7, .06, x, .35, -.55); }
    cols.push(box(-1.35, -.55, -1.8, .7), box(.55, 1.35, -1.8, .7));
    P.add(cush, .6, .45, 2.0, W / 2 - .35, .25, 2.6); P.add(cush, .18, .6, 2.0, W / 2 - .1, .75, 2.6); cols.push(box(W / 2 - .7, W / 2, 1.6, 3.6));
    P.add(M.wood, .5, 1.0, 1.4, -W / 2 + .3, .5, 2.6); P.add(M.screen, .02, .45, .75, -W / 2 + .56, 1.35, 2.6); cols.push(box(-W / 2, -W / 2 + .6, 1.9, 3.3));
    P.add(M.gold, .04, .04, L - 1.5, -W / 2 + .1, 1.62, .5); P.add(M.gold, .04, .04, L - 1.5, W / 2 - .1, 1.62, .5);
    acts.push({ type: 'sit', pos: [0, 0, -.55], r: 1.0, label: '🥂 Sit at the table', sub: 'Fancy!', say: '🥂 Very fancy. Next stop: anywhere!' });
  }
  if (kind === 'heli') { P.add(cush, W - .4, .45, .6, 0, .25, 1.6); P.add(cush, W - .4, .7, .15, 0, .8, 1.95); cols.push(box(-W / 2, W / 2, 1.25, 2.1)); }
  // the door out
  if (side) { P.add(M.metal, .1, 1.8, 1.0, -W / 2 + .06, .9, .3); P.add(M.exit, .05, .14, .4, -W / 2 + .1, 1.9, .3); acts.push({ type: 'exit', pos: [-W / 2 + .7, 0, .3], r: 1.3, label: '🚪 Hop out', sub: 'Back outside' }); }
  else { P.add(M.metal, 1.0, 1.8, .1, 0, .9, back - .06); P.add(M.exit, .4, .14, .05, 0, 1.9, back - .1); acts.push({ type: 'exit', pos: [0, 0, back - .7], r: 1.3, label: '🚪 Get off the plane', sub: 'Back outside' }); }
  P.add(M.lightStrip, .12, .02, L - 1, 0, H - .04, 0);
  P.build(g);
  if (lights) { const l = new THREE.PointLight(0xfff1d6, 4, 10, 1.6); l.position.set(0, H - .3, .5); g.add(l); const ck = new THREE.PointLight(0x9fd2ff, 2, 4, 1.6); ck.position.set(0, 1.4, front + .8); g.add(ck); }
  return {
    title: c.title, camDist: 2.6,
    decks: [{ y: 0, top: H, cols: cols.concat(walls), walls }],
    acts, start: side ? { x: -W / 2 + 1, y: 0, z: .6, yaw: Math.PI } : { x: 0, y: 0, z: back - .9, yaw: Math.PI }
  };
}
export const buildCabin = (g, kind, o) => kind === 'jumbo' ? build747(g, o) : buildSmall(g, kind, o);

/** where you stand outside each plane, by its door (plane's own coords, plane faces +z) */
export const DOOR_OUT = { jumbo: [5.2, 9], sky: [1.6, -1.8], sea: [2.2, -2.0], jet: [1.5, 2.5], heli: [1.9, .3] };
