// The Game Store — walk up to the counter to shop. House upgrades live here.
import * as THREE from 'three';
import { G, el, save, toast, refreshCoins, openPanel, closePanel } from '../game.js';
import { buildHouse } from '../town.js';
import { currentHome, designHomes, describeKind, renderHome, sketch } from '../homes.js';
import { interpret, makeThing } from '../stuff.js';
import '../jumbo.js';
import { CARS, BOATS, PLANES, ITEMS, makeCar, makeBoat, makePlane, bagCount, bagValue, capacity, TELEPORTER_PRICE } from '../vehicles.js';
import { makeRoom, shelf, plant, box, std, env, at } from './common.js';
import { CHESS_SETS } from './chess.js';
import { mat, signTexture } from '../tex.js';

export const PADDLE_PRICES = [15, 30, 50, 80, 120];


/* ---- your house: describe it, watch it think, pick one of 20 (free) ---- */
let lastResults = null, lastQ = '', stopAll = [];
function houseSection(body, section) {
  const hs = section('Your house', '🏠'), cur = currentHome();
  hs.appendChild(el('p', { style: 'color:var(--muted);font-weight:700;margin:0 0 10px' }, 'You live in: <b style="color:#fff">' + cur.name + '</b>. Describe any house you want — a skyscraper, a castle, a blue cabin — and pick one. Houses are free!'));
  const row = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' });
  const inp = el('input', { id: 'houseQ', placeholder: 'e.g. skyscraper, castle with a pool…', maxlength: '60', autocomplete: 'off', style: 'flex:1;min-width:220px;height:56px;border-radius:15px;border:2px solid var(--line);background:var(--bg2);color:var(--ink);padding:0 16px;font-size:20px;outline:none;-webkit-user-select:text;user-select:text' });
  inp.value = lastQ;
  const go = el('button', { class: 'btn go' }, '✨ Find houses');
  row.appendChild(inp); row.appendChild(go); hs.appendChild(row);
  const chips = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px' });
  ['Skyscraper', 'Castle', 'Mansion', 'Modern house', 'Log cabin', 'Beach villa', 'Gold tower'].forEach(w => { const c = el('button', { class: 'btn ghost small' }, w); c.onclick = () => { inp.value = w; search(); }; chips.appendChild(c); });
  hs.appendChild(chips);
  const results = el('div', { id: 'houseResults' }); hs.appendChild(results);
  const search = () => { const q = inp.value.trim(); if (!q) { inp.focus(); return; } inp.blur(); lastQ = q; showResults(results, q, true); };
  go.onclick = search; inp.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
  if (lastResults) showResults(results, lastQ, false);
}
function stopAnims() { stopAll.forEach(f => f()); stopAll = []; }
function showResults(box, q, fresh) {
  stopAnims(); box.innerHTML = '';
  const specs = fresh || !lastResults ? designHomes(q) : lastResults; lastResults = specs;
  const grid = el('div', { class: 'houses', style: 'margin-top:12px' });
  if (fresh) {
    // "thinking": a big blueprint sketch draws itself first
    const think = el('div', { style: 'background:var(--bg2);border-radius:18px;padding:14px;margin-top:12px;text-align:center' });
    const cv = el('canvas', { width: '560', height: '300', style: 'width:100%;max-width:560px;border-radius:12px;display:block;margin:0 auto' });
    const lbl = el('div', { style: 'font-family:Fredoka;font-size:20px;margin-top:10px' }, '🤔 Thinking of your ' + describeKind(q) + '<span class="dots"></span>');
    think.appendChild(cv); think.appendChild(lbl); box.appendChild(think);
    let dots = 0; const di = setInterval(() => { const d = lbl.querySelector('.dots'); if (d) d.textContent = '.'.repeat(1 + dots++ % 3); }, 350); stopAll.push(() => clearInterval(di));
    stopAll.push(sketch(cv, specs[0], 2600, () => setTimeout(() => {
      clearInterval(di); lbl.innerHTML = '✨ Here are 20 ideas for "' + escapeHtml(q) + '" — tap one to see it';
      think.style.transition = 'opacity .4s'; cv.style.display = 'none'; box.appendChild(grid); popCards(grid, specs);
    }, 250)));
  } else { box.appendChild(grid); popCards(grid, specs, true); }
}
function popCards(grid, specs, instant) {
  let i = 0, alive = true; stopAll.push(() => { alive = false; });
  const next = () => {
    if (!alive || i >= specs.length) return;
    const T = specs[i++], card = el('div', { class: 'hz', style: 'cursor:pointer;animation:pop .3s ease-out' });
    const PH = T.kind === 'tower' ? 360 : 220, cv = el('canvas', { width: '320', height: String(PH) }); card.appendChild(cv);
    card.appendChild(el('b', null, escapeHtml(T.name))); card.appendChild(el('small', null, T.kind === 'tower' ? T.floors + ' floors' : T.stories + (T.stories > 1 ? ' floors' : ' floor')));
    card.onclick = () => preview(T);
    grid.appendChild(card);
    const reveal = () => { if (!alive) return; const pic = renderHome(T, 320, PH); const x = cv.getContext('2d'); let a = 0; (function fade() { if (!alive) return; a = Math.min(1, a + .08); x.globalAlpha = a; x.drawImage(pic, 0, 0); x.globalAlpha = 1; if (a < 1) requestAnimationFrame(fade); })(); };
    if (instant) { reveal(); setTimeout(next, 30); }
    else { stopAll.push(sketch(cv, T, 650, () => setTimeout(reveal, 80))); setTimeout(next, 520); }
  };
  next();
}
function preview(T) {
  const ov = el('div', { style: 'position:fixed;inset:0;z-index:40;background:rgba(8,6,30,.7);display:flex;align-items:center;justify-content:center;padding:16px' });
  const card = el('div', { class: 'modal', style: 'max-width:640px' });
  let pic = renderHome(T, 640, T.kind === 'tower' ? 640 : 420); pic.style.cssText = 'width:100%;max-height:55vh;object-fit:contain;border-radius:14px;display:block';
  card.appendChild(pic);
  card.appendChild(el('h2', { style: 'margin:12px 0 4px' }, escapeHtml(T.name)));
  const blurb = el('p', { style: 'margin:0 0 6px' }, escapeHtml(T.blurb || '')); card.appendChild(blurb);
  if (T.kind === 'tower') { // choose how tall your skyscraper is
    T = { ...T };
    const row = el('div', { style: 'display:flex;align-items:center;gap:12px;margin:8px 0 12px;font-weight:800' });
    const lab = el('span', { style: 'min-width:120px;font-family:Fredoka;font-size:22px;color:#ffd34d' }, T.floors + ' floors');
    const sl = el('input', { type: 'range', min: '5', max: '60', step: '1', value: String(T.floors), style: 'flex:1;height:44px;accent-color:#ffd34d' });
    row.appendChild(el('span', null, '🏢 How many floors?')); row.appendChild(sl); row.appendChild(lab); card.insertBefore(row, blurb.nextSibling);
    let redraw = 0;
    sl.oninput = () => {
      T.floors = +sl.value; lab.textContent = T.floors + ' floors'; blurb.textContent = (T.blurb || '').replace(/^\d+ floors/, T.floors + ' floors');
      clearTimeout(redraw); redraw = setTimeout(() => { const np = renderHome(T, 640, 640); pic.src = np.src || ''; if (!np.src) { np.style.cssText = pic.style.cssText; pic.replaceWith(np); pic = np; } }, 120);
    };
    T.blurb = blurb.textContent;
  }
  const acts = el('div', { class: 'acts' });
  const yes = el('button', { class: 'btn go' }, '🏠 Make this my house (free)');
  yes.onclick = () => { if (T.kind === 'tower') T.blurb = blurb.textContent; G.S.data.up.home = T; save(true); G.refresh(); ov.remove(); renderShop(); toast('🎉 Your new ' + T.name + ' is ready! Go see it.'); };
  const no = el('button', { class: 'btn ghost' }, 'Keep looking'); no.onclick = () => ov.remove();
  acts.appendChild(yes); acts.appendChild(no); card.appendChild(acts); ov.appendChild(card);
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}
/* ---- buy anything: two search boxes ---- */
const lastAny = { paid: null, free: null };
function anythingSection(body, section) {
  const sec = section('Buy anything — just type it', '🔎');
  sec.appendChild(el('p', { style: 'color:var(--muted);font-weight:700;margin:0 0 10px' }, 'Type anything you want. I’ll think about what it looks like and give it a fair price. The 🎁 box is almost free — everything costs less than 5 coins!'));
  const box = (kind, title, ph, btn, cls) => {
    const wrap = el('div', { style: 'background:var(--bg2);border-radius:18px;padding:14px;margin-bottom:12px' });
    wrap.appendChild(el('div', { style: 'font-family:Fredoka;font-size:20px;margin-bottom:8px' }, title));
    const row = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' });
    const inp = el('input', { placeholder: ph, maxlength: '60', autocomplete: 'off', style: 'flex:1;min-width:220px;height:56px;border-radius:15px;border:2px solid var(--line);background:var(--bg);color:var(--ink);padding:0 16px;font-size:20px;outline:none;-webkit-user-select:text;user-select:text' });
    const go = el('button', { class: 'btn ' + cls }, btn);
    row.appendChild(inp); row.appendChild(go); wrap.appendChild(row);
    const out = el('div'); wrap.appendChild(out); sec.appendChild(wrap);
    const L = lastAny[kind]; if (L) { inp.value = L.q; showAny(out, L.q, kind === 'free', L.salt, false); }
    const search = () => { const q = inp.value.trim(); if (!q) { inp.focus(); return; } inp.blur(); lastAny[kind] = { q, salt: 0 }; showAny(out, q, kind === 'free', 0, true); };
    go.onclick = search; inp.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
  };
  box('paid', '💰 The store box', 'e.g. the biggest mansion in the world, a gold dragon…', '🔎 Search', 'primary');
  box('free', '🎁 The almost-free box (under 5 coins)', 'e.g. a giant pizza, a pet unicorn, a race car…', '🎁 Search', 'go');
  const mine = (G.S.data.up.stuff || []);
  if (mine.length) {
    const w = el('div', { style: 'color:var(--muted);font-weight:700' }, '🎁 Your stuff: ' + mine.map(t => escapeHtml(t.name) + (t.placed ? '' : ' (carrying)')).join(' · ') + '. Walk up to your things outside to pick them up, then tap 🎁 at the top to put them down anywhere.');
    sec.appendChild(w);
  }
}
let anyTimer = 0;
function showAny(out, q, free, salt, fresh) {
  clearTimeout(anyTimer); out.innerHTML = '';
  const R = interpret(q, free, salt);
  const card = el('div', { style: 'display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-top:12px' });
  const picBox = el('div', { style: 'flex:0 0 300px;max-width:100%;min-height:170px;border-radius:12px;background:#0002;display:flex;align-items:center;justify-content:center;font-family:Fredoka;font-size:18px;color:var(--muted)' }, '🤔 Thinking<span class="dots">…</span>');
  const info = el('div', { style: 'flex:1;min-width:220px' });
  card.appendChild(picBox); card.appendChild(info); out.appendChild(card);
  const reveal = () => {
    picBox.innerHTML = '';
    let pic;
    if (R.type === 'house') { pic = renderHome(R.spec, 300, R.spec.kind === 'tower' ? 300 : 200); pic.style.cssText = 'width:100%;border-radius:12px;display:block'; }
    else if (R.type === 'thing') pic = thingPic(R.thing);
    else pic = vehiclePic(R.type === 'car' ? makeCar : R.type === 'boat' ? makeBoat : makePlane, R.kind);
    picBox.appendChild(pic); picBox.style.background = 'none';
    info.appendChild(el('div', { style: 'font-family:Fredoka;font-size:24px;margin-bottom:4px' }, escapeHtml(R.name)));
    info.appendChild(el('p', { style: 'margin:0 0 10px;color:var(--muted);font-weight:700' }, escapeHtml(R.why)));
    const row = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' });
    const buyB = el('button', { class: 'btn go' }, 'Buy it for <i class="coin"></i> ' + R.price);
    const again = el('button', { class: 'btn ghost' }, '🔄 Show me another one');
    buyB.onclick = () => buy(R.price, () => giveAny(R));
    again.onclick = () => { const L = free ? lastAny.free : lastAny.paid; L.salt++; showAny(out, q, free, L.salt, true); };
    row.appendChild(buyB); if (R.type === 'thing' || R.type === 'house') row.appendChild(again); info.appendChild(row);
  };
  if (fresh) { let d = 0; const di = setInterval(() => { const s = picBox.querySelector('.dots'); if (s) s.textContent = '.'.repeat(1 + d++ % 3); else clearInterval(di); }, 300); anyTimer = setTimeout(() => { clearInterval(di); reveal(); }, 1400); }
  else reveal();
}
function giveAny(R) {
  const u = G.S.data.up;
  if (R.type === 'house') { u.home = R.spec; setTimeout(() => toast('🎉 ' + R.name + ' is now your home! Go see it.'), 50); return; }
  if (R.type === 'car') { if (!u.cars.includes(R.kind)) u.cars.push(R.kind); u.car = R.kind; setTimeout(() => toast('🚗 Your ' + R.name + ' is ready — tap 🚗 Drive outside.'), 50); return; }
  if (R.type === 'boat') { if (!u.boats.includes(R.kind)) u.boats.push(R.kind); u.boat = R.kind; setTimeout(() => toast('⛵ Your ' + R.name + ' is ready — walk to the water.'), 50); return; }
  if (R.type === 'plane') { if (!u.planes.includes(R.kind)) u.planes.push(R.kind); if (!u.planeKind) u.planeKind = R.kind; u.plane = true; setTimeout(() => toast('✈️ Your ' + R.name + ' is waiting at Hometown Airport.'), 50); return; }
  const t = { id: Date.now().toString(36), name: R.name, thing: R.thing, placed: false };
  (u.stuff || (u.stuff = [])).push(t);
  if (G.placeNewStuff) G.placeNewStuff(t);
  setTimeout(() => toast('🎁 Your ' + R.name + ' is waiting for you right outside the Game Store!'), 50);
}
const tpics = {};
function thingPic(T) {
  const key = JSON.stringify(T);
  if (!tpics[key]) {
    const W = 300, H = 200, R = G.renderer, rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }), sc = new THREE.Scene();
    sc.background = new THREE.Color(0xcfe6f5); sc.environment = env();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x6a6050, 1.2)); const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(5, 8, 6); sc.add(dl);
    const m = makeThing(T); sc.add(m);
    const gr = new THREE.Mesh(new THREE.CircleGeometry(60, 32), std(0x6f9a52, .95)); gr.rotation.x = -Math.PI / 2; sc.add(gr);
    const bb = new THREE.Box3().setFromObject(m), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()).length();
    const cam = new THREE.PerspectiveCamera(30, W / H, .05, 400); cam.position.set(c.x + sz * 1.2, c.y + sz * .55, c.z + sz * 1.5); cam.lookAt(c);
    R.setRenderTarget(rt); R.render(sc, cam); const pix = new Uint8Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, pix); R.setRenderTarget(null); rt.dispose();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'), img = x.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(pix.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); x.putImageData(img, 0, 0);
    tpics[key] = cv.toDataURL();
  }
  return el('img', { src: tpics[key], style: 'width:100%;border-radius:12px;display:block' });
}
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

