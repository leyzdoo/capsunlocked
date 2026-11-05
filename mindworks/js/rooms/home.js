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
  const R = makeRoom({ ceiling: tier < 2, w, d, h, wall: WALLS[tier], floor: tier >= 5 ? ['tiles', ['#f2efe9', '#dcd6cc', 6, 81]] : tier === 4 ? ['tiles', ['#c98a5e', '#b5764c', 8, 82]] : ['wood', [tier < 2 ? '#a0703f' : '#8a5a35', 6, 83]], floorTile: tier >= 4 ? 3.2 : 2.4, lamps: 2 + tier, doorColor: fancy ? 0x3b2416 : 0x8b2b2b });
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
  /* ---- stairs you can climb + a real upstairs (Family House and bigger) ---- */
  let upstairs = null;
  if (tier >= 2) upstairs = buildUpstairs(S, { tier, w, d, h, fancy, cols, add });
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
    [-1, 1].forEach(s => { const col = new THREE.Mesh(new THREE.CylinderGeometry(.3, .35, 2 * h, 20), std(0xf4f1ea, .4)); col.position.set(s * 2.2, h, d / 2 - 3); col.castShadow = true; S.add(col); cols.push({ x1: s * 2.2 - .4, x2: s * 2.2 + .4, z1: d / 2 - 3.4, z2: d / 2 - 2.6 }); });
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
  if (upstairs) S.children.forEach(o => { // lights in the open part hang from the high ceiling
    if (o.position.z <= upstairs.edge + .2) return;
    if (Math.abs(o.position.y - (h - .03)) < .02) o.position.y = 2 * h - .03;
    else if (o.isPointLight && Math.abs(o.position.y - (h - .4)) < .02) o.position.y = 2 * h - .4;
    else if (o.name === 'chandelier' && o.position.y < h) o.position.y = 2 * h - 1.5;
  });
  // a welcome mat + the way out
  add(rug(1.4, .8, '#5a4a3a'), 0, d / 2 - .7);
  let t = 0;
  return {
    scene: S, walks: true, colliders: cols, title: G.S.name + '’s ' + T.name, cam: { dist: Math.min(6.5, 4 + tier * .4), pitch: .45 },
    collidersAt: upstairs ? p => upstairs.collidersAt(p) : null,
    heightAt: upstairs ? p => upstairs.heightAt(p) : null,
    help: tier < 6 ? 'Upgrade your house at the Game Store — next: ' + HOUSE_TIERS[tier + 1].name : 'You own the biggest house in town!',
    start: new THREE.Vector3(0, 0, d / 2 - 3.2), startYaw: Math.PI, camYaw: 0, camBlockers: R.colliders,
    loftEdge: upstairs ? upstairs.edge : null,
    camClamp(p, target) {
      const up = target.y > h * .75;
      const open = upstairs && (upstairs.onStairs(target) || p.z > upstairs.edge + .3);
      p.y = up ? THREE.MathUtils.clamp(p.y, h + .4, 2 * h - .3) : Math.min(p.y, (open ? 2 * h : h) - .3);
    },
    interact: () => [{ pos: R.door, r: 1.5, label: 'Go back outside', sub: T.name, fn: () => G.backToTown() }],
    update(dt) {
      t += dt;
      if (S.userData.fire) S.userData.fire.scale.y = 1 + Math.sin(t * 13) * .15;
      if (S.userData.fish) S.userData.fish.forEach((f, i) => { f.position.x = Math.sin(t * .5 + i) * 2.5; f.position.y = 1.6 + Math.sin(t * .7 + i * 2) * .7; });
    },
    exit() {}
  };
}

