// The rules of each sport, played on a flat 960×600 "field map" (y grows toward the viewer).
// arena.js draws these in 3D; this file only knows positions, the ball and the score.
export const E = {
  msg: () => {}, S: () => ({ str: 5 }), held: new Set(), dir: () => ({ x: 0, y: 0 }),
  pitchBox: () => {}, pitchValue: () => 'fastball', setPitchValue: () => {}, finish: () => {}
};
export const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const ORD = ['', '1st', '2nd', '3rd', 'home'];
const str = () => E.S().str || 5;
const msg = t => E.msg(t);
export function stepTo(e, tx, ty, sp, dt) { const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy); if (d <= sp * dt || d < .01) { e.x = tx; e.y = ty; return true; } e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; return false; }
/** arrows / joystick turned into field directions, depending on where the camera is looking */
function arrows(map) {
  const r = E.dir(); let x = r.x, y = r.y;
  if (map === 'side') [x, y] = [-r.y, r.x];
  else if (map === 'flip') [x, y] = [-r.x, -r.y];
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  return { x, y, any: l > .15 };
}
const held = k => E.held.has(k);

class Game {
  after(t, fn, text) { if (text) msg(text); this.phase = 'show'; this.timer = t; this.then = fn; }
  tick(dt) { if (this.phase === 'show') { this.timer -= dt; if (this.timer <= 0) { this.phase = ''; const f = this.then; this.then = null; f(); } return true; } return false; }
  finish(win, detail) { this.over = true; E.pitchBox(false); E.finish(this, win, detail); }
  keyup() {}
}

/* ================= BASEBALL ================= */
export const PITCHES = ['fastball', 'curveball', 'slider', 'changeup', 'knuckleball', 'sinker', 'splitter', 'cutter'];
function lev(a, b) { const d = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return d[b.length]; }
export function guess(s) { s = (s || '').toLowerCase().replace(/[^a-z]/g, ''); if (!s) return { p: 'fastball', exact: false }; let best = 'fastball', bd = 99; for (const p of PITCHES) { const d = lev(s, p); if (d < bd) { bd = d; best = p; } } return { p: best, exact: bd === 0 }; }
export const HOME = { x: 480, y: 560 }, BASES = [HOME, { x: 615, y: 428 }, { x: 480, y: 296 }, { x: 345, y: 428 }], MOUND = { x: 480, y: 432 };
export const bpos = i => BASES[i % 4];
const FIELD0 = [['P', 480, 432], ['C', 480, 592], ['1B', 600, 392], ['2B', 552, 282], ['SS', 405, 282], ['3B', 360, 392], ['LF', 265, 170], ['CF', 480, 110], ['RF', 695, 170]];
const COVER = { 1: '1B', 2: '2B', 3: '3B', 4: 'C' };
const PT = { fastball: [1.3, 0], curveball: [.82, -38], slider: [1.02, 30], changeup: [.76, 0], knuckleball: [.78, 0], sinker: [1.12, -16], splitter: [.95, 10], cutter: [1.15, 18] };

