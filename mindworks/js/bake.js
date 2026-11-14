// Merge a group's still meshes by material (and by 80 m patch) so big scenes draw fast on an iPad.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function bakeGroup(g, cell = 80) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), groups = new Map(), drop = [], tmp = new THREE.Vector3(), mtx = new THREE.Matrix4();
  g.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.water || o.userData.noBake) return;
    if (Array.isArray(o.material) || o.material.vertexColors) return;
    for (let p = o.parent; p && p !== g; p = p.parent) if (p.userData.noBake) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    mtx.multiplyMatrices(inv, o.matrixWorld); geo.applyMatrix4(mtx);
    tmp.setFromMatrixPosition(mtx);
    const key = o.material.uuid + '|' + Math.floor(tmp.x / cell) + ',' + Math.floor(tmp.z / cell);
    if (!groups.has(key)) groups.set(key, { mat: o.material, geos: [], shadow: o.castShadow });
    const G = groups.get(key); G.geos.push(geo); G.shadow = G.shadow || o.castShadow; drop.push(o);
  });
  drop.forEach(o => { o.parent.remove(o); });
  for (const { mat, geos, shadow } of groups.values()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false); if (geos.length > 1) geos.forEach(x => x.dispose()); if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = shadow; mesh.receiveShadow = true; g.add(mesh);
  }
  const empties = []; g.traverse(o => { if (o.isGroup && o !== g && !o.children.length) empties.push(o); }); empties.forEach(o => o.parent && o.parent.remove(o));
  return g;
}