/* The second floor: a slab with a stairwell, walls, a bedroom, and railings around the opening. */
function buildUpstairs(S, { tier, w, d, h, fancy, cols, add }) {
  const steps = Math.round(h / .21), rise = h / steps, run = .3, sw = fancy ? 2.6 : 1.5;
  const sx = -w / 2 + sw / 2 + .1, sz = d / 2 - 1.5;               // first step centre
  const zFront = sz + run / 2, zBack = sz - (steps - 1) * run - run / 2;
  const st = staircase(sw, steps, rise, run, fancy ? std(0xf2efe9, .3) : std(0x8a5a35, .5)); st.position.set(sx, 0, sz); S.add(st);
  // stairwell opening in the upstairs floor
  const ox1 = -w / 2, ox2 = -w / 2 + sw + .5, oz1 = zBack, oz2 = d / 2;
  const floorM = fancy ? mat('tiles', ['#f2efe9', '#dcd6cc', 6, 86], 3, 3, { roughness: .4 }) : mat('wood', ['#9a6a40', 6, 87], 3, 3, { roughness: .55 });
  const slabT = .22, slab = (x1, x2, z1, z2) => { if (x2 - x1 < .01 || z2 - z1 < .01) return; const m = box(x2 - x1, slabT, z2 - z1, floorM, (x1 + x2) / 2, h - slabT / 2, (z1 + z2) / 2); m.castShadow = false; m.material = floorM.clone(); m.material.map = floorM.map.clone(); m.material.map.repeat.set((x2 - x1) / 3, (z2 - z1) / 3); m.material.map.needsUpdate = true; S.add(m); };
  slab(-w / 2, w / 2, -d / 2, oz1);   // the loft covers the back part only — the front is open two storeys
  const edgeX1 = sx + sw / 2 + .02;
  S.add(box(w / 2 - edgeX1, .42, .2, std(fancy ? 0xf4f1ea : 0x8a5a35, .5), (edgeX1 + w / 2) / 2, h - .21, oz1 + .02)); // the overhang's edge beam
  // underside (ceiling of the ground floor) looks like plaster
  const under = std(0xf4f1ea, .95); under.emissive.setHex(0x8a8780);   // lit softly so the overhang isn't a dark band
  [[-w / 2, w / 2, -d / 2, oz1]].forEach(([x1, x2, z1, z2]) => { const c = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), under); c.rotation.x = Math.PI / 2; c.position.set((x1 + x2) / 2, h - slabT - .001, (z1 + z2) / 2); S.add(c); });
  // upstairs walls + ceiling
  const wallM = mat('plaster', [['#e7eef5', '#e9e4f2', '#f2ece0', '#f4ead7', '#f3efe8'][Math.min(4, tier - 2)], 9], w / 3, h / 3, { roughness: .92 });
  [[w, h, .3, 0, h * 1.5, -d / 2 - .15], [w, h, .3, 0, h * 1.5, d / 2 + .15], [.3, h, d, -w / 2 - .15, h * 1.5, 0], [.3, h, d, w / 2 + .15, h * 1.5, 0]]
    .forEach(a => { const m = box(a[0], a[1], a[2], wallM, a[3], a[4], a[5]); m.castShadow = false; S.add(m); });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(0xf4f1ea, .95)); ceil.rotation.x = Math.PI / 2; ceil.position.y = 2 * h; S.add(ceil);
  // lights upstairs
  [[-w / 4, -d / 4], [w / 4, -d / 4], [w / 4, d / 4]].forEach(([x, z]) => {
    const pnl = new THREE.Mesh(new THREE.BoxGeometry(1, .05, 1), new THREE.MeshBasicMaterial({ color: 0xfffaf0 })); pnl.position.set(x, 2 * h - .03, z); S.add(pnl);
    const pl = new THREE.PointLight(0xfff1dc, 5, Math.max(w, d) * .8, 1.6); pl.position.set(x, 2 * h - .4, z); S.add(pl);
  });
  // windows upstairs (daylight glow)
  const trim = std(0xf6f2ea, .6);
  [-1, 1].forEach(s => { for (let i = 0; i < Math.floor(d / 5); i++) { const z = -d / 2 + 2.5 + i * 5; if (s < 0 && z > oz1 - 1) continue;
    const gw = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), new THREE.MeshBasicMaterial({ color: 0xcfe6ff })); gw.position.set(s * (w / 2 - .02), h + 1.7, z); gw.rotation.y = -s * Math.PI / 2; S.add(gw);
    S.add(box(.08, 1.8, 1.6, trim, s * (w / 2 - .01), h + 1.7, z)); S.add(box(.06, 1.6, .05, trim, s * (w / 2 - .06), h + 1.7, z)); } });
  // railing along the front edge of the loft (you look down into the living room from here)
  const rail = std(fancy ? 0xf4f1ea : 0x5a3c26, .5), Y = h, upCols = [], groundCols = [], stairCols = [];
  S.add(box(w / 2 - edgeX1, .08, .1, rail, (edgeX1 + w / 2) / 2, Y + 1.02, oz1 - .05));
  S.add(box(w / 2 - edgeX1, .05, .05, rail, (edgeX1 + w / 2) / 2, Y + .12, oz1 - .05));
  for (let x = edgeX1 + .1; x < w / 2; x += .16) S.add(box(.04, .9, .04, rail, x, Y + .55, oz1 - .05));
  [edgeX1 + .07, w / 2 - .1].forEach(x => S.add(box(.14, 1.15, .14, rail, x, Y + .58, oz1 - .05)));
  upCols.push({ x1: edgeX1 - .05, x2: w / 2, z1: oz1 - .15, z2: d / 2 });                 // the edge: only the stairs lead down
  // ground floor: the stair's side and back are solid; you go up from the front
  groundCols.push({ x1: sx + sw / 2, x2: sx + sw / 2 + .12, z1: zBack, z2: zFront - .2 });
  groundCols.push({ x1: -w / 2, x2: sx + sw / 2 + .12, z1: zBack - .12, z2: zBack + .4 });
  // on the stairs: rails on the open side
  stairCols.push({ x1: sx + sw / 2 - .02, x2: sx + sw / 2 + .3, z1: zBack - 1, z2: zFront - .2 }, { x1: -w / 2 - 1, x2: -w / 2, z1: zBack - 2, z2: d / 2 });
  // ---- the bedroom ----
  const up = [];
  const put = (o, x, z, ry = 0, cw = 0, cd = 0) => { o.position.set(x, h + (o.position.y || 0), z); o.rotation.y = ry; S.add(o); if (cw) { const sw2 = Math.abs(Math.sin(ry)) > .5; const a = sw2 ? cd : cw, b = sw2 ? cw : cd; upCols.push({ x1: x - a / 2, x2: x + a / 2, z1: z - b / 2, z2: z + b / 2 }); } return o; };
  const big = tier >= 5, bedW = big ? 2.2 : 1.6, bedL = big ? 2.4 : 2.1;
  const bed = new THREE.Group(), wood = mat('wood', [big ? '#3a2416' : '#7a5236', 3, 88], 1, 1, { roughness: .5 });
  bed.add(box(bedW + .1, .35, bedL + .1, wood, 0, .18, 0));
  bed.add(box(bedW, .25, bedL, std(0xf4f1ea, .9), 0, .48, 0));
  bed.add(box(bedW + .02, .12, bedL * .62, std([0x3b5a7a, 0x6b3b5a, 0x2f6b4a, 0x7a3b3b, 0x2f3a5a][tier - 2], .9), 0, .6, bedL * .18));
  [-1, 1].forEach(k => bed.add(box(bedW * .4, .14, .4, std(0xffffff, .9), k * bedW * .24, .66, -bedL / 2 + .32)));
  bed.add(box(bedW + .2, big ? 1.6 : 1.1, .1, wood, 0, big ? .8 : .55, -bedL / 2 - .05));
  if (big) [-1, 1].forEach(k => [-1, 1].forEach(j => bed.add(box(.1, 2.2, .1, wood, k * (bedW / 2 + .05), 1.1, j * (bedL / 2 + .05)))));
  put(bed, w / 2 - bedW / 2 - 1.4, -d / 2 + bedL / 2 + .15, 0, bedW + .2, bedL + .2);
  const ns = new THREE.Group(); ns.add(box(.5, .55, .45, wood, 0, .28, 0)); put(ns, w / 2 - .5, -d / 2 + .4, 0, .5, .45);
  const nl = lamp(); nl.scale.setScalar(.45); put(nl, w / 2 - .5, -d / 2 + .4); nl.position.y = h + .55;
  // desk + chair
  const desk = table(1.4, .7, .76, '#6b4a30'); put(desk, -w / 2 + sw + 2.2 > w / 2 - 4 ? 0 : -w / 2 + sw + 2.2, -d / 2 + .45, 0, 1.45, .75);
  const pc = box(.7, .45, .05, std(0x111111, .3, .5), 0, .76 + .3, 0); const pcg = new THREE.Group(); pcg.add(pc); put(pcg, desk.position.x, -d / 2 + .35);
  const chair = new THREE.Group(); chair.add(box(.5, .06, .5, std(0x2b4a7a, .6), 0, .48, 0)); chair.add(box(.5, .55, .06, std(0x2b4a7a, .6), 0, .78, .22)); chair.add(box(.06, .48, .06, std(0x222222, .4, .6), 0, .24, 0));
  put(chair, desk.position.x, -d / 2 + 1.25, 0);
  put(rug(3, 2.2, ['#3b5a7a', '#6b5a3a', '#4a3b6b', '#8a5a3a', '#2f3a5a'][tier - 2]), w / 2 - bedW / 2 - 1.4, -d / 2 + bedL + 1.2);
  // wardrobe on the right wall
  const ward = new THREE.Group(); ward.add(box(.6, 2.1, 1.6, wood, 0, 1.05, 0)); ward.add(box(.02, 1.9, .02, std(0x222222), .31, 1.05, 0));
  put(ward, w / 2 - .32, Math.min(oz1 - 1.0, -d / 2 + bedL + 2.2), 0, .65, 1.6);
  put(plant(1), -w / 2 + .5, -d / 2 + .5, 0, .5, .5);
  // a sofa at the railing for the bigger houses — sit and look down into the living room
  if (tier >= 3) put(sofa(0x4a6b8a, 2), 0, oz1 - 1.1, 0, 2.2, 1);
  // a big chandelier hanging in the open, two-storey space
  const bigCh = chandelier(1.3); bigCh.position.set(w / 6, 2 * h - 1.5, (oz1 + d / 2) / 2); S.add(bigCh);
  if (tier >= 5) { const ch = chandelier(1.1); ch.position.set(w / 4, 2 * h - .9, -d / 4); S.add(ch); }
  const onStairs = p => p.x > -w / 2 && p.x < sx + sw / 2 + .05 && p.z < zFront + .05 && p.z > zBack - .05;
  const lower = cols, upperWalls = [
    { x1: -w / 2 - 1, x2: w / 2 + 1, z1: -d / 2 - 1, z2: -d / 2 }, { x1: -w / 2 - 1, x2: w / 2 + 1, z1: d / 2, z2: d / 2 + 1 },
    { x1: -w / 2 - 1, x2: -w / 2, z1: -d / 2, z2: d / 2 }, { x1: w / 2, x2: w / 2 + 1, z1: -d / 2, z2: d / 2 }];
  return {
    onStairs, edge: oz1,
    collidersAt(p) {
      if (onStairs(p) && p.y > .05 && p.y < h - .05) return stairCols.concat(upperWalls);
      return p.y > h * .5 ? upperWalls.concat(upCols) : lower.concat(groundCols);
    },
    heightAt(p) {
      if (onStairs(p)) { const t = THREE.MathUtils.clamp((zFront - p.z) / (zFront - zBack), 0, 1); return t * h; }
      return p.y > h * .5 ? h : 0;
    }
  };
}
