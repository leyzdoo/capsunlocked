// Jigsaw — describe a puzzle, then build it on the giant screen: pieces on the left, the board on the right.
import * as THREE from 'three';
import { G, el, save, modal, openPanel, closePanel, bigScreen, roundRect, setHelp, jigsawUnlocked } from '../game.js';
import { Scenes, JigsawMatch, rng, ri, shuffle, clamp } from '../logic.js';
import { makeRoom, box, std, plant, at } from './common.js';

const SIZES = [[4, 3, 'Easy · 12'], [6, 4, 'Medium · 24'], [8, 6, 'Hard · 48'], [12, 8, 'Expert · 96']];
function off(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export async function enter({ camera, makeCharacter }) {
  const R = makeRoom({ w: 18, d: 13, h: 6.8, floor: ['wood', ['#7a5a40', 8, 141]], wall: '#2c2230', trim: '#1b1420', lamps: 4, doorColor: 0x4a1028, windows: false });
  const S = R.scene;
  const PX = 2000, PY = 1000, scr = bigScreen(11, 5.5, PX, PY);
  scr.group.position.set(0, 3.35, -6.35); S.add(scr.group);
  S.add(at(plant(1.4), -8, 0, -5.4), at(plant(1.4), 8, 0, -5.4));
  [-1, 1].forEach(s => S.add(box(2.4, .45, .7, std(0x3b0f22, .6), s * 4, .22, 3.5)));
  const me = makeCharacter('player', new THREE.Color(G.S.data.color).getHex()); me.root.position.set(-5.6, 0, -2.6); me.root.rotation.y = Math.PI + .5; S.add(me.root);
  camera.position.set(0, 3.4, 6.2); camera.lookAt(0, 3.25, -6); camera.fov = 52; camera.updateProjectionMatrix();

  let puzzle = null, drag = null;
  function idle(msg) {
    const c = scr.ctx; const g = c.createLinearGradient(0, 0, PX, PY); g.addColorStop(0, '#2a0f24'); g.addColorStop(1, '#1b1846'); c.fillStyle = g; c.fillRect(0, 0, PX, PY);
    c.fillStyle = '#ffd0e4'; c.font = '600 110px Fredoka, Arial'; c.textAlign = 'center'; c.fillText('🧩 Jigsaw', PX / 2, 400);
    c.fillStyle = '#ffffffcc'; c.font = '700 54px Nunito'; c.fillText(msg || 'Tap the screen to describe your puzzle', PX / 2, 520);
    if (G.S.data.jigsaws.length) { c.font = '600 36px Nunito'; c.fillStyle = '#ffffff88'; c.fillText('Finished so far: ' + G.S.data.jigsaws.slice(-5).map(j => j.name).join(', '), PX / 2, 640); }
    scr.update();
  }
  function describe() {
    openPanel('Describe your puzzle', body => {
      body.appendChild(el('p', { style: 'color:var(--muted);font-weight:700;margin:0 0 10px' }, 'Type what you’d like to build — a place, a time of day, anything.'));
      const ta = el('textarea', { class: 'desc', placeholder: 'e.g. a rainforest with a waterfall, a desert at night, an empty restaurant…', maxlength: '200' }); body.appendChild(ta);
      const sug = el('div', { class: 'sugs' });
      ['rainforest', 'forest at night', 'desert sunset', 'empty restaurant', 'snowy village', 'under the sea', 'outer space', 'castle'].forEach(w => { const b = el('button', { type: 'button' }, w); b.onclick = () => { ta.value = w; go(); }; sug.appendChild(b); });
      body.appendChild(sug);
      const gob = el('button', { class: 'btn primary', style: 'background:linear-gradient(180deg,#ff8cc0,#e74e95)' }, 'Show me puzzles'); gob.onclick = go; body.appendChild(gob);
      const optsBox = el('div'); body.appendChild(optsBox);
      ta.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      setTimeout(() => ta.focus(), 60);
      function go() {
        const res = JigsawMatch(ta.value); optsBox.innerHTML = '';
        optsBox.appendChild(el('h3', { style: 'margin:18px 0 0' }, res.matched ? 'Pick your puzzle' : 'I don’t have that one yet — here are some ideas'));
        const grid = el('div', { class: 'opts' }); let chosen = null, size = 1;
        res.list.forEach(o => { const card = el('button', { class: 'opt', type: 'button' }); const c = off(240, 160); Scenes.paint(c.getContext('2d'), 240, 160, o.key, o.seed, o.tod); card.appendChild(c); card.appendChild(el('b', null, o.name)); card.onclick = () => { [...grid.children].forEach(x => x.classList.remove('on')); card.classList.add('on'); chosen = o; start.disabled = false; }; grid.appendChild(card); });
        optsBox.appendChild(grid);
        const sizes = el('div', { class: 'sizes' });
        SIZES.forEach((sz, i) => { const b = el('button', { class: 'btn small' + (i === size ? ' on' : ''), type: 'button' }, sz[2] + ' pieces'); b.onclick = () => { size = i; [...sizes.children].forEach(x => x.classList.remove('on')); b.classList.add('on'); }; sizes.appendChild(b); });
        optsBox.appendChild(sizes);
        const start = el('button', { class: 'btn go', disabled: '' }, 'Start puzzle'); start.onclick = () => { closePanel(); build(chosen, SIZES[size]); }; optsBox.appendChild(start);
        setTimeout(() => optsBox.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
      }
    });
  }
  function build(opt, size) {
    const cols = size[0], rows = size[1], BX = 1000, BY = 130, BW = 960, BH = 720;
    const pw = Math.floor(BW / cols), ph = Math.floor(BH / rows), bw = pw * cols, bh = ph * rows;
    const img = off(bw, bh); Scenes.paint(img.getContext('2d'), bw, bh, opt.key, opt.seed, opt.tod);
    const r = rng(opt.seed + cols * 7), H = [], V = [];
    for (let y = 0; y < rows; y++) { H.push([]); V.push([]); for (let x = 0; x < cols; x++) { H[y].push(r() < .5 ? 1 : -1); V[y].push(r() < .5 ? 1 : -1); } }
    const m = Math.ceil(Math.max(pw, ph) * .28), pieces = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const e = [y === 0 ? 0 : -H[y - 1][x], x === cols - 1 ? 0 : V[y][x], y === rows - 1 ? 0 : H[y][x], x === 0 ? 0 : -V[y][x - 1]];
      const cv = off(pw + 2 * m, ph + 2 * m), c = cv.getContext('2d');
      c.save(); Scenes.piecePath(c, m, m, pw, ph, e); c.clip(); c.drawImage(img, x * pw - m, y * ph - m, pw + 2 * m, ph + 2 * m, 0, 0, pw + 2 * m, ph + 2 * m); c.restore();
      c.save(); Scenes.piecePath(c, m, m, pw, ph, e); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2; c.stroke(); c.restore();
      pieces.push({ cv, e, gx: BX + x * pw - m, gy: BY + y * ph - m, x: 0, y: 0, placed: false, edge: e.indexOf(0) >= 0 });
    }
    shuffle(r, pieces).forEach(p => { p.x = ri(r, 20, 960 - pw - 2 * m); p.y = ri(r, 120, PY - ph - 2 * m - 20); });
    puzzle = { opt, pieces, pw, ph, m, BX, BY, bw, bh, img, placed: 0, edgesOnly: false, peek: false };
    draw(); setHelp('Drag the pieces from the left onto the board on the right');
  }
  function draw() {
    const P = puzzle, c = scr.ctx; if (!P) return idle();
    const g = c.createLinearGradient(0, 0, 0, PY); g.addColorStop(0, '#24122a'); g.addColorStop(1, '#14122e'); c.fillStyle = g; c.fillRect(0, 0, PX, PY);
    c.fillStyle = 'rgba(255,255,255,.05)'; roundRect(c, 10, 100, 970, PY - 110, 30); c.fill();
    c.fillStyle = '#ffd0e4'; c.font = '600 46px Fredoka, Arial'; c.textAlign = 'left'; c.fillText(P.opt.name, 30, 70);
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.fillText(P.placed + ' / ' + P.pieces.length, PX - 40, 70);
    // board with faint picture
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(P.BX, P.BY, P.bw, P.bh);
    c.globalAlpha = P.peek ? .45 : .14; c.drawImage(P.img, P.BX, P.BY); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.setLineDash([10, 8]); c.lineWidth = 3; c.strokeRect(P.BX, P.BY, P.bw, P.bh); c.setLineDash([]);
    P.pieces.forEach(p => { if (p.placed) c.drawImage(p.cv, p.gx, p.gy); });
    P.pieces.forEach(p => { if (!p.placed && p !== (drag && drag.p)) { c.globalAlpha = P.edgesOnly && !p.edge ? .25 : 1; c.drawImage(p.cv, p.x, p.y); c.globalAlpha = 1; } });
    if (drag) { c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 24; c.shadowOffsetY = 10; c.drawImage(drag.p.cv, drag.p.x, drag.p.y); c.restore(); }
    scr.update();
  }
  function pieceAt(x, y) {
    const P = puzzle, c = scr.ctx;
    for (let i = P.pieces.length - 1; i >= 0; i--) { const p = P.pieces[i]; if (p.placed) continue; const lx = x - p.x, ly = y - p.y; if (lx < 0 || ly < 0 || lx > P.pw + 2 * P.m || ly > P.ph + 2 * P.m) continue; c.save(); c.translate(p.x, p.y); Scenes.piecePath(c, P.m, P.m, P.pw, P.ph, p.e); const hit = c.isPointInPath(x, y); c.restore(); if (hit) return i; }
    return -1;
  }
  function finish() {
    const P = puzzle; P.peek = false;
    if (jigsawUnlocked()) { G.S.data.jigsaws.push({ name: P.opt.name, scene: P.opt.key, pieces: P.pieces.length, at: new Date().toISOString().slice(0, 10) }); save(true); }
    me.play('agree');
    setTimeout(() => modal({ big: '🧩', title: 'Puzzle complete!', text: P.opt.name + ' · ' + P.pieces.length + ' pieces', acts: [{ label: 'Build another', cls: 'go', fn: () => { puzzle = null; idle(); describe(); } }, { label: 'Go back outside', cls: 'ghost', fn: () => G.backToTown() }] }), 700);
  }
  idle();
  setTimeout(describe, 400);
  return {
    _dbg: () => puzzle && { n: puzzle.pieces.length, placed: puzzle.placed, pieces: puzzle.pieces.map(p => ({ x: p.x, y: p.y, gx: p.gx, gy: p.gy, placed: p.placed, w: p.cv.width, h: p.cv.height })) }, _scr: scr,
    scene: S, camera, title: 'Jigsaw', help: 'Describe your puzzle to begin',
    buttons: [
      { label: '🖼️ New puzzle', fn: describe },
      { label: '👁 Picture', fn: () => { if (puzzle) { puzzle.peek = !puzzle.peek; draw(); } } },
      { label: '▢ Edges first', fn: () => { if (puzzle) { puzzle.edgesOnly = !puzzle.edgesOnly; draw(); } } }
    ],
    pointer: {
      down(e) {
        const p = scr.uvAt(e, camera); if (!p) return false;
        if (!puzzle) { describe(); return true; }
        const i = pieceAt(p.x, p.y); if (i < 0) return true;
        const pc = puzzle.pieces.splice(i, 1)[0]; puzzle.pieces.push(pc);
        drag = { p: pc, dx: p.x - pc.x, dy: p.y - pc.y }; draw(); return true;
      },
      move(e) { if (!drag) return; const p = scr.uvAt(e, camera); if (!p) return; drag.p.x = clamp(p.x - drag.dx, -40, PX - 60); drag.p.y = clamp(p.y - drag.dy, -40, PY - 60); draw(); },
      up() {
        if (!drag) return; const P = puzzle, pc = drag.p; drag = null;
        if (Math.hypot(pc.x - pc.gx, pc.y - pc.gy) < Math.max(P.pw, P.ph) * .35) { pc.placed = true; pc.x = pc.gx; pc.y = pc.gy; P.placed++; if (P.placed === P.pieces.length) { draw(); finish(); return; } }
        draw();
      }
    },
    update(dt) { me.speedBlend(0); me.update(dt); },
    exit() {}
  };
}
