// Patterns — a classroom screen shows the numbers; tap the answer (or the times table).
import * as THREE from 'three';
import { G, toast, levelComplete, bigScreen, roundRect } from '../game.js';
import { Patterns, rng, shuffle } from '../logic.js';
import { makeRoom, box, std, table, plant, at } from './common.js';
import { mat } from '../tex.js';

const NEED = 3;
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function optionsFor(q, answer, r) {
  const pool = [];
  if (q.kind === 'which') {
    const g = q.shown.reduce(gcd);
    [answer + 1, answer - 1, answer * 2, answer + 2, answer - 2, answer + 3].forEach(v => { if (v > 1 && v !== answer && g % v !== 0) pool.push(v); });
  } else {
    const n = q.table;
    [answer + n, answer - n, answer + 1, answer - 1, answer + 10, answer + 2, answer - 2, answer + n + 1].forEach(v => { if (v > 0 && v !== answer) pool.push(v); });
  }
  const opts = [answer]; shuffle(r, [...new Set(pool)]).forEach(v => { if (opts.length < 4 && opts.indexOf(v) < 0) opts.push(v); });
  return shuffle(r, opts);
}

export async function enter({ level, camera, makeCharacter }) {
  const R = makeRoom({ w: 15, d: 13, h: 5.6, floor: ['tiles', ['#d8d2c4', '#c9c2b2', 10, 111]], floorTile: 3, wall: '#e9efe6', lamps: 6, doorColor: 0x3a3320 });
  const S = R.scene;
  // classroom desks
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const t = table(1.2, .6, .74, '#c9a06b'); t.position.set(-3.6 + i * 3.6, 0, 1.6 + j * 2.4); S.add(t); S.add(box(.45, .45, .45, std(0x3f6aa5, .6), -3.6 + i * 3.6, .22, 2.2 + j * 2.4)); }
  S.add(at(plant(1.1), 6.5, 0, -5.6));
  // clock + posters
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .06, 32), std(0xffffff, .4)); clock.rotation.x = Math.PI / 2; clock.position.set(-6, 4.4, -6.45); S.add(clock);
  // the big screen above a chalk ledge
  const PX = 1600, PY = 900, scr = bigScreen(7.6, 4.275, PX, PY);
  scr.group.position.set(0, 2.85, -6.35); S.add(scr.group);
  S.add(box(8, .1, .3, mat('wood', ['#8a6a45', 2, 112], 3, 1), 0, .62, -6.25));
  const me = makeCharacter('player', new THREE.Color(G.S.data.color).getHex()); me.root.position.set(-4.2, 0, -2.4); me.root.rotation.y = Math.PI + .5; S.add(me.root);
  camera.position.set(0, 3.0, 4.8); camera.lookAt(0, 2.8, -6); camera.fov = 52; camera.updateProjectionMatrix();

  const r = rng((Math.random() * 4294967296) ^ (Date.now() + level * 31337));
  let q, step, opts, done = 0, misses = 0, total = 0, lock = false, hover = -1, flash = null;
  const BTN = i => ({ x: 170 + i * 330, y: 600, w: 290, h: 170 });
  function newQ() { q = Patterns.pickQ(level, r); step = 0; misses = 0; opts = optionsFor(q, q.answers[0], r); flash = null; draw(); }
  function draw() {
    const c = scr.ctx;
    const bg = c.createLinearGradient(0, 0, 0, PY); bg.addColorStop(0, '#1d3a2c'); bg.addColorStop(1, '#173024'); c.fillStyle = bg; c.fillRect(0, 0, PX, PY);
    // progress dots + prompt
    for (let i = 0; i < NEED; i++) { c.fillStyle = i < done ? '#4be08a' : 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(PX / 2 - 50 + i * 50, 60, 16, 0, 7); c.fill(); }
    c.fillStyle = '#ffffff'; c.font = '600 56px Fredoka, Arial'; c.textAlign = 'center'; c.fillText(q.prompt, PX / 2, 150);
    c.font = '700 30px Nunito'; c.fillStyle = '#ffd463'; c.textAlign = 'right'; c.fillText('Level ' + level, PX - 40, 64);
    // number tiles
    const items = q.shown.map((v, i) => { const bi = q.blanks.indexOf(i); return bi < 0 ? { t: String(v) } : bi < step ? { t: String(v), filled: true } : { t: bi === step ? '?' : '?', blank: true, cur: bi === step }; });
    if (q.kind === 'which') items.push({ t: '?’s', blank: true, cur: true });
    const tw = Math.min(170, (PX - 120) / items.length - 18), total_w = items.length * (tw + 18) - 18; let x = (PX - total_w) / 2;
    c.font = '600 ' + Math.round(tw * .42) + 'px Fredoka, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    items.forEach(it => {
      c.fillStyle = it.blank ? 'rgba(255,212,99,.12)' : it.filled ? 'rgba(75,224,138,.18)' : 'rgba(255,255,255,.1)';
      roundRect(c, x, 240, tw, 190, 26); c.fill();
      if (it.blank) { c.setLineDash(it.cur ? [] : [12, 10]); c.strokeStyle = '#ffd463'; c.lineWidth = it.cur ? 7 : 4; c.stroke(); c.setLineDash([]); }
      c.fillStyle = it.blank ? '#ffd463' : '#ffffff'; c.fillText(it.t, x + tw / 2, 340); x += tw + 18;
    });
    // answer buttons
    opts.forEach((v, i) => {
      const b = BTN(i), st = flash && flash.i === i ? flash.ok : null;
      c.fillStyle = st === true ? '#2fbf72' : st === false ? '#c8414f' : i === hover ? '#ffe08a' : '#ffd463';
      roundRect(c, b.x, b.y, b.w, b.h, 30); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)'; roundRect(c, b.x, b.y + b.h - 14, b.w, 14, 8); c.fill();
      c.fillStyle = '#2b2000'; c.font = '600 78px Fredoka, Arial'; c.fillText(q.kind === 'which' ? v + '’s' : String(v), b.x + b.w / 2, b.y + b.h / 2);
      c.font = '700 26px Nunito'; c.fillStyle = 'rgba(43,32,0,.55)'; c.textAlign = 'left'; c.fillText(String(i + 1), b.x + 18, b.y + 30); c.textAlign = 'center';
    });
    c.textBaseline = 'alphabetic';
    scr.update();
  }
  function answer(i) {
    if (lock || i < 0 || i >= opts.length) return;
    const want = q.answers[step], got = opts[i];
    if (got === want) {
      flash = { i, ok: true }; lock = true; draw();
      setTimeout(() => {
        flash = null; step++;
        if (step >= q.answers.length) {
          done++; me.play('agree');
          if (done >= NEED) { draw(); setTimeout(() => levelComplete('pattern', level, total === 0 ? 'Perfect!' : ''), 500); return; }
          lock = false; newQ();
        } else { opts = optionsFor(q, q.answers[step], r); lock = false; draw(); }
      }, 550);
    } else {
      misses++; total++; flash = { i, ok: false }; me.play('headShake'); draw();
      lock = true;
      setTimeout(() => {
        flash = null; lock = false;
        if (misses >= 3) { toast('The answer was ' + want + (q.kind === 'which' ? '’s' : '') + '. Here’s a new one.'); newQ(); }
        else { opts = opts.filter((_, k) => k !== i); draw(); }
      }, 700);
    }
  }
  const hit = e => { const p = scr.uvAt(e, camera); if (!p) return -1; return opts.findIndex((_, i) => { const b = BTN(i); return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; }); };
  newQ();
  return {
    _dbg: () => ({ q, step, opts, done }), _scr: scr,
    scene: S, camera, title: 'Patterns · Level ' + level, help: 'Find the missing number — tap your answer on the screen',
    pointer: { down(e) { const i = hit(e); if (i >= 0) { answer(i); return true; } return false; }, hover(e) { const i = hit(e); if (i !== hover) { hover = i; draw(); } } },
    key(e) { const n = parseInt(e.key, 10); if (n >= 1 && n <= 4) answer(n - 1); },
    update(dt) { me.speedBlend(0); me.update(dt); },
    exit() {}
  };
}
