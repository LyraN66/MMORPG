import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = import.meta.env.BASE_URL + 'assets/';
const FILES = ['anims', 'knight', 'mage', 'rogue', 'skel_minion', 'skel_warrior', 'skel_rogue', 'skel_mage', 'props', 'weapons'];

export const A = { gltf: {}, clips: {}, props: {}, weapons: {} };

export async function loadAll(onProgress) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let done = 0;
  await Promise.all(FILES.map((f) => loader.loadAsync(BASE + f + '.glb').then((g) => {
    A.gltf[f] = g; done++; onProgress?.(done / FILES.length);
  })));
  for (const c of A.gltf.anims.animations) {
    // Root motion off: strip root/IK position drift to keep characters in place.
    c.tracks = c.tracks.filter((t) => !(t.name.startsWith('root.') && t.name.endsWith('.position')));
    A.clips[c.name] = c;
  }
  for (const [store, key] of [[A.props, 'props'], [A.weapons, 'weapons']]) {
    for (const n of A.gltf[key].scene.children) store[n.name] = n;
  }
  // Materials: KayKit models are matte gradient-atlas art, so a diffuse (Lambert) material looks the same
  // as PBR but is far cheaper per pixel on phone GPUs.
  const cache = new Map();
  const toLambert = (src) => {
    if (!src || !src.isMeshStandardMaterial) return src;
    if (cache.has(src)) return cache.get(src);
    if (src.map) { src.map.colorSpace = THREE.SRGBColorSpace; src.map.anisotropy = 4; }
    const l = new THREE.MeshLambertMaterial({ map: src.map, color: src.color, emissive: src.emissive, emissiveMap: src.emissiveMap,
      transparent: src.transparent, opacity: src.opacity, alphaTest: src.alphaTest, side: src.side, vertexColors: src.vertexColors });
    l.name = src.name; cache.set(src, l);
    return l;
  };
  const fix = (o) => o.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true; m.receiveShadow = true;
      m.material = Array.isArray(m.material) ? m.material.map(toLambert) : toLambert(m.material);
    }
  });
  Object.values(A.gltf).forEach((g) => fix(g.scene));
}

// Create an animated character instance with its own mixer and named actions.
export function makeCharacter(model, { weapon, offhand, hideMeshes } = {}) {
  const root = skClone(A.gltf[model].scene);
  const materials = [];
  root.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      materials.push(o.material);
      o.frustumCulled = false;
      if (hideMeshes && hideMeshes.some((h) => o.name.startsWith(h))) o.visible = false;
    }
  });
  const slotR = root.getObjectByName('handslotr');
  const slotL = root.getObjectByName('handslotl');
  const attach = (name, slot) => {
    if (!name || !slot || !A.weapons[name]) return null;
    const w = new THREE.Group(); w.add(A.weapons[name].clone(true));
    w.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); materials.push(o.material); o.castShadow = true; } });
    slot.add(w);
    return w;
  };
  const wR = attach(weapon, slotR);
  const wL = attach(offhand, slotL);
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  const get = (name) => {
    if (!actions[name]) {
      const clip = A.clips[name];
      if (!clip) return null;
      actions[name] = mixer.clipAction(clip);
    }
    return actions[name];
  };
  return { root, mixer, get, materials, slotR, slotL, weaponR: wR, weaponL: wL };
}

// Small helper that plays looping/one-shot animations with crossfades.
export class Animator {
  // seq/once/ts let the current animation be mirrored over the network.
  constructor(ch) { this.ch = ch; this.current = null; this.lock = 0; this.speed = 1; this.seq = 0; }
  loop(name, fade = 0.2, timeScale = 1) {
    if (this.lock > 0) return;
    if (this.current?.name === name) { this.current.action.timeScale = timeScale; return; }
    const a = this.ch.get(name); if (!a) return;
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; a.timeScale = timeScale;
    a.enabled = true; a.setEffectiveWeight(1); a.play();
    if (this.current) this.current.action.crossFadeTo(a, fade, false);
    this.current = { name, action: a, once: false, ts: timeScale };
  }
  once(name, { fade = 0.12, timeScale = 1, hold = false, lockFor } = {}) {
    const a = this.ch.get(name); if (!a) return 0;
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = timeScale;
    a.enabled = true; a.setEffectiveWeight(1); a.play();
    if (this.current && this.current.action !== a) this.current.action.crossFadeTo(a, fade, false);
    this.current = { name, action: a, once: true, ts: timeScale, hold };
    this.seq++;
    const dur = a.getClip().duration / timeScale;
    this.lock = hold ? Infinity : (lockFor ?? dur * 0.92);
    return dur;
  }
  // mixDt lets callers skip skinning work for off-screen characters while game timing (lock) still advances.
  update(dt, mixDt = dt) { if (this.lock !== Infinity) this.lock = Math.max(0, this.lock - dt); if (mixDt > 0) this.ch.mixer.update(mixDt); }
  unlock() { this.lock = 0; }
}

// Build InstancedMeshes for repeated static props. placements: [{name, x, y, z, ry, s}]
export function buildInstancedProps(placements) {
  const group = new THREE.Group();
  // Split each prop type into world bands so the camera and shadow frustums can cull distant chunks.
  const byName = {};
  const BAND = 24;
  for (const p of placements) (byName[p.name + '|' + Math.floor(p.z / BAND)] ||= []).push(p);
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const [key, list] of Object.entries(byName)) {
    const name = key.split('|')[0];
    const src = A.props[name];
    if (!src) { console.warn('prop missing', name); continue; }
    src.parent.updateMatrixWorld(true);
    // Relative to the prop's parent so the node's own (de-quantization) transform is kept.
    const inv = new THREE.Matrix4().copy(src.parent.matrixWorld).invert();
    src.traverse((m) => {
      if (!m.isMesh) return;
      const local = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
      im.name = name;
      list.forEach((p, i) => {
        e.set(0, p.ry || 0, 0); q.setFromEuler(e);
        tmp.compose(new THREE.Vector3(p.x, p.y || 0, p.z), q, new THREE.Vector3(p.s || 1, p.s || 1, p.s || 1));
        tmp.multiply(local);
        im.setMatrixAt(i, tmp);
      });
      im.castShadow = !list[0].noShadow; im.receiveShadow = true;
      im.computeBoundingSphere();
      im.userData.zc = (Number(key.split('|')[1]) + 0.5) * BAND;
      group.add(im);
    });
  }
  return group;
}

// Clones keep the node's own transform (it carries mesh de-quantization), so wrap them in a group.
export function cloneProp(name, s = 1) {
  const g = new THREE.Group(); g.add(A.props[name].clone(true)); g.scale.setScalar(s);
  return g;
}
export function cloneWeapon(name, s = 1) {
  const g = new THREE.Group(); const o = A.weapons[name].clone(true); g.add(o); g.scale.setScalar(s);
  o.traverse((m) => { if (m.isMesh) m.material = m.material.clone(); });
  return g;
}
