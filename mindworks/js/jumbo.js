// Plane 4: the Royal Jumbo — biggest plane in Mindworks. Double-decker, luxury cabin,
// a map you tap to choose where to go, and autopilot so you can relax in the back.
import * as THREE from 'three';
import { CH, WATER_Y, heightAt, biomeOf, blockIcon, blockName } from './world.js';
import { planeMakers } from './vehicles.js';

const std = (c, r = .6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
function bx(g, w, h, d, m, x, y, z, shadow = true) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = shadow; g.add(o); return o; }
function wheelSet(g, x, z, dark) {
  bx(g, .25, 1.6, .25, dark, x, 1.1, z);
  [-.35, .35].forEach(o => { const t = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .35, 16), std(0x111111, .9)); t.rotation.z = Math.PI / 2; t.position.set(x + o, .45, z); g.add(t); });
}

/* seats you can sit in, in the plane's own coordinates (the plane faces +z) */
export const SEATS = [
  { name: 'Upper deck lounge', pos: [1.25, 5.15, -5.6], yaw: -Math.PI / 2 + 1.0 },
  { name: 'Lower deck window seat', pos: [-.45, 2.75, -5.2], yaw: -.45 },
  { name: 'Cockpit', pos: [0, 5.3, 9.9], yaw: 0 }
];

