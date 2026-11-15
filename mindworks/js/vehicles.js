// Cars, boats and the things you can find around the world.
import * as THREE from 'three';
import { G } from './game.js';
import { car } from './town.js';
import { rng } from './tex.js';

export const CARS = {
  sedan: { name: 'Red Car', price: 30, trunk: 25, speed: 13, blurb: 'A zippy little car. Trunk holds 25 things.' },
  jeep: { name: 'Jungle Jeep', price: 40, trunk: 35, speed: 14, blurb: 'Great for hills and deserts. Holds 35.' },
  truck: { name: 'Pickup Truck', price: 50, trunk: 60, speed: 12, blurb: 'A big truck bed — holds 60 things!' },
  race: { name: 'Race Car', price: 80, trunk: 15, speed: 21, blurb: 'The fastest thing on wheels. Small trunk (15).' }
};
export const BOATS = {
  row: { name: 'Rowboat', price: 20, speed: 5.5, blurb: 'Row out on lakes and the sea.' },
  sail: { name: 'Sailboat', price: 35, speed: 9, blurb: 'Sails with the wind — faster than rowing.' },
  speed: { name: 'Speedboat', price: 55, speed: 16, blurb: 'Zoom across the ocean!' }
};
export const PLANES = {
  sky: { name: 'Sky Plane', price: 0, speed: 24, top: 60, blurb: 'Free! Steer with the wheel and push the lever up to fly over the whole world.' },
  sea: { name: 'Seaplane', price: 0, speed: 22, top: 50, water: true, blurb: 'Free! Has floats, so it can land on lakes and the sea. Pull the lever down over water to land, then steer to the shore.' },
  jumbo: { name: '747 Jumbo Jet', price: 0, speed: 30, top: 85, big: true, blurb: 'Free! A real 747 — the hump on top, four engines, and over 300 seats inside. Walk aboard, climb the stairs to the upper deck and the cockpit, then tap the 🗺️ map and turn on autopilot.' },
  heli: { name: 'Helicopter', price: 0, speed: 16, top: 240, heli: true, blurb: 'Free! Goes straight up and down — land on the roof of any skyscraper, hop out and look around, then fly off again.' },
  jet: { name: 'Jet', price: 0, speed: 36, top: 95, blurb: 'Free! The fastest thing in Mindworks. Flies higher too, and needs a longer run to take off.' }
};
export const ITEMS = {
  crate: { name: 'Crate', icon: '📦', value: 2 }, gear: { name: 'Gear', icon: '⚙️', value: 2 }, apple: { name: 'Apple', icon: '🍎', value: 1 },
  wood: { name: 'Wood', icon: '🪵', value: 1 }, gem: { name: 'Gem', icon: '💎', value: 5 }, fossil: { name: 'Fossil', icon: '🦴', value: 4 },
  shell: { name: 'Seashell', icon: '🐚', value: 3 }, gold: { name: 'Gold nugget', icon: '✨', value: 6 }
};
export const BIOME_ITEMS = { home: ['gear', 'apple'], city: ['crate', 'gear'], suburb: ['apple', 'crate'], town: ['apple', 'gear', 'crate'], hills: ['wood', 'apple'], mountains: ['gem', 'wood', 'gem'], desert: ['fossil', 'gold', 'fossil'], lake: ['shell', 'wood'], sea: ['shell', 'shell', 'gem'], airport: ['gear', 'crate'] };
export const BAG = 5;
export const TELEPORTER_PRICE = 5;
export const capacity = () => BAG + (G.S.data.up.car ? CARS[G.S.data.up.car].trunk : 0);
export const bagCount = () => Object.values(G.S.data.bag || {}).reduce((a, b) => a + b, 0);
export const bagValue = () => Object.entries(G.S.data.bag || {}).reduce((a, [k, n]) => a + (ITEMS[k] ? ITEMS[k].value * n : 0), 0);
export const today = () => new Date().toISOString().slice(0, 10);

const std = (c, r = .6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
function bx(g, w, h, d, m, x, y, z) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; }
function wheel(g, x, z, r = .4, w = .3) { const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), std(0x111111, .9)); t.rotation.z = Math.PI / 2; t.position.set(x, r, z); t.castShadow = true; g.add(t); const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * .55, r * .55, w + .02, 10), std(0xb8bcc2, .3, 1)); rim.rotation.z = Math.PI / 2; rim.position.set(x, r, z); g.add(rim); }