export class Baseball extends Game {
  constructor() { super(); this.sport = 'baseball'; this.inn = 1; this.half = 'you'; this.outs = 0; this.s = 0; this.b = 0; this.sc = { you: 0, cpu: 0 }; this.runners = []; this.lastType = ''; this.ready(); }
  again() { return new Baseball(); }
  get map() { return this.half === 'cpu' && this.mode !== 'play' ? 'flip' : 'plain'; }
  get labels() {
    if (this.half === 'you') return { q: 'Swing', w: 'Run' };
    return this.mode === 'play' ? { r: 'Catch', digits: true } : { e: 'Pitch' };
  }
  ready() {
    this.fld = FIELD0.map(([n, x, y]) => ({ n, x, y, hx: x, hy: y }));
    this.ball = { x: MOUND.x, y: MOUND.y, z: 0, vx: 0, vy: 0, vz: 0, state: 'pitcher' };
    this.holder = null; this.ctrl = null; this.swingT = 0; this.swung = false; this.playT = 0; this.endWait = 0; this.toMound = false; this.mode = 'ready'; this.aimX = 0; this.batter = null;
    E.pitchBox(this.half === 'cpu');
    if (this.half === 'you') { this.timer = 1.2 + Math.random() * .7; msg("<b>You're batting.</b> Press <kbd>Q</kbd> (Swing) as the ball crosses the plate. Early pulls it left, late pushes it right."); }
    else msg('<b>You pitch.</b> Type a pitch in the box, aim with the arrows, then <kbd>E</kbd> to throw. If they hit it, run to the ball and press <kbd>R</kbd>.');
  }
  rs() { return this.half === 'you' ? 135 + str() * 1.4 : 150; }
  throwPitch(type, aim) { const [p, brk] = PT[type]; this.ptype = type; this.pdur = .95 / p; this.brk = brk * (.7 + Math.random() * .6); this.wob = type === 'knuckleball'; this.cross = 480 + aim; this.px = this.cross - this.brk; this.pt = 0; this.mode = 'pitch'; this.swung = false; this.cpuDecided = false; }
  update(dt) {
    const b = this.ball; if (this.swingT > 0) this.swingT -= dt; if (this.tick(dt)) return;
    if (this.mode === 'ready') {
      if (this.half === 'you') { this.timer -= dt; if (this.timer <= 0) this.throwPitch(pick(PITCHES), (Math.random() * 2 - 1) * 44); }
      else { const a = arrows(this.map); this.aimX = clamp(this.aimX + a.x * 120 * dt, -50, 50); }
    } else if (this.mode === 'pitch') {
      this.pt += dt / this.pdur; const t = this.pt;
      b.x = MOUND.x + (this.px - MOUND.x) * t + this.brk * t * t + (this.wob ? Math.sin(t * 15) * 7 : 0); b.y = MOUND.y + (HOME.y - MOUND.y) * t; b.z = 8;
      if (this.half === 'cpu' && !this.cpuDecided && t > .84) this.cpuSwing();
      if (t >= 1.2) this.pitchDone();
    } else if (this.mode === 'play') { this.playT += dt; this.physics(dt); if (this.phase === 'show') return; this.defense(dt); this.offense(dt); this.checkEnd(dt); }
  }
  key(k) {
    const b = this.ball;
    if (this.half === 'you') {
      if (k === 'q' && this.mode === 'pitch' && !this.swung) {
        this.swung = true; this.swingT = .25;
        const timing = (b.y - 552) / 30, dx = Math.abs(b.x - 480), reach = 26 + str() / 10;
        if (Math.abs(timing) <= 1 && dx <= reach) this.contact(timing, (1 - Math.abs(timing) * .55) * (1 - dx / reach * .45), str());
      } else if (k === 'q' && this.mode !== 'play') this.swingT = .25;
      if (k === 'w' && this.mode === 'play') [...this.runners].sort((a, c) => c.base - a.base).forEach(r => { if (r.moving) return; const nb = r.base + 1; if (!this.runners.some(o => o !== r && ((o.base === nb && !o.moving) || (o.moving && o.target === nb)))) this.go(r, nb); });
    } else {
      if (k === 'e' && this.mode === 'ready') {
        const r = guess(E.pitchValue()); E.setPitchValue(r.p); this.rep = r.p === this.lastType; this.lastType = r.p;
        if (!r.exact) msg(`Did you mean <b>${r.p}</b>? Throwing a ${r.p}.`);
        const miss = (Math.random() * 2 - 1) * Math.max(3, 14 - str() / 8); this.throwPitch(r.p, this.aimX + miss);
      }
      if (this.mode === 'play' && this.ctrl) {
        if (k === 'r' && (b.state === 'air' || b.state === 'ground') && D(this.ctrl, b) < 30 && b.z < 50) this.grab(this.ctrl);
        if (/^[1-4]$/.test(k) && b.state === 'held' && this.holder === this.ctrl) this.throwTo(+k);
      }
    }
  }
  pitchDone() {
    const strike = this.swung || Math.abs(this.cross - 480) <= 28;
    if (strike) { this.s++; if (this.s >= 3) return this.kOut(); return this.after(.9, () => this.ready(), this.swung ? 'Swing and a miss — strike!' : 'Called strike!'); }
    this.b++; if (this.b >= 4) return this.walk(); this.after(.9, () => this.ready(), `Ball ${this.b}.`);
  }
  kOut() { this.outs++; this.s = this.b = 0; if (this.outs >= 3) return this.after(1.4, () => this.endHalf(), "Strike three! That's 3 outs."); this.after(1.3, () => this.ready(), 'Strike three — out!'); }
  walk() {
    const occ = n => this.runners.find(r => r.base === n); let n = 1; const chain = []; while (occ(n)) { chain.push(occ(n)); n++; }
    chain.reverse().forEach(r => { r.base++; if (r.base >= 4) this.score(r); else { const p = bpos(r.base); r.x = p.x; r.y = p.y; } });
    const p = bpos(1); this.runners.push({ base: 1, target: 1, moving: false, x: p.x, y: p.y }); this.s = this.b = 0; this.after(1.2, () => this.ready(), 'Ball four — walk!');
  }
  cpuSwing() {
    this.cpuDecided = true; const inZ = Math.abs(this.cross - 480) <= 28; if (Math.random() > (inZ ? .72 : .28)) return; this.swung = true; this.swingT = .25;
    const c = (inZ ? .62 : .28) - Math.abs(this.brk) / 170 - (this.wob ? .12 : 0) + (this.rep ? .15 : 0) - str() / 400;
    if (Math.random() < c) this.contact((Math.random() * 2 - 1) * .9, .45 + Math.random() * .55, 30);
  }
  contact(timing, q, pow) {
    const ang = timing * .8 + (Math.random() - .5) * .25;
    if (Math.abs(ang) > .85) { if (this.s < 2) this.s++; return this.after(1, () => this.ready(), 'Foul ball!'); }
    const sp = 190 + q * 230 + pow * 2.4, b = this.ball;
    Object.assign(b, { x: 480, y: 548, z: 12, vx: Math.sin(ang) * sp, vy: -Math.cos(ang) * sp, vz: 30 + Math.random() ** 1.6 * 270 * q, state: 'air', bounced: false });
    this.mode = 'play'; this.playT = 0; this.s = this.b = 0; E.pitchBox(false);
    const occ = n => this.runners.find(r => r.base === n && !r.moving); let n = 1; const forced = []; while (occ(n)) { forced.push(occ(n)); n++; } forced.forEach(r => this.go(r, r.base + 1));
    this.batter = { base: 0, target: 1, moving: true, x: HOME.x - 12, y: HOME.y }; this.runners.push(this.batter);
    msg(this.half === 'you' ? 'Hit! Your batter runs to 1st. Press <kbd>W</kbd> (Run) to send your runners to the next base — beat the throw!' : 'They hit it! Run to the ball with the arrows, press <kbd>R</kbd> to catch, then <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> or <kbd>4</kbd> (home) to throw.');
  }
  go(r, t) { r.target = t; r.moving = true; }
  score(r) { this.runners = this.runners.filter(o => o !== r); this.sc[this.half]++; msg(`${this.half === 'you' ? 'You score' : 'CPU scores'} a run!`); }
  outRunner(r, t) { if (this.phase === 'show') return; this.runners = this.runners.filter(o => o !== r); this.outs++; if (this.outs >= 3) return this.after(1.5, () => this.endHalf(), t + " That's 3 outs."); msg(t); }
  nearestF(p) { let best = null, bd = 1e9; for (const f of this.fld) { const d = D(f, p); if (d < bd) { bd = d; best = f; } } return best; }
  landing() { const b = { ...this.ball }; for (let i = 0; i < 240 && b.z > 0; i++) { b.x += b.vx / 60; b.y += b.vy / 60; b.z += b.vz / 60; b.vz -= 520 / 60; } return b; }
  physics(dt) {
    const b = this.ball;
    if (b.state === 'air' || b.state === 'ground') {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.state === 'air') { b.z += b.vz * dt; b.vz -= 520 * dt; if (b.z <= 0) { b.z = 0; if (b.vz < -90) { b.bounced = true; b.vz *= -.35; b.vx *= .7; b.vy *= .7; } else { b.state = 'ground'; b.vz = 0; } } }
      else { const f = Math.max(0, 1 - 1.3 * dt); b.vx *= f; b.vy *= f; }
      const dh = D(b, HOME);
      if (dh > 520) { if (b.state === 'air' && b.z > 10) return this.homeRun(); b.vx *= -.4; b.vy *= -.4; const k = 518 / dh; b.x = HOME.x + (b.x - HOME.x) * k; b.y = HOME.y + (b.y - HOME.y) * k; }
      if (b.y > 598) { b.y = 598; b.vy *= -.4; } b.x = clamp(b.x, 6, 954);
    } else if (b.state === 'thrown') {
      b.z = 10;
      if (stepTo(b, b.toPt.x, b.toPt.y, b.sp, dt)) { b.state = 'held'; this.holder = this.nearestF(b.toPt); this.holder.x = b.toPt.x; this.holder.y = b.toPt.y; this.throwCD = .35; if (b.to) this.baseTouch(b.to); }
    }
    if (b.state === 'held' && this.holder) { b.x = this.holder.x; b.y = this.holder.y; b.z = 8; }
  }
  homeRun() { const n = this.runners.length; this.runners = []; this.sc[this.half] += n; this.ball.state = 'dead'; this.after(2.4, () => this.ready(), `<b>HOME RUN!</b> ${n} run${n > 1 ? 's' : ''} score${n > 1 ? '' : 's'}.`); }
  grab(f) {
    const b = this.ball;
    if (b.state === 'air' && !b.bounced && this.batter && this.runners.includes(this.batter)) { this.runners.forEach(r => { if (r.moving && r !== this.batter) this.go(r, r.base); }); this.outRunner(this.batter, 'Caught it! Fly out.'); }
    b.state = 'held'; this.holder = f; this.throwCD = .35;
  }
  baseTouch(i) { [...this.runners].forEach(r => { if (r.moving && r.target === i) this.outRunner(r, r.target === r.base ? 'Doubled off!' : `Out at ${ORD[i]}!`); }); }
  throwTo(bi) { const b = this.ball, h = this.holder; if (!h) return; b.state = 'thrown'; b.to = bi; b.toPt = bi ? bpos(bi) : MOUND; b.sp = bi ? (this.half === 'cpu' ? 460 + str() * 3 : 460) : 360; b.x = h.x; b.y = h.y; this.holder = null; }
  aiThrow() {
    const h = this.holder; let best = null;
    for (const r of this.runners) if (r.moving) { const p = bpos(r.target), rt = D(r, p) / this.rs(), tt = D(h, p) / 460 + .12; if (tt < rt && (!best || r.target > best.target)) best = r; }
    if (best) { if (D(h, bpos(best.target)) > 12) this.throwTo(best.target); return; }
    if (!this.runners.some(r => r.moving) && D(h, MOUND) > 70 && !this.toMound) { this.toMound = true; this.throwTo(0); }
    this.throwCD = .3;
  }
  defense(dt) {
    const b = this.ball, user = this.half === 'cpu', fs = this.fld, loose = b.state === 'air' || b.state === 'ground';
    if (user) { if (b.state === 'held') this.ctrl = this.holder; else if (loose) { const n = this.nearestF(b); if (!this.ctrl || D(n, b) < D(this.ctrl, b) - 30) this.ctrl = n; } }
    const target = b.state === 'air' ? this.landing() : b, chaser = loose ? (user ? this.ctrl : this.nearestF(target)) : null;
    const covers = {}; for (const k in COVER) covers[k] = fs.find(x => x.n === COVER[k]);
    if (chaser === covers[2]) covers[2] = fs.find(x => x.n === 'SS'); if (chaser === covers[1]) covers[1] = fs.find(x => x.n === 'P'); if (chaser === covers[3]) covers[3] = fs.find(x => x.n === 'SS');
    for (const f of fs) {
      if (user && f === this.ctrl) { const a = arrows(this.map), sp = (170 + str()) * dt; f.x = clamp(f.x + a.x * sp, 8, 952); f.y = clamp(f.y + a.y * sp, 8, 596); continue; }
      if (f === this.holder) continue;
      if (f === chaser) { if (this.playT > .5) stepTo(f, target.x, target.y, 135, dt); if (D(f, b) < 12 && b.z < 22) this.grab(f); continue; }
      const bk = Object.keys(covers).find(k => covers[k] === f);
      if (bk && b.state !== 'pitcher') { const p = bpos(+bk); stepTo(f, p.x + (+bk === 1 ? 8 : 0), p.y, 175, dt); } else stepTo(f, f.hx, f.hy, 110, dt);
    }
    if (b.state === 'held' && this.holder) {
      const h = this.holder;
      for (let i = 1; i <= 4; i++) if (D(h, bpos(i)) < 13) this.baseTouch(i);
      [...this.runners].forEach(r => { if (r.moving && D(h, r) < 15) this.outRunner(r, 'Tagged out!'); });
      if (!user) { this.throwCD -= dt; if (this.throwCD <= 0) this.aiThrow(); }
    }
  }
  offense(dt) { [...this.runners].forEach(r => { if (!r.moving) return; const p = bpos(r.target); if (stepTo(r, p.x, p.y, this.rs(), dt)) { r.moving = false; r.base = r.target; if (r.base >= 4) this.score(r); else if (this.half === 'cpu') this.cpuRun(r); } }); }
  cpuRun(r) { const nb = r.base + 1, b = this.ball; if (b.state === 'held' || b.state === 'thrown') return; if (this.runners.some(o => o !== r && ((o.base === nb && !o.moving) || (o.moving && o.target === nb)))) return; if (D(b, bpos(nb)) > 240) this.go(r, nb); }
  checkEnd(dt) {
    const b = this.ball; if (this.runners.some(r => r.moving)) { this.endWait = 0; return; }
    if (b.state === 'held' || b.state === 'dead' || this.playT > 18) { this.endWait += dt; if (this.endWait > .9) { this.endWait = 0; this.ready(); } } else this.endWait = 0;
  }
  endHalf() {
    this.outs = 0; this.s = this.b = 0; this.runners = []; E.pitchBox(false);
    if (this.half === 'you') { this.half = 'cpu'; return this.after(1.4, () => this.ready(), 'Switch sides — now you pitch and field.'); }
    if ((this.inn >= 3 && this.sc.you !== this.sc.cpu) || this.inn >= 6) return this.finish(this.sc.you > this.sc.cpu, `Final: You ${this.sc.you} – ${this.sc.cpu} CPU`);
    this.inn++; this.half = 'you'; this.after(1.4, () => this.ready(), this.inn > 3 ? 'Tied! Extra inning.' : `Inning ${this.inn}. You're up to bat.`);
  }
  board() { return `Inning ${this.inn} · ${this.half === 'you' ? 'You bat' : 'You pitch'} · B${this.b} S${this.s} · ${this.outs} out`; }
}

