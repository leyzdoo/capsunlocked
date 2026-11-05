// Human-shaped character (Mixamo "X Bot" model) with idle / walk / run animations.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

let source = null, loading = null;
export function loadCharacter(url) {
  if (!loading) loading = new Promise((res) => {
    new GLTFLoader().load(url, g => { source = g; res(g); }, undefined, () => { source = null; res(null); });
  });
  return loading;
}

/** look: 'player' (body colour) | 'robot' (chrome) */
export function makeCharacter(look = 'player', color = 0x3f7fd9) {
  const root = new THREE.Group();
  let model, mixer = null, actions = {};
  if (source) {
    model = SkeletonUtils.clone(source.scene);
    const box = new THREE.Box3().setFromObject(model), h = box.max.y - box.min.y;
    model.scale.setScalar(1.72 / h);
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const isJoint = /Joints/i.test(o.material.name);
      if (look === 'robot') o.material = new THREE.MeshStandardMaterial({ color: isJoint ? 0x222428 : 0xd7dbe0, metalness: isJoint ? .5 : 1, roughness: isJoint ? .5 : .22 });
      else o.material = new THREE.MeshStandardMaterial({ color: isJoint ? 0x2a2d33 : color, metalness: .1, roughness: isJoint ? .55 : .45 });
    });
    mixer = new THREE.AnimationMixer(model);
    source.animations.forEach(a => { actions[a.name] = mixer.clipAction(a); });
    ['idle', 'walk', 'run'].forEach(n => { if (actions[n]) { actions[n].play(); actions[n].setEffectiveWeight(n === 'idle' ? 1 : 0); } });
  } else {
    // fallback figure if the model can't load
    model = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: look === 'robot' ? 0xd7dbe0 : color, metalness: look === 'robot' ? 1 : .1, roughness: .35 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.24, .8, 6, 12), m); body.position.y = .95; body.castShadow = true; model.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 12), m); head.position.y = 1.58; head.castShadow = true; model.add(head);
  }
  root.add(model);
  // name tag / ring under feet
  const ring = new THREE.Mesh(new THREE.RingGeometry(.32, .4, 32), new THREE.MeshBasicMaterial({ color: look === 'robot' ? 0xff6b6b : 0xffffff, transparent: true, opacity: .55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .03; root.add(ring);

  let w = { idle: 1, walk: 0, run: 0 }, oneShot = null;
  const ch = {
    root, model, mixer, actions,
    speedBlend(speed) { // 0..1 walk, >1 run
      const t = { idle: speed < .05 ? 1 : 0, walk: speed >= .05 && speed < 1.15 ? 1 : 0, run: speed >= 1.15 ? 1 : 0 };
      for (const k in w) { w[k] += (t[k] - w[k]) * .18; if (actions[k]) actions[k].setEffectiveWeight(oneShot ? 0 : w[k]); }
      if (actions.walk) actions.walk.timeScale = Math.max(.6, Math.min(1.4, speed * 1.1));
    },
    play(name) { // one-shot gesture: 'agree', 'headShake'
      const a = actions[name]; if (!a) return;
      if (oneShot) oneShot.stop();
      a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.setEffectiveWeight(1); a.play(); oneShot = a;
      const done = (e) => { if (e.action === a) { oneShot = null; mixer.removeEventListener('finished', done); } };
      mixer.addEventListener('finished', done);
    },
    bone(name) { let b = null; model.traverse(o => { if (o.isBone && o.name.replace(/[:_]/g, '').toLowerCase().endsWith(name.toLowerCase())) b = b || o; }); return b; },
    update(dt) { if (mixer) mixer.update(dt); }
  };
  return ch;
}
