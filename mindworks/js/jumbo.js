// Plane 4: the 747 Jumbo Jet — the biggest plane in Mindworks. The hump on top holds the
// upper deck and the cockpit, four engines, and a real cabin inside (see cabins.js).
// Tap the map to choose where to go, and autopilot so you can relax in the back.
import * as THREE from 'three';
import { CH, WATER_Y, heightAt, biomeOf, blockIcon, blockName } from './world.js';
import { planeMakers } from './vehicles.js';
import { build747 } from './cabins.js';
import { signTexture } from './tex.js';

const std = (c, r = .6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
function bx(g, w, h, d, m, x, y, z, shadow = true) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = shadow; g.add(o); return o; }
function gear(g, x, z, dark, n = 2) {
  bx(g, .28, 1.5, .28, dark, x, 1.05, z);
  for (let k = 0; k < n; k++) [-.32, .32].forEach(o => { const t = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .3, 16), std(0x111111, .9)); t.rotation.z = Math.PI / 2; t.position.set(x + o, .42, z + (n > 1 ? (k - .5) * 1 : 0)); g.add(t); });
}

/* the real cabin (cabins.js) shrunk to fit inside the plane: cabin coords → plane coords */
const CS = .62, CY = 2.6;
const toPlane = (x, y, z) => [-CS * x, CY + CS * y, -CS * z];
/* seats you can sit in while flying, in the plane's own coordinates (the plane faces +z) */
export const SEATS = [
  { name: 'Upper deck lounge', pos: toPlane(-1.4, 3 + 1.5, -8.9), yaw: .08 },
  { name: 'Seat 32A, by the window', pos: toPlane(-2.2, 1.4, 8.3), yaw: .12 },
  { name: 'Cockpit jump seat', pos: toPlane(0, 3 + 1.75, -19.7), yaw: 0, down: .5 }
];