/* ================= FOOTBALL ================= */
export const FPOS = ['Quarterback', 'Running Back', 'Receiver', 'Kicker'];
export const FX = y => 60 + y * 8.4;
export class Football extends Game {
  constructor(practice) {
    super(); this.sport = 'football'; this.practice = !!practice; this.pos = practice ? 'Kicker' : pick(FPOS); this.sc = { you: 0, cpu: 0 }; this.drive = 0; this.maxD = this.pos === 'Kicker' ? 5 : 3; this.cpuD = 0; this.made = 0; this.tries = 0; this.stam = 1; this.mode = ''; this.los = 25; this.first = 35; this.down = 1;
    this.after(2.2, () => this.newDrive(), practice ? 'Kick practice! Aim with <kbd>←</kbd> <kbd>→</kbd>, hold <kbd>Q</kbd> to power up, let go to kick. <kbd>Esc</kbd> to leave.' : `You were randomly picked to play <b>${this.pos}</b>!`);
  }
  again() { return new Football(this.practice); }
  map = 'side';
  get labels() { return this.pos === 'Kicker' ? { q: 'Kick (hold)' } : this.me === 'QB' ? { t: 'Throw', w: 'Sprint' } : this.me === 'WR1' ? { r: 'Catch', w: 'Sprint' } : { w: 'Sprint' }; }
  newDrive() { if (!this.practice && this.drive >= this.maxD) return this.end(); this.drive++; if (this.pos === 'Kicker') return this.setupKick(); this.los = 25; this.down = 1; this.first = 35; this.setup(); }
  setup() {
    const cx = FX(this.los), mk = (x, y, r) => ({ x, y, r });
    this.off = { QB: mk(cx - 40, 330, 'QB'), RB: mk(cx - 75, 368, 'RB'), WR1: mk(cx - 6, 170, 'WR'), WR2: mk(cx - 6, 490, 'WR'), OL1: mk(cx - 8, 305, 'OL'), OL2: mk(cx - 8, 355, 'OL') };
    this.def = [[cx + 14, 305, 'rush'], [cx + 14, 355, 'rush'], [cx + 70, 330, 'lb'], [cx + 46, 170, 'cb', 'WR1'], [cx + 46, 490, 'cb', 'WR2'], [cx + 190, 330, 'safety']].map(([x, y, role, mark]) => ({ x, y, role, mark, sp: 138 + Math.random() * 28, stun: 0 }));
    this.carrier = this.off.QB; this.ballF = null; this.thrown = false; this.mode = 'pre'; this.timer = 1.1; this.t = 0;
    this.me = this.pos === 'Quarterback' ? 'QB' : this.pos === 'Running Back' ? 'RB' : 'WR1';
    msg(`Down ${this.down} · ${Math.max(1, this.first - this.los)} to go. ` + ({ QB: 'Move with the arrows. Press <kbd>T</kbd> (Throw) to the open receiver — the one with the gold ring — then run!', RB: 'Take the handoff and run with the arrows. Hold <kbd>W</kbd> to sprint.', WR1: 'Get open with the arrows. When the ball comes, press <kbd>R</kbd> (Catch), then run!' })[this.me]);
  }
  ctrl() { const O = this.off, me = O[this.me]; return this.carrier && this.carrier.r !== 'OL' && (this.carrier === me || this.thrown || this.me === 'RB') ? this.carrier : me; }
  update(dt) {
    if (this.fly) this.fly.t += dt; if (this.tick(dt)) return;
    if (this.mode === 'pre') { this.timer -= dt; if (this.timer <= 0) { this.mode = 'live'; msg('Hut!'); } return; }
    if (this.mode === 'aim') { const a = arrows(this.map); this.aim = clamp(this.aim + a.y * .7 * dt, -.6, .6); if (this.charging) this.pow = Math.min(1, this.pow + dt * .9); return; }
    if (this.mode === 'kickfly') return this.kickFly(dt);
    if (this.mode !== 'live') return; this.t += dt;
    const O = this.off, me = O[this.me];
    if (this.me === 'RB' && this.carrier === O.QB && this.t > .35) this.carrier = O.RB;
    const ctrl = this.ctrl();
    const sprint = held('w') && this.stam > .05; this.stam = sprint ? Math.max(0, this.stam - dt * .6) : Math.min(1, this.stam + dt * .25);
    const a = arrows(this.map), sp = (148 + str() * .9) * (sprint ? 1.5 : 1) * (ctrl === O.QB && !this.thrown ? .75 : 1);
    ctrl.x = Math.max(20, ctrl.x + a.x * sp * dt); ctrl.y += a.y * sp * dt;
    for (const k of ['WR1', 'WR2', 'RB']) { const p = O[k]; if (p === ctrl || p === this.carrier) continue; if (k === 'RB') { if (this.me !== 'RB') stepTo(p, p.x + 40, p.y < 330 ? 250 : 430, 120, dt); } else { const fwd = this.t < 1.3; stepTo(p, p.x + (fwd ? 60 : 40), fwd ? p.y : p.y + (330 - p.y) * .4, 128, dt); } }
    for (const k of ['OL1', 'OL2']) { const p = O[k]; if (this.def[k === 'OL1' ? 0 : 1]) stepTo(p, this.def[k === 'OL1' ? 0 : 1].x - 14, this.def[k === 'OL1' ? 0 : 1].y, 60, dt); }
    if (this.me === 'WR1' && !this.thrown && this.carrier === O.QB) { const open = Math.min(...this.def.map(d => D(d, me))); if ((this.t > 1.1 && open > 55) || this.t > 2.9) this.throwBall(me); }
    if (this.ballF) { const f = this.ballF; if (stepTo(f, f.tx, f.ty, f.sp, dt)) return this.arrive(); }
    if (this.mode !== 'live') return;
    const tgt = this.carrier || (this.ballF ? { x: this.ballF.tx, y: this.ballF.ty } : O.QB);
    for (const d of this.def) {
      if (d.stun > 0) { d.stun -= dt; continue; }
      let gx = tgt.x, gy = tgt.y, s = d.sp;
      if (!this.thrown && this.carrier === O.QB) {
        if (d.role === 'rush') { if (this.t < 2.1) s = 22; }
        else if (d.role === 'cb') { const m = O[d.mark]; gx = m.x + 18; gy = m.y; s = d.sp * .82; }
        else if (d.role === 'safety') { gx = Math.max(d.x, tgt.x + 160); gy = 330; s = 90; }
        else { gx = tgt.x + 60; s = 70; }
      } else if (this.ballF) { gx = this.ballF.tx; gy = this.ballF.ty; }
      stepTo(d, gx, gy, s, dt);
      if (this.ballF && !this.ballF.tipped && D(d, this.ballF) < 16 && D(this.ballF, { x: this.ballF.tx, y: this.ballF.ty }) < 60) { this.ballF.tipped = true; if (Math.random() < .4) return this.endPlay('pick'); }
      if (!this.ballF && this.carrier && D(d, tgt) < 17) { if (tgt === ctrl && !d.broke && Math.random() < str() / 220) { d.broke = true; d.stun = .7; msg('Broke a tackle!'); } else return this.endPlay('tackle'); }
    }
    if (!this.carrier) return; if (tgt.y < 90 || tgt.y > 570) return this.endPlay('out');
    if (tgt.x >= FX(100)) return this.endPlay('td');
  }
  key(k) {
    const O = this.off; if (this.mode === 'aim' && k === 'q' && !this.charging) { this.charging = true; this.pow = 0; }
    if (this.mode === 'live' && k === 't' && this.me === 'QB' && this.carrier === O.QB && !this.thrown) this.throwBall(this.openest());
    if (this.mode === 'live' && k === 'r' && this.ballF && this.ballF.to === O[this.me] && D(this.ballF, O[this.me]) < 46) this.catchIt(O[this.me]);
  }
  keyup(k) { if (this.mode === 'aim' && k === 'q' && this.charging) { this.charging = false; this.kick(); } }
  openest() { const O = this.off; let best = O.WR1, bv = -1; for (const k of ['WR1', 'WR2', 'RB']) { const v = Math.min(...this.def.map(d => D(d, O[k]))) + (O[k].x - O.QB.x) * .15; if (v > bv) { bv = v; best = O[k]; } } return best; }
  throwBall(to) { const q = this.off.QB; this.thrown = true; this.carrier = null; this.ballF = { x: q.x, y: q.y, sx: q.x, sy: q.y, tx: to.x + (to === this.off[this.me] ? 20 : 45), ty: to.y, sp: 430 + str() * 2, to, dist: D(q, to) }; }
  catchIt(p) { const near = this.def.some(d => D(d, p) < 15); if (near && Math.random() < .35) return this.endPlay('inc'); this.ballF = null; this.carrier = p; msg('Caught it! Run!'); }
  arrive() { const f = this.ballF, p = f.to; if (p === this.off[this.me]) return this.endPlay('inc'); if (D(p, f) < 32) this.catchIt(p); else this.endPlay('inc'); }
  endPlay(why) {
    if (this.mode !== 'live') return; this.mode = 'dead'; const c = this.carrier;
    if (why === 'pick') return this.after(1.6, () => this.endDrive(), 'Intercepted!');
    if (why === 'inc') { this.down++; this.ballF = null; return this.nextDown('Incomplete.'); }
    if (why === 'td') { this.sc.you += 7; return this.after(2, () => this.endDrive(), '<b>TOUCHDOWN!</b> +7'); }
    const yd = Math.round((c.x - 60) / 8.4), gain = yd - this.los; this.los = clamp(yd, 1, 99);
    const t = (why === 'out' ? 'Out of bounds. ' : c === this.off.QB && !this.thrown ? 'Sacked! ' : 'Tackled. ') + (gain >= 0 ? `Gain of ${gain}.` : `Loss of ${-gain}.`);
    if (this.los >= this.first) { this.down = 1; this.first = Math.min(100, this.los + 10); return this.after(1.4, () => this.setup(), t + ' <b>First down!</b>'); }
    this.down++; this.nextDown(t);
  }
  nextDown(t) { if (this.down > 4) return this.after(1.6, () => this.endDrive(), t + ' Turnover on downs.'); this.after(1.3, () => this.setup(), t); }
  setupKick() {
    this.dist = Math.round(20 + Math.random() * (this.practice ? 36 : 26)); this.kx = Math.max(FX(15), FX(110 - this.dist)); this.ky = 250 + Math.random() * 160; this.aim = 0; this.pow = 0; this.charging = false; this.wind = (Math.random() * 2 - 1) * .07; this.fly = null; this.mode = 'aim';
    msg(`Field goal from <b>${this.dist} yards</b>. Aim with <kbd>←</kbd> <kbd>→</kbd>, hold <kbd>Q</kbd> to power up, let go to kick. Wind is blowing ${this.wind > 0 ? 'right' : 'left'}.`);
  }
  kick() { const ang = Math.atan2(330 - this.ky, 950 - this.kx) + this.aim; this.fly = { t: 0, x: this.kx, y: this.ky, z: 0, ang: ang + this.wind, range: this.pow * (38 + str() * .6) * 8.4, s: 0 }; this.mode = 'kickfly'; }
  kickFly(dt) {
    const f = this.fly; f.s += 560 * dt; f.x = this.kx + Math.cos(f.ang) * f.s; f.y = this.ky + Math.sin(f.ang) * f.s; f.z = Math.sin(Math.min(1, f.s / Math.max(f.range, 1)) * Math.PI) * 140;
    let res = null; if (f.x >= 950) res = f.y >= 300 && f.y <= 360 ? 'good' : 'wide'; else if (f.s >= f.range) res = 'short'; if (!res) return;
    this.tries++; const made = res === 'good'; if (made) this.made++; this.mode = 'done';
    const t = made ? "It's good!" : res === 'wide' ? 'Wide — missed the posts.' : 'Short! Not enough power.';
    if (this.practice) return this.after(1.8, () => this.setupKick(), `${t} Practice: ${this.made} of ${this.tries} made.`);
    if (made) this.sc.you += 3; this.after(1.8, () => this.endDrive(), t + (made ? ' +3' : ''));
  }
  cpuDrive() { this.cpuD++; const r = Math.random(); if (r < .3) { this.sc.cpu += 7; return 'CPU scores a touchdown.'; } if (r < .45) { this.sc.cpu += 3; return 'CPU kicks a field goal.'; } return 'Your defense stops them!'; }
  endDrive() { const want = Math.round(this.drive * 3 / this.maxD), l = []; while (this.cpuD < want) l.push(this.cpuDrive()); this.after(l.length ? 2 : .4, () => this.newDrive(), l.length ? `CPU has the ball… ${l.join(' ')}` : ''); }
  end() { while (this.cpuD < 3) this.cpuDrive(); this.finish(this.sc.you > this.sc.cpu, `Final: You ${this.sc.you} – ${this.sc.cpu} CPU. You played ${this.pos}.`); }
  board() { return this.practice ? `Kick practice · Made ${this.made} of ${this.tries}` : this.pos === 'Kicker' ? `Kicker · Kick ${this.drive}/${this.maxD}` : `${this.pos} · Drive ${this.drive}/${this.maxD} · Down ${this.down}`; }
}

