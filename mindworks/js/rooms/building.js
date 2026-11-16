// Go inside any building in the world.
//  - shops: a shopkeeper robot behind the counter, shelves full of what they sell, customers
//  - towers (like Skyline Tower): a lobby with a front desk and an elevator to every floor —
//    offices, apartments, a cafe, a gym, an arcade, a pool, trampolines… and the roof
import * as THREE from 'three';
import { G, el, toast, openPanel, closePanel } from '../game.js';
import { sofa, table, rug, plant, shelf, box, std, env, chandelier } from './common.js';
import { mat, rng, signTexture } from '../tex.js';
import { robotName } from '../world.js';
import { shell, door, caption, robotHome, BOT_COLORS } from './apartment.js';

/* what each kind of shop sells, and what the shopkeeper says */
const SHOP = {
  BAKERY: ['🍞🥐🧁🍰🥖🍪', 'Fresh bread, right out of the oven! Smell that?', 'eat'], PIZZA: ['🍕🍕🧀🍅🫓🥤', 'One slice or the whole pie? Extra bolts on top?', 'eat'],
  BOOKS: ['📚📖📕📗📘📙', 'This one is about a robot pirate. My favorite!', 'books'], 'TOY SHOP': ['🧸🪀🪁🎲🚂🤖', 'Every toy here is tested by me. Very important job.', 'shelves'],
  'ROBOT REPAIR': ['🔧🔩⚙️🪛🔋🤖', 'Squeaky knee? I can fix that in a jiffy.', 'shelves'], 'ICE CREAM': ['🍦🍨🍧🍫🍓🍒', 'Today’s special: motor-oil swirl. Just kidding — it’s chocolate!', 'eat'],
  BANK: ['🪙💰💵💎🏦🔐', 'Your coins are safe with us. The vault is super strong!', 'bank'], FLOWERS: ['🌷🌹🌻🌼💐🌸', 'Flowers make every robot smile.', 'shelves'],
  HARDWARE: ['🔩🔨🪚🧰🪜🔦', 'Need bolts? We have ten thousand kinds.', 'shelves'], CAFE: ['☕🧋🥤🍩🥐🍵', 'Hot cocoa with marshmallows? Coming right up!', 'eat'],
  ARCADE: ['🕹️👾🎮🏆🎯🪙', 'High score of the day: 9,999,999. Can you beat it?', 'arcade'], MUSIC: ['🎸🎹🥁🎺🎻🎷', 'Strum anything you like — just not too loud!', 'shelves'],
  GROCERY: ['🍎🍌🥕🥦🧀🥛', 'Fresh apples today. Very crunchy!', 'shelves'], HOTEL: ['🛎️🧳🗝️🛏️🧴☕', 'Welcome! Your room has the best view in town.', 'hotel'],
  LIBRARY: ['📚📖📕📗📘📙', 'Shhh… this is a quiet place. Borrow any book you like!', 'books'], 'POST OFFICE': ['✉️📦📮📬🏷️📫', 'Sending a letter? It’ll get there by robot-mail tomorrow!', 'shelves'],
  DINER: ['🥞🍳🥓🍔🍟🥤', 'Pancakes are flipping! Grab a booth.', 'eat'], GYM: ['🏋️💪🥊🚴🧘🏃', 'Feel the burn! Ten more push-ups!', 'gym']
};
const WORK = ['typing an email ⌨️', 'in a meeting 📊', 'drawing plans 📐', 'on a video call 📞', 'fixing a computer 💻', 'making a chart 📈', 'having a snack 🍪'];

function emojiTex(ch) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 64, 72);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const emojiCache = {};
function emoji(ch, s = .35) { const t = emojiCache[ch] || (emojiCache[ch] = emojiTex(ch)); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true })); sp.scale.setScalar(s); return sp; }
const chars = s => Array.from(s);

