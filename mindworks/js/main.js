// Mindworks 3D — boot, sign-in, walking around town, entering buildings.
import * as THREE from 'three';
import { G, $, el, GAMES, MASTER, COLORS, Store, defaultData, normalize, save, flush, toast, modal, closeModal, modalOpen, refreshCoins, setHelp, setTitle, setRoomButtons, openPanel, closePanel, jigsawUnlocked, masteredCount } from './game.js';
import { createTown, paintPlaque } from './town.js';
import { currentHome } from './homes.js';
import { createWorld, WATER_Y, blockName, roofY, biomeOf, airportAt, slotAt, runwayAt } from './world.js';
import { CARS, BOATS, PLANES, ITEMS, makeCar, makeBoat, makePlane, capacity, bagCount, today, TELEPORTER_PRICE } from './vehicles.js';
import { loadCharacter, makeCharacter } from './character.js';
import { SEATS, drawMap } from './jumbo.js';
import { DOOR_OUT } from './cabins.js';
import { setAnisotropy } from './tex.js';
import { ROOMS } from './rooms/index.js';

const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
G.renderer = renderer; setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 230);
const fade = el('div', { style: 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .25s;z-index:35' }); document.body.appendChild(fade);
const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

/* ---------------- input ---------------- */
const keys = {}, joy = { x: 0, y: 0, id: null }, input = { run: false };
G.input = input;
G.camYawTo = y => { cam.yaw = cam.tYaw = y; };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  keys[e.key.toLowerCase()] = true;
  if ((e.key === 'Enter' || e.key === 'e' || e.key === 'E') && !modalOpen() && !$('prompt').classList.contains('hide')) $('promptBtn').click();
  if (e.key === 'Escape' && active && active !== townPlace && !modalOpen()) leaveBuilding();
  if (active && active.key) active.key(e);
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
(function joystick() {
  const pad = $('joy'), knob = $('knob'), R = 50;
  function set(e) { const r = pad.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; joy.x = dx / R; joy.y = -dy / R; }
  pad.addEventListener('pointerdown', e => { joy.id = e.pointerId; pad.setPointerCapture(e.pointerId); set(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === joy.id) set(e); });
  const end = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  $('runBtn').addEventListener('pointerdown', e => { e.preventDefault(); input.run = !input.run; $('runBtn').classList.toggle('on', input.run); });
})();
// canvas: buildings get first chance at pointer events; otherwise drag turns the camera
const cam = { yaw: 0, pitch: .38, dist: 6.5, height: 1.45, tYaw: 0, drag: null, target: new THREE.Vector3() };
canvas.addEventListener('pointerdown', e => {
  if (modalOpen()) return;
  if (active && active.pointer && active.pointer.down(e) === true) { canvas.setPointerCapture(e.pointerId); (active._ptrs = active._ptrs || new Set()).add(e.pointerId); return; }
  if (active && active.walks) { cam.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener('pointermove', e => {
  if (active && active._ptrs && active._ptrs.has(e.pointerId)) { if (active.pointer.move) active.pointer.move(e); return; }
  if (active && active.pointer && active.pointer.hover) active.pointer.hover(e);
  if (cam.drag && cam.drag.id === e.pointerId) {
    cam.yaw -= (e.clientX - cam.drag.x) * .0065; cam.pitch = THREE.MathUtils.clamp(cam.pitch + (e.clientY - cam.drag.y) * .004, .12, 1.15);
    cam.drag.x = e.clientX; cam.drag.y = e.clientY;
  }
});
const ptrEnd = e => {
  if (active && active._ptrs && active._ptrs.has(e.pointerId)) { active._ptrs.delete(e.pointerId); active.pointer.up && active.pointer.up(e); }
  if (cam.drag && cam.drag.id === e.pointerId) cam.drag = null;
};
canvas.addEventListener('pointerup', ptrEnd); canvas.addEventListener('pointercancel', ptrEnd);
document.addEventListener('gesturestart', e => e.preventDefault());

/* ---------------- collisions ---------------- */
export function collide(p, r, boxes) {
  for (let pass = 0; pass < 2; pass++) for (const b of boxes) {
    const cx = Math.max(b.x1, Math.min(p.x, b.x2)), cz = Math.max(b.z1, Math.min(p.z, b.z2));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else { // centre inside the box: push out the shortest way
        const opts = [[b.x1 - r - p.x, 0], [b.x2 + r - p.x, 0], [0, b.z1 - r - p.z], [0, b.z2 + r - p.z]].sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]));
        p.x += opts[0][0]; p.z += opts[0][1];
      }
    }
  }
}

/* ---------------- world ---------------- */
let town = null, world = null, player = null, townPlace = null, active = null, lastDoor = null;
function setProgress(p, t) { $('loadBar').style.width = Math.round(p * 100) + '%'; if (t) $('loadTxt').textContent = t; }
async function boot() {
  setProgress(.15, 'Loading your character…');
  await loadCharacter(new URL('../models/Xbot.glb', import.meta.url).href);
  setProgress(.55, 'Building the town…');
  await new Promise(r => setTimeout(r, 30));
  town = createTown(renderer);
  setProgress(.75, 'Building the blocks around town…');
  await new Promise(r => setTimeout(r, 30));
  world = createWorld(town); world.ensure(town.spawn.pos, true);
  setProgress(.9, 'Opening the doors…');
  townPlace = {
    id: 'town', scene: town.scene, walks: true, cam: { dist: 6.5, pitch: .38 },
    get colliders() { return town.colliders; },
    collidersAt: p => town.colliders.concat(world.collidersAt(p)).filter(c => !(c.top != null && p.y > c.top - 1)), // up on a roof, the building isn't in your way
    get camBlockers() { const pp = player.root.position; if ((ride && ride.type === 'plane' && ride.alt > 3) || pp.y > world.heightAt(pp.x, pp.z) + 3) return []; return town.camBlockers.concat(world.camBlockers(player.root.position)); },
    heightAt: p => { if (ride && ride.type === 'plane') return p.y; if (ride && ride.type === 'boat') return WATER_Y + .05; const r = roofAt(p.x, p.z); return r > p.y - 1.5 && r < p.y + 1.5 ? r : world.heightAt(p.x, p.z); },
    blocked: p => ride && ride.type === 'plane' ? false : onRoofEdge(p) ? true : ride && ride.type === 'boat' ? world.heightAt(p.x, p.z) > WATER_Y - .2 : world.blocked(p),
    camClamp(p) { p.y = Math.max(p.y, world.heightAt(p.x, p.z) + .5); },
    interact() { if (ride && ride.type === 'plane') return []; if (ride && ride.type === 'boat') return boatActs(); return town.doors.map(d => ({ pos: d.pos, r: 2.0, ...doorAction(d) })).concat(world.interact(player.root.position), boatActs(), parkedActs()); },
    update(dt) { const yy = Math.max(0, player.root.position.y); town.scene.fog.near = 60 + yy * .8; town.scene.fog.far = 175 + yy * 1.4; const fr = 230 + yy * 1.6; if (Math.abs(camera.far - fr) > 5) { camera.far = fr; camera.updateProjectionMatrix(); } // see farther from up high
      town.followShadow(player.root.position); world.update(dt, player.root.position); if (ride) rideTick(dt); syncT += dt; if (syncT > .5) { syncT = 0; syncPlanes(); } }
  };
  // warm-up render so the first frame after sign-in is quick
  player = makeCharacter('player', 0x3f7fd9); placeInTown(town.spawn.pos, town.spawn.yaw);
  active = townPlace; renderer.compile(town.scene, camera);
  setProgress(1);
  $('loading').classList.add('hide'); $('login').classList.remove('hide');
  requestAnimationFrame(loop);
}
/* skyscraper roofs: helicopters land on them and you can walk around up there */
function roofAt(x, z) { let y = world ? world.roofAt(x, z) : -1e9; for (const r of town.roofs || []) if (x > r.x1 && x < r.x2 && z > r.z1 && z < r.z2) y = Math.max(y, roofY(r, x, z)); return y; }
const floorAt = (x, z) => Math.max(world.heightAt(x, z), roofAt(x, z));
function onRoofEdge(p) { return !ride && p.y > world.heightAt(p.x, p.z) + 2.5 && roofAt(p.x, p.z) < p.y - 1.5; } // don't walk off the roof
/* stairways between upper floors in your house */
G.moveFloor = y => { fade.style.opacity = 1; setTimeout(() => { player.root.position.y = y; cam.target.y = y + cam.height; fade.style.opacity = 0; }, 250); };
G.chooseFloor = list => modal({ big: '🪜', title: 'Which way?', acts: list.map(x => ({ label: x.label, cls: 'go', fn: x.fn })).concat([{ label: 'Stay here', cls: 'ghost' }]) });
function placeInTown(pos, faceYaw) {
  camera.fov = 55; camera.updateProjectionMatrix();
  if (world) world.ensure(pos, true);
  town.scene.add(player.root); player.root.position.copy(pos); if (world) player.root.position.y = world.heightAt(pos.x, pos.z); player.root.rotation.y = faceYaw;
  cam.yaw = cam.tYaw = faceYaw; cam.pitch = .38; cam.dist = 6.5; cam.target.copy(pos);
}
function doorAction(d) {
  const lv = G.S.data ? G.S.data.levels : {};
  if (d.id === 'home') return { label: 'Go inside your ' + currentHome().name, sub: 'Your home', fn: () => G.enterRoom('home', {}) };
  if (d.id === 'homeBack') return { label: '🚪 Go in the back door', sub: 'Your ' + currentHome().name, fn: () => G.enterRoom('home', { door: 'back' }) };
  if (d.id === 'store') return { label: 'Go into the Game Store', sub: 'Upgrades and your house', fn: () => G.enterRoom('store', {}) };
  if (d.id === 'jigsaw') {
    if (!jigsawUnlocked() && !G.preview) return { label: '🔒 Jigsaw is locked', sub: masteredCount() + ' of 5 games at level 25', fn: () => modal({ big: '🔒', title: 'Not yet!', text: 'The Jigsaw opens when all five games reach level 25. You have ' + masteredCount() + ' of 5.', acts: [{ label: 'OK', cls: 'go' }] }) };
    return { label: 'Go into Jigsaw', sub: (G.S.data.jigsaws || []).length + ' finished', fn: () => G.enterRoom('jigsaw', {}) };
  }
  const g = GAMES.find(x => x.id === d.id), next = (lv[d.id] || 0) + 1;
  return {
    label: 'Go into ' + g.name, sub: 'Level ' + next + (lv[d.id] >= MASTER ? ' · ★ mastered' : ' · ' + Math.min(lv[d.id], MASTER) + '/25'),
    fn: () => {
      if (d.id === 'chess' || d.id === 'pong') modal({ big: d.id === 'chess' ? '♟️' : '🏓', title: g.name, text: 'Who are you playing?', acts: [
        { label: 'Play the robot · Level ' + next, cls: 'go', fn: () => G.enterRoom(d.id, { level: next }) },
        { label: '2 players on this iPad', cls: 'primary', fn: () => G.enterRoom(d.id, { mode: 'pvp' }) },
        { label: 'Not now', cls: 'ghost' }] });
      else G.enterRoom(d.id, { level: next });
    }
  };
}

/* ---------------- entering / leaving buildings ---------------- */
let switching = false;
G.enterRoom = async (id, opts = {}) => {
  if (switching) return; switching = true;
  if (ride) stopRide(true);
  closeModal(); closePanel();
  fade.style.opacity = 1; await wait(260);
  if (active && active !== townPlace && active.exit) active.exit();
  if (active === townPlace) lastDoor = opts.doorObj || town.doors.find(d => d.id === (opts.door === 'back' ? 'homeBack' : id)) || lastDoor;
  try {
    const level = opts.level != null ? opts.level : (G.S.data.levels[id] || 0) + 1;
    const room = await ROOMS[id].enter({ level, mode: opts.mode || 'robot', player, camera, makeCharacter, door: opts.door, data: opts.data });
    room.id = id; active = room;
    camera.up.set(0, 1, 0);
    if (room.walks) {
      camera.fov = 55; camera.updateProjectionMatrix();
      room.scene.add(player.root); player.root.position.copy(room.start || new THREE.Vector3()); player.root.rotation.y = room.startYaw || Math.PI;
      cam.yaw = cam.tYaw = room.camYaw ?? 0; cam.target.copy(player.root.position);
    }
    setTitle(room.title || id); setHelp(room.help || '');
    const btns = (room.buttons || []).concat([{ label: '🚪 Leave', fn: leaveBuilding, cls: 'ghost' }]);
    setRoomButtons(btns);
  } catch (err) { console.error(err); toast('That building had a problem opening.'); active = townPlace; }
  showJoy(); fade.style.opacity = 0; switching = false;
};
function leaveBuilding() { G.backToTown(); }
G.backToTown = async (doorId) => {
  if (switching) return;
  if (typeof doorId === 'string') lastDoor = town.doors.find(d => d.id === doorId) || lastDoor;
  else if (doorId && doorId.pos) lastDoor = doorId; // a spot that isn't a building door (like outside a plane)
  switching = true;
  closeModal(); closePanel(); fade.style.opacity = 1; await wait(260);
  if (active && active !== townPlace && active.exit) active.exit();
  active = townPlace; setTitle(G.S.name); setHelp(''); setRoomButtons(null);
  const d = lastDoor || town.doors.find(x => x.id === 'home');
  const out = d.pos.clone(); out.x += Math.sin(d.facing) * .6; out.z += Math.cos(d.facing) * .6;
  placeInTown(out, d.facing);
  refreshPlaques(); showJoy(); fade.style.opacity = 0; switching = false;
};
G.refresh = () => { refreshPlaques(); refreshCoins(); if (town && G.S.data) town.setHome(currentHome()); };
function showJoy() { const walk = active && active.walks && touch && !(ride && ride.type === 'plane'); $('joy').classList.toggle('hide', !walk); $('runBtn').classList.toggle('hide', !walk); refreshRideBtn(); }
const wait = ms => new Promise(r => setTimeout(r, ms));

function refreshPlaques() {
  if (!town || !G.S.data) return;
  GAMES.forEach(g => { const p = town.plaques[g.id]; if (!p) return; const lv = G.S.data.levels[g.id]; paintPlaque(p, g.name, lv >= MASTER ? '★ Mastered · L' + lv : 'Level ' + (lv + 1) + ' next', lv / MASTER, g.color); });
  if (town.plaques.store) paintPlaque(town.plaques.store, 'Game Store', 'Open · ' + G.S.data.coins + ' coins', 1, '#ffd34d');
  if (town.plaques.jigsaw) paintPlaque(town.plaques.jigsaw, 'Jigsaw', jigsawUnlocked() ? 'Open!' : '🔒 ' + masteredCount() + '/5 mastered', masteredCount() / 5, '#ff6fae');
}

/* ---------------- loop ---------------- */
const clock = new THREE.Clock(), tmp = new THREE.Vector3();
let promptFor = null;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, clock.getDelta());
  if (!active) return;
  if (active.walks && G.S.data) walk(dt);
  if (active.update) active.update(dt);
  player.update(dt);
  if (active.walks && G.S.data) updatePrompt();
  const c = active.walks ? camera : (active.camera || camera);
  if (c.aspect !== innerWidth / innerHeight) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); }
  renderer.render(active.scene, c);
}
function walk(dt) {
  let mx = joy.x, my = joy.y;
  if (keys.a || keys.arrowleft) mx -= 1; if (keys.d || keys.arrowright) mx += 1;
  if (keys.w || keys.arrowup) my += 1; if (keys.s || keys.arrowdown) my -= 1;
  if (modalOpen() || switching) mx = my = 0;
  if (ride && ride.type === 'plane') { mx = my = 0; flyStep(dt); }
  const len = Math.min(1, Math.hypot(mx, my)), run = input.run || keys.shift, rideDef = ride && ride.type !== 'plane' ? (ride.type === 'car' ? CARS : BOATS)[ride.kind] : null;
  const p = player.root.position, ox = p.x, oz = p.z;
  let speed = 0;
  if (len > .08) {
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let vx = rx * mx + fx * my, vz = rz * mx + fz * my; const vl = Math.hypot(vx, vz); vx /= vl; vz /= vl;
    speed = rideDef ? rideDef.speed * (run ? 1.35 : 1) * len : (run ? 6.4 : 3.3) * len;
    p.x += vx * speed * dt; p.z += vz * speed * dt;
    const target = Math.atan2(vx, vz); let dr = target - player.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    player.root.rotation.y += dr * Math.min(1, dt * (ride ? 3.5 : 12));
    // ease the camera round behind you when walking forward
    if (!cam.drag && my > .5) { let dy = player.root.rotation.y + Math.PI - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cam.yaw += dy * Math.min(1, dt * 1.2); }
  }
  if (!(ride && ride.type === 'plane' && ride.alt > 1.5)) collide(p, ride ? (ride.type === 'plane' ? 2.2 : 1.25) : .38, active.collidersAt ? active.collidersAt(p) : active.colliders);
  if (active.blocked && active.blocked(p)) { if (!active.blocked({ x: p.x, z: oz })) p.z = oz; else if (!active.blocked({ x: ox, z: p.z })) p.x = ox; else { p.x = ox; p.z = oz; } }
  if (active.heightAt) { const ty = active.heightAt(p); p.y += (ty - p.y) * Math.min(1, dt * 16); if (Math.abs(ty - p.y) < .005) p.y = ty; }
  player.speedBlend(ride ? 0 : speed / 3.3);
  // camera
  const C = ride ? (ride.type === 'plane' ? { dist: (PLANES[ride.kind].big ? 34 : 16) + ride.alt * .12 } : { dist: 10, pitch: .35 }) : active.cam || { dist: 6.5, pitch: .38 };
  cam.dist += ((C.dist) - cam.dist) * Math.min(1, dt * 4);
  if (C.pitch != null && C.lockPitch) cam.pitch += (C.pitch - cam.pitch) * Math.min(1, dt * 4);
  cam.target.lerp(tmp.set(p.x, p.y + cam.height, p.z), Math.min(1, dt * 10));
  const cp = Math.cos(cam.pitch);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * cam.dist * cp, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cam.dist * cp);
  // keep the camera out of walls: shorten the boom where it would pass through a building
  const bl = active.camBlockers;
  if (bl && bl.length) {
    const ox = cam.target.x, oz = cam.target.z, dx = camera.position.x - ox, dz = camera.position.z - oz; let tMax = 1;
    for (const b of bl) {
      let t0 = 0, t1 = 1;
      if (Math.abs(dx) < 1e-6) { if (ox < b.x1 || ox > b.x2) continue; } else { let a = (b.x1 - ox) / dx, c = (b.x2 - ox) / dx; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
      if (Math.abs(dz) < 1e-6) { if (oz < b.z1 || oz > b.z2) continue; } else { let a = (b.z1 - oz) / dz, c = (b.z2 - oz) / dz; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
      if (t0 <= t1 && t1 > 0) tMax = Math.min(tMax, Math.max(.12, t0 - .06));
    }
    if (tMax < 1) { camera.position.x = ox + dx * tMax; camera.position.z = oz + dz * tMax; camera.position.y = cam.target.y + (camera.position.y - cam.target.y) * Math.max(tMax, .5); }
  }
  if (active.camClamp) active.camClamp(camera.position, cam.target);
  camera.lookAt(cam.target);
  if (ride && ride.relax != null) seatCam();
}
/* sitting inside the Royal Jumbo: the camera is your eyes in the seat; drag to look around */
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
function seatCam() {
  const s = SEATS[ride.relax], look = s.yaw + (cam.yaw - ride.yaw0), up = (cam.pitch - .38) * -1.2 - (s.down || 0);
  ride.mesh.updateWorldMatrix(true, false);
  _v1.set(s.pos[0], s.pos[1], s.pos[2]); ride.mesh.localToWorld(_v1);
  _v2.set(s.pos[0] + Math.sin(look) * 3, s.pos[1] + up, s.pos[2] + Math.cos(look) * 3); ride.mesh.localToWorld(_v2);
  camera.up.set(0, 1, 0).transformDirection(ride.mesh.matrixWorld); // you tilt with the plane, so the cabin looks level
  camera.position.copy(_v1); camera.lookAt(_v2);
}
function updatePrompt() {
  const list = active.interact ? active.interact() : [];
  const p = player.root.position; let best = null, bd = 1e9;
  for (const it of list) { if (Math.abs((it.pos.y || 0) - p.y) > 1.2) continue; const d = Math.hypot(it.pos.x - p.x, it.pos.z - p.z); if (d < it.r && d < bd) { bd = d; best = it; } }
  const show = !!best && !modalOpen() && !switching;
  $('prompt').classList.toggle('hide', !show);
  if (show && promptFor !== best.label + best.sub) { promptFor = best.label + best.sub; $('promptBtn').textContent = best.label; $('promptSub').textContent = best.sub || ''; }
  $('promptBtn').onclick = show ? () => best.fn() : null;
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); });