export function makeJumbo() {
  const g = new THREE.Group(), out = new THREE.Group(), cabin = new THREE.Group();
  g.add(out); g.add(cabin); cabin.visible = false; g.userData.outside = out; g.userData.cabin = cabin;
  const white = std(0xf7f7fa, .3, .2), belly = std(0xc9ced8, .35, .3), navy = std(0x14204a, .4, .3), gold = std(0xd8b04a, .25, .9), dark = std(0x1e1e1e, .6), glass = std(0x0f1a2a, .05, .8), metal = std(0xaab1bd, .3, .9);
  const R = 2.5, Y = 3.8;
  // round body
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 28, 32), white); body.rotation.x = Math.PI / 2; body.position.set(0, Y, 0); body.castShadow = true; out.add(body);
  const bl = new THREE.Mesh(new THREE.CylinderGeometry(R + .02, R + .02, 28, 32, 1, true, Math.PI * .62, Math.PI * .76), belly); bl.rotation.x = Math.PI / 2; bl.position.set(0, Y, 0); out.add(bl);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), white); nose.rotation.x = Math.PI / 2; nose.scale.set(1, 1.5, 1); nose.position.set(0, Y, 14); out.add(nose);
  // tail: tapers and sweeps up
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(.45, R, 9, 32), white); tail.rotation.x = -Math.PI / 2 + .09; tail.position.set(0, Y + .45, -18.4); tail.castShadow = true; out.add(tail);
  // THE HUMP — the 747's famous upper deck: it rises well above the body at the front and slopes down into the nose
  const HY = Y + 2.0;
  const hump = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 8, 28), white); hump.rotation.x = Math.PI / 2; hump.position.set(0, HY, 8.8); hump.castShadow = true; out.add(hump);
  const hf = new THREE.Mesh(new THREE.SphereGeometry(1.85, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), white); hf.rotation.x = Math.PI / 2 + .42; hf.scale.set(1, 2.9, 1); hf.position.set(0, HY, 12.75); hf.castShadow = true; out.add(hf);
  const hb = new THREE.Mesh(new THREE.SphereGeometry(1.85, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), white); hb.rotation.x = -Math.PI / 2; hb.scale.set(1, 4.2, 1); hb.position.set(0, HY, 4.85); hb.castShadow = true; out.add(hb);
  // cockpit windows on the sloping front of the hump
  [-1, 1].forEach(s => { const w = bx(out, .85, .4, .1, glass, s * .6, HY + .55, 15.0, false); w.rotation.set(-1.0, s * .5, 0); });
  const wc = bx(out, .7, .4, .1, glass, 0, HY + .68, 15.25, false); wc.rotation.x = -1.05;
  // stripes + windows
  [-1, 1].forEach(s => {
    bx(out, .08, .16, 27.5, navy, s * (R - .02), Y - .55, 0, false); bx(out, .08, .06, 27.5, gold, s * (R - .02), Y - .78, 0, false);
    const wins = new THREE.InstancedMesh(new THREE.BoxGeometry(.08, .36, .26), glass, 60), m4 = new THREE.Matrix4(); let n = 0;
    for (let z = -12.5; z <= 12.6 && n < 46; z += .58) if (Math.abs(z - 8.3) > .6) m4.makeTranslation(s * (R - .03), Y - .2, z), wins.setMatrixAt(n++, m4);
    for (let z = 3.5; z <= 12.4 && n < 60; z += .6) m4.makeTranslation(s * 1.84, HY + .35, z), wins.setMatrixAt(n++, m4);
    wins.count = n; out.add(wins);
  });
  [8.3, -2, -11].forEach(z => bx(out, .06, 1.25, .7, belly, 2.48, Y - .15, z, false)); // doors on the left side
  // wings + four engines
  [-1, 1].forEach(s => {
    const w = new THREE.Shape(); w.moveTo(0, 3); w.lineTo(s * 16, -7); w.lineTo(s * 16, -8.4); w.lineTo(0, -4);
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(w, { depth: .35, bevelEnabled: false }), white); wing.rotation.x = Math.PI / 2; wing.position.set(0, 2.5, 0); wing.castShadow = true; out.add(wing);
    bx(out, .15, 1.4, 1.2, navy, s * 16, 2.9, -7.8);
    [5.8, 10.6].forEach(x => {
      const lead = 3 - .625 * x, z = lead - .4;
      const e = new THREE.Mesh(new THREE.CylinderGeometry(.85, .7, 3.6, 20), white); e.rotation.x = Math.PI / 2; e.position.set(s * x, 1.35, z); e.castShadow = true; out.add(e);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(.8, .1, 8, 20), metal); lip.position.set(s * x, 1.35, z + 1.8); out.add(lip);
      const fan = new THREE.Mesh(new THREE.CircleGeometry(.75, 20), std(0x3a3f4a, .4, .8)); fan.position.set(s * x, 1.35, z + 1.78); out.add(fan);
      bx(out, .25, .8, 2.2, white, s * x, 2.0, z - .4);
    });
    // tailplane
    const ts = new THREE.Shape(); ts.moveTo(0, -13); ts.lineTo(s * 7.5, -18.5); ts.lineTo(s * 7.5, -19.6); ts.lineTo(0, -17.5);
    const tw = new THREE.Mesh(new THREE.ExtrudeGeometry(ts, { depth: .22, bevelEnabled: false }), white); tw.rotation.x = Math.PI / 2; tw.position.set(0, Y + .9, 0); out.add(tw);
  });
  // tall tail fin with "747" on it
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(-6.5, 0); fin.lineTo(-9.5, 7.8); fin.lineTo(-6.8, 7.8);
  const tf = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: .3, bevelEnabled: false }), navy); tf.rotation.y = -Math.PI / 2; tf.position.set(.15, Y + 1.6, -12.2); tf.castShadow = true; out.add(tf);
  const tt = signTexture('747', { bg: null, fg: '#d8b04a', font: '700 170px Fredoka, Arial', w: 512, h: 256 });
  [-1, 1].forEach(s => { const lab = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshBasicMaterial({ map: tt, transparent: true })); lab.position.set(s * .17, Y + 5.2, -17.7); lab.rotation.y = s * Math.PI / 2; out.add(lab); });
  // landing gear
  gear(out, 0, 12, dark, 1); [-1.4, 1.4].forEach(x => { gear(out, x, -1.2, dark); gear(out, x, -3.4, dark); }); [-3.6, 3.6].forEach(x => gear(out, x, -1.6, dark));
  g.userData.prop = new THREE.Group(); out.add(g.userData.prop);

  // ---------- the cabin you see from your seat while flying: the real one, shrunk ----------
  const inner = new THREE.Group(); build747(inner, { lights: false });
  inner.rotation.y = Math.PI; inner.scale.setScalar(CS); inner.position.set(0, CY, 0); cabin.add(inner);
  const l1 = new THREE.PointLight(0xfff1d6, 6, 26, 1.6); l1.position.set(0, CY + 1.4, 0); cabin.add(l1);
  const l2 = new THREE.PointLight(0xfff1d6, 4, 14, 1.6); l2.position.set(0, CY + 3.3, 9); cabin.add(l2);
  return g;
}

