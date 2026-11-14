// Inside your skyscraper: a lobby, elevators to every floor, and the city below the windows.
import * as THREE from 'three';
import { G, el, openPanel, closePanel, toast } from '../game.js';
import { TOWER_FH } from '../town.js';
import { sofa, table, rug, plant, lamp, shelf, chandelier, box, std, env } from './common.js';
import { mat, rng, signTexture } from '../tex.js';

const W = 24, D = 18;
const REAL = ['office', 'apartment', 'office', 'apartment', 'gym', 'office', 'apartment', 'restaurant', 'office', 'pool', 'apartment', 'office'];
const FUN = ['arcade', 'trampoline', 'ballpit', 'apartment', 'cinema', 'candy', 'aquarium', 'pool', 'jungle', 'ice', 'arcade', 'gym'];
const NAMES = { lobby: 'Lobby', office: 'Offices', apartment: 'Apartment', gym: 'Gym', restaurant: 'Restaurant', pool: 'Pool', penthouse: 'Penthouse', roof: 'Roof deck', arcade: 'Arcade', trampoline: 'Trampoline park', ballpit: 'Ball pit', cinema: 'Movie theater', candy: 'Candy land', aquarium: 'Aquarium', jungle: 'Jungle', ice: 'Ice rink' };
const ICONS = { lobby: '🛎️', office: '💼', apartment: '🛋️', gym: '🏋️', restaurant: '🍽️', pool: '🏊', penthouse: '👑', roof: '🚁', arcade: '🕹️', trampoline: '🤸', ballpit: '🔴', cinema: '🎬', candy: '🍭', aquarium: '🐠', jungle: '🌴', ice: '⛸️' };

export function floorType(T, n) {
  if (n === 0) return 'lobby';
  if (n === T.floors + 1) return 'roof';
  if (n === T.floors) return 'penthouse';
  const list = T.real ? REAL : FUN, r = rng(T.seed + n * 31);
  return n <= list.length ? list[(n - 1 + (T.seed % list.length)) % list.length] : list[Math.floor(r() * list.length)];
}

/* the view out the windows: a painted city seen from the height you're at */
function skylineTexture(T, elev) {
  const C = 2048, H = 1024, c = document.createElement('canvas'); c.width = C; c.height = H; const x = c.getContext('2d'), r = rng(T.seed + 77);
  const mid = H / 2, yAt = (h, dist) => mid - (h - elev) / dist * (H / 2);
  const sky = x.createLinearGradient(0, 0, 0, mid); sky.addColorStop(0, '#5f97d6'); sky.addColorStop(1, '#d7e7f4'); x.fillStyle = sky; x.fillRect(0, 0, C, mid + 2);
  // far hills on the horizon
  x.fillStyle = '#9fb3bf'; x.beginPath(); x.moveTo(0, mid); for (let i = 0; i <= C; i += 32) x.lineTo(i, yAt(40 + Math.sin(i * .01) * 30 + Math.sin(i * .037) * 15, 2500)); x.lineTo(C, mid); x.fill();
  x.fillStyle = '#7f8f7a'; x.fillRect(0, mid, C, H - mid); // ground far below
  // city blocks, far to near
  for (const dist of [900, 600, 400, 260, 170, 110]) {
    const shade = 1 - dist / 1100;
    for (let i = 0; i < 70; i++) {
      const bx = r() * C, bw = (12 + r() * 30) * (300 / dist) * 2, bh = 10 + r() * (dist > 300 ? 160 : 90);
      const top = yAt(bh, dist), bot = Math.min(H, yAt(0, dist));
      const g = Math.round(90 + r() * 70 * shade), tint = r();
      x.fillStyle = `rgb(${g + (tint < .3 ? 20 : 0)},${g + 4},${g + (tint > .7 ? 25 : 10)})`; x.fillRect(bx, top, bw, bot - top);
      if (bw > 10 && bot - top > 14) { x.fillStyle = 'rgba(255,240,200,.35)'; for (let wy = top + 4; wy < bot - 4; wy += 7) for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) if (r() < .25) x.fillRect(wx, wy, 2.5, 3); }
      if (elev > bh) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(bx, top, bw, Math.max(1, (elev - bh) / dist * 40)); } // rooftops seen from above
    }
    x.fillStyle = 'rgba(215,231,244,' + (dist / 2400) + ')'; x.fillRect(0, 0, C, H); // haze
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

