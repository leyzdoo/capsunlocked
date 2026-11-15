// Inside a plane: walk around, sit down, then go to the cockpit to fly.
import * as THREE from 'three';
import { G, toast } from '../game.js';
import { env } from './common.js';
import { buildCabin } from '../cabins.js';

export async function enter({ player, data }) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fd2ff); scene.environment = env();
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x3a3228, .7));
  const g = new THREE.Group(); scene.add(g);
  const C = buildCabin(g, data.kind, { lights: true });
  const deckOf = p => { let d = C.decks[0]; for (const k of C.decks) if (p.y > k.y - 1) d = k; return d; };
  const acts = C.acts.map(a => ({
    pos: new THREE.Vector3(a.pos[0], a.pos[1], a.pos[2]), r: a.r, label: a.label, sub: a.sub,
    fn: a.type === 'fly' ? () => G.takeOff() : a.type === 'exit' ? () => G.backToTown() : a.type === 'up' ? () => { G.moveFloor(C.decks[1].y); toast('⬆️ The upper deck'); } : a.type === 'down' ? () => { G.moveFloor(0); toast('⬇️ The main deck'); } : () => toast(a.say)
  }));
  const st = C.start;
  setTimeout(() => toast('✈️ Welcome aboard the ' + C.title + '! ' + (C.decks.length > 1 ? 'The cockpit is upstairs at the front.' : 'The cockpit is at the front.')), 350);
  return {
    scene, walks: true, title: 'Inside the ' + C.title, cam: { dist: C.camDist, pitch: .3 },
    help: C.decks.length > 1 ? 'Walk the aisles, climb the stairs, and sit in the captain’s seat to fly' : 'Walk to the cockpit and sit in the pilot seat to fly',
    start: new THREE.Vector3(st.x, st.y, st.z), startYaw: st.yaw, camYaw: st.yaw + Math.PI,
    get colliders() { return C.decks[0].cols; },
    collidersAt: p => deckOf(p).cols,
    get camBlockers() { return deckOf(player.root.position).walls; },
    heightAt: p => deckOf(p).y,
    camClamp(p) { const d = deckOf(player.root.position); p.y = Math.max(d.y + .4, Math.min(p.y, d.top - .15)); },
    interact: () => acts,
    exit() { g.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
  };
}