/* ---------- the map: blocks around you, tap one to fly there ---------- */
export function drawMap(canvas, px, pz, R = 4) {
  const N = R * 2 + 1, S = canvas.width / N, ci = Math.round(px / CH), cj = Math.round(pz / CH), c = canvas.getContext('2d');
  const step = 6, img = c.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += step) for (let x = 0; x < canvas.width; x += step) {
    const wx = (ci + R) * CH + CH / 2 - x / S * CH, wz = (cj + R) * CH + CH / 2 - y / S * CH, h = heightAt(wx, wz), b = biomeOf(Math.round(wx / CH), Math.round(wz / CH));
    let col = h < WATER_Y ? [70 - h * 4, 150 - h * 6, 220] : b === 'desert' ? [232, 196, 120] : h > 30 ? [235, 240, 248] : h > 12 ? [128, 128, 120] : b === 'airport' ? [150, 150, 158] : (b === 'city' || b === 'suburb' || b === 'town' || b === 'home') ? [170, 176, 160] : [96 + h * 3, 170 - h * 2, 90];
    for (let yy = 0; yy < step; yy++) for (let xx = 0; xx < step; xx++) { const k = ((y + yy) * canvas.width + x + xx) * 4; if (k < img.data.length) { img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255; } }
  }
  c.putImageData(img, 0, 0);
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1;
  for (let k = 0; k <= N; k++) { c.beginPath(); c.moveTo(k * S, 0); c.lineTo(k * S, N * S); c.stroke(); c.beginPath(); c.moveTo(0, k * S); c.lineTo(N * S, k * S); c.stroke(); }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
    const bi = ci + i, bj = cj + j, cx = (R - i + .5) * S, cy = (R - j + .5) * S;
    c.font = Math.round(S * .36) + 'px sans-serif'; c.fillText(bi === 0 && bj === 0 ? '🏠' : blockIcon(bi, bj), cx, cy - S * .1);
    c.font = '700 ' + Math.round(S * .13) + 'px Nunito, sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    const nm = bi === 0 && bj === 0 ? 'Home' : blockName(bi, bj); c.strokeText(nm, cx, cy + S * .3); c.fillText(nm, cx, cy + S * .3);
  }
  return { toWorld: (x, y) => ({ x: (ci + R) * CH + CH / 2 - x / S * CH, z: (cj + R) * CH + CH / 2 - y / S * CH }), toMap: (wx, wz) => ({ x: ((ci + R) * CH + CH / 2 - wx) / CH * S, y: ((cj + R) * CH + CH / 2 - wz) / CH * S }) };
}

planeMakers.jumbo = makeJumbo;