/* ================= BASKETBALL ================= */
export const BPOS = { 'Point Guard': [20, .08, 0], 'Shooting Guard': [15, .1, 0], 'Small Forward': [5, .03, .04], 'Power Forward': [-5, 0, .08], 'Center': [-15, -.06, .12] };
export const HOOP = { x: 872, y: 300 };
export class Basketball extends Game {
  constructor() { super(); this.sport = 'basketball'; this.pos = pick(Object.keys(BPOS)); this.n = 0; this.lim = 6; this.sc = { you: 0, cpu: 0 }; this.after(2, () => this.poss(), `You were randomly picked to play <b>${this.pos}</b>!`); }
  again() { return new Basketball(); }
  map = 'side';
  get labels() { return { q: 'Shoot', t: 'Pass', r: 'Catch', w: 'Sprint' }; }
  poss() {
    if (this.n >= this.lim) return this.end(); this.n++;
    this.me = { x: 380, y: 300 }; this.mates = [{ x: 650, y: 120, hx: 650, hy: 120 }, { x: 680, y: 480, hx: 680, hy: 480 }];
    this.def = [[470, 300, 'me'], [700, 160, 0], [720, 440, 1]].map(([x, y, m]) => ({ x, y, m, sp: 125 + Math.random() * 25 }));
    this.has = 'me'; this.ballF = null; this.clock = 12; this.mode = 'live'; this.shot = null; this.dir = { x: 1, y: 0 }; this.rAt = -9; this.t = 0;
    msg(`Possession ${this.n} of ${this.lim}. Drive with the arrows, <kbd>Q</kbd> to shoot, <kbd>T</kbd> to pass. Catch passes with <kbd>R</kbd>.`);
  }
  update(dt) {
    if (this.shot) this.shot.t += dt; if (this.tick(dt)) return; if (this.mode !== 'live') return; this.t += dt; this.clock -= dt;
    if (this.clock <= 0) return this.done(0, 'Shot clock violation!');
    const me = this.me, [spb] = BPOS[this.pos], a = arrows(this.map), sp = (165 + str() + spb) * (held('w') ? 1.25 : 1);
    if (a.any) this.dir = { x: a.x, y: a.y }; me.x = clamp(me.x + a.x * sp * dt, 300, 925); me.y = clamp(me.y + a.y * sp * dt, 60, 540);
    this.mates.forEach((m, i) => { stepTo(m, m.hx + Math.sin(this.t * 1.3 + i * 2) * 40, m.hy + Math.cos(this.t * 1.1 + i) * 30, 90, dt); if (this.has === i) { m.hold -= dt; if (m.hold <= 0) this.pass(m, 'me'); } });
    for (const d of this.def) { const m = d.m === 'me' ? me : this.mates[d.m], dx = HOOP.x - m.x, dy = HOOP.y - m.y, dl = Math.hypot(dx, dy) || 1; stepTo(d, m.x + dx / dl * 34, m.y + dy / dl * 34, d.sp, dt); }
    if (this.has === 'me' && D(this.def[0], me) < 20 && Math.random() < dt * .55) return this.done(0, 'Stolen! Keep moving to shake your defender.');
    if (this.ballF) {
      const f = this.ballF;
      for (const d of this.def) if (!f.chk.has(d) && D(d, f) < 15) { f.chk.add(d); if (Math.random() < .45) return this.done(0, 'Pass picked off!'); }
      const tgt = f.to === 'me' ? me : this.mates[f.to]; f.tx = tgt.x; f.ty = tgt.y;
      if (stepTo(f, f.tx, f.ty, f.sp, dt)) { if (f.to === 'me') { if (this.t - this.rAt < .35) { this.has = 'me'; this.ballF = null; msg('Got it!'); } else return this.done(0, "You didn't catch it — press R when the pass arrives!"); } else { this.has = f.to; this.mates[f.to].hold = .9; this.ballF = null; } }
      else if (f.to === 'me' && this.t - this.rAt < .15 && D(f, me) < 45) { this.has = 'me'; this.ballF = null; msg('Got it!'); }
    }
  }
  pass(from, to) { this.has = null; this.ballF = { x: from.x, y: from.y, tx: 0, ty: 0, sp: 480, to, chk: new Set() }; if (to === 'me') msg('Pass coming back — press <kbd>R</kbd> to catch!'); }
  key(k) {
    if (this.mode !== 'live') return; const me = this.me;
    if (k === 'r') this.rAt = this.t;
    if (k === 't' && this.has === 'me') { let best = 0, bv = -9; this.mates.forEach((m, i) => { const dx = m.x - me.x, dy = m.y - me.y, dl = Math.hypot(dx, dy) || 1, v = (dx * this.dir.x + dy * this.dir.y) / dl; if (v > bv) { bv = v; best = i; } }); this.pass(me, best); }
    if (k === 'q' && this.has === 'me') {
      const [, three, close] = BPOS[this.pos], d = D(me, HOOP), is3 = d >= 250;
      let p = d < 120 ? .68 + close : is3 ? .37 + three : .5; const c = Math.min(...this.def.map(x => D(x, me))); if (c < 40) p -= .25; else if (c < 75) p -= .1; p += str() / 400;
      const ok = Math.random() < p, pts = is3 ? 3 : 2; this.has = null; this.mode = 'shot'; this.shot = { t: 0, x: me.x, y: me.y, ok };
      this.after(1.1, () => this.done(ok ? pts : 0, ok ? `Swish! +${pts}` : 'Clank — no good.'));
    }
  }
  done(p, t) { this.mode = 'done'; this.sc.you += p; const r = Math.random(), c = r < .12 ? 3 : r < .55 ? 2 : 0; this.sc.cpu += c; this.after(2.2, () => this.poss(), `${t} Then CPU ${c ? `scores ${c}` : 'misses'} at the other end.`); }
  end() { if (this.sc.you === this.sc.cpu && this.lim < 12) { this.lim += 2; return this.after(1.6, () => this.poss(), 'Tied! Overtime — 2 more possessions.'); } this.finish(this.sc.you > this.sc.cpu, `Final: You ${this.sc.you} – ${this.sc.cpu} CPU. You played ${this.pos}.`); }
  board() { return `${this.pos} · Possession ${this.n}/${this.lim} · Shot clock ${Math.max(0, Math.ceil(this.clock || 0))}`; }
}

