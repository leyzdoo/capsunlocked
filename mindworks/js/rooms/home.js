// Your house — the inside grows with every upgrade from the Game Store.
import * as THREE from 'three';
import { G, GAMES, MASTER, roundRect } from '../game.js';
import { HOUSE_TIERS } from '../town.js';
import { makeRoom, sofa, table, rug, plant, lamp, shelf, painting, chandelier, staircase, box, std } from './common.js';
import { mat } from '../tex.js';
import { Scenes, rng } from '../logic.js';

const SIZES = [[10, 8, 3.2], [13, 9, 3.2], [15, 11, 3.4], [17, 12, 3.6], [20, 14, 4.2], [24, 16, 5.4], [28, 18, 6.4]];
const WALLS = ['#efe4d0', '#e6ece8', '#f1e9dc', '#e9e1d4', '#f4ead7', '#f3efe8', '#f7f3ea'];

function progressCanvas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 576; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 576); g.addColorStop(0, '#1b1846'); g.addColorStop(1, '#2a2763'); x.fillStyle = g; x.fillRect(0, 0, 1024, 576);
  x.fillStyle = '#fff'; x.font = '600 56px Fredoka, Arial'; x.textAlign = 'left'; x.fillText(G.S.name + '’s progress', 50, 86);
  GAMES.forEach((gm, i) => {
    const y = 140 + i * 74, lv = G.S.data.levels[gm.id];
    x.fillStyle = '#d9d4ff'; x.font = '700 32px Nunito, Arial'; x.fillText(gm.name, 50, y + 30);
    x.fillStyle = 'rgba(255,255,255,.12)'; roundRect(x, 340, y + 6, 520, 30, 15); x.fill();
    x.fillStyle = gm.color; roundRect(x, 340, y + 6, Math.max(30, 520 * Math.min(1, lv / MASTER)), 30, 15); x.fill();
    x.fillStyle = '#fff'; x.font = '600 30px Fredoka, Arial'; x.fillText(Math.min(lv, MASTER) + '/25', 880, y + 32);
  });
  return c;
}
function trophyCanvas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 384; const x = c.getContext('2d');
  x.fillStyle = '#3a2416'; x.fillRect(0, 0, 1024, 384);
  GAMES.forEach((gm, i) => {
    const cx = 110 + i * 200, lv = G.S.data.levels[gm.id], got = lv >= MASTER;
    x.fillStyle = got ? '#e6c35a' : '#6b5a4a'; x.beginPath(); x.moveTo(cx - 55, 70); x.lineTo(cx + 55, 70); x.quadraticCurveTo(cx + 50, 190, cx, 205); x.quadraticCurveTo(cx - 50, 190, cx - 55, 70); x.fill();
    x.fillRect(cx - 12, 200, 24, 50); x.fillRect(cx - 45, 250, 90, 22);
    x.fillStyle = '#f6eadb'; x.font = '700 26px Nunito, Arial'; x.textAlign = 'center'; x.fillText(gm.name, cx, 320);
    x.fillStyle = got ? '#ffd34d' : '#bfae9a'; x.font = '600 28px Fredoka, Arial'; x.fillText(got ? '★ 25' : lv + '/25', cx, 355);
  });
  return c;
}