/* ---------------- cars, boats, the bag ---------------- */
let ride = null;
G.isRiding = () => ride;
function startRide(type, kind, at) {
  if (ride) stopRide(true);
  const mesh = type === 'car' ? makeCar(kind) : type === 'plane' ? makePlane(kind) : makeBoat(kind);
  player.root.add(mesh);
  if (type === 'car' || type === 'plane') player.model.visible = false; else player.model.position.y = .25;
  ride = { type, kind, mesh, t: 0, alt: 0, v: 0 };
  if (type === 'plane') { flight.wheel = 0; flight.lever = 0; setLever(0); }
  if (at) { player.root.position.x = at.x; player.root.position.z = at.z; }
  showJoy(); refreshRideBtn(); toast(type === 'plane' ? '✈️ ' + PLANES[kind].name + ': push the lever up to take off — steer with the wheel!' : type === 'car' ? '🚗 Driving your ' + CARS[kind].name + '!' : '⛵ Sailing your ' + BOATS[kind].name + '!');
}
function stopRide(silent, at) {
  if (!ride) return;
  if (!silent && ride.type === 'plane') park(ride.kind, player.root.position, player.root.rotation.y);
  player.root.remove(ride.mesh); player.model.visible = true; player.model.position.y = 0; player.model.rotation.set(0, 0, 0);
  ride.mesh.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  const wasPlane = ride.type === 'plane'; ride = null; if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); } camera.up.set(0, 1, 0);
  if (wasPlane) { const p = player.root.position; p.y = floorAt(p.x, p.z); }
  if (at) { player.root.position.x = at.x; player.root.position.z = at.z; }
  showJoy(); refreshRideBtn(); if (!silent) toast('🚶 You got out.');
}
function rideTick(dt) {
  ride.t += dt;
  if (ride.type === 'boat') { ride.mesh.position.y = Math.sin(ride.t * 1.8) * .06; ride.mesh.rotation.z = Math.sin(ride.t * 1.3) * .04; player.model.rotation.z = ride.mesh.rotation.z; }
}
function nearPoint(test) { // look around you for water (or land)
  const p = player.root.position;
  for (const rad of [1.6, 2.6, 3.6]) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, x = p.x + Math.sin(a) * rad, z = p.z + Math.cos(a) * rad; if (test(x, z)) return { x, z }; }
  return null;
}
let boatCache = { t: 0, acts: [] };
function boatActs() {
  const now = performance.now(); if (now - boatCache.t < 250) return boatCache.acts; boatCache.t = now;
  const u = G.S.data.up, p = player.root.position; let acts = [];
  if (ride && ride.type === 'boat') { const land = nearPoint((x, z) => world.heightAt(x, z) > WATER_Y + .25 && !world.blocked({ x, z })); if (land) acts = [{ pos: p.clone(), r: 5, label: '🏝️ Go ashore', sub: 'Get out of your ' + BOATS[ride.kind].name, fn: () => stopRide(false, land) }]; }
  else if (u.boat && !(ride && ride.type === 'car')) { const water = nearPoint((x, z) => world.heightAt(x, z) < WATER_Y - .35); if (water) acts = [{ pos: p.clone(), r: 5, label: '⛵ Get in your ' + BOATS[u.boat].name, sub: 'Sail on the water', fn: () => startRide('boat', u.boat, water) }]; }
  else if (!u.boat && world.blocked({ x: p.x + Math.sin(player.root.rotation.y) * 1.5, z: p.z + Math.cos(player.root.rotation.y) * 1.5 })) acts = [{ pos: p.clone(), r: 5, label: '🌊 Water!', sub: 'Buy a boat at the Game Store to go out on it', fn: () => toast('⛵ Boats are in the Game Store — then come back here!') }];
  boatCache.acts = acts; return acts;
}
function refreshRideBtn() {
  const b = $('rideBtn'), u = G.S.data && G.S.data.up, out = active === townPlace, flying = ride && ride.type === 'plane';
  const landed = flying && ride.alt < .3 && ride.v < 3;
  const show = !!(u && out && (landed || (u.car && !(ride && (ride.type === 'boat' || flying)))));
  b.classList.toggle('hide', !show);
  if (show) b.textContent = landed ? '🚶 Get out' : ride ? '🚶 Get out' : '🚗 Drive ' + CARS[u.car].name;
  $('flyBtn').classList.toggle('hide', !(u && (u.planes || []).length && out && !ride)); $('flyBtn').textContent = '✈️ My planes';
  const relax = flying && ride.relax != null, big = flying && PLANES[ride.kind].big;
  $('wheel').classList.toggle('hide', !flying || relax); $('lever').classList.toggle('hide', !flying || relax);
  $('jumboBtns').classList.toggle('hide', !flying); $('autoChip').classList.toggle('hide', !(flying && ride.auto)); $('relaxBtn').classList.toggle('hide', !big);
  if (big) { $('relaxBtn').textContent = relax ? '🪑 Change seat (' + SEATS[ride.relax].name + ')' : '🛋️ Relax in the back'; $('cockpitBtn').classList.toggle('hide', !relax); }
}
/* ---------------- the plane: steering wheel + height lever ---------------- */
const clamp = THREE.MathUtils.clamp, flight = { wheel: 0, lever: 0, held: false, warned: 0 };
const topAlt = () => ride && ride.type === 'plane' ? PLANES[ride.kind].top : 60;
function setLever(v) {
  flight.lever = clamp(v, 0, 1); $('leverKnob').style.bottom = (flight.lever * 100) + '%';
  $('leverLab').textContent = flight.lever < .02 ? 'Land' : Math.round(flight.lever * topAlt()) + ' m';
}
(function cockpit() {
  const w = $('wheel'), rot = $('wheelRot'); let id = null, x0 = 0;
  w.addEventListener('pointerdown', e => { autoOff(); id = e.pointerId; x0 = e.clientX; flight.held = true; w.setPointerCapture(id); e.preventDefault(); });
  w.addEventListener('pointermove', e => { if (e.pointerId === id) flight.wheel = clamp((e.clientX - x0) / 70, -1, 1); });
  const end = e => { if (e.pointerId !== id) return; id = null; flight.held = false; };
  w.addEventListener('pointerup', end); w.addEventListener('pointercancel', end);
  G._wheelRot = rot;
  const lv = $('lever'), tr = lv.querySelector('.track'); let lid = null;
  const set = e => { const r = tr.getBoundingClientRect(); setLever(1 - (e.clientY - r.top) / r.height); };
  lv.addEventListener('pointerdown', e => { autoOff(); lid = e.pointerId; lv.setPointerCapture(lid); set(e); e.preventDefault(); });
  lv.addEventListener('pointermove', e => { if (e.pointerId === lid) set(e); });
  lv.addEventListener('pointerup', e => { if (e.pointerId === lid) lid = null; }); lv.addEventListener('pointercancel', () => { lid = null; });
})();
function flyStep(dt) {
  const p = player.root.position, k = keys;
  // keyboard: A/D or ←/→ steer, W/S or ↑/↓ move the lever
  const kSteer = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
  if ((kSteer || kLevKey()) && ride.auto) autoOff();
  if (ride.auto) autopilot(dt);
  else if (kSteer) flight.wheel = clamp(flight.wheel + kSteer * dt * 3, -1, 1);
  else if (!flight.held) flight.wheel *= Math.max(0, 1 - dt * 4); // the wheel springs back to the middle
  if (ride.relax != null && !ride.auto) flight.wheel = 0; // nobody at the wheel: fly straight
  const kLev = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0);
  if (kLev) setLever(flight.lever + kLev * dt * .5);
  G._wheelRot.setAttribute('transform', 'rotate(' + (flight.wheel * 90) + ' 50 50)');
  const PL = PLANES[ride.kind], ground = world.heightAt(p.x, p.z), wet = ground < WATER_Y, roof = roofAt(p.x, p.z), floor = Math.max(ground, WATER_Y, roof < p.y + .5 ? roof : -1e9);
  ride.onRoof = roof > ground + 2 && Math.abs(p.y - roof) < .4;
  let target = floor + flight.lever * PL.top;
  ride.onWater = wet && PL.water && ride.alt < .3;
  const onRoofTop = roof > ground + 2 && roof < p.y + .5;
  if (flight.lever < .08 && !canLand(p, PL, wet, onRoofTop) && !(ride.alt < .3 && ride.v < 1)) { // no landing here — hover until you reach an airport
    target = Math.max(target, floor + 8);
    if (performance.now() - flight.warned > 5000) { flight.warned = performance.now(); toast(PL.heli ? '🛬 Helicopters land at airports or on skyscraper roofs!' : '🛬 Planes can only land at an airport! Tap 🗺️ Map to find one.'); }
  }
  if (wet && !PL.water && flight.lever < .05) { target = WATER_Y + 3; if (performance.now() - flight.warned > 5000) { flight.warned = performance.now(); toast('🌊 Can’t land on water — fly to land first!'); } }
  const air = ride.alt > .3;
  // speed: rolls on the runway, flies at full speed in the air, stops when it lands with the lever down
  const wantV = PL.heli ? (air ? PL.speed * clamp((flight.lever * PL.top - 2) / 8, 0, 1) : 0) : flight.lever > .02 || air || (wet && !PL.water) ? PL.speed : wet ? 5 : 0; // a helicopter only goes forward with the lever up; lever down = stop and sink straight down // the seaplane taxis slowly on water so you can steer to shore
  ride.v += (wantV - ride.v) * Math.min(1, dt * (PL.heli ? 2.5 : wantV ? 1.1 : 1.6));
  // steering turns the plane (less while it is rolling slowly on the ground)
  player.root.rotation.y -= flight.wheel * dt * (air ? 1.1 : .9) * (PL.heli ? (air ? 1 : 0) : Math.min(1, ride.v / 6));
  const yaw = player.root.rotation.y;
  p.x += Math.sin(yaw) * ride.v * dt; p.z += Math.cos(yaw) * ride.v * dt;
  // climb only once it is going fast enough to lift off
  const lift = PL.heli || ride.v > PL.speed * .45 || air ? 1 : 0;
  const ny = lift ? p.y + clamp(target - p.y, (PL.heli ? -6 : -9) * dt, (PL.heli ? 5 : 7) * dt) : floor;
  const climb = (ny - p.y) / Math.max(dt, 1e-4); p.y = Math.max(ny, floor);
  ride.alt = p.y - floor;
  // tilt the plane: bank into turns, nose up when climbing
  ride.mesh.rotation.z += ((air ? flight.wheel * (PL.big ? .22 : .55) : 0) - ride.mesh.rotation.z) * Math.min(1, dt * 4);
  ride.mesh.rotation.x += ((PL.heli ? ride.v / PL.speed * .18 : clamp(-climb * .05, PL.big ? -.1 : -.35, PL.big ? .1 : .35)) - ride.mesh.rotation.x) * Math.min(1, dt * 3);
  ride.mesh.position.y = ride.onWater ? Math.sin(ride.t * 1.8) * .07 - .15 : 0; // bob on the waves
  if (ride.onWater && performance.now() - flight.warned > 6000) { flight.warned = performance.now(); toast('🌊 Splashdown! Steer to the shore to get out.'); }
  ride.mesh.userData.prop.rotation.z += dt * (6 + ride.v * 2);
  if (ride.mesh.userData.rotor) { ride.mesh.userData.prop.rotation.x += dt * 30; ride.mesh.userData.rotor.rotation.y += dt * (air || flight.lever > .02 ? 22 : 9); }
  if (ride.onRoof && !ride.wasOnRoof) toast('🏢 You landed on the roof! Tap 🚶 Get out to look around.'); ride.wasOnRoof = ride.onRoof;
  if (ride.mesh.userData.flame) ride.mesh.userData.flame.scale.setScalar(.4 + ride.v / PL.speed * (.8 + Math.random() * .3));
  // keep the camera behind the plane
  if (!cam.drag && ride.relax == null) { let dy = yaw + Math.PI - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cam.yaw += dy * Math.min(1, dt * 1.6); }
  if (!cam.drag && ride.relax == null) cam.pitch += ((air ? .32 : .25) - cam.pitch) * Math.min(1, dt * 2);
  refreshRideBtn();
}
/* ---------- Royal Jumbo: autopilot, map, seats ---------- */
function kLevKey() { const k = keys; return (k.w || k.arrowup || k.s || k.arrowdown) ? 1 : 0; }
function autoOff() { if (ride && ride.auto) { ride.auto = null; toast('👨‍✈️ Autopilot off — you are flying!'); refreshRideBtn(); } }
function autopilot(dt) {
  const p = player.root.position, a = ride.auto, dx = a.x - p.x, dz = a.z - p.z, dist = Math.hypot(dx, dz);
  let diff = Math.atan2(dx, dz) - player.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  flight.wheel += (clamp(-diff * 2.2, -1, 1) - flight.wheel) * Math.min(1, dt * 3);
  // cruise high, then come down so it lands right about at the spot you picked
  const want = dist > 260 ? .55 : dist > 120 ? .3 : dist > 45 ? .12 : 0;
  if (Math.abs(want - flight.lever) > .005) setLever(flight.lever + clamp(want - flight.lever, -dt * .25, dt * .25));
  if (dist < 45 && ride.alt < .5) { ride.auto = null; flight.wheel = 0; setLever(0); toast('🛬 We have arrived at ' + a.name + '! Welcome.'); refreshRideBtn(); }
}
function openMap() {
  openPanel('🗺️ Where do you want to go?', body => {
    const wrap = el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:10px' });
    const cv = el('canvas', { width: 540, height: 540, style: 'width:min(540px,100%);border-radius:16px;touch-action:none;cursor:crosshair' });
    const info = el('p', { style: 'margin:0;color:var(--muted);font-weight:700;text-align:center' }, 'Tap an airport 🛫 to fly there. North is up. ✈️ is you.');
    const row = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center' });
    const go = el('button', { class: 'btn go', disabled: '' }, '🤖 Autopilot — fly me there'), home = el('button', { class: 'btn primary' }, '🏠 Fly to Hometown Airport');
    row.appendChild(go); row.appendChild(home); wrap.appendChild(cv); wrap.appendChild(info); wrap.appendChild(row); body.appendChild(wrap);
    const p = player.root.position, M = drawMap(cv, p.x, p.z), base = cv.getContext('2d').getImageData(0, 0, 540, 540); let dest = null;
    function marks() {
      const c = cv.getContext('2d'); c.putImageData(base, 0, 0);
      const me = M.toMap(p.x, p.z); c.save(); c.translate(me.x, me.y); c.rotate(Math.PI - player.root.rotation.y); c.font = '34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.rotate(-Math.PI / 4); c.fillText('✈️', 0, 0); c.restore();
      if (dest) { const d = M.toMap(dest.x, dest.z); c.fillStyle = '#ff3d5a'; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(d.x, d.y - 14, 11, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.moveTo(d.x - 7, d.y - 8); c.lineTo(d.x, d.y + 2); c.lineTo(d.x + 7, d.y - 8); c.fill(); c.setLineDash([8, 7]); c.strokeStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(me.x, me.y); c.lineTo(d.x, d.y); c.stroke(); c.setLineDash([]); }
    }
    marks();
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect(), w = M.toWorld((e.clientX - r.left) / r.width * 540, (e.clientY - r.top) / r.height * 540);
      // planes can only land at airports, so pick the airport closest to where you tapped
      const ti = Math.round(w.x / 160), tj = Math.round(w.z / 160); let best = null, bd = 1e9;
      for (let i = ti - 3; i <= ti + 3; i++) for (let j = tj - 3; j <= tj + 3; j++) { if (biomeOf(i, j) !== 'airport') continue; const rw = runwayAt(i, j), d = Math.hypot(rw.x - w.x, rw.z - w.z); if (d < bd) { bd = d; best = { ...rw, name: blockName(i, j) }; } }
      if (!best) { info.textContent = 'No airport near there — look for a 🛫 on the map.'; return; }
      dest = best;
      info.textContent = '📍 ' + dest.name + ' — ' + Math.round(Math.hypot(w.x - p.x, w.z - p.z)) + ' m away'; go.disabled = false; marks();
    });
    const fly = d => { ride.auto = d; if (flight.lever < .1) setLever(.15); closePanel(); toast('🤖 Autopilot on — flying to ' + d.name + (PLANES[ride.kind].big ? '. Relax in the back if you like!' : '. Sit back and enjoy the view!')); refreshRideBtn(); };
    go.onclick = () => dest && fly(dest);
    home.onclick = () => fly({ ...runwayAt(HOME_AP.i, HOME_AP.j), name: HOME_AP.name });
  });
}
function setSeat(i) {
  const o = ride.mesh.userData;
  camera.fov = i == null ? 55 : 72; camera.updateProjectionMatrix(); if (i == null) camera.up.set(0, 1, 0);
  if (i == null) { ride.relax = null; o.outside.visible = true; o.cabin.visible = false; cam.yaw = player.root.rotation.y + Math.PI; cam.pitch = .32; }
  else { if (ride.relax == null) ride.yaw0 = cam.yaw; ride.relax = i; o.outside.visible = false; o.cabin.visible = true; ride.yaw0 = cam.yaw; cam.pitch = .38; toast('🛋️ ' + SEATS[i].name + (ride.auto ? ' — the autopilot is flying.' : ' — drag to look around.')); }
  refreshRideBtn();
}
$('mapBtn').onclick = () => { if (ride && ride.type === 'plane') openMap(); };
$('relaxBtn').onclick = () => { if (ride && ride.type === 'plane') setSeat(ride.relax == null ? 0 : (ride.relax + 1) % SEATS.length); };
$('cockpitBtn').onclick = () => { if (ride && ride.type === 'plane') setSeat(null); };
$('flyBtn').onclick = () => { if (!ride && active === townPlace) myPlanes(); };
$('rideBtn').onclick = () => {
  if (ride && ride.type === 'plane') return modal({ big: '✈️', title: 'You landed!', text: 'What do you want to do?', acts: [
    { label: '🚪 Walk inside the plane', cls: 'go', fn: () => { const k = ride.kind; park(k, player.root.position, player.root.rotation.y); stopRide(true); G.boardPlane(k); } },
    { label: '🚶 Get out', cls: 'primary', fn: () => stopRide(false) },
    { label: 'Stay in the cockpit', cls: 'ghost' }] });
  if (ride) stopRide(false); else if (G.S.data.up.car) startRide('car', G.S.data.up.car);
};
/* ---------- planes wait at airports: all of them at Hometown Airport, unless you left one somewhere else ---------- */
const HOME_AP = { i: 0, j: -1, name: 'Hometown Airport' };
const spots = () => G.S.data.up.planeSpots || (G.S.data.up.planeSpots = {});
function spotOf(kind) { const s = spots()[kind]; return s || slotAt(HOME_AP.i, HOME_AP.j, kind); }
function park(kind, pos, yaw) { spots()[kind] = { x: pos.x, y: pos.y, z: pos.z, yaw }; save(true); syncPlanes(true); }
const shown = new Map(); // kind → { mesh, key }
let syncT = 0;
function syncPlanes(force) {
  if (!town || !G.S.data) return;
  const p = player.root.position, owned = G.S.data.up.planes || [];
  for (const [k, o] of shown) {
    const s = spotOf(k), key = s.x + ',' + s.z + ',' + s.yaw;
    if (!owned.includes(k) || (ride && ride.type === 'plane' && ride.kind === k) || o.key !== key || Math.hypot(s.x - p.x, s.z - p.z) > 280) { town.scene.remove(o.mesh); o.mesh.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); shown.delete(k); }
  }
  for (const k of owned) {
    if (shown.has(k) || (ride && ride.type === 'plane' && ride.kind === k)) continue;
    const s = spotOf(k); if (Math.hypot(s.x - p.x, s.z - p.z) > 250) continue;
    const mesh = makePlane(k); mesh.position.set(s.x, s.y || world.heightAt(s.x, s.z), s.z); mesh.rotation.y = s.yaw; town.scene.add(mesh);
    shown.set(k, { mesh, key: s.x + ',' + s.z + ',' + s.yaw });
  }
}
function planeSpot(pk, lx, lz) { const c = Math.cos(pk.yaw), sn = Math.sin(pk.yaw); return new THREE.Vector3(pk.x + c * lx + sn * lz, pk.y || 0, pk.z - sn * lx + c * lz); }
function doorOut(kind) { const pk = spotOf(kind), [lx, lz] = DOOR_OUT[kind] || [2, 0], c = Math.cos(pk.yaw), sn = Math.sin(pk.yaw); return { pos: planeSpot(pk, lx, lz), facing: Math.atan2(c, -sn) }; }
function parkedActs() {
  if (ride) return [];
  const out = [];
  for (const k of shown.keys()) { const d = doorOut(k); out.push({ pos: d.pos, r: PLANES[k].big ? 4 : 2.6, label: '🚪 Walk aboard the ' + PLANES[k].name, sub: 'Go inside — then sit in the cockpit to fly', fn: () => G.boardPlane(k) }); }
  return out;
}
G.boardPlane = kind => { G.S.data.up.planeKind = kind; save(true); G.enterRoom('cabin', { data: { kind }, doorObj: doorOut(kind) }); };
G.takeOff = async () => {
  const kind = G.S.data.up.planeKind; if (!kind) return G.backToTown();
  const pk = spotOf(kind); await G.backToTown(doorOut(kind));
  player.root.position.set(pk.x, pk.y || world.heightAt(pk.x, pk.z), pk.z); player.root.rotation.y = pk.yaw;
  startRide('plane', kind); syncPlanes(true); cam.yaw = cam.tYaw = pk.yaw + Math.PI; cam.target.copy(player.root.position);
};
/* where is each plane? */
function whereIs(kind) {
  const s = spotOf(kind), ap = airportAt(s.x, s.z);
  return ap ? ap.name : 'out in ' + blockName(Math.round(s.x / 160), Math.round(s.z / 160));
}
function dirTo(x, z) {
  const p = player.root.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
  if (d < 90) return 'right here';
  const blocks = Math.max(1, Math.round(d / 160)), ns = dz < -Math.abs(dx) * .4 ? 'north' : dz > Math.abs(dx) * .4 ? 'south' : '', ew = dx > Math.abs(dz) * .4 ? 'west' : dx < -Math.abs(dz) * .4 ? 'east' : '';
  return blocks + ' block' + (blocks > 1 ? 's' : '') + ' ' + (ns + ew || 'away');
}
function myPlanes() {
  const owned = G.S.data.up.planes || [];
  openPanel('✈️ My planes', body => {
    if (!owned.length) { body.appendChild(el('p', { style: 'color:var(--muted);font-weight:700' }, 'You don’t have a plane yet — they’re free at the Game Store!')); return; }
    body.appendChild(el('p', { style: 'color:var(--muted);font-weight:700;margin:0 0 12px' }, 'Planes wait at airports. Walk up to a plane’s door to get on. You can only land at an airport.'));
    const box = el('div', { class: 'prog' });
    owned.forEach(k => { const s = spotOf(k); box.appendChild(el('div', { class: 'prow' }, '<b>' + PLANES[k].name + '</b><span style="flex:1;text-align:right;color:#ffd34d">🛫 ' + whereIs(k) + ' · ' + dirTo(s.x, s.z) + '</span>')); });
    body.appendChild(box);
    const hd = dirTo(HOME_AP.i * 160, HOME_AP.j * 160 - 40);
    body.appendChild(el('p', { class: 'note' }, 'Hometown Airport is just north of your house' + (hd === 'right here' ? ' — you’re there!' : ' (' + hd + ').') + ' Any airport’s plane desk can bring a plane to you.'));
  });
}
/* the plane desk inside every airport: bring any of your planes here */
G.airportDesk = ap => {
  const owned = G.S.data.up.planes || [];
  openPanel('✈️ ' + ap.name + ' — plane desk', body => {
    if (!owned.length) { body.appendChild(el('p', { style: 'color:var(--muted);font-weight:700' }, 'You don’t have any planes yet. Get free planes at the Game Store, and they’ll wait for you at Hometown Airport.')); return; }
    body.appendChild(el('p', { style: 'color:var(--muted);font-weight:700;margin:0 0 12px' }, '🤖 “Which plane would you like? I’ll have it parked out front in a jiffy!”'));
    const list = el('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    owned.forEach(k => {
      const s = spotOf(k), here = (() => { const a = airportAt(s.x, s.z); return a && a.i === ap.i && a.j === ap.j; })();
      const row = el('div', { class: 'prow', style: 'gap:12px' }, '<b>' + PLANES[k].name + '</b><span style="flex:1;color:var(--muted)">' + (here ? '✅ Parked here' : '🛫 ' + whereIs(k)) + '</span>');
      const b = el('button', { class: 'btn ' + (here ? 'ghost' : 'go') }, here ? 'It’s outside' : 'Bring it here');
      b.onclick = () => { const t = slotAt(ap.i, ap.j, k); park(k, new THREE.Vector3(t.x, 0, t.z), t.yaw); G.S.data.up.planeKind = k; save(true); closePanel(); toast('🛬 Your ' + PLANES[k].name + ' just landed at ' + ap.name + ' — it’s parked out on the apron. Walk to its door!'); };
      if (here) b.onclick = () => { closePanel(); toast('✈️ Your ' + PLANES[k].name + ' is parked out on the apron behind the terminal.'); };
      row.appendChild(b); list.appendChild(row);
    });
    body.appendChild(list);
  });
};
/* planes can only land at airports (the helicopter can land on skyscraper roofs too; the seaplane on water) */
function canLand(p, PL, wet, onRoofTop) { return !!airportAt(p.x, p.z) || (PL.heli && onRoofTop) || (PL.water && wet); }
function goHome() {
  if (ride) { const wasPlane = ride.type === 'plane' && ride.kind; stopRide(true); if (wasPlane) { delete spots()[wasPlane]; save(true); } }
  const d = town.doors.find(x => x.id === 'home'); placeInTown(d.pos.clone().add(new THREE.Vector3(0, 0, -1.5)), Math.PI); toast('🏠 Back home!');
}
G.refreshBag = () => { if (!G.S.data) return; $('hudBag').textContent = '🎒 ' + bagCount() + '/' + capacity(); refreshRideBtn(); };
G.collect = (type, key) => {
  const d = G.S.data; if (!d) return false;
  if (bagCount() >= capacity()) { if (!G._fullT || performance.now() - G._fullT > 4000) { G._fullT = performance.now(); toast('🎒 Your bag is full! Sell your stuff at the Game Store' + (d.up.car ? '.' : ', or buy a car to carry more.')); } return false; }
  d.bag[type] = (d.bag[type] || 0) + 1;
  if (d.got.day !== today()) d.got = { day: today(), keys: [] };
  d.got.keys.push(key); save(); G.refreshBag();
  toast('+1 ' + ITEMS[type].icon + ' ' + ITEMS[type].name + '  (🎒 ' + bagCount() + '/' + capacity() + ')');
  return true;
};

