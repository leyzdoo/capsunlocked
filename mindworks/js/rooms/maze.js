// Mazes — an indoor hedge maze. Walk your character from the door to the gold star.
import * as THREE from 'three';
import { G, save, toast, levelComplete } from '../game.js';
import { MazeGen, rng } from '../logic.js';
import { mat } from '../tex.js';
import { env, std } from './common.js';

const CELL = 3, WALL_T = .5, WALL_H = 2.3;

export async function enter({ level, player }) {
  const r = rng(level * 7919 + (Date.now() % 100000));
  const base = Math.min(4 + level, 26);
  const cols = base, rows = Math.max(4, Math.round(base * .75));
  const g = MazeGen.gen(cols, rows, r);
  if (level > 8) { const extra = Math.floor(cols * rows * Math.min(.06, (level - 8) * .004)); for (let i = 0; i < extra; i++) { const c = Math.floor(r() * cols * rows); if (c % cols < cols - 1 && (g[c] & 2)) { g[c] &= ~2; g[c + 1] &= ~8; } } }
  const W = cols * CELL, D = rows * CELL, ox = -W / 2, oz = -D / 2;
  const cellCenter = c => new THREE.Vector3(ox + (c % cols) * CELL + CELL / 2, 0, oz + Math.floor(c / cols) * CELL + CELL / 2);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd8ee); scene.environment = env();
  scene.fog = new THREE.Fog(0xbfd8ee, 40, 140);
  scene.add(new THREE.HemisphereLight(0xf2f7ff, 0x4a5a3a, .9));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.far = 90; sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
  scene.add(sun); scene.add(sun.target);
  // floor: grass paths inside a stone hall
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 12, D + 12), mat('grass', [], (W + 12) / 6, (D + 12) / 6, { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const stone = mat('concrete', ['#cfc6b6', 128, 93], 4, 2, { roughness: .9 });
  const hallH = 9;
  [[W + 12, hallH, .5, 0, hallH / 2, -D / 2 - 6], [W + 12, hallH, .5, 0, hallH / 2, D / 2 + 6], [.5, hallH, D + 12, -W / 2 - 6, hallH / 2, 0], [.5, hallH, D + 12, W / 2 + 6, hallH / 2, 0]]
    .forEach(a => { const m = new THREE.Mesh(new THREE.BoxGeometry(a[0], a[1], a[2]), stone); m.position.set(a[3], a[4], a[5]); m.receiveShadow = true; scene.add(m); });
  // hedge walls (instanced)
  const segs = [];
  for (let c = 0; c < cols * rows; c++) {
    const x = ox + (c % cols) * CELL, z = oz + Math.floor(c / cols) * CELL, w = g[c];
    if (w & 1) segs.push([x + CELL / 2, z, CELL + WALL_T, WALL_T]);
    if (w & 8) segs.push([x, z + CELL / 2, WALL_T, CELL + WALL_T]);
    if ((w & 2) && c % cols === cols - 1) segs.push([x + CELL, z + CELL / 2, WALL_T, CELL + WALL_T]);
    if ((w & 4) && Math.floor(c / cols) === rows - 1) segs.push([x + CELL / 2, z + CELL, CELL + WALL_T, WALL_T]);
  }
  const hedgeM = mat('hedge', [], 1, 1, { roughness: .95, bump: 3 });
  const geo = new THREE.BoxGeometry(1, 1, 1), inst = new THREE.InstancedMesh(geo, hedgeM, segs.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  segs.forEach((s, i) => { m4.compose(p3.set(s[0], WALL_H / 2, s[1]), q, s3.set(s[2], WALL_H * (.94 + ((i * 37) % 10) / 100), s[3])); inst.setMatrixAt(i, m4); });
  inst.castShadow = true; inst.receiveShadow = true; scene.add(inst);
  const colliders = segs.map(s => ({ x1: s[0] - s[2] / 2, x2: s[0] + s[2] / 2, z1: s[1] - s[3] / 2, z2: s[1] + s[3] / 2 }));
  colliders.push({ x1: ox - 4, x2: W / 2 + 4, z1: oz - 4, z2: oz - .2 }); // keep you inside the maze
  // the entrance: a doorway in the first cell's north wall is the way you came in; the goal glows
  const goalC = cols * rows - 1, gp = cellCenter(goalC);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: .55 })); pad.rotation.x = -Math.PI / 2; pad.position.set(gp.x, .03, gp.z); scene.add(pad);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(.45, 0), new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffb300, emissiveIntensity: 1.2, metalness: .6, roughness: .2 }));
  star.position.set(gp.x, 1.5, gp.z); scene.add(star);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.6, .9, 14, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide })); beam.position.set(gp.x, 7, gp.z); scene.add(beam);
  const gl = new THREE.PointLight(0xffd34d, 6, 9, 1.6); gl.position.set(gp.x, 2, gp.z); scene.add(gl);
  // start mat
  const sp = cellCenter(0);
  const startMat = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), std(0x2fd3a7, .8)); startMat.rotation.x = -Math.PI / 2; startMat.position.set(sp.x, .02, sp.z); scene.add(startMat);
  // breadcrumbs (where you've been) + peek dots
  const crumbG = new THREE.CircleGeometry(.18, 12), crumbM = new THREE.MeshBasicMaterial({ color: 0x2fd3a7, transparent: true, opacity: .6 }), peekM = new THREE.MeshBasicMaterial({ color: 0xffd34d });
  const visited = new Set([0]), peeks = [];
  function crumb(c, m) { const p = cellCenter(c), d = new THREE.Mesh(crumbG, m); d.rotation.x = -Math.PI / 2; d.position.set(p.x, .025, p.z); scene.add(d); return d; }
  const cellOf = p => { const cx = Math.floor((p.x - ox) / CELL), cz = Math.floor((p.z - oz) / CELL); return cx < 0 || cz < 0 || cx >= cols || cz >= rows ? -1 : cz * cols + cx; };
  let done = false, t = 0;
  function peek() {
    const u = G.S.data.up;
    if (u.mazeHints <= 0) { toast('Get Path peeks at the Game Store.'); return; }
    u.mazeHints--; save(); document.getElementById('peekBtn').textContent = '💡 Peek (' + u.mazeHints + ')';
    peeks.forEach(p => scene.remove(p)); peeks.length = 0;
    const from = cellOf(player.root.position);
    MazeGen.solve(g, cols, rows, from < 0 ? 0 : from, goalC).slice(0, Math.max(6, Math.round((cols + rows) / 2))).forEach(c => peeks.push(crumb(c, peekM)));
  }
  return {
    _dbg: () => ({ goal: gp, cols, rows }),
    scene, walks: true, colliders, title: 'Mazes · Level ' + level,
    cam: { dist: 11, pitch: 1.12, lockPitch: true },
    help: 'Walk to the glowing gold star!',
    start: new THREE.Vector3(sp.x, 0, sp.z), startYaw: Math.PI / 2 + .4, camYaw: -.6,
    buttons: [{ label: '💡 Peek (' + G.S.data.up.mazeHints + ')', fn: peek, id: 'peekBtn' }],
    interact: () => [],
    update(dt) {
      t += dt; star.rotation.y = t * 1.6; star.position.y = 1.5 + Math.sin(t * 2.5) * .15;
      const p = player.root.position;
      sun.position.set(p.x - 12, 26, p.z + 10); sun.target.position.copy(p);
      const c = cellOf(p); if (c >= 0 && !visited.has(c)) { visited.add(c); crumb(c, crumbM); peeks.forEach(pk => { if (Math.hypot(pk.position.x - p.x, pk.position.z - p.z) < 1) pk.visible = false; }); }
      if (!done && Math.hypot(p.x - gp.x, p.z - gp.z) < 1.1) { done = true; setTimeout(() => levelComplete('maze', level, 'You found the star!'), 300); }
    },
    exit() { inst.dispose(); }
  };
}