/** vehicles face +z */
export function makeCar(kind) {
  const g = new THREE.Group();
  if (kind === 'sedan' || kind === 'race') {
    const c = car(kind === 'race' ? 0xffc300 : 0xc0392b, rng(1)); c.rotation.y = -Math.PI / 2; if (kind === 'race') { c.scale.set(1.05, .78, 1.05); const sp = new THREE.Group(); bx(sp, 1.9, .08, .5, std(0x111111), 0, 1.25, -2.1); bx(sp, .08, .45, .08, std(0x111111), -.7, 1.02, -2.1); bx(sp, .08, .45, .08, std(0x111111), .7, 1.02, -2.1); g.add(sp); }
    g.add(c);
  } else if (kind === 'jeep') {
    const paint = std(0x3f6e3a, .45, .3), dark = std(0x1e1e1e, .6);
    bx(g, 1.9, .8, 3.8, paint, 0, .95, 0); bx(g, 1.85, .5, 1.2, paint, 0, 1.6, -.2);
    const ws = bx(g, 1.8, .7, .06, std(0x22303a, .1, .8), 0, 1.65, .9); ws.rotation.x = -.2;
    [-1, 1].forEach(s => { bx(g, .08, .9, .08, dark, s * .85, 1.8, -1.2); }); bx(g, 1.8, .08, .08, dark, 0, 2.25, -1.2);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .28, 18), dark); sp.rotation.x = Math.PI / 2; sp.position.set(0, 1.1, -2.05); g.add(sp);
    [[.95, 1.25], [-.95, 1.25], [.95, -1.25], [-.95, -1.25]].forEach(([x, z]) => wheel(g, x, z, .48, .38));
    [-.6, .6].forEach(x => bx(g, .3, .2, .05, new THREE.MeshBasicMaterial({ color: 0xfff6dd }), x, 1.05, 1.92));
  } else { // truck
    const paint = std(0x2b5aa8, .35, .5), dark = std(0x1e1e1e, .6);
    bx(g, 2, .7, 5, paint, 0, .85, 0); bx(g, 1.95, .9, 1.8, paint, 0, 1.65, .7);
    const ws = bx(g, 1.85, .7, .06, std(0x22303a, .1, .8), 0, 1.7, 1.62); ws.rotation.x = -.25;
    [-1, 1].forEach(s => bx(g, .1, .5, 2.3, paint, s * .95, 1.45, -1.3)); bx(g, 2, .5, .1, paint, 0, 1.45, -2.45);
    G.truckBed = bx(g, 1.8, .05, 2.3, std(0x333333, .8), 0, 1.22, -1.3);
    [[1, 1.6], [-1, 1.6], [1, -1.6], [-1, -1.6]].forEach(([x, z]) => wheel(g, x, z, .45, .34));
    [-.65, .65].forEach(x => bx(g, .35, .18, .05, new THREE.MeshBasicMaterial({ color: 0xfff6dd }), x, .95, 2.52));
  }
  return g;
}
export function makeBoat(kind) {
  const g = new THREE.Group(), L = kind === 'speed' ? 4.6 : kind === 'sail' ? 4.4 : 3.4, Wd = kind === 'row' ? 1.4 : 1.8;
  const s = new THREE.Shape(); s.moveTo(-Wd / 2, -L / 2); s.lineTo(Wd / 2, -L / 2); s.quadraticCurveTo(Wd / 2 + .05, L * .15, 0, L / 2); s.quadraticCurveTo(-Wd / 2 - .05, L * .15, -Wd / 2, -L / 2);
  const hullM = kind === 'row' ? std(0x8a5a35, .7) : kind === 'sail' ? std(0xf4f1ea, .4) : std(0xd8452f, .3, .2);
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .65, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 2 }), hullM);
  hull.rotation.x = -Math.PI / 2; hull.position.y = -.25; hull.castShadow = true; g.add(hull);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(s), kind === 'row' ? std(0x6a4426, .8) : std(0xc9a26a, .7)); deck.rotation.x = -Math.PI / 2; deck.position.y = .3; deck.scale.setScalar(.9); g.add(deck);
  if (kind === 'row') { bx(g, Wd - .1, .08, .3, std(0x6a4426), 0, .45, -.3); [-1, 1].forEach(k => { const o = bx(g, 2.2, .06, .12, std(0xa0703f), k * 1.2, .55, -.3); o.rotation.z = k * .25; }); }
  if (kind === 'sail') {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 5, 8), std(0x8a6440)); mast.position.set(0, 2.8, .4); g.add(mast);
    const sl = new THREE.Shape(); sl.moveTo(0, 0); sl.lineTo(0, 4.2); sl.lineTo(-2.1, 0); sl.closePath();
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sl), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: .8 })); sail.rotation.y = Math.PI / 2; sail.position.set(0, .7, .35); g.add(sail); g.userData.sail = sail;
  }
  if (kind === 'speed') { const ws = bx(g, 1.4, .5, .06, std(0x22303a, .1, .8), 0, .65, .5); ws.rotation.x = -.5; bx(g, 1.5, .08, 1.2, std(0xf4f1ea, .4), 0, .32, 1.2); bx(g, .5, .5, .5, std(0x222222, .4, .6), 0, .2, -L / 2 - .1); }
  return g;
}
/** one plane, faces +z; propeller is g.userData.prop */
export const planeMakers = {}; // extra planes register here (see jumbo.js)
export function makePlane(kind) {
  if (planeMakers[kind]) return planeMakers[kind]();
  if (kind === 'heli') return makeHeli();
  if (kind === 'jet') return makeJet();
  const sea = kind === 'sea', g = new THREE.Group(), paint = std(sea ? 0xffd23f : 0xf2f4f7, .35, .3), red = std(sea ? 0x1f6fd1 : 0xd8352a, .4, .2), dark = std(0x1e1e1e, .6), glass = std(0x22303a, .1, .8);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.62, .42, 5.6, 16), paint); body.rotation.x = Math.PI / 2; body.position.set(0, 1.5, 0); body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.62, 16, 12), red); nose.scale.z = .8; nose.position.set(0, 1.5, 2.8); g.add(nose);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.42, 1.4, 16), paint); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 1.5, -3.5); g.add(tail);
  const cock = new THREE.Mesh(new THREE.SphereGeometry(.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass); cock.scale.set(.9, .8, 1.6); cock.position.set(0, 2, .6); g.add(cock);
  bx(g, 7.4, .12, 1.4, paint, 0, 1.35, .5); [-1, 1].forEach(s => bx(g, .9, .14, 1.42, red, s * 3.3, 1.36, .5));
  bx(g, 2.6, .1, .8, paint, 0, 1.6, -3.4); bx(g, .1, 1.1, .9, red, 0, 2.15, -3.5);
  const prop = new THREE.Group(); prop.position.set(0, 1.5, 3.35); bx(prop, .14, 2, .06, dark, 0, 0, 0); bx(prop, 2, .14, .06, dark, 0, 0, 0); g.add(prop); g.userData.prop = prop;
  if (sea) { // two floats instead of wheels
    [-1.15, 1.15].forEach(x => {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(.32, 3.6, 6, 12), std(0xf4f1ea, .4)); f.rotation.x = Math.PI / 2; f.position.set(x, .32, .3); f.castShadow = true; g.add(f);
      [1.3, -.6].forEach(z => { const st = bx(g, .08, .95, .08, dark, x * .7, .95, z); st.rotation.z = x > 0 ? .4 : -.4; });
    });
  } else {
    [[.9, 1.3], [-.9, 1.3]].forEach(([x, z]) => { bx(g, .08, .8, .08, dark, x, .75, z); wheel(g, x, z, .32, .22); });
    bx(g, .06, .5, .06, dark, 0, .85, -3.2); wheel(g, 0, -3.2, .18, .14);
  }
  return g;
}
function makeHeli() {
  const g = new THREE.Group(), paint = std(0xe8452f, .35, .3), dark = std(0x1e1e1e, .6), glass = std(0x7fd6ff, .05, .6), metal = std(0xb8bcc2, .3, 1);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 16), paint); body.scale.set(1, .95, 1.5); body.position.set(0, 1.6, .2); body.castShadow = true; g.add(body);
  const win = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2.2), glass); win.rotation.x = Math.PI / 2.4; win.scale.set(1, 1, 1.2); win.position.set(0, 1.85, .9); g.add(win);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(.18, .3, 4.2, 10), paint); boom.rotation.x = Math.PI / 2; boom.position.set(0, 1.85, -3); boom.castShadow = true; g.add(boom);
  bx(g, .08, 1.1, .7, paint, 0, 2.35, -4.9); bx(g, 1.4, .08, .5, paint, 0, 1.9, -4.6);
  const tail = new THREE.Group(); tail.position.set(.18, 2.2, -4.95); bx(tail, .04, 1.1, .12, dark, 0, 0, 0); g.add(tail); g.userData.prop = tail; // the little tail rotor
  // skids
  [-1, 1].forEach(s => { bx(g, .1, .08, 3.4, metal, s * .9, .12, .2); [-.6, 1].forEach(z => { const st = bx(g, .07, .75, .07, metal, s * .75, .5, z); st.rotation.z = s * -.3; }); });
  // main rotor
  bx(g, .25, .5, .25, dark, 0, 2.95, .2);
  const rotor = new THREE.Group(); rotor.position.set(0, 3.2, .2); for (let k = 0; k < 4; k++) { const b = bx(rotor, .32, .05, 5.2, dark, 0, 0, 0); b.rotation.y = k * Math.PI / 4 * 2 / 2 * 1; b.rotation.y = k * Math.PI / 2; b.position.set(0, 0, 0); } g.add(rotor); g.userData.rotor = rotor;
  rotor.children.forEach((b, k) => { b.geometry.translate(0, 0, 2.6); b.rotation.y = k * Math.PI / 2; });
  return g;
}
function makeJet() {
  const g = new THREE.Group(), paint = std(0x3a4f6e, .3, .6), stripe = std(0xffc300, .4, .2), dark = std(0x1e1e1e, .6), glass = std(0x7fd6ff, .05, .6);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.55, .5, 6.2, 16), paint); body.rotation.x = Math.PI / 2; body.position.set(0, 1.5, -.2); body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.55, 2.2, 16), paint); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.5, 4); g.add(nose);
  const cock = new THREE.Mesh(new THREE.SphereGeometry(.45, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass); cock.scale.set(.9, .9, 2.4); cock.position.set(0, 1.9, 1.9); g.add(cock);
  [-1, 1].forEach(s => { // swept wings and tail fins
    const w = new THREE.Shape(); w.moveTo(0, 1.2); w.lineTo(s * 3.6, -1.4); w.lineTo(s * 3.6, -2.1); w.lineTo(0, -1.6);
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(w, { depth: .1, bevelEnabled: false }), paint); wing.rotation.x = Math.PI / 2; wing.position.set(0, 1.4, 0); wing.castShadow = true; g.add(wing);
    bx(g, .5, .13, .7, stripe, s * 3.3, 1.36, -1.7);
    const fin = bx(g, .08, 1.2, 1, paint, s * .45, 2.2, -3); fin.rotation.z = s * -.35;
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.38, 1.4, 12), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: .85 })); flame.rotation.x = -Math.PI / 2; flame.position.set(0, 1.5, -4); g.add(flame);
  const prop = new THREE.Group(); prop.add(flame); g.add(prop); g.userData.prop = prop; g.userData.flame = flame; // "prop" spins nothing visible on a jet
  [[.9, .9], [-.9, .9], [0, 3]].forEach(([x, z]) => { bx(g, .08, .8, .08, dark, x, .75, z); wheel(g, x, z, .28, .2); });
  return g;
}
const ITEM_MESH = {
  crate: () => { const g = new THREE.Group(); bx(g, .7, .7, .7, std(0xb08a5a, .8), 0, 0, 0); [-1, 1].forEach(s => bx(g, .74, .1, .74, std(0x7a5a35, .8), 0, s * .28, 0)); return g; },
  gear: () => { const g = new THREE.Group(), m = std(0xc9a64a, .3, 1); const t = new THREE.Mesh(new THREE.TorusGeometry(.32, .1, 8, 20), m); g.add(t); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; bx(g, .12, .14, .12, m, Math.cos(a) * .45, Math.sin(a) * .45, 0); } return g; },
  apple: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 12), std(0xd8302a, .4))); bx(g, .04, .18, .04, std(0x4a3628), 0, .32, 0); const l = bx(g, .18, .02, .1, std(0x3f8a2a), .1, .36, 0); l.rotation.z = .5; return g; },
  wood: () => { const g = new THREE.Group(); for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .9, 10), std(0x7a5236, .9)); c.rotation.z = Math.PI / 2; c.position.set(0, (k === 2 ? .2 : 0), (k - 1) * .26 * (k === 2 ? 0 : 1)); g.add(c); } return g; },
  gem: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.OctahedronGeometry(.35), new THREE.MeshStandardMaterial({ color: 0x3fe0ff, emissive: 0x1a90c0, roughness: .05, metalness: .3 }))); return g; },
  fossil: () => { const g = new THREE.Group(), m = std(0xf0e8d6, .7); const c = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .8, 8), m); c.rotation.z = Math.PI / 2; g.add(c); [-1, 1].forEach(s => [-1, 1].forEach(t => { const b = new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 8), m); b.position.set(s * .42, t * .08, 0); g.add(b); })); return g; },
  shell: () => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(.28, .5, 12, 1), std(0xffb0b8, .5)); c.rotation.z = -1.2; g.add(c); return g; },
  gold: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(.28, 0), std(0xffcf3a, .2, 1))); return g; }
};
export function makeItem(type) {
  const g = new THREE.Group(), m = ITEM_MESH[type](); m.position.y = .75; g.add(m); g.userData.spin = m;
  const ring = new THREE.Mesh(new THREE.RingGeometry(.45, .6, 24), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: .6, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = .05; g.add(ring);
  return g;
}