/* ---------------- sign in ---------------- */
let mode = 'in', color = COLORS[0];
function setMode(m) { mode = m; $('tabIn').classList.toggle('on', m === 'in'); $('tabNew').classList.toggle('on', m === 'new'); $('colorPick').classList.toggle('hide', m !== 'new'); $('loginGo').textContent = m === 'new' ? 'Create player' : 'Sign in'; $('loginErr').textContent = ''; }
function initLogin() {
  const sw = $('swatches');
  COLORS.forEach((c, i) => { const b = el('button', { type: 'button', class: i ? '' : 'on', style: 'background:' + c, 'aria-label': 'color ' + (i + 1) }); b.onclick = () => { color = c; [...sw.children].forEach(x => x.classList.remove('on')); b.classList.add('on'); }; sw.appendChild(b); });
  $('tabIn').onclick = () => setMode('in'); $('tabNew').onclick = () => setMode('new');
  $('inPin').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 4); });
  $('inPin').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('loginGo').onclick = doLogin;
  $('saveNote').textContent = Store.local ? 'Test mode: progress is saved on this device only.' : 'Your progress is saved to the Mindworks Google Sheet.';
  try { const last = localStorage.getItem('mw3_last'); if (last) $('inName').value = last; } catch (e) {}
  $('btnOut').onclick = () => { flush(); location.reload(); };
  $('btnHome').onclick = () => {
    if (active !== townPlace) { lastDoor = town.doors.find(d => d.id === 'home'); G.backToTown(); return; }
    const b = world.block || { i: 0, j: 0 }, far = Math.max(Math.abs(b.i), Math.abs(b.j));
    if (far >= 1 && !G.S.data.up.teleporter) {
      const dir = (b.j > 0 ? 'north' : b.j < 0 ? 'south' : '') + (b.i > 0 ? 'west' : b.i < 0 ? 'east' : '');
      modal({ big: '🏠', title: 'Home is ' + far + ' block' + (far > 1 ? 's' : '') + ' away', text: 'Walk ' + (dir || 'back') + ' to get home — or buy the Home Teleporter at the Game Store (' + TELEPORTER_PRICE + ' coins) to zap home from anywhere.', acts: [{ label: 'OK', cls: 'go' }] }); return;
    }
    goHome();
  };
  $('btnProgress').onclick = showProgress;
  $('panelClose').onclick = closePanel;
}
function doLogin() {
  const name = $('inName').value.trim(), pin = $('inPin').value;
  if (!/^[A-Za-z0-9 _-]{2,20}$/.test(name)) { $('loginErr').textContent = 'Names can be 2–20 letters or numbers.'; return; }
  if (!/^\d{4}$/.test(pin)) { $('loginErr').textContent = 'PIN must be 4 numbers.'; return; }
  const btn = $('loginGo'); btn.disabled = true; $('loginErr').textContent = ''; btn.textContent = 'One moment…';
  (mode === 'new' ? Store.signUp(name, pin, defaultData(color)) : Store.signIn(name, pin)).then(res => {
    G.S.name = res.name; G.S.pin = pin; G.S.data = normalize(res.data);
    try {
      const c = JSON.parse(localStorage.getItem('mw3_cache_' + G.S.name.toLowerCase()) || 'null');
      const score = d => Object.values(d.levels).reduce((a, b) => a + b, 0) * 1000 + d.coins + (d.up.house || 0) * 10;
      if (c && score(normalize(c)) > score(G.S.data)) { G.S.data = normalize(c); save(true); }
      localStorage.setItem('mw3_last', G.S.name);
    } catch (e) {}
    startPlaying();
  }).catch(e => { $('loginErr').textContent = e.message; }).finally(() => { btn.disabled = false; setMode(mode); });
}
function startPlaying() {
  $('login').classList.add('hide'); $('hud').classList.remove('hide');
  town.scene.remove(player.root);
  player = makeCharacter('player', new THREE.Color(G.S.data.color || COLORS[0]).getHex());
  const d = town.doors.find(x => x.id === 'home'); lastDoor = d;
  town.setHome(currentHome());
  placeInTown(town.spawn.pos, town.spawn.yaw);
  setTitle(G.S.name); refreshCoins(); refreshPlaques(); showJoy(); G.refreshBag();
  showProgress(true);
}
function showProgress(first) {
  openPanel(first ? 'Welcome, ' + G.S.name + '!' : 'My progress', body => {
    const pts = GAMES.reduce((a, g) => a + Math.min(MASTER, G.S.data.levels[g.id]), 0);
    body.appendChild(el('p', { style: 'color:var(--muted);font-weight:700;margin:0 0 12px' }, jigsawUnlocked() ? 'You mastered all five games — the Jigsaw building is open!' : pts + ' of 125 levels done. Reach level 25 in all five games to open the Jigsaw.'));
    const box = el('div', { class: 'prog' });
    GAMES.forEach(g => { const lv = G.S.data.levels[g.id]; box.appendChild(el('div', { class: 'prow' }, '<b>' + g.name + '</b><div class="bar"><i style="width:' + Math.min(100, lv / MASTER * 100) + '%;background:' + g.color + '"></i></div><span>' + Math.min(lv, MASTER) + ' / 25</span>')); });
    box.appendChild(el('div', { class: 'prow' }, '<b>Jigsaw</b><div class="bar"><i style="width:' + masteredCount() / 5 * 100 + '%;background:#ff6fae"></i></div><span>' + (jigsawUnlocked() ? 'Open' : '🔒') + '</span>'));
    box.appendChild(el('div', { class: 'prow' }, '<b>Your house</b><span style="flex:1;text-align:right;color:#ffd34d">🏠 ' + currentHome().name + '</span>'));
    body.appendChild(box);
    const go = el('div', { style: 'display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap' });
    const b = el('button', { class: 'btn go' }, first ? 'Start walking' : 'Close'); b.onclick = closePanel; go.appendChild(b);
    body.appendChild(go);
    body.appendChild(el('p', { class: 'note' }, touch ? 'Use the circle at bottom-left to walk. Drag the screen to look around. Walk up to a door to go in.' : 'Walk with WASD or the arrow keys (Shift to run). Drag to look around. Walk up to a door and press Enter.'));
  });
}

