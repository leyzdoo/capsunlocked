// The Game Store — walk up to the counter to shop. House upgrades live here.
import * as THREE from 'three';
import { G, el, save, toast, refreshCoins, openPanel, closePanel } from '../game.js';
import { HOUSE_TIERS, buildHouse } from '../town.js';
import { makeRoom, shelf, plant, box, std, env, at } from './common.js';
import { CHESS_SETS } from './chess.js';
import { mat, signTexture } from '../tex.js';

export const PADDLE_PRICES = [15, 30, 50, 80, 120];

/* little 3D pictures of every house level, rendered once */
let thumbs = null;
function houseThumbs() {
  if (thumbs) return thumbs;
  const W = 320, H = 200, R = G.renderer, rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  const pix = new Uint8Array(W * H * 4);
  thumbs = HOUSE_TIERS.map((T, i) => {
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0xcfe3f4); sc.environment = env();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x6a6050, 1.1));
    const dl = new THREE.DirectionalLight(0xfff1dc, 2.2); dl.position.set(-14, 22, 18); sc.add(dl);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), std(0x5f8f3e, 1)); ground.rotation.x = -Math.PI / 2; sc.add(ground);
    const hse = buildHouse(i); sc.add(hse);
    const span = T.w + (T.wings ? (T.bigWings ? 14 : 11) * (T.wings === 2 ? 1 : .55) : 0) + (T.garage ? 5 : 0);
    const cam = new THREE.PerspectiveCamera(32, W / H, .5, 400);
    const dist = Math.max(span * 1.7, 22); cam.position.set(dist * .45, dist * .42, dist * .95); cam.lookAt(T.garage ? 2.5 : 0, T.stories * 1.6 + 1, 0);
    R.setRenderTarget(rt); R.render(sc, cam); R.readRenderTargetPixels(rt, 0, 0, W, H, pix); R.setRenderTarget(null);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), img = x.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(pix.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  });
  rt.dispose();
  return thumbs;
}