export function makeJumbo() {
  const g = new THREE.Group(), out = new THREE.Group(), cabin = new THREE.Group();
  g.add(out); g.add(cabin); cabin.visible = false; g.userData.outside = out; g.userData.cabin = cabin;
  const white = std(0xf7f7fa, .3, .2), navy = std(0x14204a, .4, .3), gold = std(0xd8b04a, .25, .9), dark = std(0x1e1e1e, .6), glass = std(0x0f1a2a, .05, .8);
  // body: tall oval tube, two decks of windows
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 20, 28), white); body.rotation.x = Math.PI / 2; body.scale.set(1, 1, 1.32); body.position.set(0, 3.5, 0); body.castShadow = true; out.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.2, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), white); nose.rotation.x = Math.PI / 2; nose.scale.set(1, 1.32 * 1.1, 1.32); nose.position.set(0, 3.5, 10); out.add(nose);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 28), white); tail.rotation.x = -Math.PI / 2; tail.scale.set(1, 1, 1.32); tail.position.set(0, 3.9, -13); out.add(tail);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(2.22, 2.22, 20, 28, 1, true, Math.PI * 1.62, Math.PI * .76), navy); belly.rotation.x = Math.PI / 2; belly.scale.set(1, 1, 1.32); belly.position.set(0, 3.5, 0); out.add(belly);
  [-1, 1].forEach(s => {
    bx(out, .06, .12, 19.6, gold, s * 2.2, 3.1, 0, false); // gold stripe
    for (const y of [2.55, 4.85]) for (let z = -8.8; z <= 8.8; z += 1.1) bx(out, .06, .42, .5, glass, s * 2.19, y, z, false);
  });
  const shield = bx(out, 2.2, .7, .1, glass, 0, 5.1, 11.4, false); shield.rotation.x = -.6;
  // wings, engines, tail
  [-1, 1].forEach(s => {
    const w = new THREE.Shape(); w.moveTo(0, 3); w.lineTo(s * 13, -3.4); w.lineTo(s * 13, -5); w.lineTo(0, -3.2);
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(w, { depth: .3, bevelEnabled: false }), white); wing.rotation.x = Math.PI / 2; wing.position.set(0, 2.2, 0); wing.castShadow = true; out.add(wing);
    bx(out, .2, 1.6, 1.2, gold, s * 13, 2.9, -4.3); // winglets
    [4.5, 9].forEach(x => {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(.75, .65, 3.2, 18), navy); e.rotation.x = Math.PI / 2; e.position.set(s * x, 1.2, 1.4 - x * .5); e.castShadow = true; out.add(e);
      const fan = new THREE.Mesh(new THREE.CircleGeometry(.62, 18), std(0x9aa3b5, .3, .9)); fan.position.set(s * x, 1.2, 3.02 - x * .5); out.add(fan);
    });
    const ts = new THREE.Shape(); ts.moveTo(0, -11); ts.lineTo(s * 5.5, -15.5); ts.lineTo(s * 5.5, -16.5); ts.lineTo(0, -15);
    const tw = new THREE.Mesh(new THREE.ExtrudeGeometry(ts, { depth: .2, bevelEnabled: false }), white); tw.rotation.x = Math.PI / 2; tw.position.set(0, 5.2, 0); out.add(tw);
  });
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(-5.5, 0); fin.lineTo(-7.5, 6.5); fin.lineTo(-5, 6.5);
  const tf = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: .25, bevelEnabled: false }), navy); tf.rotation.y = -Math.PI / 2; tf.position.set(-.12, 5.8, -9.5); tf.castShadow = true; out.add(tf);
  bx(out, .3, .9, .9, gold, 0, 10.6, -16.2, false); // crown on the tail
  wheelSet(out, 0, 8.5, dark); [-1.4, 1.4].forEach(x => { wheelSet(out, x, -1, dark); wheelSet(out, x, -2.6, dark); });
  g.userData.prop = new THREE.Group(); out.add(g.userData.prop);

  // ---------- the cabin you see from the inside ----------
  const wall = std(0xf3ead8, .7), carpet = std(0x4a1f2e, .9), leather = std(0xe8d5b0, .45), wood = std(0x6b3f22, .5), trim = std(0xd8b04a, .3, .9);
  const L = 18, z0 = -9;
  bx(cabin, 3.8, .1, L, carpet, 0, 1.55, 0, false); bx(cabin, 3.8, .2, L, wood, 0, 3.95, 0, false); bx(cabin, 3.8, .1, L, carpet, 0, 4.1, 0, false); bx(cabin, 3.8, .1, L, wall, 0, 6.25, 0, false);
  bx(cabin, 3.8, 4.8, .1, wall, 0, 3.9, z0, false); bx(cabin, 3.8, 4.8, .1, wall, 0, 3.9, -z0, false);
  [-1, 1].forEach(s => {
    // walls with a band of windows on each deck
    for (const [y0, y1, wy] of [[1.6, 3.95, 2.55], [4.15, 6.25, 4.85]]) {
      bx(cabin, .1, wy - .25 - y0, L, wall, s * 1.9, (y0 + wy - .25) / 2, 0, false);
      bx(cabin, .1, y1 - wy - .25, L, wall, s * 1.9, (wy + .25 + y1) / 2, 0, false);
      for (let z = z0; z < -z0; z += 1.1) bx(cabin, .1, .5, .6, wall, s * 1.9, wy, z + .27 + .55, false);
      bx(cabin, .12, .06, L, trim, s * 1.88, wy - .28, 0, false);
    }
    // lower deck: big leather recliners by the windows
    for (let z = -6.5; z <= 7; z += 2.2) {
      const x = s * 1.1;
      bx(cabin, .9, .45, .9, leather, x, 1.85, z, false); bx(cabin, .9, 1, .2, leather, x, 2.45, z - .4, false);
      bx(cabin, .15, .3, .9, wood, x - .52, 2.1, z, false); bx(cabin, .15, .3, .9, wood, x + .52, 2.1, z, false);
    }
  });
  // upper deck lounge: sofas, a little bar, gold lamps
  [-1, 1].forEach(s => { bx(cabin, .8, .5, 4, leather, s * 1.3, 4.4, -3.2, false); bx(cabin, .2, .8, 4, leather, s * 1.75, 4.75, -3.2, false); });
  bx(cabin, 1, .55, .8, wood, 0, 4.42, -3.2, false); bx(cabin, 2.6, 1.1, .5, wood, 0, 4.7, 2.5, false); bx(cabin, 2.7, .08, .6, trim, 0, 5.28, 2.5, false);
  [[-.6, 5.45, 2.5], [.4, 5.45, 2.5]].forEach(([x, y, z]) => { const gl = new THREE.Mesh(new THREE.CylinderGeometry(.07, .05, .25, 10), std(0xbfe7ff, .05, .2)); gl.position.set(x, y, z); cabin.add(gl); });
  for (let z = -7; z <= 7; z += 3.5) { const lamp = new THREE.Mesh(new THREE.SphereGeometry(.15, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c9 })); lamp.position.set(0, 6.1, z); cabin.add(lamp); }
  // cockpit seats
  [-.55, .55].forEach(x => { bx(cabin, .6, .4, .6, std(0x2a2a33, .6), x, 4.35, 10.1, false); bx(cabin, .6, .9, .15, std(0x2a2a33, .6), x, 4.85, 9.75, false); });
  bx(cabin, 2.2, .35, .5, std(0x1a1a22, .5), 0, 4.4, 10.9, false);
  const light = new THREE.PointLight(0xfff1d6, 7, 26, 1.6); light.position.set(0, 5.6, 0); cabin.add(light);
  const light2 = new THREE.PointLight(0xfff1d6, 5, 22, 1.6); light2.position.set(0, 3.4, 2); cabin.add(light2);
  return g;
}

/* ---------- the map: blocks around you, tap one to fly there ---------- */
export function drawMap(canvas, px, pz, R = 4) {
  const N = R * 2 + 1, S = canvas.width / N, ci = Math.round(px / CH), cj = Math.round(pz / CH), c = canvas.getContext('2d');
  const step = 6, img = c.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += step) for (let x = 0; x < canvas.width; x += step) {
    const wx = (ci + R) * CH + CH / 2 - x / S * CH, wz = (cj + R) * CH + CH / 2 - y / S * CH, h = heightAt(wx, wz), b = biomeOf(Math.round(wx / CH), Math.round(wz / CH));
    let col = h < WATER_Y ? [70 - h * 4, 150 - h * 6, 220] : b === 'desert' ? [232, 196, 120] : h > 30 ? [235, 240, 248] : h > 12 ? [128, 128, 120] : (b === 'city' || b === 'suburb' || b === 'town' || b === 'home') ? [170, 176, 160] : [96 + h * 3, 170 - h * 2, 90];
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