let vpics = {};
function vehiclePic(maker, k) {
  const key = (maker === makeCar ? 'c' : maker === makePlane ? 'p' : 'b') + k;
  if (!vpics[key]) {
    const W = 300, H = 170, R = G.renderer, rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }), sc = new THREE.Scene();
    sc.background = new THREE.Color(maker === makeCar ? 0xd9e6f2 : maker === makePlane ? 0xbfe0ff : 0x9fd0ef); sc.environment = env();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x6a6050, 1.2)); const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(5, 8, 6); sc.add(dl);
    const m = maker(k); sc.add(m);
    if (maker === makeBoat) { const w = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std(0x2f7fb0, .1, .2)); w.rotation.x = -Math.PI / 2; w.position.y = .05; sc.add(w); }
    const bb = new THREE.Box3().setFromObject(m), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()).length();
    const cam = new THREE.PerspectiveCamera(30, W / H, .1, 100); cam.position.set(c.x + sz * 1.1, c.y + sz * .6, c.z + sz * 1.3); cam.lookAt(c);
    R.setRenderTarget(rt); R.render(sc, cam); const pix = new Uint8Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, pix); R.setRenderTarget(null); rt.dispose();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'), img = x.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(pix.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); x.putImageData(img, 0, 0);
    vpics[key] = cv.toDataURL();
  }
  return el('img', { src: vpics[key], style: 'width:100%;border-radius:12px;display:block' });
}
function buy(cost, fn) {
  if (G.S.data.coins < cost) { toast('You need ' + (cost - G.S.data.coins) + ' more coins — play some levels!'); return false; }
  G.S.data.coins -= cost; fn(); save(true); refreshCoins(); G.refresh(); renderShop(); return true;
}
export function openShop(focusHouse) { openPanel('Game Store', renderShopInto); if (focusHouse) setTimeout(() => { const i = document.getElementById('houseQ'); if (i) i.scrollIntoView({ block: 'center' }); }, 50); }
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
  anythingSection(body, section);
  houseSection(body, section);
  // ---- sell what you found ----
  const sv = section('Sell what you found', '🎒'), bag = G.S.data.bag, n = bagCount();
  sv.appendChild(el('p', { style: 'color:var(--muted);font-weight:700;margin:0 0 10px' }, n ? 'Your bag has ' + n + ' of ' + capacity() + ' things:' : 'Your bag is empty. Explore the world to find crates, apples, gems, fossils, seashells and more! You can carry ' + capacity() + (G.S.data.up.car ? ' (your car’s trunk helps).' : ' — a car carries more.')));
  if (n) {
    const row = el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px' });
    Object.entries(bag).filter(([, c]) => c > 0).forEach(([k, c]) => row.appendChild(el('span', { class: 'chip' }, ITEMS[k].icon + ' ' + ITEMS[k].name + ' ×' + c + ' <small style="color:var(--coin)">(' + ITEMS[k].value + ' each)</small>')));
    sv.appendChild(row);
    const sb = el('button', { class: 'btn go' }, '<i class="coin"></i> Sell it all for ' + bagValue() + ' coins');
    sb.onclick = () => { const v = bagValue(); G.S.data.coins += v; G.S.data.bag = {}; save(true); refreshCoins(); renderShop(); toast('💰 Sold! +' + v + ' coins'); };
    sv.appendChild(sb);
  }
  // ---- getting around ----
  const gg = grid(section('Getting around', '🧭'));
  item(gg, '🏠 Home Teleporter', 'Lost? Tap 🏠 at the top to zap straight home from anywhere in the world.', u.teleporter ? 'You have it!' : '', u.teleporter ? null : TELEPORTER_PRICE, () => buy(TELEPORTER_PRICE, () => { u.teleporter = true; }));
  const vgrid = (title, icon, CAT, ownedK, curK, maker) => {
    const g2 = grid(section(title, icon));
    Object.entries(CAT).forEach(([k, c]) => {
      const owned = u[ownedK].includes(k), on = u[curK] === k;
      const it = el('div', { class: 'item' }), pic = vehiclePic(maker, k);
      it.appendChild(pic); it.appendChild(el('div', { class: 't' }, c.name)); it.appendChild(el('div', { class: 'd' }, c.blurb));
      if (on) it.appendChild(el('div', { class: 'own' }, curK === 'car' ? 'Your car — tap 🚗 Drive outside' : 'Your boat — walk to the water'));
      const b = el('button', { class: 'btn ' + (owned ? (on ? '' : 'go') : 'primary') }, owned ? (on ? 'In use' : 'Use this one') : '<i class="coin"></i> ' + c.price);
      b.disabled = on;
      b.onclick = owned ? () => { u[curK] = k; save(true); G.refreshBag(); renderShop(); } : () => buy(c.price, () => { u[ownedK].push(k); u[curK] = k; });
      it.appendChild(b); g2.appendChild(it);
    });
  };
  vgrid('Cars — drive anywhere, carry more', '🚗', CARS, 'cars', 'car', makeCar);
  vgrid('Boats — sail lakes and the sea', '⛵', BOATS, 'boats', 'boat', makeBoat);
  // ---- planes (free) ----
  const pl = grid(section('Planes — they wait for you at Hometown Airport', '✈️'));
  Object.entries(PLANES).forEach(([k, c]) => {
    const owned = u.planes.includes(k), on = u.planeKind === k, it = el('div', { class: 'item' });
    it.appendChild(vehiclePic(makePlane, k)); it.appendChild(el('div', { class: 't' }, c.name)); it.appendChild(el('div', { class: 'd' }, c.blurb));
    if (owned) it.appendChild(el('div', { class: 'own' }, '🛫 Waiting at the airport'));
    const b = el('button', { class: 'btn ' + (owned ? '' : 'go') }, owned ? 'You have it!' : '🎁 Get it free'); b.disabled = owned;
    b.onclick = () => { u.planes.push(k); if (!u.planeKind) u.planeKind = k; u.plane = true; save(true); G.refreshBag(); renderShop(); toast('✈️ The ' + c.name + ' is yours! It’s waiting at Hometown Airport, just south of your house.'); };
    it.appendChild(b); pl.appendChild(it);
  });
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
  const T = currentHome();
  const stand = box(2.2, .9, 2.2, std(0x2b2b2b, .3, .5), -4.5, .45, 1.5); S.add(stand); cols.push({ x1: -5.7, x2: -3.3, z1: .3, z2: 2.7 });
  const model = buildHouse(T); const bb = new THREE.Box3().setFromObject(model), sz = bb.getSize(new THREE.Vector3());
  model.scale.setScalar(Math.min(1.9 / Math.max(sz.x, sz.z), 2.6 / sz.y)); model.position.set(-4.5, .9, 1.5); S.add(model);
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .5), new THREE.MeshBasicMaterial({ map: signTexture('Your ' + T.name, { bg: '#1c1c22', fg: '#ffd34d', font: '600 90px Fredoka, Arial' }) }));
  lbl.position.set(-4.5, .45, 2.62); S.add(lbl);
  S.add(at(plant(1.2), 4.8, 0, 3.5)); cols.push({ x1: 4.5, x2: 5.1, z1: 3.2, z2: 3.8 });
  let t = 0;
  return {
    scene: S, walks: true, colliders: cols, title: 'Game Store', cam: { dist: 5.5, pitch: .42 },
    help: 'Walk up to the counter to shop',
    start: new THREE.Vector3(0, 0, d / 2 - 3.6), startYaw: Math.PI, camYaw: 0, camBlockers: R.colliders,
    camClamp(p) { p.y = Math.min(p.y, 3.7); },
    interact: () => [
      { pos: new THREE.Vector3(0, 0, -d / 2 + 3.9), r: 2.2, label: '🛒 Open the shop', sub: 'Upgrades and your house', fn: () => openShop() },
      { pos: new THREE.Vector3(-4.5, 0, 3.2), r: 1.8, label: '🏠 Design a new house', sub: 'Describe it and pick one — free', fn: () => openShop(true) },
      { pos: R.door, r: 1.5, label: 'Go back outside', sub: 'Game Store', fn: () => G.backToTown() }
    ],
    buttons: [{ label: '🛒 Shop', fn: () => openShop(), cls: 'primary' }],
    update(dt) { t += dt; keeper.speedBlend(0); keeper.update(dt); model.rotation.y = t * .4; },
    exit() {}
  };
}