function buy(cost, fn) {
  if (G.S.data.coins < cost) { toast('You need ' + (cost - G.S.data.coins) + ' more coins — play some levels!'); return false; }
  G.S.data.coins -= cost; fn(); save(true); refreshCoins(); G.refresh(); renderShop(); return true;
}
export function openShop() { openPanel('Game Store', renderShopInto); }
function renderShop() { const b = document.getElementById('panelBody'); b.innerHTML = ''; renderShopInto(b); refreshCoins(); }
function renderShopInto(body) {
  const u = G.S.data.up;
  function section(title, icon) { const s = el('div', { class: 'sec' }); s.appendChild(el('h3', null, icon + ' ' + title)); body.appendChild(s); return s; }
  function grid(sec) { const g = el('div', { class: 'items' }); sec.appendChild(g); return g; }
  function item(g, t, d, own, price, fn, label) {
    const it = el('div', { class: 'item' });
    it.innerHTML = '<div class="t">' + t + '</div><div class="d">' + d + '</div>' + (own ? '<div class="own">' + own + '</div>' : '');
    const b = el('button', { class: 'btn primary' }, price == null ? (label || 'Owned') : '<i class="coin"></i> ' + price);
    if (price == null) { b.disabled = !label; b.className = 'btn' + (label ? ' go' : ''); }
    b.onclick = fn; it.appendChild(b); g.appendChild(it);
  }
  // ---- house upgrades ----
  const hs = section('Your house', '🏠');
  const cur = u.house || 0, next = HOUSE_TIERS[cur + 1];
  hs.appendChild(el('p', { style: 'color:var(--muted);font-weight:700;margin:0 0 10px' }, next ? 'You live in a <b style="color:#fff">' + HOUSE_TIERS[cur].name + '</b>. Upgrade one step at a time — all the way to the Super Mansion!' : 'You own the <b style="color:#ffd34d">Super Mansion</b> — the biggest house in town!'));
  const row = el('div', { class: 'houses' }), pics = houseThumbs();
  HOUSE_TIERS.forEach((T, i) => {
    const card = el('div', { class: 'hz' + (i === cur ? ' cur' : i === cur + 1 ? ' next' : '') });
    card.innerHTML = '<img src="' + pics[i] + '" alt="' + T.name + '" style="width:100%;border-radius:10px;display:block;' + (i > cur + 1 ? 'filter:grayscale(.6) brightness(.8)' : '') + '"><b>' + T.name + '</b><small>' + (i <= cur ? (i === cur ? '✓ Your house' : 'Done') : '<i class="coin" style="width:14px;height:14px;vertical-align:-2px"></i> ' + T.price) + '</small>';
    row.appendChild(card);
  });
  hs.appendChild(row);
  if (next) {
    const nb = el('div', { style: 'display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap' });
    nb.innerHTML = '<div style="flex:1;min-width:200px"><b style="font-family:Fredoka;font-size:20px">Next: ' + next.name + '</b><div style="color:var(--muted)">' + next.blurb + '</div></div>';
    const b = el('button', { class: 'btn go' }, '<i class="coin"></i> Upgrade for ' + next.price);
    b.onclick = () => { if (buy(next.price, () => { u.house = cur + 1; })) toast('🎉 Your house is now a ' + next.name + '! Go see it.'); };
    nb.appendChild(b); hs.appendChild(nb);
  }
  // ---- ping pong ----
  const pg = grid(section('Ping Pong', '🏓'));
  const np = u.paddle < PADDLE_PRICES.length ? PADDLE_PRICES[u.paddle] : null;
  item(pg, 'Bigger paddle', 'Each upgrade makes your paddle wider and your shots faster.', 'Paddle level ' + u.paddle + ' of ' + PADDLE_PRICES.length, np, () => buy(np, () => { u.paddle++; }), np == null ? null : undefined);
  item(pg, 'Extra life (respawn)', 'If the robot is about to win, use a life to keep playing.', 'You have ' + u.lives, 10, () => buy(10, () => { u.lives++; }));
  // ---- chess ----
  const cg = grid(section('Chess', '♟️'));
  Object.keys(CHESS_SETS).forEach(k => {
    const c = CHESS_SETS[k], owned = u.sets.indexOf(k) >= 0, on = u.chessSet === k;
    const sw = '<span style="display:inline-flex;gap:6px;align-items:center"><span style="width:26px;height:26px;border-radius:50%;background:' + c.w + ';border:2px solid #0006"></span><span style="width:26px;height:26px;border-radius:50%;background:' + c.b + ';border:2px solid #fff6"></span><span style="width:26px;height:26px;border-radius:6px;background:linear-gradient(135deg,' + c.light + ' 50%,' + c.dark + ' 50%)"></span></span>';
    item(cg, c.name + ' pieces', sw, on ? 'In use' : owned ? 'Owned' : '', owned ? null : c.price,
      owned ? () => { u.chessSet = k; save(true); renderShop(); } : () => buy(c.price, () => { u.sets.push(k); u.chessSet = k; }), owned ? (on ? null : 'Use this set') : undefined);
  });
  item(cg, 'Hint pack ×3', 'Shows a good move. Tap 💡 during a game.', 'You have ' + u.chessHints, 10, () => buy(10, () => { u.chessHints += 3; }));
  // ---- picture + maze ----
  const xg = grid(section('Picture Puzzles & Mazes', '🧠'));
  item(xg, '50/50 hint ×3', 'Picture Puzzles: removes two wrong pieces.', 'You have ' + u.picHints, 8, () => buy(8, () => { u.picHints += 3; }));
  item(xg, 'Path peek ×3', 'Mazes: lights up the next steps toward the exit.', 'You have ' + u.mazeHints, 8, () => buy(8, () => { u.mazeHints += 3; }));
}

