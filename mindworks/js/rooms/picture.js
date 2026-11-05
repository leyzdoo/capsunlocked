// Picture Puzzles — a big screen on the gallery wall; tap the piece that fits.
import * as THREE from 'three';
import { G, save, toast, levelComplete, levelFailed, bigScreen, roundRect } from '../game.js';
import { Scenes, rng, ri, pick, shuffle, clamp } from '../logic.js';
import { makeRoom, plant, painting, box, std, at } from './common.js';

function off(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export async function enter({ level, camera, makeCharacter }) {
  const R = makeRoom({ w: 16, d: 13, h: 6.4, floor: ['wood', ['#6b4a30', 8, 101]], wall: '#2d2a33', trim: '#1b1a20', lamps: 4, doorColor: 0x5a2a16, windows: false });
  const S = R.scene;
  // gallery feel: paintings on the side walls, benches
  [-1, 1].forEach(s => { for (let i = 0; i < 2; i++) { const c = off(360, 240); Scenes.paint(c.getContext('2d'), 360, 240, Scenes.keys()[(i * 3 + (s > 0 ? 5 : 1)) % Scenes.keys().length], 11 + i, 'day'); const p = painting(1.8, 1.2, c); p.position.set(s * 7.94, 2.3, -2 + i * 4); p.rotation.y = -s * Math.PI / 2; S.add(p);
    const spot = new THREE.SpotLight(0xfff1dc, 18, 8, .5, .6, 1.5); spot.position.set(s * 6, 6.0, -2 + i * 4); spot.target.position.set(s * 8, 2.3, -2 + i * 4); S.add(spot, spot.target); } });
  [[-4.5, 3.5], [4.5, 3.5]].forEach(([x, z]) => { S.add(box(2.2, .45, .6, std(0x1b1a20, .4, .4), x, .22, z)); });
  S.add(at(plant(1.3), -7.2, 0, -5.6)); S.add(at(plant(1.3), 7.2, 0, -5.6));
  // the big screen
  const PX = 1600, PY = 900, scr = bigScreen(9.6, 5.4, PX, PY);
  scr.group.position.set(0, 3.2, -6.35); S.add(scr.group);
  const fill = new THREE.PointLight(0xbfd4ff, 4, 10, 1.6); fill.position.set(0, 2.6, -4.5); S.add(fill);
  // you, standing in front of the screen
  const me = makeCharacter('player', new THREE.Color(G.S.data.color).getHex()); me.root.position.set(-4.3, 0, -2.2); me.root.rotation.y = Math.PI + .5; S.add(me.root);
  camera.position.set(0, 3.3, 5.4); camera.lookAt(0, 3.0, -6); camera.fov = 52; camera.updateProjectionMatrix();

  /* ---- build the puzzle (same rules as before, drawn on the screen) ---- */
  const r = rng(level * 104729 + (Date.now() % 1000003));
  const W = 1000, H = 680;
  const keys = Scenes.keys(), key = keys[(level - 1 + ri(r, 0, keys.length - 1)) % keys.length];
  const tod = pick(r, Scenes.LIST[key].tods), src = off(W, H); Scenes.paint(src.getContext('2d'), W, H, key, ri(r, 1, 1e9), tod);
  const frac = clamp(.27 - (level - 1) * .006, .15, .27), ps = Math.round(Math.min(W, H) * frac * 1.25), m = Math.ceil(ps * .28);
  const hx = ri(r, m + 4, W - ps - m - 4), hy = ri(r, m + 4, H - ps - m - 4);
  const edges = [0, 0, 0, 0].map(() => r() < .5 ? 1 : -1);
  function cutAt(cvs, x, y, mir) {
    const p = off(ps + 2 * m, ps + 2 * m), c = p.getContext('2d');
    c.save(); Scenes.piecePath(c, m, m, ps, ps, edges); c.clip();
    if (mir) { c.translate(ps + 2 * m, 0); c.scale(-1, 1); }
    c.drawImage(cvs, x - m, y - m, ps + 2 * m, ps + 2 * m, 0, 0, ps + 2 * m, ps + 2 * m); c.restore();
    c.save(); Scenes.piecePath(c, m, m, ps, ps, edges); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3; c.stroke(); c.restore();
    return p;
  }
  function spot(minD, maxD) {
    for (let t = 0; t < 200; t++) { const a = r() * Math.PI * 2, dist = ps * (minD + r() * (maxD - minD)); const x = Math.round(hx + Math.cos(a) * dist), y = Math.round(hy + Math.sin(a) * dist); if (x >= m && y >= m && x <= W - ps - m && y <= H - ps - m) return [x, y]; }
    return [ri(r, m, W - ps - m), ri(r, m, H - ps - m)];
  }
  const choices = [{ cv: cutAt(src, hx, hy), ok: true }];
  if (level <= 4) for (let i = 0; i < 3; i++) { const other = pick(r, keys.filter(k => k !== key)), o = off(W, H); Scenes.paint(o.getContext('2d'), W, H, other, ri(r, 1, 1e9), pick(r, Scenes.LIST[other].tods)); choices.push({ cv: cutAt(o, ri(r, m, W - ps - m), ri(r, m, H - ps - m)) }); }
  else if (level <= 9) for (let i = 0; i < 3; i++) { const s1 = spot(1.6, 4); choices.push({ cv: cutAt(src, s1[0], s1[1]) }); }
  else if (level <= 16) for (let i = 0; i < 3; i++) { const s2 = spot(.65, 1.4); choices.push({ cv: cutAt(src, s2[0], s2[1]) }); }
  else { choices.push({ cv: cutAt(src, hx, hy, true) }); const s3 = spot(.3, .5); choices.push({ cv: cutAt(src, s3[0], s3[1]) }); const s4 = spot(.55, 1); choices.push({ cv: cutAt(src, s4[0], s4[1], level > 22) }); }
  shuffle(r, choices);
  // layout on the screen
  const PIC = { x: 40, y: 150, w: W, h: H }, CS = 240;
  choices.forEach((ch, i) => { ch.rect = { x: 1080 + (i % 2) * (CS + 24), y: 170 + Math.floor(i / 2) * (CS + 60), w: CS, h: CS }; ch.state = ''; });
  let tries = 2, done = false, filled = false, hover = -1;
  function draw() {
    const c = scr.ctx;
    const bg = c.createLinearGradient(0, 0, 0, PY); bg.addColorStop(0, '#1b1846'); bg.addColorStop(1, '#2b1f3a'); c.fillStyle = bg; c.fillRect(0, 0, PX, PY);
    c.fillStyle = '#fff'; c.font = '600 58px Fredoka, Arial'; c.textAlign = 'left'; c.fillText('Which piece fits?', 40, 92);
    c.font = '700 34px Nunito, Arial'; c.fillStyle = '#ffd7bd'; c.textAlign = 'right'; c.fillText('Level ' + level + '  ·  ' + tries + (tries === 1 ? ' try' : ' tries') + ' left', PX - 40, 90);
    c.drawImage(src, PIC.x, PIC.y, PIC.w, PIC.h);
    c.save(); c.translate(PIC.x, PIC.y);
    Scenes.piecePath(c, hx, hy, ps, ps, edges);
    if (!filled) { c.fillStyle = '#14122e'; c.fill(); c.setLineDash([10, 8]); c.strokeStyle = '#ff8a5b'; c.lineWidth = 5; c.stroke(); c.setLineDash([]); c.fillStyle = '#ff8a5b'; c.font = '600 ' + Math.round(ps * .45) + 'px Fredoka, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', hx + ps / 2, hy + ps / 2 + 4); c.textBaseline = 'alphabetic'; }
    else { c.strokeStyle = '#4be08a'; c.lineWidth = 7; c.stroke(); }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 4; c.strokeRect(PIC.x, PIC.y, PIC.w, PIC.h);
    choices.forEach((ch, i) => {
      const q = ch.rect;
      c.fillStyle = ch.state === 'wrong' ? 'rgba(255,93,115,.18)' : i === hover ? '#4a4590' : '#332f75'; roundRect(c, q.x, q.y, q.w, q.h, 26); c.fill();
      c.lineWidth = 8; c.strokeStyle = ch.state === 'right' ? '#4be08a' : ch.state === 'wrong' ? '#ff5d73' : 'rgba(255,255,255,.15)'; c.stroke();
      c.globalAlpha = ch.state === 'wrong' ? .35 : 1; c.drawImage(ch.cv, q.x + 14, q.y + 14, q.w - 28, q.h - 28); c.globalAlpha = 1;
      c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '700 30px Nunito'; c.textAlign = 'left'; c.fillText(String(i + 1), q.x + 18, q.y + 42);
    });
    scr.update();
  }
  function pickChoice(i) {
    const ch = choices[i]; if (done || !ch || ch.state === 'wrong') return;
    if (ch.ok) { done = true; ch.state = 'right'; filled = true; draw(); me.play('agree'); setTimeout(() => levelComplete('picture', level, tries === 2 ? 'First try!' : ''), 900); }
    else {
      ch.state = 'wrong'; tries--; me.play('headShake');
      if (tries <= 0) { done = true; choices.forEach(c => { if (c.ok) c.state = 'right'; }); draw(); setTimeout(() => levelFailed('picture', level, 'The green one was the missing piece.'), 1000); }
      else draw();
    }
  }
  function hint() {
    if (done) return; const u = G.S.data.up;
    if (u.picHints <= 0) { toast('Get 50/50 hints at the Game Store.'); return; }
    const wrong = choices.filter(c => !c.ok && c.state !== 'wrong'); if (wrong.length < 2) { toast('Already narrowed down!'); return; }
    u.picHints--; save(); document.getElementById('picHint').textContent = '💡 50/50 (' + u.picHints + ')';
    wrong.slice(0, 2).forEach(c => { c.state = 'wrong'; }); draw();
  }
  const hit = (e) => { const p = scr.uvAt(e, camera); if (!p) return -1; return choices.findIndex(ch => p.x >= ch.rect.x && p.x <= ch.rect.x + ch.rect.w && p.y >= ch.rect.y && p.y <= ch.rect.y + ch.rect.h); };
  draw();
  return {
    _dbg: () => ({ ok: choices.findIndex(c => c.ok), rects: choices.map(c => c.rect) }), _scr: scr,
    scene: S, camera, title: 'Picture Puzzles · Level ' + level, help: 'Tap the piece on the big screen that fits the hole',
    buttons: [{ label: '💡 50/50 (' + G.S.data.up.picHints + ')', fn: hint, id: 'picHint' }],
    pointer: {
      down(e) { const i = hit(e); if (i >= 0) { pickChoice(i); return true; } return false; },
      hover(e) { const i = hit(e); if (i !== hover) { hover = i; draw(); } }
    },
    key(e) { const n = parseInt(e.key, 10); if (n >= 1 && n <= 4) pickChoice(n - 1); },
    update(dt) { me.speedBlend(0); me.update(dt); },
    exit() {}
  };
}