/* ================= SOCCER PENALTIES ================= */
export const GL = { x1: 300, x2: 660, y1: 150, y2: 330 };
export class Soccer extends Game {
  constructor() { super(); this.sport = 'soccer'; this.r = 0; this.sc = { you: 0, cpu: 0 }; this.mode = ''; this.mine = true; this.kp = { x: 480 }; this.after(1.6, () => this.yourKick(), 'Penalty shootout! 5 kicks each.'); }
  again() { return new Soccer(); }
  get map() { return this.mine ? 'plain' : 'flip'; }
  get labels() { return this.mine ? { q: 'Shoot' } : { r: 'Dive' }; }
  yourKick() { this.r++; this.mine = true; this.mode = 'aim'; this.cross = { x: 480, y: 250 }; this.kp = { x: 480 }; this.t = 0; this.shot = null; msg(`Your kick ${this.r}. Move the target with the arrows — corners are hardest to save. Press <kbd>Q</kbd> to shoot.`); }
  cpuKick() { this.mine = false; this.mode = 'runup'; this.timer = 1.1 + Math.random() * .8; this.kp = { x: 480, dive: 0, dir: 0 }; this.shot = null; this.t = 0; msg(`CPU kick ${this.r}. You're in goal — slide with the arrows and press <kbd>R</kbd> to dive and catch!`); }
  update(dt) {
    if (this.tick(dt)) return; this.t += dt; const a = arrows(this.map), k = this.kp;
    if (this.mode === 'aim') { const c = this.cross; c.x = clamp(c.x + a.x * 300 * dt, 250, 710); c.y = clamp(c.y + a.y * 300 * dt, 110, 350); k.x = 480 + Math.sin(this.t * 2.3) * 55; }
    else if (this.mode === 'shot') {
      const s = this.shot; s.t += dt;
      if (this.mine) { if (s.t > .18) stepTo(k, clamp(s.tx, GL.x1 + 20, GL.x2 - 20), 0, 430, dt); }
      else { if (k.dive > 0) { k.dive -= dt; k.x = clamp(k.x + k.dir * 520 * dt, GL.x1, GL.x2); } else k.x = clamp(k.x + a.x * 250 * dt, GL.x1, GL.x2); if (a.any) k.dir = Math.sign(a.x) || k.dir; }
      if (s.t >= s.dur) this.resolve();
    } else if (this.mode === 'runup') {
      if (k.dive > 0) { k.dive -= dt; k.x = clamp(k.x + k.dir * 520 * dt, GL.x1, GL.x2); } else k.x = clamp(k.x + a.x * 250 * dt, GL.x1, GL.x2);
      if (a.any) k.dir = Math.sign(a.x) || k.dir;
      this.timer -= dt; if (this.timer <= 0) { this.mode = 'shot'; this.shot = { t: 0, dur: .62, tx: GL.x1 + 25 + Math.random() * (GL.x2 - GL.x1 - 50), ty: GL.y1 + 20 + Math.random() * (GL.y2 - GL.y1 - 30) }; }
    }
  }
  key(k) {
    if (this.mode === 'aim' && k === 'q') { this.mode = 'shot'; this.shot = { t: 0, dur: Math.max(.3, .55 - str() / 500), tx: this.cross.x, ty: this.cross.y }; }
    if (!this.mine && k === 'r' && (this.mode === 'runup' || this.mode === 'shot') && !(this.kp.dive > 0) && !this.kp.used) { this.kp.dive = .35; this.kp.used = true; }
  }
  resolve() {
    const s = this.shot, k = this.kp, inGoal = s.tx > GL.x1 && s.tx < GL.x2 && s.ty > GL.y1 && s.ty < GL.y2; this.mode = 'done'; let goal, t;
    if (this.mine) {
      const reach = s.ty > 210 ? 50 : 34;
      if (!inGoal) { goal = false; t = s.ty <= GL.y1 ? 'Over the bar!' : 'Wide of the post!'; } else if (Math.abs(k.x - s.tx) < reach) { goal = false; t = 'Saved!'; } else { goal = true; t = 'GOAL!'; }
      s.goal = goal; if (goal) this.sc.you++; return this.after(1.8, () => this.cpuKick(), t);
    }
    const reach = k.used ? 74 : 40; if (Math.abs(k.x - s.tx) < reach && (k.used || s.ty > 200)) { goal = false; t = 'What a save!'; } else { goal = true; t = 'CPU scores.'; }
    s.goal = goal; if (goal) this.sc.cpu++; this.after(1.8, () => this.next(), t);
  }
  next() { const r = this.r; if ((r >= 5 && this.sc.you !== this.sc.cpu) || r >= 10) return this.finish(this.sc.you > this.sc.cpu, `Final: You ${this.sc.you} – ${this.sc.cpu} CPU`); if (r >= 5) msg('Tied — sudden death!'); this.yourKick(); }
  board() { return `Penalties · Round ${this.r} · ${this.mine ? 'You shoot' : 'You save'}`; }
}

/* ================= GYM ================= */
export class Training extends Game {
  constructor() { super(); this.sport = 'gym'; this.timer = 8; this.reps = 0; this.lift = 0; this.phase = 'lift'; this.sc = null; msg('Mash <kbd>Q</kbd> (Lift) as fast as you can! 8 seconds.'); }
  again() { return new Training(); }
  map = 'plain';
  get labels() { return { q: 'Lift' }; }
  update(dt) { if (this.phase !== 'lift') return; this.timer -= dt; this.lift = Math.max(0, this.lift - dt * 2.5); if (this.timer <= 0) { this.phase = 'done'; this.over = true; E.trainDone(this.reps); } }
  key(k) { if (k === 'q' && this.phase === 'lift') { this.reps++; this.lift = Math.min(1, this.lift + .3); } }
  board() { return `Gym · Reps ${this.reps} · ${Math.max(0, this.timer).toFixed(1)}s`; }
}
