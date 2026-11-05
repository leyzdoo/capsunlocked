// Ping Pong — a real table; the robot is a human-shaped figure holding a real paddle.
import * as THREE from 'three';
import { G, save, modal, levelComplete, levelFailed, setHelp } from '../game.js';
import { rng, clamp } from '../logic.js';
import { makeRoom, box, std } from './common.js';
import { mat } from '../tex.js';

const L = 2.74, TW = 1.525, TH = .76, BR = .022, LINE = L / 2 + .15;

function paddleMesh(color) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .012, 28), std(color, .7)); blade.rotation.x = Math.PI / 2; blade.castShadow = true; g.add(blade);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(.084, .084, .006, 28), std(0x111111, .7)); back.rotation.x = Math.PI / 2; back.position.z = -.008; g.add(back);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(.028, .1, .022), mat('wood', ['#c49a64', 2, 131], 1, 1)); handle.position.y = -.12; handle.castShadow = true; g.add(handle);
  return g;
}

export async function enter({ level, mode, camera, makeCharacter }) {
  const pvp = mode === 'pvp';
  const R = makeRoom({ w: 16, d: 20, h: 6, floor: ['wood', ['#b98a5a', 10, 132]], floorTile: 3, wall: '#dfe7ee', lamps: 6, doorColor: 0x14385a });
  const S = R.scene;
  // table
  const top = new THREE.MeshStandardMaterial({ color: 0x1d5f8f, roughness: .45 });
  S.add(box(TW, .04, L, top, 0, TH - .02, 0));
  const white = std(0xffffff, .5);
  [[TW, .005, .02, 0, TH + .001, L / 2 - .01], [TW, .005, .02, 0, TH + .001, -L / 2 + .01], [.02, .005, L, TW / 2 - .01, TH + .001, 0], [.02, .005, L, -TW / 2 + .01, TH + .001, 0], [.005, .005, L, 0, TH + .001, 0]]
    .forEach(a => S.add(box(a[0], a[1], a[2], white, a[3], a[4], a[5])));
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([s, t]) => S.add(box(.06, TH - .04, .06, std(0x2a2a2a, .4, .6), s * (TW / 2 - .15), (TH - .04) / 2, t * (L / 2 - .3))));
  S.add(box(TW - .3, .04, .04, std(0x2a2a2a, .4, .6), 0, .3, L / 2 - .3)); S.add(box(TW - .3, .04, .04, std(0x2a2a2a, .4, .6), 0, .3, -L / 2 + .3));
  // net
  const net = new THREE.Mesh(new THREE.PlaneGeometry(TW + .3, .15), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .55, side: THREE.DoubleSide, roughness: .9 }));
  net.position.set(0, TH + .075, 0); S.add(net); S.add(box(TW + .3, .015, .015, white, 0, TH + .15, 0));
  [-1, 1].forEach(s => S.add(box(.03, .17, .03, std(0x222222, .4, .6), s * (TW / 2 + .15), TH + .08, 0)));
  // barriers + scoreboard
  for (let i = -3; i <= 3; i++) { [-1, 1].forEach(s => { if (Math.abs(i) > 0 || s < 0) S.add(box(1.9, .7, .05, std(0x0f2b45, .5), i * 2.1, .35, s * 6.5)); }); }
  const sbc = document.createElement('canvas'); sbc.width = 1024; sbc.height = 384; const sbt = new THREE.CanvasTexture(sbc); sbt.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.5), new THREE.MeshBasicMaterial({ map: sbt, toneMapped: false })); board.position.set(0, 3.6, -9.9); S.add(board); S.add(box(4.2, 1.7, .1, std(0x111111, .4), 0, 3.6, -9.97));

  // players
  const bot = makeCharacter('robot'); bot.root.position.set(0, 0, -L / 2 - .62); if (!pvp) S.add(bot.root);
  const hand = bot.bone('RightHand');
  const botPaddle = paddleMesh(0xc8202a); S.add(botPaddle);
  const myPaddle = paddleMesh(0x1d4fbf); S.add(myPaddle);
  const p2Paddle = paddleMesh(0xc8202a); if (pvp) S.add(p2Paddle);
  const ballM = new THREE.Mesh(new THREE.SphereGeometry(BR, 20, 14), std(0xff9a1a, .35)); ballM.castShadow = true; S.add(ballM);
  const shadowM = new THREE.Mesh(new THREE.CircleGeometry(BR * 1.2, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false })); shadowM.rotation.x = -Math.PI / 2; S.add(shadowM);

  // rules
  const up = G.S.data.up, boost = pvp ? 0 : up.paddle;
  const target = pvp ? 7 : level <= 5 ? 3 : level <= 15 ? 5 : 7;
  const baseSpeed = (pvp ? 1.05 : Math.min(2.3, .85 + level * .045)) * 1.75;
  const robotSpeed = Math.min(2.4, .5 + level * .07) * TW, robotErr = Math.max(.015, .2 - level * .007) * TW;
  const st = {
    p1: { x: 0, tx: 0, w: .34 * (1 + .14 * boost) }, p2: { x: 0, tx: 0, w: .34 },
    ball: { x: 0, z: 0, vx: 0, vz: 0, hitZ: 0, tgtZ: 0, y: TH + .3 }, score: [0, 0], pause: 1.4, serveTo: 0, over: false, err: 0, msg: 'Get ready!', swing1: 0, swing2: 0
  };
  const r = rng(Date.now() % 1e9);
  function aim(fromX, toward, spd, off) { // toward: +1 = to the player's end, -1 = robot's end
    const b = st.ball, dist = 2 * LINE, T = dist / spd;
    const tx = clamp(fromX * .3 + (off != null ? off * .55 : (r() - .5) * 1.0), -TW / 2 + .1, TW / 2 - .1);
    b.vz = toward * spd; b.vx = (tx - fromX) / T; b.hitZ = b.z; b.tgtZ = toward * LINE;
  }
  function serve() { const b = st.ball, dir = st.serveTo === 0 ? 1 : -1; b.x = 0; b.z = -dir * LINE * .9; aim(0, dir, baseSpeed, null); st.err = (r() - .5) * 2 * robotErr; }
  function scoreboard() {
    const c = sbc.getContext('2d'); c.fillStyle = '#0b1622'; c.fillRect(0, 0, 1024, 384);
    c.font = '700 44px Nunito, Arial'; c.textAlign = 'center'; c.fillStyle = '#9fc6ea';
    c.fillText(pvp ? 'PLAYER 2' : 'ROBOT · L' + level, 256, 70); c.fillText(pvp ? 'PLAYER 1' : G.S.name.toUpperCase(), 768, 70);
    c.font = '600 200px Fredoka, Arial'; c.fillStyle = '#ff6b6b'; c.fillText(st.score[1], 256, 290); c.fillStyle = '#6fb6ff'; c.fillText(st.score[0], 768, 290);
    c.font = '700 32px Nunito'; c.fillStyle = '#ffffffaa'; c.fillText('first to ' + target, 512, 360);
    sbt.needsUpdate = true;
    setHelp(st.msg ? st.msg : (pvp ? 'Each player drags on their own side of the table' : 'Move your finger left and right to move your paddle') + (up.lives && !pvp ? '   ·   ❤️ ' + up.lives : ''));
  }
  function point(winner) { // 0 = you / player 1, 1 = robot / player 2
    st.score[winner]++; st.serveTo = winner === 0 ? 1 : 0; st.pause = 1.1; st.ball.vx = st.ball.vz = 0;
    st.msg = pvp ? (winner === 0 ? 'Point for Player 1' : 'Point for Player 2') : (winner === 0 ? 'Your point!' : 'Robot scores');
    if (!pvp) bot.play(winner === 1 ? 'agree' : 'headShake');
    if (st.score[winner] >= target) end(winner);
    scoreboard();
  }
  function end(winner) {
    st.over = true;
    setTimeout(() => {
      if (pvp) { G.S.data.wins2p.pong++; save(); modal({ big: '🏓', title: (winner === 0 ? 'Player 1' : 'Player 2') + ' wins!', text: st.score[0] + ' – ' + st.score[1], acts: [{ label: 'Rematch', cls: 'go', fn: () => G.enterRoom('pong', { mode: 'pvp' }) }, { label: 'Go back outside', cls: 'ghost', fn: () => G.backToTown() }] }); }
      else if (winner === 0) { bot.play('sad_pose'); levelComplete('pong', level, 'You won ' + st.score[0] + ' – ' + st.score[1] + '!'); }
      else levelFailed('pong', level, 'The robot won ' + st.score[1] + ' – ' + st.score[0] + '.' + (up.lives ? ' You have ' + up.lives + ' extra ' + (up.lives === 1 ? 'life' : 'lives') + '.' : ' Extra lives are 10 coins at the Game Store.'),
        up.lives ? [{ label: '❤️ Use a life — keep playing', cls: 'primary', fn: () => { up.lives--; save(); st.score[1] = Math.max(0, target - 2); st.over = false; st.pause = 1.3; st.msg = 'Extra life! Keep going'; st.serveTo = 1; scoreboard(); } }] : null);
    }, 600);
  }
  // camera
  function frameCamera() {
    const a = innerWidth / innerHeight;
    if (pvp) { camera.up.set(a >= 1 ? -1 : 0, 0, a >= 1 ? 0 : -1); camera.position.set(0, a >= 1 ? 3.3 : 4.6, .001); camera.lookAt(0, TH, 0); camera.fov = 50; }
    else { camera.up.set(0, 1, 0); const k = a < 1 ? 1.45 : 1; camera.position.set(0, 2.6 + .3 * k, L / 2 + 2.6 * k); camera.lookAt(0, 1.1, -1.5); camera.fov = 52; }
    camera.updateProjectionMatrix();
  }
  frameCamera(); let lastAspect = innerWidth / innerHeight;
  // input: point at the table to place your paddle
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TH + .15)), hp = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), side = {};
  function aimAt(e, isDown) {
    const rc = G.renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, hp)) return;
    if (isDown || side[e.pointerId] == null) side[e.pointerId] = pvp ? (hp.z > 0 ? 1 : 2) : 1;
    const p = side[e.pointerId] === 1 ? st.p1 : st.p2; p.tx = clamp(hp.x, -TW / 2 - .2, TW / 2 + .2);
  }
  const keys = {};
  const kd = e => { keys[e.key] = true; }, ku = e => { keys[e.key] = false; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const handPos = new THREE.Vector3();
  scoreboard();
  return {
    _dbg: () => ({ score: st.score, ball: st.ball, p1: st.p1.x, p2: st.p2.x, over: st.over }),
    scene: S, camera, title: pvp ? 'Ping Pong · 2 players' : 'Ping Pong · Level ' + level, help: '', multiTouch: true,
    pointer: { down(e) { aimAt(e, true); return true; }, move(e) { aimAt(e, false); }, up(e) { delete side[e.pointerId]; } },
    update(dt) {
      if (Math.abs(innerWidth / innerHeight - lastAspect) > .01) { lastAspect = innerWidth / innerHeight; frameCamera(); }
      const step = Math.min(dt, .033) / 3;
      for (let k = 0; k < 3; k++) tick(step);
      // visuals
      const b = st.ball;
      ballM.position.set(b.x, b.y, b.z); shadowM.position.set(b.x, Math.abs(b.x) < TW / 2 && Math.abs(b.z) < L / 2 ? TH + .002 : .002, b.z);
      myPaddle.position.set(st.p1.x, TH + .2, LINE + .05); myPaddle.rotation.set(-.35 + st.swing1, 0, -st.p1.x * .4);
      if (pvp) { p2Paddle.position.set(st.p2.x, TH + .2, -LINE - .05); p2Paddle.rotation.set(.35 - st.swing2, Math.PI, st.p2.x * .4); }
      else {
        // move the robot so its hand (and paddle) lines up with where it wants the paddle
        bot.update(dt); bot.speedBlend(0);
        if (hand) { hand.getWorldPosition(handPos); bot.root.position.x += (st.p2.x - handPos.x); }
        else handPos.set(st.p2.x, 1, bot.root.position.z);
        botPaddle.position.set(st.p2.x, Math.max(TH + .12, handPos.y), -LINE - .05); botPaddle.rotation.set(.35 - st.swing2, Math.PI, .2);
      }
      st.swing1 *= .85; st.swing2 *= .85;
    },
    exit() { removeEventListener('keydown', kd); removeEventListener('keyup', ku); camera.up.set(0, 1, 0); }
  };
  function tick(dt) {
    const b = st.ball;
    if (keys.ArrowLeft) st.p1.tx -= 2.4 * dt; if (keys.ArrowRight) st.p1.tx += 2.4 * dt;
    if (pvp) { if (keys.a) st.p2.tx -= 2.4 * dt; if (keys.d) st.p2.tx += 2.4 * dt; }
    st.p1.tx = clamp(st.p1.tx, -TW / 2 - .2, TW / 2 + .2); st.p2.tx = clamp(st.p2.tx, -TW / 2 - .2, TW / 2 + .2);
    [st.p1, pvp ? st.p2 : null].forEach(p => { if (p) p.x += clamp(p.tx - p.x, -6 * dt, 6 * dt); });
    if (!pvp) { // robot: predict where the ball will cross its line
      let want = 0;
      if (b.vz < 0) want = b.x + b.vx * ((b.z + LINE) / -b.vz) + st.err;
      st.p2.x += clamp(want - st.p2.x, -robotSpeed * dt, robotSpeed * dt);
    }
    if (st.over) return;
    if (st.pause > 0) { st.pause -= dt; if (st.pause <= 0) { st.msg = ''; scoreboard(); serve(); } b.y = TH + .3; return; }
    b.x += b.vx * dt; b.z += b.vz * dt;
    // height: arc → bounce on the far half → rise to the paddle
    const s = clamp((b.z - b.hitZ) / (b.tgtZ - b.hitZ || 1), 0, 1.3), sb = .62;
    if (s < sb) { const u = s / sb; b.y = (1 - u) * (1 - u) * (TH + .2) + 2 * u * (1 - u) * (TH + .62) + u * u * (TH + BR); }
    else { const u = Math.min(1.3, (s - sb) / (1 - sb)); b.y = (1 - u) * (1 - u) * (TH + BR) + 2 * u * (1 - u) * (TH + .48) + u * u * (TH + .2); }
    // hits
    if (b.vz > 0 && b.z >= LINE && b.z - b.vz * dt < LINE + .001) {
      if (Math.abs(b.x - st.p1.x) <= st.p1.w / 2 + BR + .03) { const off = (b.x - st.p1.x) / (st.p1.w / 2); aim(b.x, -1, Math.min(Math.abs(b.vz) * 1.045 * (pvp ? 1 : 1 + boost * .03), 5.6), clamp(off, -1, 1)); b.z = LINE; st.swing1 = .9; st.err = (r() - .5) * 2 * robotErr; }
    }
    if (b.vz < 0 && b.z <= -LINE && b.z - b.vz * dt > -LINE - .001) {
      if (Math.abs(b.x - st.p2.x) <= st.p2.w / 2 + BR + .03) { const off = (b.x - st.p2.x) / (st.p2.w / 2); aim(b.x, 1, Math.min(Math.abs(b.vz) * 1.045, 5.6), clamp(off, -1, 1)); b.z = -LINE; st.swing2 = .9; }
    }
    if (b.z > LINE + .7) point(1); else if (b.z < -LINE - .7) point(0);
  }
}