if (Store.local) window.__mw = { G, cam, camera, get shown() { return shown; }, get ride() { return ride; }, get world() { return world; }, startRide, stopRide, get player() { return player; }, get town() { return town; }, get active() { return active; }, placeInTown };
initLogin();
boot().catch(err => { console.error(err); setProgress(1, 'Something went wrong loading Mindworks: ' + err.message); });
addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
/* when a new Mindworks update goes live, offer a button to load it (so an iPad left open never gets stuck on an old version) */
(function watchForUpdates() {
  let mine = null;
  const check = () => fetch('/mindworks/version.txt?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : null).then(v => {
    if (!v) return; v = v.trim();
    if (mine == null) { mine = v; return; }
    if (v !== mine && !document.getElementById('updBtn')) {
      const b = el('button', { id: 'updBtn', class: 'btn go', style: 'position:fixed;left:50%;top:max(70px,calc(env(safe-area-inset-top) + 58px));transform:translateX(-50%);z-index:40;font-size:18px;box-shadow:0 8px 24px #0007' }, '🎉 New update! Tap to get it');
      b.onclick = () => { flush(); setTimeout(() => location.reload(), 300); }; document.body.appendChild(b);
    }
  }).catch(() => {});
  check(); setInterval(check, 60000);
  addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
})();
