import * as THREE from 'three';
import { heightAt, makeGlowTexture } from './world.js';

const V = new THREE.Vector3();

class Particles {
  constructor(scene, max, additive) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grav = new Float32Array(max);
    this.drag = new Float32Array(max); this.size0 = new Float32Array(max); this.grow = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 300 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = size * uScale / -mv.z; }`,
      fragmentShader: additive
        ? `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.,d); gl_FragColor = vec4(vC*a*1.4, a*vA); }`
        : `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(vC, vA*smoothstep(0.5,0.3,d)); }`,
    });
    this.mat = mat;
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    scene.add(this.points);
  }
  emit(p, v, color, size, life, { grav = 0, drag = 0, grow = 0 } = {}) {
    if (this.n >= this.max) return;
    const i = this.n++, i3 = i * 3;
    this.pos[i3] = p.x; this.pos[i3 + 1] = p.y; this.pos[i3 + 2] = p.z;
    this.vel[i3] = v.x; this.vel[i3 + 1] = v.y; this.vel[i3 + 2] = v.z;
    this.col[i3] = color.r; this.col[i3 + 1] = color.g; this.col[i3 + 2] = color.b;
    this.size0[i] = size; this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
    this.alpha[i] = 1;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); i--; continue; }
      const i3 = i * 3, k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= k; this.vel[i3 + 1] = this.vel[i3 + 1] * k - this.grav[i] * dt; this.vel[i3 + 2] *= k;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.2);
      this.size[i] = this.size0[i] * (1 + this.grow[i] * (1 - t));
    }
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'color', 'size', 'alpha']) this.geo.attributes[k].needsUpdate = true;
  }
  kill(i) {
    const j = --this.n; if (i === j) return;
    const i3 = i * 3, j3 = j * 3;
    for (let a = 0; a < 3; a++) { this.pos[i3 + a] = this.pos[j3 + a]; this.vel[i3 + a] = this.vel[j3 + a]; this.col[i3 + a] = this.col[j3 + a]; }
    this.size[i] = this.size[j]; this.size0[i] = this.size0[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
    this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.alpha[i] = this.alpha[j]; this.grow[i] = this.grow[j];
  }
}

const ringVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;

export class FX {
  constructor(scene, camera, overlay) {
    this.scene = scene; this.camera = camera; this.overlay = overlay;
    this.add = new Particles(scene, 3500, true);
    this.solid = new Particles(scene, 1500, false);
    this.timed = []; // {obj, t, dur, update(k), dispose}
    this.shakeAmt = 0; this.hitStop = 0; this.flashEl = document.getElementById('flash');
    this.numbers = [];
    this.glowTex = makeGlowTexture();
    this.c = new THREE.Color();
  }
  setScale(h) { this.add.mat.uniforms.uScale.value = h * 0.55; this.solid.mat.uniforms.uScale.value = h * 0.55; }

  // ---------- particles ----------
  burst(p, n, color, { speed = 4, up = 2, size = 0.5, life = 0.6, grav = 6, drag = 1.5, solid = false, spread = 1, grow = 0 } = {}) {
    const sys = solid ? this.solid : this.add; const c = this.c.set(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      V.set(Math.cos(a) * s * spread, up * (0.4 + Math.random()), Math.sin(a) * s * spread);
      sys.emit(p, V, c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), { grav, drag, grow });
    }
  }
  flame(p, size, color) {
    const c = this.c.set(color);
    V.set((Math.random() - 0.5) * 0.4 * size, 1.2 + Math.random() * 1.4 * size, (Math.random() - 0.5) * 0.4 * size);
    const q = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5 * size, 0, (Math.random() - 0.5) * 0.5 * size));
    this.add.emit(q, V, c, 0.6 * size + Math.random() * 0.5 * size, 0.5 + Math.random() * 0.4, { grav: -0.5, drag: 1, grow: -0.6 });
    if (Math.random() < 0.15) { this.c.set(0xffe08a); V.y *= 1.8; this.add.emit(q, V, this.c, 0.12, 1.2, { grav: -0.2, drag: 0.5 }); }
  }
  trail(p, color, size = 0.5, life = 0.35) {
    V.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6);
    this.add.emit(p, V, this.c.set(color), size, life, { drag: 2, grow: -0.7 });
  }
  dust(p, n = 6, color = 0x8a7a66, scale = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28;
      V.set(Math.cos(a) * 2 * scale, 0.5 + Math.random(), Math.sin(a) * 2 * scale);
      this.solid.emit(new THREE.Vector3(p.x + Math.cos(a) * 0.4, p.y + 0.15, p.z + Math.sin(a) * 0.4), V, this.c.set(color), 0.5 * scale, 0.7, { drag: 3, grav: 0.5, grow: 1.5 });
    }
  }
  bones(p, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = 2 + Math.random() * 4;
      V.set(Math.cos(a) * s, 3 + Math.random() * 4, Math.sin(a) * s);
      this.solid.emit(new THREE.Vector3(p.x, p.y + 1.2, p.z), V, this.c.set(Math.random() < 0.5 ? 0xe8e2d0 : 0xbfb7a2), 0.22 + Math.random() * 0.2, 0.9 + Math.random() * 0.5, { grav: 14, drag: 0.6 });
    }
  }

  // ---------- meshes ----------
  timedMesh(obj, dur, update) { this.scene.add(obj); this.timed.push({ obj, t: 0, dur, update }); return obj; }

  slash(pos, yaw, color = 0xfff1c9, { radius = 2.2, tilt = 0, flip = false, width = 0.55, dur = 0.22 } = {}) {
    const geo = new THREE.RingGeometry(radius - width, radius, 32, 1, -1.3, 2.6);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uK: { value: 0 }, uC: { value: new THREE.Color(color) }, uFlip: { value: flip ? 1 : 0 } },
      vertexShader: ringVS,
      fragmentShader: `uniform float uK; uniform vec3 uC; uniform float uFlip; varying vec2 vUv;
        void main(){ float a = mix(vUv.x, 1.-vUv.x, uFlip); float head = uK*1.4; float t = smoothstep(head-0.8, head, a) * (1.-smoothstep(head, head+0.05, a));
          float edge = smoothstep(0., 0.5, vUv.y) ; gl_FragColor = vec4(uC*1.6, t*edge*(1.-uK*0.6)); }`,
    });
    const m = new THREE.Mesh(geo, mat);
    const g = new THREE.Group(); g.add(m);
    m.rotation.x = -Math.PI / 2 + tilt; g.position.copy(pos); g.position.y += 1.1; g.rotation.y = yaw + Math.PI / 2;
    this.timedMesh(g, dur, (k) => { mat.uniforms.uK.value = k; });
  }

  groundRing(pos, { color = 0xffd27a, r0 = 0.5, r1 = 4, dur = 0.5, width = 0.35, opacity = 1 } = {}) {
    const geo = new THREE.RingGeometry(0.85, 1, 48);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, heightAt(pos.x, pos.z) + 0.08, pos.z);
    this.timedMesh(m, dur, (k) => { const r = r0 + (r1 - r0) * (1 - Math.pow(1 - k, 3)); m.scale.setScalar(r); mat.opacity = opacity * (1 - k); });
  }

  // Ground telegraph for incoming attacks: fills up, then calls done.
  telegraph(pos, radius, dur, color = 0xff2a2a) {
    const geo = new THREE.CircleGeometry(1, 48);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uK: { value: 0 }, uC: { value: new THREE.Color(color) } },
      vertexShader: ringVS,
      fragmentShader: `uniform float uK; uniform vec3 uC; varying vec2 vUv; void main(){ float d = length(vUv-0.5)*2.;
        float rim = smoothstep(0.9,0.97,d)*(1.-smoothstep(0.97,1.,d)); float fill = step(d, uK)*0.35; float base = 0.12;
        float a = (rim*0.9 + fill + base) * step(d,1.); gl_FragColor = vec4(uC, a); }`,
    });
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.scale.setScalar(radius);
    m.position.set(pos.x, heightAt(pos.x, pos.z) + 0.1, pos.z); m.renderOrder = 3;
    this.timedMesh(m, dur, (k) => { mat.uniforms.uK.value = k; });
    return m;
  }

  pillar(pos, color = 0xffd36b, { h = 14, r = 1.1, dur = 1.6 } = {}) {
    const geo = new THREE.CylinderGeometry(r, r, h, 24, 1, true); geo.translate(0, h / 2, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uK: { value: 0 }, uC: { value: new THREE.Color(color) } }, vertexShader: ringVS,
      fragmentShader: `uniform float uK; uniform vec3 uC; varying vec2 vUv; void main(){ float a = (1.-vUv.y) * (1.-uK) * (0.6+0.4*sin(vUv.x*40.+uK*20.));
        gl_FragColor = vec4(uC*1.5, a); }`,
    });
    const m = new THREE.Mesh(geo, mat); m.position.copy(pos);
    this.timedMesh(m, dur, (k) => { mat.uniforms.uK.value = k; m.scale.set(1 + k * 0.6, Math.min(1, k * 6), 1 + k * 0.6); });
  }

  // Persistent loot beam; returns object with dispose().
  lootBeam(pos, color) {
    const geo = new THREE.CylinderGeometry(0.12, 0.35, 5, 12, 1, true); geo.translate(0, 2.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat); m.position.copy(pos); this.scene.add(m);
    return m;
  }

  glow(color, size) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.scale.setScalar(size); return sp;
  }

  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
  stop(t) { this.hitStop = Math.max(this.hitStop, t); }
  flash(color = 'rgba(255,40,40,0.35)') {
    const el = this.flashEl; el.style.background = color; el.style.transition = 'none'; el.style.opacity = '1';
    requestAnimationFrame(() => { el.style.transition = 'opacity 0.45s'; el.style.opacity = '0'; });
  }

  // ---------- floating numbers ----------
  number(pos, text, cls) {
    const el = document.createElement('div'); el.className = 'dmg ' + (cls || ''); el.textContent = text;
    this.overlay.appendChild(el);
    this.numbers.push({ el, p: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 2.4, (Math.random() - 0.5) * 0.8)), t: 0, dur: cls?.includes('big') ? 1.3 : 0.95, vx: (Math.random() - 0.5) * 30 });
  }

  update(dt, realDt) {
    this.add.update(dt); this.solid.update(dt);
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const t = this.timed[i]; t.t += dt; const k = Math.min(1, t.t / t.dur);
      t.update?.(k);
      if (k >= 1) {
        this.scene.remove(t.obj);
        t.obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        this.timed.splice(i, 1);
      }
    }
    const w = innerWidth, h = innerHeight;
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i]; n.t += realDt; const k = n.t / n.dur;
      if (k >= 1) { n.el.remove(); this.numbers.splice(i, 1); continue; }
      V.copy(n.p); V.y += k * 1.6; V.project(this.camera);
      if (V.z > 1) { n.el.style.opacity = 0; continue; }
      const x = (V.x * 0.5 + 0.5) * w + n.vx * k, y = (-V.y * 0.5 + 0.5) * h;
      const sc = k < 0.15 ? 0.6 + k / 0.15 * 0.8 : 1.4 - Math.min(0.4, (k - 0.15) * 2);
      n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${sc})`;
      n.el.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    }
  }
}