export async function enter({ player }) {
  const tier = G.S.data.up.house || 0, T = HOUSE_TIERS[tier];
  const [w, d, h] = SIZES[tier];
  const fancy = tier >= 4;
  const R = makeRoom({ w, d, h, wall: WALLS[tier], floor: tier >= 5 ? ['tiles', ['#f2efe9', '#dcd6cc', 6, 81]] : tier === 4 ? ['tiles', ['#c98a5e', '#b5764c', 8, 82]] : ['wood', [tier < 2 ? '#a0703f' : '#8a5a35', 6, 83]], floorTile: tier >= 4 ? 3.2 : 2.4, lamps: 2 + tier, doorColor: fancy ? 0x3b2416 : 0x8b2b2b });
  const S = R.scene, cols = R.colliders.slice();
  const add = (o, x, z, ry = 0, colW = 0, colD = 0) => { o.position.set(x, o.position.y, z); o.rotation.y = ry; S.add(o); if (colW) cols.push({ x1: x - colW / 2, x2: x + colW / 2, z1: z - colD / 2, z2: z + colD / 2 }); return o; };
  const backZ = -d / 2;
  // living area: TV wall at the back, sofa facing it
  const tvW = 2.2 + tier * .25, tvH = tvW * .5625;
  const tvc = progressCanvas(), tvt = new THREE.CanvasTexture(tvc); tvt.colorSpace = THREE.SRGBColorSpace;
  const tv = new THREE.Group(); tv.add(box(tvW + .08, tvH + .08, .06, std(0x111111, .3, .5), 0, 0, 0));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(tvW, tvH), new THREE.MeshBasicMaterial({ map: tvt, toneMapped: false })); scr.position.z = .035; tv.add(scr);
  tv.position.set(0, 1.25 + tvH / 2, backZ + .08); S.add(tv);
  add(table(2.2, .45, .5, '#3a2a20'), 0, backZ + .4, 0, 2.2, .5);
  add(rug(4 + tier * .4, 3 + tier * .3, ['#7a3b3b', '#3b5a7a', '#6b5a3a', '#4a3b6b', '#8a5a3a', '#2f3a5a', '#5a1f2a'][tier]), 0, backZ + 3.2);
  add(sofa(fancy ? 0x2f3a5a : 0x56606e, 2.4 + tier * .15), 0, backZ + 4.8, Math.PI, 2.6 + tier * .15, 1);
  add(table(1.3, .7, .42), 0, backZ + 3.2, 0, 1.3, .7);
  add(plant(1.1), -w / 2 + .6, backZ + 1.6, 0, .5, .5);
  add(lamp(), w / 2 - .7, backZ + .7, 0, .4, .4);
  // trophy wall on the left
  const tro = painting(3.4, 1.275, trophyCanvas()); tro.position.y = 2; tro.rotation.y = Math.PI / 2; tro.position.x = -w / 2 + .06; tro.position.z = backZ + 3; S.add(tro);
  add(shelf(2, 2.2), -w / 2 + 1.5, backZ + .3, 0, 2.1, .5);
  // more rooms worth of things as the house grows
  if (tier >= 1) { // dining
    const dz = tier >= 3 ? 0 : d / 2 - 2.6, dx = w / 2 - 3;
    add(table(2, 1.1, .76, '#5a3c26'), dx, dz, 0, 2.1, 1.2);
    [-1, 1].forEach(s => [-.55, .55].forEach(o => { const ch = new THREE.Group(); ch.add(box(.45, .05, .45, std(0x5a3c26, .5), 0, .45, 0)); ch.add(box(.45, .6, .05, std(0x5a3c26, .5), 0, .75, -.2)); [-1, 1].forEach(a => [-1, 1].forEach(b => ch.add(box(.04, .45, .04, std(0x3a2416), a * .19, .22, b * .19)))); add(ch, dx + o, dz + s * .85, s > 0 ? Math.PI : 0); }));
  }
  if (tier >= 2) { // kitchen along the right wall
    const kx = w / 2 - .35, kz0 = backZ + 1.2;
    const counter = box(.7, .92, 4, mat('wood', ['#e8e2d6', 2, 84], 1, 2), kx, .46, kz0 + 2); S.add(counter);
    S.add(box(.75, .05, 4.05, std(0x2b2b2b, .2, .3), kx, .94, kz0 + 2));
    S.add(box(.75, 1.9, .8, std(0xdcdfe3, .3, .7), kx, .95, kz0 + 4.5));
    cols.push({ x1: kx - .4, x2: w / 2, z1: kz0, z2: kz0 + 4.9 });
  }
  if (tier >= 2) { const st = staircase(fancy ? 2.6 : 1.4, Math.round(h / .22), .22, .3, fancy ? std(0xf2efe9, .3) : std(0x8a5a35, .5)); st.position.set(-w / 2 + (fancy ? 1.6 : 1), 0, d / 2 - 1.5); S.add(st); cols.push({ x1: -w / 2, x2: -w / 2 + (fancy ? 2.9 : 1.8), z1: d / 2 - 1.5 - Math.round(h / .22) * .3 - .2, z2: d / 2 - 1.3 }); }
  if (tier >= 3) { // fireplace
    const fp = new THREE.Group(); fp.add(box(2.2, 1.4, .5, mat('brick', ['#8a4b3a', '#c8bdb0', 85], 1, .6), 0, .7, 0)); fp.add(box(2.5, .12, .65, std(0xece6da, .5), 0, 1.45, 0)); fp.add(box(1.1, .8, .1, std(0x111111, .9), 0, .5, .21));
    const fire = new THREE.Mesh(new THREE.ConeGeometry(.25, .5, 8), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); fire.position.set(0, .4, .15); fp.add(fire);
    const fl = new THREE.PointLight(0xff8a3a, 3, 5, 2); fl.position.set(0, .6, .5); fp.add(fl);
    add(fp, w / 2 - .3, Math.min(3, d / 2 - 2.5), -Math.PI / 2, .7, 2.5); S.userData.fire = fire;
  }
  if (tier >= 4) { add(sofa(0x7a4a3a, 2.2), -2.8, backZ + 3.3, Math.PI / 2, 1, 2.4); const ch = chandelier(1); ch.position.set(0, h - .9, backZ + 3.2); S.add(ch); }
  if (tier >= 5) {
    // grand piano
    const pi = new THREE.Group(), blk = std(0x0d0d0f, .15, .3);
    const shape = new THREE.Shape(); shape.moveTo(-.75, 0); shape.lineTo(.75, 0); shape.lineTo(.75, -1.1); shape.quadraticCurveTo(.6, -2, -.1, -2.1); shape.quadraticCurveTo(-.75, -2.1, -.75, -1.2); shape.closePath();
    const top = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .35, bevelEnabled: false }), blk); top.rotation.x = -Math.PI / 2; top.position.y = .62; top.castShadow = true; pi.add(top);
    pi.add(box(1.5, .1, .25, std(0xf4f1ea, .3), 0, .9, .1)); [[-.6, -.1], [.6, -.1], [0, -1.8]].forEach(([a, b]) => pi.add(box(.08, .62, .08, blk, a, .31, b)));
    add(pi, w / 2 - 3, d / 2 - 3.2, Math.PI, 1.6, 2.3);
    const r = rng(7);
    [-1, 1].forEach(s => { const c = document.createElement('canvas'); c.width = 480; c.height = 320; Scenes.paint(c.getContext('2d'), 480, 320, ['lake', 'mountains', 'castle', 'garden'][Math.floor(r() * 4)], 5 + s, 'sunset'); const p = painting(2.2, 1.46, c); p.position.set(s * w / 4, 2.6, backZ + .05); if (s < 0 || tier < 6) S.add(p); });
    [-1, 1].forEach(s => { const col = new THREE.Mesh(new THREE.CylinderGeometry(.3, .35, h, 20), std(0xf4f1ea, .4)); col.position.set(s * 2.2, h / 2, d / 2 - 3); col.castShadow = true; S.add(col); cols.push({ x1: s * 2.2 - .4, x2: s * 2.2 + .4, z1: d / 2 - 3.4, z2: d / 2 - 2.6 }); });
    const ch2 = chandelier(1.4); ch2.position.set(0, h - 1.1, d / 2 - 5); S.add(ch2);
  }
  if (tier >= 6) {
    // aquarium wall
    const aq = new THREE.Group(); aq.add(box(6, 2.4, .5, std(0xc9a64a, .3, 1), 0, 1.6, 0));
    const water = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2), new THREE.MeshBasicMaterial({ color: 0x1fa6d6 })); water.position.set(0, 1.6, .26); aq.add(water);
    const fish = [];
    for (let i = 0; i < 12; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ color: [0xffb000, 0xff5d73, 0xffffff, 0xffd23f][i % 4] })); f.scale.set(1.8, 1, .6); f.position.set(-2.5 + Math.random() * 5, .8 + Math.random() * 1.6, .28); aq.add(f); fish.push(f); }
    add(aq, w / 4, backZ + .3, 0, 6.2, .6); S.userData.fish = fish;
    const ch3 = chandelier(1.4); ch3.position.set(-w / 4, h - 1.1, 0); S.add(ch3);
    // gold trim around the ceiling
    S.add(box(w, .18, .1, std(0xc9a64a, .3, 1), 0, h - .3, backZ + .06));
  }
  // a welcome mat + the way out
  add(rug(1.4, .8, '#5a4a3a'), 0, d / 2 - .7);
  let t = 0;
  return {
    scene: S, walks: true, colliders: cols, title: G.S.name + '’s ' + T.name, cam: { dist: Math.min(6.5, 4 + tier * .4), pitch: .45 },
    help: tier < 6 ? 'Upgrade your house at the Game Store — next: ' + HOUSE_TIERS[tier + 1].name : 'You own the biggest house in town!',
    start: new THREE.Vector3(0, 0, d / 2 - 3.2), startYaw: Math.PI, camYaw: 0, camBlockers: R.colliders,
    camClamp(p) { p.y = Math.min(p.y, h - .3); },
    interact: () => [{ pos: R.door, r: 1.5, label: 'Go back outside', sub: T.name, fn: () => G.backToTown() }],
    update(dt) {
      t += dt;
      if (S.userData.fire) S.userData.fire.scale.y = 1 + Math.sin(t * 13) * .15;
      if (S.userData.fish) S.userData.fish.forEach((f, i) => { f.position.x = Math.sin(t * .5 + i) * 2.5; f.position.y = 1.6 + Math.sin(t * .7 + i * 2) * .7; });
    },
    exit() {}
  };
}