export async function enter({ player, makeCharacter, T, door }) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xd7e7f4); scene.environment = env();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6050, .9));
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.4); sun.position.set(8, 20, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera; sc.left = -W / 2 - 2; sc.right = W / 2 + 2; sc.top = D / 2 + 2; sc.bottom = -D / 2 - 2; sc.far = 60; sun.shadow.bias = -.0005; scene.add(sun);
  const R = 70, sky = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 2 * R, 48, 1, true), new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: false, fog: false }));
  scene.add(sky);
  let floorN = 0, group = null, cols = [], acts = [], tramps = [], anim = [], h = 5.2, t = 0, riding = false;

  function build(n) {
    if (group) { scene.remove(group); group.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
    group = new THREE.Group(); scene.add(group); cols = []; acts = []; tramps = []; anim = [];
    floorN = n; const type = floorType(T, n), r = rng(T.seed + n * 13);
    h = type === 'lobby' ? 5.2 : type === 'penthouse' ? 4.6 : 3.4;
    const elev = n === 0 ? 1.6 : 6 + (n - 1) * TOWER_FH + 1.6;
    if (sky.material.map) sky.material.map.dispose();
    sky.material.map = skylineTexture(T, elev); sky.material.needsUpdate = true; sky.position.y = 1.6;
    const roof = type === 'roof';
    // floor
    const floorM = type === 'lobby' || type === 'penthouse' ? mat('tiles', ['#efece6', '#d8d2c8', 6, 201], W / 3.2, D / 3.2, { roughness: .25 })
      : type === 'office' ? mat('carpet', ['#5a6470', 12], 4, 4) : type === 'ice' ? std(0xeef6ff, .08, .1)
      : type === 'roof' ? mat('concrete', ['#9a968e', 0, 202], 6, 5) : type === 'gym' || type === 'trampoline' ? std(0x2b2b30, .9)
      : mat('wood', ['#9a6a40', 6, 203], 6, 5, { roughness: .5 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorM); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; group.add(fl);
    const walls = [{ x1: -W / 2 - 1, x2: W / 2 + 1, z1: -D / 2 - 1, z2: -D / 2 }, { x1: -W / 2 - 1, x2: W / 2 + 1, z1: D / 2, z2: D / 2 + 1 }, { x1: -W / 2 - 1, x2: -W / 2, z1: -D / 2, z2: D / 2 }, { x1: W / 2, x2: W / 2 + 1, z1: -D / 2, z2: D / 2 }];
    cols.push(...walls);
    // back wall = elevator core (solid); other three sides glass
    const core = mat('plaster', [type === 'lobby' ? '#d9d2c4' : '#ece8e0', 9], W / 3, h / 3, { roughness: .9 });
    if (!roof) group.add(box(W, h, .3, core, 0, h / 2, -D / 2 - .15));
    else { group.add(box(8, 3.2, 4, core, 0, 1.6, -D / 2 + 2)); cols.push({ x1: -4, x2: 4, z1: -D / 2, z2: -D / 2 + 4 }); }
    const frameM = std(0x2a2d33, .4, .7), glassM = new THREE.MeshStandardMaterial({ color: 0xa9c4d8, roughness: .02, metalness: .1, transparent: true, opacity: .16, depthWrite: false });
    const glassWall = (len, x, z, ry) => {
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(len, h), glassM); gp.position.set(x, h / 2, z); gp.rotation.y = ry; group.add(gp);
      const n2 = Math.round(len / 2.4);
      for (let i = 0; i <= n2; i++) { const o = -len / 2 + i * len / n2; group.add(box(.1, h, .1, frameM, x + Math.cos(ry) * o, h / 2, z - Math.sin(ry) * o)); }
      [0.05, h - .05, 1.0].forEach((yy, k) => { const b = box(len, k === 2 ? .05 : .12, .1, frameM, x, yy, z); b.rotation.y = ry; group.add(b); });
    };
    if (roof) { // railing all around
      const rm = std(0xd8dde3, .3, .8);
      [[W, 0, D / 2 - .1, 0], [W, 0, -D / 2 + .1, 0], [D, -W / 2 + .1, 0, Math.PI / 2], [D, W / 2 - .1, 0, Math.PI / 2]].forEach(([len, x, z, ry]) => { const top = box(len, .08, .08, rm, x, 1.1, z); top.rotation.y = ry; group.add(top); const gl = new THREE.Mesh(new THREE.PlaneGeometry(len, 1), glassM); gl.position.set(x, .55, z); gl.rotation.y = ry; group.add(gl); });
    } else {
      glassWall(W, 0, D / 2, 0); glassWall(D, -W / 2, 0, Math.PI / 2); glassWall(D, W / 2, 0, Math.PI / 2);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0xf4f1ea, .95)); ceil.rotation.x = Math.PI / 2; ceil.position.y = h; group.add(ceil);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x = -W / 3 + i * W / 3, z = -D / 4 + j * D / 2; const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, .04, 1.4), new THREE.MeshBasicMaterial({ color: 0xfffaf0 })); p.position.set(x, h - .02, z); group.add(p); const pl = new THREE.PointLight(0xfff1dc, 4, 14, 1.6); pl.position.set(x, h - .4, z); group.add(pl); }
    }
    // elevators on the back wall
    const ey = roof ? 0 : 0, ez = roof ? -D / 2 + 4.02 : -D / 2 + .02;
    [-1.8, 1.8].forEach((ex, k) => {
      group.add(box(1.7, 2.7, .1, std(0xc9ccd1, .3, .5), ex, 1.35 + ey, ez + .05));
      group.add(box(.03, 2.6, .12, std(0x555555, .3, .8), ex, 1.3 + ey, ez + .1));
      group.add(box(2.1, .3, .12, std(0x2a2d33, .4, .7), ex, 2.95 + ey, ez + .06));
      const lit = new THREE.Mesh(new THREE.PlaneGeometry(.5, .14), new THREE.MeshBasicMaterial({ color: 0xffb000 })); lit.position.set(ex, 2.95 + ey, ez + .13); group.add(lit);
    });
    const callBtn = box(.12, .25, .05, std(0x222222, .3, .6), 0, 1.2, ez + .05); group.add(callBtn);
    acts.push({ pos: new THREE.Vector3(0, 0, ez + 1.3), r: 2.4, label: '🛗 Take the elevator', sub: 'Floor ' + (n === 0 ? 'L' : n > T.floors ? 'Roof' : n) + ' · ' + NAMES[type], fn: openElevator });
    // floor-number sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .5), new THREE.MeshBasicMaterial({ map: signTexture((n === 0 ? 'L' : n > T.floors ? 'R' : n) + ' · ' + NAMES[type], { bg: '#1b1d22', fg: '#ffd34d', font: '600 100px Fredoka, Arial' }) }));
    sign.position.set(0, 3.45, ez + .08); if (!roof) group.add(sign);
    (FLOORS[type] || FLOORS.office)({ group, cols, acts, tramps, anim, r, h, T, n, makeCharacter, add: addFn(group, cols) });
    return type;
  }

  function openElevator() {
    openPanel('🛗 Elevator — ' + T.name, body => {
      body.appendChild(el('p', { style: 'color:var(--muted);font-weight:700;margin:0 0 12px' }, 'Pick a floor. ' + (T.real ? 'This tower is set up like a real skyscraper.' : 'Every floor in this tower is something fun!')));
      const g = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px' });
      for (let k = T.floors + 1; k >= 0; k--) {
        const ty = floorType(T, k), b = el('button', { class: 'btn ' + (k === floorN ? 'go' : 'ghost') + ' small', style: 'justify-content:flex-start;min-height:52px' }, '<b style="min-width:42px;display:inline-block">' + (k === 0 ? 'L' : k > T.floors ? 'R' : k) + '</b>' + ICONS[ty] + ' ' + NAMES[ty]);
        b.onclick = () => ride(k); g.appendChild(b);
      }
      body.appendChild(g);
    });
  }
  async function ride(k) {
    closePanel(); if (k === floorN || riding) return; riding = true;
    const fade = document.createElement('div'); fade.style.cssText = 'position:fixed;inset:0;z-index:36;background:#111;opacity:0;transition:opacity .3s;display:flex;align-items:center;justify-content:center;color:#ffd34d;font:600 64px Fredoka,Arial';
    document.body.appendChild(fade); requestAnimationFrame(() => fade.style.opacity = 1);
    const from = floorN, steps = Math.min(18, Math.abs(k - from)), arrow = k > from ? '▲ ' : '▼ ';
    for (let i = 0; i <= steps; i++) { const f = Math.round(from + (k - from) * i / steps); fade.textContent = arrow + (f === 0 ? 'L' : f > T.floors ? 'R' : f); await new Promise(res => setTimeout(res, 70)); }
    const type = build(k);
    const ez = type === 'roof' ? -D / 2 + 4 : -D / 2;
    player.root.position.set(0, 0, ez + 2); player.root.rotation.y = 0;
    G.camYawTo && G.camYawTo(Math.PI);
    await new Promise(res => setTimeout(res, 200)); fade.style.opacity = 0; setTimeout(() => fade.remove(), 350);
    toast(ICONS[type] + ' ' + NAMES[type]); riding = false;
  }

  build(0);
  const back = door === 'back';
  return {
    scene, walks: true, title: T.name, cam: { dist: 5.5, pitch: .4 },
    get colliders() { return cols; }, get camBlockers() { return cols.slice(0, floorType(T, floorN) === 'roof' ? 5 : 4); },
    help: 'Walk to the elevators to go up. ' + T.floors + ' floors + the roof!',
    start: new THREE.Vector3(back ? -W / 2 + 3 : 0, 0, back ? -D / 2 + 1.6 : D / 2 - 2), startYaw: back ? 0 : Math.PI, camYaw: back ? Math.PI : 0,
    camClamp(p) { if (floorType(T, floorN) !== 'roof') p.y = Math.min(p.y, h - .25); p.x = THREE.MathUtils.clamp(p.x, -W / 2 + .3, W / 2 - .3); p.z = THREE.MathUtils.clamp(p.z, -D / 2 + .3, D / 2 - .3); },
    heightAt(p) { for (const tr of tramps) if (Math.hypot(p.x - tr.x, p.z - tr.z) < tr.r) return Math.abs(Math.sin(t * 3.2 + tr.ph)) * 1.6 + .6; return 0; },
    interact: () => acts.concat(floorN === 0 ? [
      { pos: new THREE.Vector3(0, 0, D / 2 - 1), r: 1.6, label: 'Go out the front door', sub: T.name, fn: () => G.backToTown('home') },
      { pos: new THREE.Vector3(-W / 2 + 3, 0, -D / 2 + 1), r: 1.6, label: '🚪 Back patio door', sub: 'Go out to the backyard', fn: () => G.backToTown('homeBack') }
    ] : []),
    buttons: [{ label: '🛗 Elevator', fn: openElevator, cls: 'primary' }],
    update(dt) { t += dt; anim.forEach(f => f(t, dt)); },
    exit() { if (sky.material.map) sky.material.map.dispose(); }
  };
}
const addFn = (group, cols) => (o, x, z, ry = 0, cw = 0, cd = 0) => { o.position.set(x, o.position.y, z); o.rotation.y = ry; group.add(o); if (cw) { const s = Math.abs(Math.sin(ry)) > .5, a = s ? cd : cw, b = s ? cw : cd; cols.push({ x1: x - a / 2, x2: x + a / 2, z1: z - b / 2, z2: z + b / 2 }); } return o; };