/* a city skyline painted on the windows — the higher the floor, the more sky you see */
function viewTex(level, seed) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'), r = rng(seed);
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#7fbcff'); g.addColorStop(1, '#d6ecff'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  const base = 150 + Math.min(1, level / 40) * 110; // horizon drops as you go up
  for (let i = 0; i < 40; i++) { const w = 14 + r() * 30, h = 20 + r() * 120 * (1 - Math.min(.8, level / 50)), bx = r() * 512; x.fillStyle = ['#6d7f93', '#8796a8', '#5c6b7d', '#9aa8b8'][Math.floor(r() * 4)]; x.fillRect(bx, base - h, w, 256); x.fillStyle = '#ffe9a066'; for (let k = 0; k < 6; k++) x.fillRect(bx + 3 + r() * (w - 6), base - h + 6 + r() * h, 3, 4); }
  x.fillStyle = '#4f8f3a'; x.fillRect(0, base, 512, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function enter({ player, makeCharacter, data }) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0e0d1c); scene.environment = env();
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x3a3228, .65));
  const key = new THREE.DirectionalLight(0xfff3e0, 1); key.position.set(4, 10, 6); scene.add(key);
  const R = rng(data.seed || 1);
  let group = null, cols = [], acts = [], anim = [], t = 0, busy = false, H = 3.6, roof = false;
  const add = (o, x, z, ry = 0, cw = 0, cd = 0) => { o.position.set(x, o.position.y, z); o.rotation.y = ry; group.add(o); if (cw) { const s2 = Math.abs(Math.sin(ry)) > .5, a = s2 ? cd : cw, b = s2 ? cw : cd; cols.push({ x1: x - a / 2, x2: x + a / 2, z1: z - b / 2, z2: z + b / 2 }); } return o; };
  const ctx = { get group() { return group; }, get cols() { return cols; }, get anim() { return anim; }, makeCharacter, add };
  function clear() { if (group) { scene.remove(group); group.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) o.geometry.dispose(); }); } group = new THREE.Group(); scene.add(group); cols = []; acts = []; anim = []; scene.background = new THREE.Color(0x0e0d1c); roof = false; }
  function place(p, yaw) { player.root.position.copy(p); player.root.rotation.y = yaw; G.camYawTo && G.camYawTo(yaw + Math.PI); }
  async function move(fn) {
    if (busy) return; busy = true;
    const f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;z-index:36;background:#000;opacity:0;transition:opacity .22s'; document.body.appendChild(f);
    requestAnimationFrame(() => f.style.opacity = 1); await new Promise(res => setTimeout(res, 240));
    fn(); f.style.opacity = 0; setTimeout(() => f.remove(), 260); busy = false;
  }
  /** a robot standing (or walking a path) with a name tag; say = what it tells you */
  function bot(x, z, face, name, job, say, path, color) {
    const b = makeCharacter('bot', color || BOT_COLORS[Math.floor(R() * BOT_COLORS.length)]); b.root.position.set(x, 0, z); b.root.rotation.y = face; group.add(b.root);
    const tg = caption(name, job); tg.position.y = 2.1; b.root.add(tg);
    let seg = 0, wait = 0;
    anim.push((t2, dt) => {
      b.update(dt);
      if (!path) { b.speedBlend(0); return; }
      if (wait > 0) { wait -= dt; b.speedBlend(0); return; }
      const tg2 = path[seg], p = b.root.position, dx = tg2[0] - p.x, dz = tg2[1] - p.z, d = Math.hypot(dx, dz);
      if (d < .15) { seg = (seg + 1) % path.length; wait = 1.5; return; }
      p.x += dx / d * dt * 1.1; p.z += dz / d * dt * 1.1; b.root.rotation.y = Math.atan2(dx, dz); b.speedBlend(.6);
    });
    if (say) acts.push({ pos: b.root.position, r: 2.2, label: '👋 Say hi to ' + name, sub: job, fn: () => { b.play('agree'); toast('🤖 ' + name + ': "' + say + '"'); } });
    return b;
  }
  const sign = (text, w, x, y, z, ry = 0) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w * .18), new THREE.MeshBasicMaterial({ map: signTexture(text, { bg: '#2a2520', fg: '#ffe9b0', border: '#c9a64a' }) })); s.position.set(x, y, z); s.rotation.y = ry; group.add(s); return s; };

  /* ======================= a shop ======================= */
  function goShop() {
    clear(); const w = 14, d = 10; H = 3.6;
    const S = SHOP[data.sign] || ['🎁🎈🧸🍬🎀🪅', 'Welcome! Look around!', 'shelves'], items = chars(S[0]);
    shell(group, cols, { w, d, h: H, wall: ['#f2ece0', '#e6ece8', '#f1e4dc', '#e8e0f0'][Math.floor(R() * 4)], floor: ['tiles', [['#efe9dd', '#2f2a26'], ['#e8e2d6', '#3a4a5a'], ['#f2e6dc', '#6a3a3a']][Math.floor(R() * 3)].concat([8, 405])] });
    door(group, 0, d / 2 - .05, Math.PI, 0x2a2a30);
    sign(data.sign || 'SHOP', 4.2, 0, 2.95, -d / 2 + .06);
    // the counter + shopkeeper
    const counter = new THREE.Group(); counter.add(box(3.6, 1.05, .8, mat('wood', ['#8a5a35', 4, 406], 2, 1), 0, .52, 0)); counter.add(box(3.7, .06, .9, std(0xe8e2d6, .4), 0, 1.07, 0));
    counter.add(box(.5, .3, .4, std(0x333333, .4, .4), 1.1, 1.25, 0)); add(counter, 3.4, -2.6, 0, 3.7, .9);
    const it0 = emoji(items[0], .5); it0.position.set(2.6, 1.4, -2.6); group.add(it0);
    bot(3.4, -3.6, 0, data.owner || 'Shopkeeper', 'the shopkeeper', S[1], null, 0xe0b04a);
    acts.push({ pos: new THREE.Vector3(3.4, 0, -1.6), r: 1.6, label: '🛒 Buy something', sub: 'From ' + (data.owner || 'the shopkeeper'), fn: () => { const e = items[Math.floor(Math.random() * items.length)]; toast(S[2] === 'eat' ? e + ' Yum! You ate it right there. (It was free — the shopkeeper likes you!)' : e + ' Thanks for shopping! (It’s a gift — free!)'); } });
    // shelves full of stuff, or the special things this shop has
    const shelves = (x, z, ry) => { const s = new THREE.Group(); s.add(box(2.6, 2.1, .5, std(0x6b4a30, .6), 0, 1.05, 0)); for (let lv = 0; lv < 3; lv++) { s.add(box(2.5, .05, .55, std(0xe8e2d6, .5), 0, .45 + lv * .62, .02)); for (let k = 0; k < 4; k++) { const e = emoji(items[(lv * 4 + k) % items.length], .38); e.position.set(-.9 + k * .6, .7 + lv * .62, .2); s.add(e); } } add(s, x, z, ry, 2.6, .55); };
    if (S[2] === 'eat') { for (const [x, z] of [[-4, -1.5], [-4, 1.8], [-1, 1.8], [-1, -1.5]]) { add(table(1, 1, .76, '#5a3c26'), x, z, 0, 1, 1); [-1, 1].forEach(s => add(box(.4, .5, .4, std(0xc0392b, .6), 0, .25, 0), x + s * .8, z, 0, .4, .4)); const e = emoji(items[Math.floor(R() * items.length)], .4); e.position.set(x, 1.0, z); group.add(e); }
      bot(-4.8, 1.8, Math.PI / 2, robotName(R), 'eating 😋', 'This is the best ' + (data.sign || '').toLowerCase() + ' in town!');
      shelves(-w / 2 + .3, -3.6, Math.PI / 2); }
    else if (S[2] === 'books') { [[-5.5, -4.6, 0], [-2.8, -4.6, 0], [-w / 2 + .3, -1, Math.PI / 2], [-w / 2 + .3, 1.8, Math.PI / 2]].forEach(([x, z, ry]) => add(shelf(2.4, 2.4), x, z, ry, 2.4, .5)); add(sofa(0x7a4a3a, 2), -2, 2, Math.PI, 2.2, 1); add(rug(3, 2, '#3b5a7a'), -2, 1); bot(-2, 1.3, Math.PI, robotName(R), 'reading 📖', 'Shh… I’m at the best part!'); }
    else if (S[2] === 'arcade') { for (let k = 0; k < 5; k++) { const m = new THREE.Group(); m.add(box(.9, 1.9, .8, std([0x8a2be2, 0x1f6fd1, 0xd8452f, 0x2fae6a, 0xff8a2a][k], .5), 0, .95, 0)); const scr = new THREE.Mesh(new THREE.PlaneGeometry(.7, .55), new THREE.MeshBasicMaterial({ color: 0x2a6fb0 })); scr.position.set(0, 1.45, .41); m.add(scr); anim.push(tt => scr.material.color.setHSL((tt * .3 + k * .2) % 1, .7, .5)); add(m, -5.5 + k * 1.4, -4.2, 0, .9, .8); }
      bot(-4.1, -3.1, Math.PI, robotName(R), 'going for the high score 🕹️', 'Don’t talk to me — I’m on level 87!'); }
    else if (S[2] === 'gym') { for (let k = 0; k < 3; k++) { const tm = new THREE.Group(); tm.add(box(.9, .2, 2, std(0x222222, .6), 0, .1, 0)); tm.add(box(.9, 1.2, .1, std(0x333333, .5, .5), 0, .8, -.95)); add(tm, -5 + k * 2, -2.5, Math.PI, .9, 2); }
      const runner = bot(-5, -2.5, Math.PI, robotName(R), 'running 🏃', '20 more minutes! Beep beep!'); anim.push(() => runner.speedBlend(1.6));
      const bar = new THREE.Group(); bar.add(box(1.8, .06, .06, std(0x888888, .3, .8), 0, 1.1, 0)); [-1, 1].forEach(s => { const pl = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .1, 16), std(0x222222, .5)); pl.rotation.z = Math.PI / 2; pl.position.set(s * .8, 1.1, 0); bar.add(pl); }); add(bar, -2, 2, 0, 1.8, .6); }
    else if (S[2] === 'bank') { const v = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, .3, 24), std(0x9aa3ad, .3, .9)); v.rotation.x = Math.PI / 2; v.position.set(-3.5, 1.4, -d / 2 + .2); group.add(v); const wh = new THREE.Mesh(new THREE.TorusGeometry(.5, .06, 8, 20), std(0xd8b04a, .3, .9)); wh.position.set(-3.5, 1.4, -d / 2 + .4); group.add(wh); anim.push(tt => wh.rotation.z = tt * .3);
      for (let k = 0; k < 6; k++) { const c = emoji('💰', .5); c.position.set(-5.5 + (k % 3) * .6, .3, -3 + Math.floor(k / 3) * .6); group.add(c); } cols.push({ x1: -6, x2: -4.6, z1: -3.4, z2: -2.2 }); }
    else if (S[2] === 'hotel') { add(sofa(0x7a4a3a, 2.4), -4, 1.5, Math.PI / 2, 1, 2.6); add(rug(4, 3, '#6b2a3c'), -2, 1); const ch = chandelier(1); ch.position.set(-2, H - .2, 0); group.add(ch); add(plant(1.4), -w / 2 + .6, -d / 2 + .6, 0, .5, .5); }
    else { shelves(-4.6, -4.4, 0); shelves(-1.6, -4.4, 0); shelves(-w / 2 + .3, -.6, Math.PI / 2); shelves(-2.8, 1.4, 0); }
    if (S[2] !== 'eat' && S[2] !== 'books' && S[2] !== 'arcade' && S[2] !== 'gym') bot(-3, 0, 0, robotName(R), 'shopping 🛍️', 'I come here every day!', [[-3, 0], [-5, 0.2], [-5, 2.8], [-.5, 2.8]]);
    add(plant(1.2), w / 2 - .6, d / 2 - .8, 0, .5, .5);
    acts.push({ pos: new THREE.Vector3(0, 0, d / 2 - 1), r: 1.6, label: 'Go back outside', sub: data.name || data.sign, fn: () => G.backToTown() });
    place(new THREE.Vector3(0, 0, d / 2 - 2), Math.PI);
  }

  /* ======================= a tower ======================= */
  const FLOORS = Math.max(4, Math.min(60, data.floors || 12));
  function floorType(f) {
    if (f === FLOORS) return 'penthouse';
    const rr = rng((data.seed || 1) * 17 + f)();
    if (data.real === false) return ['arcade', 'pool', 'trampolines', 'cinema', 'garden', 'cafe', 'gym', 'ballpit'][Math.floor(rr * 8)];
    return f < FLOORS * .55 ? (rr < .7 ? 'offices' : rr < .85 ? 'cafe' : 'gym') : (rr < .75 ? 'apartment' : rr < .9 ? 'garden' : 'pool');
  }
  const NAMES = { offices: '💼 Offices', apartment: '🏠 Apartment', penthouse: '👑 Penthouse', cafe: '☕ Cafe', gym: '🏋️ Gym', arcade: '🕹️ Arcade', pool: '🏊 Pool', trampolines: '🤸 Trampolines', cinema: '🎬 Movie theater', garden: '🌳 Sky garden', ballpit: '🟡 Ball pit' };
  function elevatorDoors(x, z, ry) {
    const g = new THREE.Group(); g.add(box(2.4, 2.8, .12, std(0x9aa3ad, .3, .8), 0, 1.4, 0)); g.add(box(.04, 2.5, .14, std(0x333333, .5), 0, 1.3, 0)); [-1, 1].forEach(s => g.add(box(1.1, 2.5, .05, std(0xc9ccd1, .25, .9), s * .57, 1.3, .07)));
    const up = emoji('🛗', .45); up.position.set(1.6, 1.3, .2); g.add(up); g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
  }
  function elevatorAct(x, z, here) {
    acts.push({ pos: new THREE.Vector3(x, 0, z), r: 1.8, label: '🛗 Take the elevator', sub: 'You’re on ' + (here === 0 ? 'the lobby' : here === 'roof' ? 'the roof' : 'floor ' + here) + ' · ' + FLOORS + ' floors', fn: () => openPanel('🛗 ' + (data.name || 'Elevator'), body => {
      body.appendChild(el('p', { style: 'color:var(--muted);font-weight:700;margin:0 0 12px' }, 'Which floor? Tap a button.'));
      const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px' });
      const btn = (label, sub, fn, on) => { const b = el('button', { class: 'btn ' + (on ? 'ghost' : 'primary'), style: 'flex-direction:column;align-items:flex-start;padding:10px 14px;height:auto' }, '<b>' + label + '</b><small style="opacity:.8;font-weight:700">' + sub + '</small>'); b.onclick = () => { closePanel(); if (!on) move(fn); }; grid.appendChild(b); };
      btn('Lobby', 'The way out', () => goLobby(true), here === 0);
      for (let f = 1; f <= FLOORS; f++) btn('Floor ' + f, NAMES[floorType(f)], () => goFloor(f), here === f);
      btn('⬆️ Roof', 'The view from the top!', goRoof, here === 'roof');
      body.appendChild(grid);
    }) });
  }
  function goLobby(fromElevator) {
    clear(); const w = 16, d = 12; H = 4.2;
    shell(group, cols, { w, d, h: H, wall: '#ece6da', floor: ['tiles', ['#f2efe8', '#c9c2b4', 8, 407]] });
    door(group, 0, d / 2 - .05, Math.PI, 0x2a2a30);
    sign((data.name || 'TOWER').toUpperCase(), 5, -3.5, 3.4, -d / 2 + .06);
    elevatorDoors(3.5, -d / 2 + .1, 0); elevatorDoors(6.2, -d / 2 + .1, 0);
    const desk = new THREE.Group(); desk.add(box(3.2, 1.1, .8, std(0x2a2d33, .3, .4), 0, .55, 0)); desk.add(box(3.3, .06, .9, std(0xe8e2d6, .3), 0, 1.12, 0)); add(desk, -3.5, -2.4, 0, 3.3, .9);
    bot(-3.5, -3.4, 0, data.owner || robotName(R), 'the front desk 🛎️', 'Welcome to ' + (data.name || 'the tower') + '! It has ' + FLOORS + ' floors. Take the elevator — and don’t miss the roof!', null, 0xe0b04a);
    add(sofa(0x56606e, 2.4), -6, 2.5, Math.PI / 2, 1, 2.6); add(plant(1.5), w / 2 - .7, d / 2 - .8, 0, .5, .5); add(plant(1.5), -w / 2 + .7, d / 2 - .8, 0, .5, .5); add(rug(5, 3, '#3a4a6a'), 0, 1.5);
    bot(2, 2, 0, robotName(R), 'waiting for the elevator', 'I work on floor ' + (2 + Math.floor(R() * (FLOORS - 1))) + '. The view is amazing!', [[2, 2], [4.8, -3.4], [-1, 1]]);
    elevatorAct(4.8, -d / 2 + 1.4, 0);
    acts.push({ pos: new THREE.Vector3(0, 0, d / 2 - 1), r: 1.6, label: 'Go back outside', sub: data.name, fn: () => G.backToTown() });
    place(fromElevator ? new THREE.Vector3(4.8, 0, -d / 2 + 2) : new THREE.Vector3(0, 0, d / 2 - 2), fromElevator ? 0 : Math.PI);
  }
  /** a floor of the tower: a big room with windows showing the view, the elevator at the back */
  function goFloor(f) {
    clear(); const type = floorType(f), r = rng((data.seed || 1) * 31 + f);
    if (type === 'apartment' || type === 'penthouse') {
      const name = robotName(r), acts2 = ['cooking', 'tv', 'painting', 'guitar', 'reading', 'dancing', 'gaming', 'plants'], a = acts2[Math.floor(r() * acts2.length)];
      const home = robotHome(ctx, null, name, a, r); H = 3.2;
      if (type === 'penthouse') { const ch = chandelier(1.1); ch.position.set(0, H - .2, 0); group.add(ch); }
      elevatorDoors(0, 4 - .05, Math.PI); acts.push(home.say); elevatorAct(0, 3, f);
      place(new THREE.Vector3(0, 0, 2.2), Math.PI); toast('🛗 Floor ' + f + ' — ' + (type === 'penthouse' ? 'the penthouse! ' : '') + name + '’s apartment'); return;
    }
    const w = 20, d = 14; H = 3.6;
    shell(group, cols, { w, d, h: H, window: false, wall: '#eef0f2', floor: type === 'garden' ? ['grass', []] : type === 'offices' ? ['carpet', ['#4a5a6a', 12]] : ['tiles', ['#efe9dd', '#9aa3ad', 8, 408]] });
    // windows on three walls with the city view
    const vt = viewTex(f, (data.seed || 1) + f);
    [[0, -d / 2 + .04, 0, w - 1], [-w / 2 + .04, 0, Math.PI / 2, d - 1], [w / 2 - .04, 0, -Math.PI / 2, d - 1]].forEach(([x, z, ry, len]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.2), new THREE.MeshBasicMaterial({ map: vt })); p.position.set(x, 1.65, z); p.rotation.y = ry; group.add(p); });
    elevatorDoors(0, d / 2 - .05, Math.PI); elevatorAct(0, d / 2 - 1.4, f);
    sign('FLOOR ' + f + ' · ' + NAMES[type].replace(/^\S+ /, '').toUpperCase(), 4, -4, 3.1, d / 2 - .06, Math.PI);
    const B = (x, z, face, job, say, path) => bot(x, z, face, robotName(r), job, say, path);
    if (type === 'offices') {
      for (let row = 0; row < 3; row++) for (let c = 0; c < 4; c++) { const x = -7 + c * 4.2, z = -4.5 + row * 3.2, dk = new THREE.Group(); dk.add(box(1.8, .06, .9, std(0xe8e2d6, .4), 0, .76, 0)); dk.add(box(.06, .76, .8, std(0x555555, .5, .5), -.85, .38, 0)); dk.add(box(.06, .76, .8, std(0x555555, .5, .5), .85, .38, 0)); const scr = new THREE.Mesh(new THREE.PlaneGeometry(.6, .38), new THREE.MeshBasicMaterial({ color: 0x3aa0ff })); scr.position.set(0, 1.05, -.25); dk.add(scr); dk.add(box(.65, .42, .04, std(0x111111, .4), 0, 1.05, -.28)); add(dk, x, z, 0, 1.8, .9); }
      for (let k = 0; k < 4; k++) { const x = -7 + Math.floor(r() * 4) * 4.2, z = -4.5 + k % 3 * 3.2 + .8; B(x, z, Math.PI, WORK[Math.floor(r() * WORK.length)], ['I’m making a chart about robot snacks. Very important!', 'My boss is a toaster. Just kidding!', 'Want to see my spreadsheet? It has 1,000 rows!', 'Lunch break in 5 minutes!'][k]); }
      const wc = new THREE.Group(); wc.add(box(.4, 1, .4, std(0xf2f2f2, .4), 0, .5, 0)); wc.add(new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .45, 14), std(0x7fc4ff, .1, .1))); wc.children[1].position.y = 1.22; add(wc, 8.5, 4.5, 0, .4, .4);
    } else if (type === 'cafe') {
      for (const [x, z] of [[-6, -3], [-2, -3], [2, -3], [6, -3], [-6, 1], [-2, 1], [2, 1]]) add(table(1, 1, .76, '#5a3c26'), x, z, 0, 1, 1);
      const ct = new THREE.Group(); ct.add(box(4, 1.05, .8, std(0x6b4a30, .6), 0, .52, 0)); add(ct, 6, 2.5, 0, 4, .8);
      B(6, 3.4, Math.PI, 'making coffee ☕', 'Hot cocoa or a smoothie?'); B(-6, 1.8, Math.PI, 'having lunch 🥪', 'The sandwiches here are the best!');
    } else if (type === 'gym') {
      for (let k = 0; k < 4; k++) { const tm = new THREE.Group(); tm.add(box(.9, .2, 2, std(0x222222, .6), 0, .1, 0)); tm.add(box(.9, 1.2, .1, std(0x333333, .5, .5), 0, .8, -.95)); add(tm, -6 + k * 2.4, -4, Math.PI, .9, 2); }
      const rn = B(-6, -4, Math.PI, 'running 🏃', 'Can’t stop, won’t stop!'); anim.push(() => rn.speedBlend(1.6)); add(rug(6, 4, '#3a6a4a'), 3, 1); B(3, 1, 0, 'doing yoga 🧘', 'Breathe in… breathe out…');
    } else if (type === 'arcade') {
      for (let k = 0; k < 8; k++) { const m = new THREE.Group(); m.add(box(.9, 1.9, .8, std([0x8a2be2, 0x1f6fd1, 0xd8452f, 0x2fae6a][k % 4], .5), 0, .95, 0)); const scr = new THREE.Mesh(new THREE.PlaneGeometry(.7, .55), new THREE.MeshBasicMaterial({ color: 0x2a6fb0 })); scr.position.set(0, 1.45, .41); m.add(scr); anim.push(tt => scr.material.color.setHSL((tt * .4 + k * .13) % 1, .7, .5)); add(m, -8 + k * 2.2, -5.6, 0, .9, .8); }
      B(-3.6, -4.4, Math.PI, 'playing a racing game 🏎️', 'Vroom vroom! I’m in first place!'); B(2.2, -4.4, Math.PI, 'playing pinball', 'Ding ding ding!');
    } else if (type === 'pool') {
      const pool = new THREE.Mesh(new THREE.BoxGeometry(12, .1, 6), std(0x2fa8e0, .05, .2)); pool.position.set(0, .05, -2); group.add(pool); cols.push({ x1: -6, x2: 6, z1: -5, z2: 1 });
      const sw = B(-2, -2, 0, 'swimming 🏊', 'The water is perfect!'); anim.push(tt => { sw.root.position.x = Math.sin(tt * .5) * 4; sw.root.position.y = -.9; sw.root.rotation.y = Math.cos(tt * .5) > 0 ? Math.PI / 2 : -Math.PI / 2; });
      for (let k = 0; k < 4; k++) add(box(.7, .3, 1.8, std(0xffffff, .5), 0, .3, 0), -6 + k * 4, 3.5, 0, .7, 1.8);
      B(-6, 2.6, 0, 'sunbathing 😎', 'Ahh, this is the life.');
    } else if (type === 'trampolines') {
      for (let k = 0; k < 6; k++) { const x = -6 + (k % 3) * 6, z = -3 + Math.floor(k / 3) * 5; const tr = new THREE.Mesh(new THREE.BoxGeometry(4, .2, 3.6), std([0x2f6fd8, 0xd8452f, 0x2fae6a, 0xffd34d, 0x8a5ad8, 0xff8a2a][k], .6)); tr.position.set(x, .3, z); group.add(tr); }
      for (let k = 0; k < 3; k++) { const b = B(-6 + k * 6, -3, 0, 'bouncing 🤸', 'Boing! Boing! Higher!'); anim.push(tt => { b.root.position.y = .4 + Math.abs(Math.sin(tt * 3 + k)) * 1.6; }); }
    } else if (type === 'cinema') {
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshBasicMaterial({ color: 0x3a6fb0 })); scr.position.set(0, 2.2, -d / 2 + .1); group.add(scr); anim.push(tt => scr.material.color.setHSL((tt * .05) % 1, .5, .45));
      for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) add(box(.8, .9, .8, std(0x8a1f2a, .7), 0, .45, 0), -6 + k * 2, -1 + row * 2, 0, .8, .8);
      B(-2, 1.6, Math.PI, 'watching a movie 🍿', 'Shhh! This is the best part!');
    } else if (type === 'garden') {
      for (let k = 0; k < 10; k++) add(plant(1.2 + r()), -8 + r() * 16, -5 + r() * 9, 0, .5, .5);
      add(sofa(0x6a8a4a, 2.2), 0, 0, 0, 2.4, 1); B(4, -2, 0, 'watering plants 🪴', 'A garden in the sky! The plants love the sunshine up here.');
    } else if (type === 'ballpit') {
      const cs = [0xff4a4a, 0xffd34d, 0x4a9aff, 0x4ad66a, 0xff8fc0], g2 = new THREE.SphereGeometry(.18, 8, 6);
      for (let k = 0; k < 400; k++) { const b = new THREE.Mesh(g2, std(cs[k % 5], .5)); b.position.set(-5 + Math.random() * 10, .18 + Math.random() * .5, -5 + Math.random() * 6); group.add(b); }
      B(0, -2, 0, 'swimming in balls 🟡', 'I lost my shoe in here somewhere!');
    }
    place(new THREE.Vector3(0, 0, d / 2 - 2.4), Math.PI);
    toast('🛗 Floor ' + f + ' — ' + NAMES[type]);
  }
  function goRoof() {
    clear(); roof = true; H = 30;
    scene.background = new THREE.Color(0x8fc4ff);
    const w = 18, d = 16;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, .4, d), mat('concrete', ['#b9b6ae', 160], w / 4, d / 4, { roughness: .9 })); deck.position.y = -.2; deck.receiveShadow = true; group.add(deck);
    [[w, 0, -d / 2, 0], [w, 0, d / 2, 0], [d, -w / 2, 0, Math.PI / 2], [d, w / 2, 0, Math.PI / 2]].forEach(([len, x, z, ry]) => { const rl = box(len, .08, .08, std(0xd8d8d8, .3, .8), x, 1.05, z); rl.rotation.y = ry; group.add(rl); for (let k = -len / 2; k <= len / 2; k += 1.5) { const p = box(.06, 1.05, .06, std(0xd8d8d8, .3, .8), 0, .52, 0); p.position.set(x + (ry ? 0 : k), .52, z + (ry ? k : 0)); group.add(p); } });
    cols.push({ x1: -w / 2 - 1, x2: w / 2 + 1, z1: -d / 2 - 1, z2: -d / 2 }, { x1: -w / 2 - 1, x2: w / 2 + 1, z1: d / 2, z2: d / 2 + 1 }, { x1: -w / 2 - 1, x2: -w / 2, z1: -d / 2, z2: d / 2 }, { x1: w / 2, x2: w / 2 + 1, z1: -d / 2, z2: d / 2 });
    // helipad
    const hp = new THREE.Mesh(new THREE.CircleGeometry(4, 32), std(0x3a3d44, .8)); hp.rotation.x = -Math.PI / 2; hp.position.set(-3, .02, -2); group.add(hp);
    const H2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: signTexture('H', { bg: null, fg: '#ffd34d', font: '800 220px Arial', w: 256, h: 256 }), transparent: true })); H2.rotation.x = -Math.PI / 2; H2.position.set(-3, .03, -2); group.add(H2);
    // the city far below
    const city = new THREE.Group(), cr = rng((data.seed || 1) + 99), below = -FLOORS * 3.4;
    for (let k = 0; k < 160; k++) { const a = cr() * Math.PI * 2, dist = 40 + cr() * 260, h = 6 + cr() * Math.max(8, -below * .8 - 6); const b = new THREE.Mesh(new THREE.BoxGeometry(10 + cr() * 14, h, 10 + cr() * 14), std([0x8796a8, 0x6d7f93, 0xb8b0a0, 0x9aa8b8][Math.floor(cr() * 4)], .8)); b.position.set(Math.cos(a) * dist, below + h / 2, Math.sin(a) * dist); city.add(b); }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), std(0x4f8f3a, 1)); ground.rotation.x = -Math.PI / 2; ground.position.y = below; city.add(ground); group.add(city);
    scene.fog = new THREE.Fog(0x8fc4ff, 120, 420);
    const sh = new THREE.Group(); sh.add(box(2.6, 2.9, 2.2, std(0xd8d8d8, .6), 0, 1.45, 0)); add(sh, 6, 5.5, 0, 2.6, 2.2); elevatorDoors(6, 4.35, Math.PI);
    elevatorAct(6, 3.4, 'roof');
    bot(2, 2, 0, robotName(R), 'enjoying the view 🌇', 'You can see the whole city from up here! ' + FLOORS + ' floors up!');
    place(new THREE.Vector3(2.5, 0, 3), Math.PI); toast('⬆️ The roof of ' + (data.name || 'the tower') + ' — ' + FLOORS + ' floors up!');
  }

  if (data.kind === 'tower') goLobby(); else goShop();
  return {
    scene, walks: true, title: data.name || data.sign, cam: { dist: 4.6, pitch: .42 },
    get colliders() { return cols; }, get camBlockers() { return roof ? [] : cols.slice(0, 4); },
    help: data.kind === 'tower' ? 'Take the elevator to any floor — or all the way to the roof!' : 'Look around and say hi to the shopkeeper',
    start: player.root.position.clone(), startYaw: player.root.rotation.y, camYaw: player.root.rotation.y + Math.PI,
    camClamp(p) { if (!roof) p.y = Math.min(p.y, H - .3); },
    interact: () => acts,
    update(dt) { t += dt; anim.forEach(f => f(t, dt)); },
    exit() { scene.fog = null; }
  };
}