export async function enter({ makeCharacter }) {
  const w = 16, d = 12;
  const R = makeRoom({ w, d, h: 4, floor: ['tiles', ['#efe9dd', '#2f2a26', 8, 91]], floorTile: 3.2, wall: '#f3e6c8', lamps: 6, doorColor: 0x5c4300 });
  const S = R.scene, cols = R.colliders.slice();
  // counter + shopkeeper
  const counter = new THREE.Group();
  counter.add(box(5, 1.05, 1, mat('wood', ['#7a4a26', 5, 92], 2, 1, { roughness: .45 }), 0, .52, 0));
  counter.add(box(5.1, .06, 1.1, std(0x2b2b2b, .2, .4), 0, 1.07, 0));
  const reg = box(.5, .35, .4, std(0x333333, .4, .5), 1.6, 1.28, 0); counter.add(reg);
  counter.position.set(0, 0, -d / 2 + 2.6); S.add(counter); cols.push({ x1: -2.6, x2: 2.6, z1: -d / 2 + 2, z2: -d / 2 + 3.2 });
  const keeper = makeCharacter('player', 0xc7962a); keeper.root.position.set(0, 0, -d / 2 + 1.5); S.add(keeper.root);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1), new THREE.MeshStandardMaterial({ map: signTexture('GAME STORE', { bg: '#3d2d00', fg: '#ffd34d', border: '#ffd34d' }), emissive: 0xffffff, emissiveIntensity: .3 }));
  sign.material.emissiveMap = sign.material.map; sign.position.set(0, 3.1, -d / 2 + .05); S.add(sign);
  // shelves with goods
  const goods = [0xff5d73, 0x4fb0ff, 0xffd23f, 0x2fd3a7, 0x9d8cff, 0xff8a5b];
  [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) {
    const sh = shelf(2.4, 2.2, false); sh.rotation.y = -s * Math.PI / 2; sh.position.set(s * (w / 2 - .3), 0, -2.5 + i * 3); S.add(sh);
    for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) sh.add(box(.42, .3 + (k % 2) * .1, .3, std(goods[(i + j + k) % goods.length], .5), -.9 + j * .6, .25 + k * .54, 0));
    cols.push({ x1: s > 0 ? w / 2 - .6 : -w / 2, x2: s > 0 ? w / 2 : -w / 2 + .6, z1: -2.5 + i * 3 - 1.3, z2: -2.5 + i * 3 + 1.3 });
  } });
  // a house model on a stand, showing your next upgrade
  const tier = G.S.data.up.house || 0, showTier = Math.min(HOUSE_TIERS.length - 1, tier + 1);
  const stand = box(2.2, .9, 2.2, std(0x2b2b2b, .3, .5), -4.5, .45, 1.5); S.add(stand); cols.push({ x1: -5.7, x2: -3.3, z1: .3, z2: 2.7 });
  const model = buildHouse(showTier); const T = HOUSE_TIERS[showTier]; const span = T.w + (T.wings ? 13 : 0) + (T.garage ? 5 : 0);
  model.scale.setScalar(1.9 / Math.max(span, T.d)); model.position.set(-4.5, .9, 1.5); S.add(model);
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .5), new THREE.MeshBasicMaterial({ map: signTexture(tier >= HOUSE_TIERS.length - 1 ? 'You have it all!' : 'Next: ' + T.name, { bg: '#1c1c22', fg: '#ffd34d', font: '600 90px Fredoka, Arial' }) }));
  lbl.position.set(-4.5, .45, 2.62); S.add(lbl);
  S.add(at(plant(1.2), 4.8, 0, 3.5)); cols.push({ x1: 4.5, x2: 5.1, z1: 3.2, z2: 3.8 });
  let t = 0;
  return {
    scene: S, walks: true, colliders: cols, title: 'Game Store', cam: { dist: 5.5, pitch: .42 },
    help: 'Walk up to the counter to shop',
    start: new THREE.Vector3(0, 0, d / 2 - 3.6), startYaw: Math.PI, camYaw: 0, camBlockers: R.colliders,
    camClamp(p) { p.y = Math.min(p.y, 3.7); },
    interact: () => [
      { pos: new THREE.Vector3(0, 0, -d / 2 + 3.9), r: 2.2, label: '🛒 Open the shop', sub: 'Upgrades and your house', fn: openShop },
      { pos: R.door, r: 1.5, label: 'Go back outside', sub: 'Game Store', fn: () => G.backToTown() }
    ],
    buttons: [{ label: '🛒 Shop', fn: openShop, cls: 'primary' }],
    update(dt) { t += dt; keeper.speedBlend(0); keeper.update(dt); model.rotation.y = t * .4; },
    exit() {}
  };
}