function chair(color = 0x2b4a7a) { const c = new THREE.Group(); c.add(box(.5, .06, .5, std(color, .6), 0, .48, 0)); c.add(box(.5, .55, .06, std(color, .6), 0, .78, .22)); c.add(box(.06, .48, .06, std(0x222222, .4, .6), 0, .24, 0)); return c; }
function bed(color) { const b = new THREE.Group(), wd = std(0x5a3c26, .5); b.add(box(1.8, .35, 2.2, wd, 0, .18, 0)); b.add(box(1.7, .25, 2.1, std(0xf4f1ea, .9), 0, .48, 0)); b.add(box(1.72, .12, 1.3, std(color, .9), 0, .6, .35)); [-1, 1].forEach(k => b.add(box(.7, .14, .4, std(0xffffff, .9), k * .42, .66, -.75))); b.add(box(1.9, 1.1, .1, wd, 0, .55, -1.12)); return b; }
function screen(w, h, color) { const g = new THREE.Group(); g.add(box(w + .1, h + .1, .08, std(0x111111, .3, .5), 0, 0, 0)); const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color })); s.position.z = .05; g.add(s); g.userData.scr = s; return g; }
function counter(len, color = '#e8e2d6') { const g = new THREE.Group(); g.add(box(len, .95, .8, mat('wood', [color, 2, 204], 2, 1), 0, .47, 0)); g.add(box(len + .05, .06, .85, std(0x2b2b2b, .2, .3), 0, .97, 0)); return g; }

/* what's on each kind of floor (the back wall has the elevators; keep z > -D/2+3 clear in the middle) */
const FLOORS = {
  lobby({ add, group, cols, T, makeCharacter, anim }) {
    const desk = new THREE.Group(); desk.add(box(5, 1.1, 1, mat('wood', ['#3a2a20', 4, 205], 2, 1, { roughness: .4 }), 0, .55, 0)); desk.add(box(5.1, .06, 1.1, std(0xefece6, .2), 0, 1.12, 0));
    add(desk, 6, -2, 0, 5.2, 1.2);
    const keeper = makeCharacter('player', 0x8a8f99); keeper.root.position.set(6, 0, -3.2); group.add(keeper.root); anim.push((t, dt) => { keeper.speedBlend(0); keeper.update(dt); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.2), new THREE.MeshBasicMaterial({ map: signTexture(T.name.toUpperCase(), { bg: '#1b1d22', fg: '#ffd34d', border: '#c9a64a' }) })); sign.position.set(6, 3.6, -D / 2 + .05); group.add(sign);
    [-1, 1].forEach(s => add(sofa(0x2f3a5a, 2.6), -6 + s * 2.2, 3, s > 0 ? -Math.PI / 2 : Math.PI / 2, 1, 2.8));
    add(table(1.4, .8, .42, '#2a2a2a'), -6, 3, 0, 1.4, .8); add(rug(6, 5, '#3b3f5a'), -6, 3);
    [[-W / 2 + .8, D / 2 - .8], [W / 2 - .8, D / 2 - .8], [-W / 2 + .8, -D / 2 + 2.6], [W / 2 - .8, -D / 2 + 2.6]].forEach(([x, z]) => add(plant(1.6), x, z, 0, .6, .6));
    if (T.real) [-1, 1].forEach(s => { const g = new THREE.Group(); g.add(box(.25, 1, 1.4, std(0xc9ccd1, .2, 1), 0, .5, 0)); g.add(box(.6, .05, .05, std(0xd04a3a, .4), .3, .9, 0)); add(g, s * 1.2, 1, 0, .3, 1.4); });
    const ch = chandelier(1.4); ch.position.set(-6, 4.1, 3); group.add(ch);
    // back patio door
    group.add(box(1.4, 2.5, .1, std(0x2a2d33, .4, .7), -W / 2 + 3, 1.25, -D / 2 + .06)); group.add(box(1.1, 2.1, .05, std(0x7fb0d0, .05, .6), -W / 2 + 3, 1.3, -D / 2 + .12));
    const ex = new THREE.Mesh(new THREE.PlaneGeometry(.7, .25), new THREE.MeshBasicMaterial({ color: 0x2bd46a })); ex.position.set(-W / 2 + 3, 2.75, -D / 2 + .1); group.add(ex);
  },
  office({ add, r }) {
    for (let row = 0; row < 3; row++) for (let c = 0; c < 4; c++) {
      const x = -8 + c * 5.4 - (c >= 2 ? -.6 : 0), z = -2 + row * 3.4; if (Math.abs(x) < 3 && row === 0) continue;
      const d = new THREE.Group(); d.add(box(1.6, .05, .8, std(0xe8e2d6, .5), 0, .75, 0)); [-1, 1].forEach(s => d.add(box(.05, .75, .75, std(0x9aa0a6, .5, .5), s * .78, .37, 0)));
      d.add(box(1.7, .5, .05, std(0x5a6a7a, .9), 0, 1.05, -.42)); const sc = screen(.6, .35, r() < .5 ? 0x3a7fd0 : 0x2fae6a); sc.position.set(0, 1.05, -.2); d.add(sc);
      add(d, x, z, 0, 1.7, .9); const ch = chair(); ch.position.y = 0; add(ch, x, z + .7, Math.PI);
    }
    // glass meeting room
    const mg = new THREE.Group(); mg.add(box(.05, 2.6, 4, new THREE.MeshStandardMaterial({ color: 0xa9c4d8, transparent: true, opacity: .25 }), -2.5, 1.3, 0)); mg.add(box(5, 2.6, .05, new THREE.MeshStandardMaterial({ color: 0xa9c4d8, transparent: true, opacity: .25 }), 0, 1.3, 2));
    mg.add(box(3, .06, 1.4, mat('wood', ['#5a3c26', 4, 206], 1, 1), 0, .76, 0));
    add(mg, W / 2 - 2.6, D / 2 - 2.2, 0); add(plant(1.2), -W / 2 + .7, D / 2 - .7, 0, .5, .5); add(plant(1.2), W / 2 - .7, -D / 2 + 2.5, 0, .5, .5);
  },
  apartment({ add, r, group }) {
    add(rug(5, 4, ['#7a3b3b', '#3b5a7a', '#4a3b6b'][Math.floor(r() * 3)]), -6, 3);
    add(sofa(0x56606e, 2.6), -6, 4.6, Math.PI, 2.8, 1);
    const tv = screen(2.4, 1.35, 0x2a5f9a); tv.position.y = 1.6; add(tv, -6, D / 2 - .3, Math.PI);
    add(table(1.2, .7, .42), -6, 3, 0, 1.2, .7); add(lamp(), -9.5, 5, 0, .4, .4);
    add(counter(4), 4, -4.5, 0, 4, .9); add(box(.8, 1.9, .8, std(0xdcdfe3, .3, .7), 6.6, .95, -6.2), 6.6, -6.2, 0, .8, .8);
    add(table(1.8, 1, .76, '#5a3c26'), 4, -1.5, 0, 1.8, 1); [-1, 1].forEach(s => add(chair(0x5a3c26), 4 + s * .55, -.7, Math.PI));
    add(bed(r() < .5 ? 0x3b5a7a : 0x6b3b5a), 8.6, 4.5, Math.PI, 2, 2.4); add(shelf(2, 2.2), -W / 2 + 1.4, -2, Math.PI / 2, .5, 2.1);
    group.add(box(.15, 2.6, 5, std(0xece8e0, .9), 6.4, 1.3, 5.5));
  },
  penthouse({ add, group }) {
    add(rug(7, 5, '#5a1f2a'), -5, 3); add(sofa(0x2f3a5a, 3.2), -5, 5, Math.PI, 3.4, 1); add(sofa(0x2f3a5a, 3.2), -8.4, 3, Math.PI / 2, 1, 3.4);
    const ch = chandelier(1.4); ch.position.set(-5, 3.6, 3); group.add(ch);
    // hot tub
    const tub = new THREE.Group(); tub.add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, .8, 24), std(0xefece6, .3))); tub.children[0].position.y = .4;
    const wtr = new THREE.Mesh(new THREE.CircleGeometry(1.25, 24), new THREE.MeshStandardMaterial({ color: 0x2bb6e0, roughness: .05 })); wtr.rotation.x = -Math.PI / 2; wtr.position.y = .78; tub.add(wtr); add(tub, 7, 4.5, 0, 2.8, 2.8);
    add(bed(0x5a1f2a), 8, -3.5, 0, 2.2, 2.6); add(box(5, .1, .1, std(0xc9a64a, .3, 1), 0, 4.4, -D / 2 + .1), 0, -D / 2 + .1);
    add(counter(3.5, '#2a2a2a'), 1, 1.5, 0, 3.5, .9); add(plant(1.6), -W / 2 + .8, -D / 2 + 2.6, 0, .6, .6);
  },
  gym({ add }) {
    for (let i = 0; i < 4; i++) { const tm = new THREE.Group(); tm.add(box(.8, .2, 1.8, std(0x222222, .6), 0, .1, 0)); tm.add(box(.8, 1.2, .1, std(0x333333, .5, .5), 0, .8, -.85)); const sc2 = screen(.4, .25, 0x2fae6a); sc2.position.set(0, 1.4, -.8); tm.add(sc2); add(tm, -9 + i * 1.6, D / 2 - 1.6, Math.PI, .9, 1.9); }
    const rack = new THREE.Group(); rack.add(box(3, .1, .6, std(0x333333, .5, .6), 0, .6, 0)); for (let i = 0; i < 6; i++) { const db = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .5, 12), std(0x111111, .4, .7)); db.rotation.z = Math.PI / 2; db.position.set(-1.2 + i * .48, .78, 0); rack.add(db); } add(rack, 6, -4.6, 0, 3, .7);
    [-1, 1].forEach(s => add(rug(2, 3, s < 0 ? '#2f6fd8' : '#d04a3a'), 6 + s * 1.5, 2));
    const bag = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 1.4, 16), std(0xd04a3a, .7)); bag.position.y = 1.4; add(bag, 9.5, 5.5, 0, .7, .7);
  },
  restaurant({ add, r }) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const x = -8 + i * 5.5, z = -1.5 + j * 3.3, t2 = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, .05, 20), std(0xf4f1ea, .6)); top.position.y = .76; t2.add(top); t2.add(box(.1, .76, .1, std(0x222222), 0, .38, 0));
      add(t2, x, z, 0, 1.2, 1.2); [0, Math.PI].forEach(a => add(chair(0x7a3b3b), x + Math.sin(a) * 1, z + Math.cos(a) * 1, a + Math.PI));
    }
    add(counter(6, '#3a2a20'), 7, -4.6, 0, 6, .9); add(plant(1.4), W / 2 - .8, D / 2 - .8, 0, .5, .5);
  },
  pool({ add, group, cols }) {
    group.add(box(14, .3, 8, std(0xefece6, .4), -1, .15, 2));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(13, 7), new THREE.MeshStandardMaterial({ color: 0x2bb6e0, roughness: .03, metalness: .2 })); p.rotation.x = -Math.PI / 2; p.position.set(-1, .31, 2); group.add(p);
    cols.push({ x1: -8, x2: 6, z1: -2, z2: 6 });
    for (let i = 0; i < 4; i++) add(box(.7, .3, 1.8, std(0xffffff, .5), -7 + i * 2.2, .3, D / 2 - 1.3), -7 + i * 2.2, D / 2 - 1.3, 0, .7, 1.8);
    add(plant(1.6), W / 2 - .8, D / 2 - .8, 0, .6, .6);
  },
  roof({ add, group, cols, T }) {
    const hp = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, .2, 32), std(0x3a3d42, .7)); hp.position.set(-4, .1, 3); group.add(hp);
    const hc = document.createElement('canvas'); hc.width = hc.height = 256; const hx = hc.getContext('2d'); hx.strokeStyle = '#ffd34d'; hx.lineWidth = 14; hx.beginPath(); hx.arc(128, 128, 110, 0, 7); hx.stroke(); hx.fillStyle = '#fff'; hx.font = 'bold 160px Arial'; hx.textAlign = 'center'; hx.fillText('H', 128, 184);
    const hm = new THREE.Mesh(new THREE.CircleGeometry(3.8, 32), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), transparent: true })); hm.rotation.x = -Math.PI / 2; hm.position.set(-4, .21, 3); group.add(hm);
    for (let i = 0; i < 4; i++) add(plant(1.8), 5 + (i % 2) * 3, 1 + Math.floor(i / 2) * 4, 0, .6, .6);
    [0, 1].forEach(i => add(box(1.8, .45, .7, mat('wood', ['#8a6440', 4, 207], 1, 1), 0, .22, 0), 6.5, -2 + i * 7.5, 0, 1.8, .7));
  },
  arcade({ add, anim, r }) {
    const cols2 = [0xff5d73, 0x4fb0ff, 0xffd23f, 0x2fd3a7, 0x9d8cff];
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Group(), color = cols2[i % 5]; c.add(box(1, 1.9, .9, std(color, .5, .2), 0, .95, 0));
      const s = screen(.7, .55, 0x111111); s.position.set(0, 1.4, .46); c.add(s); c.add(box(.9, .1, .4, std(0x222222), 0, 1.0, .55));
      const x = -10 + (i % 5) * 2.2, z = i < 5 ? -1.5 : 4; add(c, x, z, i < 5 ? 0 : Math.PI, 1.1, 1);
      const sm = s.userData.scr.material, ph = r() * 6; anim.push(t => sm.color.setHSL((t * .2 + ph) % 1, .8, .5));
    }
    add(rug(8, 3, '#2a1a4a'), 6, 2);
    const pt = new THREE.Group(); pt.add(box(2.8, .1, 1.5, std(0x1f6f3f, .6), 0, .76, 0)); [-1, 1].forEach(s => [-1, 1].forEach(t2 => pt.add(box(.08, .76, .08, std(0x222222), s * 1.3, .38, t2 * .65)))); add(pt, 7, 4.5, 0, 2.8, 1.5);
  },
  trampoline({ group, tramps, cols }) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const x = -7 + i * 6, z = 0 + j * 5, tr = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, .1, 8, 40), std([0x2f6fd8, 0xd04a3a, 0x2fae6a][i], .5)); ring.rotation.x = Math.PI / 2; ring.position.y = .5; tr.add(ring);
      const m = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), std(0x111111, .9)); m.rotation.x = -Math.PI / 2; m.position.y = .49; tr.add(m);
      tr.position.set(x, 0, z); group.add(tr); tramps.push({ x, z, r: 1.7, ph: i + j });
    }
  },
  ballpit({ group, tramps, cols }) {
    group.add(box(12, .7, .3, std(0x4fb0ff, .5), -1, .35, -1.5)); group.add(box(12, .7, .3, std(0x4fb0ff, .5), -1, .35, 6.5)); group.add(box(.3, .7, 8, std(0x4fb0ff, .5), -7, .35, 2.5));
    const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshStandardMaterial({ roughness: .4 }), 1500), m = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < 1500; i++) { m.makeTranslation(-6.8 + Math.random() * 11.6, .1 + Math.random() * .45, -1.3 + Math.random() * 7.6); balls.setMatrixAt(i, m); balls.setColorAt(i, c.setHex([0xff5d73, 0x4fb0ff, 0xffd23f, 0x2fd3a7, 0xff8a5b][i % 5])); }
    group.add(balls); cols.push({ x1: -7.2, x2: 5, z1: -1.7, z2: -1.3 }, { x1: -7.2, x2: 5, z1: 6.3, z2: 6.7 }, { x1: -7.2, x2: -6.8, z1: -1.5, z2: 6.5 });
    tramps.push({ x: -1, z: 2.5, r: 0, ph: 0 });
    const slide = new THREE.Mesh(new THREE.BoxGeometry(1.2, .1, 5), std(0xffd23f, .5)); slide.position.set(7.5, 1.2, 2.5); slide.rotation.x = .45; group.add(slide);
  },
  cinema({ add, group }) {
    const s = screen(10, 4.2, 0x8fb8e8); s.position.set(0, 2.6, D / 2 - .3); s.rotation.y = Math.PI; group.add(s);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 8; i++) { const x = -7 + i * 2, z = -1 + row * 2; if (Math.abs(x) < 1.5) continue; const seat = new THREE.Group(); seat.add(box(1.2, .45, .9, std(0x8a1f2a, .8), 0, .3, 0)); seat.add(box(1.2, .8, .2, std(0x8a1f2a, .8), 0, .7, -.4)); add(seat, x, z, 0, 1.2, 1); }
    group.userData.dim = true;
  },
  candy({ add, r }) {
    for (let i = 0; i < 8; i++) { const lp = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 2.6, 8), std(0xffffff, .4)); st.position.y = 1.3; lp.add(st);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .2, 24), std([0xff5d8f, 0x9d8cff, 0xffd23f, 0x2fd3a7][i % 4], .3)); top.rotation.x = Math.PI / 2; top.position.y = 2.8; lp.add(top);
      add(lp, -9 + (i % 4) * 5 + r(), i < 4 ? -2 : 5, 0, .3, .3); }
    for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 1, 20), std([0xffb0c8, 0xb0e0ff, 0xfff0a0][i % 3], .5)), -6 + i * 2.6, 1.5, 0, 1.2, 1.2).position.y = .5;
  },
  aquarium({ add, group, anim }) {
    const tank = new THREE.Group(); tank.add(box(14, 3, .4, new THREE.MeshStandardMaterial({ color: 0x1fa6d6, transparent: true, opacity: .6, roughness: .05 }), 0, 1.6, 0));
    const fish = []; for (let i = 0; i < 24; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), new THREE.MeshBasicMaterial({ color: [0xffb000, 0xff5d73, 0xffffff, 0xffd23f][i % 4] })); f.scale.set(1.8, 1, .6); tank.add(f); fish.push(f); }
    add(tank, 0, 2.5, 0, 14, .5); anim.push(t => fish.forEach((f, i) => { f.position.set(Math.sin(t * .4 + i) * 6.5, 1 + ((i * 37) % 22) / 10 + Math.sin(t + i) * .2, 0); }));
    add(rug(10, 4, '#1f3a6a'), 0, 5.5);
  },
  jungle({ add, r }) {
    for (let i = 0; i < 14; i++) { const pl = plant(2.4 + r() * 1.2); add(pl, -10 + r() * 20, -3 + r() * 10, r() * 6, .7, .7); }
    add(rug(6, 3, '#2f5a24'), 0, 3);
  },
  ice({ add, group }) {
    group.add(box(16, .5, .2, std(0xffffff, .5), 0, .25, -2)); group.add(box(16, .5, .2, std(0xffffff, .5), 0, .25, 7.5));
    for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.ConeGeometry(.3, .7, 12), std(0xff8a2a, .6)), -6 + i * 2.4, 2.5, 0).position.y = .35;
  }
};
