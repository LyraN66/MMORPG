import * as THREE from 'three';
import { buildInstancedProps } from './assets.js';
import { ZONES } from './data.js';
import { BOUNDS, CAMP, CRYPT, ACTIVE_MAP, THEMES, rng, roadX, heightAt, generateLayout } from '../server/shared/terrain.js';

export { BOUNDS, rng, roadX, heightAt };
export const CAMP_POS = new THREE.Vector3(CAMP[0], 0, CAMP[1]);
export const CRYPT_POS = new THREE.Vector3(CRYPT[0], 0, CRYPT[1]);

// Per-theme look: prop recolour (colour, strength), road/plaza colours, grass density, floating mote colours per zone,
// light colours. The first valley ('bones') keeps its original look.
const VIS = {
  bones: { tint: [0xffffff, 0], dirt: 0x6b5238, stone: 0x5b5651, grass: 1, motes: [0xffc36b, 0x9cff9c, 0xff6a4a], hemi: [0x8a9bd0, 0x3b2a20], sun: 0xffd2a1, moon: true },
  swamp: { tint: [0x5f8a4a, 0.3], dirt: 0x4a4430, stone: 0x4a5048, grass: 1.3, motes: [0xb8ff6a, 0x7dff4a, 0xd06aff], hemi: [0x8ab09a, 0x2a3020], sun: 0xd8f0b0, moon: true },
  desert: { tint: [0xe0a868, 0.45], dirt: 0xb08458, stone: 0x9a7a5a, grass: 0.12, motes: [0xffe0a0, 0xffc070, 0xff8a4a], hemi: [0xffd8a8, 0x7a5030], sun: 0xffe2b0, moon: false },
  snow: { tint: [0xf0f6ff, 0.6], dirt: 0xa8b4c4, stone: 0x8a94a4, grass: 0.25, motes: [0xffffff, 0xe8f4ff, 0xbfe0ff], hemi: [0xc8d8ff, 0x6a7890], sun: 0xf0f4ff, moon: true },
  lava: { tint: [0x3a2a26, 0.55], dirt: 0x2a1c18, stone: 0x3a3230, grass: 0, motes: [0xff8a3a, 0xff5a1a, 0xff3a1a], hemi: [0xb06a4a, 0x2a1008], sun: 0xff9a6a, moon: false },
  coast: { tint: [0x8ad0d0, 0.18], dirt: 0xc8b07a, stone: 0x6a8a8a, grass: 0.6, motes: [0xbff8ff, 0x7ad8ff, 0x4ab0ff], hemi: [0xa8d8ff, 0x405a50], sun: 0xfff0d8, moon: false },
  ghost: { tint: [0x46506e, 0.6], dirt: 0x3a3440, stone: 0x4a4458, grass: 0.8, motes: [0xc0a8ff, 0x8a7aff, 0xb07aff], hemi: [0x8a80c8, 0x241a30], sun: 0xb8b0ff, moon: true },
  dragon: { tint: [0x8a4a3a, 0.4], dirt: 0x4a2e24, stone: 0x5a4440, grass: 0.15, motes: [0xffb06a, 0xff7a3a, 0xff4a2a], hemi: [0xd08a6a, 0x3a1a10], sun: 0xffb08a, moon: false },
};

export class World {
  constructor(scene, quality) {
    this.scene = scene; this.quality = quality; this.map = ACTIVE_MAP; this.vis = VIS[this.map.theme] || VIS.bones;
    CAMP_POS.set(CAMP[0], 0, CAMP[1]);
    if (CRYPT) CRYPT_POS.set(CRYPT[0], 0, CRYPT[1]);
    this.lights = [];
    this.flames = [];
    this.time = 0;
    this.build();
  }

  resolve(pos, r) { this.col.resolve(pos, r); }
  blocked(x, z, r) { return this.col.blocked(x, z, r); }

  build() {
    const s = this.scene;
    // Sky dome with gradient + stars + moon
    const skyGeo = new THREE.SphereGeometry(120, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(this.map.sky.top) }, mid: { value: new THREE.Color(this.map.sky.mid) }, bot: { value: new THREE.Color(this.map.sky.bot) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 top, mid, bot; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = mix(bot, mid, smoothstep(-0.05, 0.18, h)); c = mix(c, top, smoothstep(0.15, 0.7, h));
        gl_FragColor = vec4(c, 1.); }`,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat); s.add(this.sky);
    const starGeo = new THREE.BufferGeometry(); const sp = [];
    const r0 = rng(7);
    for (let i = 0; i < 900; i++) {
      const th = r0() * Math.PI * 2, ph = Math.acos(0.15 + r0() * 0.85);
      sp.push(112 * Math.sin(ph) * Math.cos(th), 112 * Math.cos(ph), 112 * Math.sin(ph) * Math.sin(th));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
    s.add(this.stars);
    // Sky, stars and moon live inside the camera's far plane and follow the player.
    const moon = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), new THREE.MeshBasicMaterial({ color: 0xffe9c4, fog: false }));
    moon.position.set(-42, 45, -90); moon.lookAt(0, 0, 0); this.sky.add(moon);
    if (!this.vis.moon) { moon.material.color.set(0xfff4d8); moon.position.set(30, 60, -70); moon.lookAt(0, 0, 0); this.stars.material.opacity = 0.15; }
    const halo = new THREE.Mesh(new THREE.CircleGeometry(12, 32), new THREE.MeshBasicMaterial({ color: 0xffd6a0, fog: false, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.copy(moon.position).multiplyScalar(1.01); halo.lookAt(0, 0, 0); this.sky.add(halo);

    // Lighting
    s.add(new THREE.HemisphereLight(this.vis.hemi[0], this.vis.hemi[1], 1.25));
    const sun = new THREE.DirectionalLight(this.vis.sun, 2.6);
    sun.position.set(-25, 45, 18);
    sun.castShadow = this.quality !== 'low';
    const sm = this.quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(sm, sm);
    const sc = sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 120;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    s.add(sun); s.add(sun.target);
    this.sun = sun;
    const rim = new THREE.DirectionalLight(0x6f7cff, 0.7); rim.position.set(30, 20, -40); s.add(rim);

    this.buildTerrain();
    this.buildProps();
    this.buildPortal();
    if (this.quality !== 'low') this.buildGrass();
    this.buildAmbientMotes();
  }

  buildTerrain() {
    const W = BOUNDS.maxX - BOUNDS.minX + 60, H = BOUNDS.maxZ - BOUNDS.minZ + 60;
    const seg = this.quality === 'low' ? 80 : 120;
    const geo = new THREE.PlaneGeometry(W, H, seg, Math.round(seg * H / W));
    geo.rotateX(-Math.PI / 2);
    geo.translate((BOUNDS.minX + BOUNDS.maxX) / 2, 0, (BOUNDS.minZ + BOUNDS.maxZ) / 2);
    const pos = geo.attributes.position; const col = []; const c = new THREE.Color(), c2 = new THREE.Color();
    const dirt = new THREE.Color(this.vis.dirt), stone = new THREE.Color(this.vis.stone);
    const [cx, cz] = this.map.camp, lz = this.map.crypt[1] + 9;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
      // zone tint blend
      const zi = ZONES.findIndex((zn) => z >= zn.zMin && z < zn.zMax);
      const zn = ZONES[Math.max(0, zi)];
      c.set(zn.tint);
      const next = ZONES[Math.min(ZONES.length - 1, zi + 1)];
      const t = THREE.MathUtils.smoothstep(zn.zMin + 8 - z, 0, 16);
      c2.set(next.tint); c.lerp(c2, t * 0.5);
      const n = Math.sin(x * 0.9) * Math.cos(z * 0.7) * 0.5 + Math.sin(x * 0.23 + z * 0.31) * 0.5;
      c.offsetHSL(0.01 * n, 0.04 * n, 0.05 * n);
      const dr = Math.abs(x - roadX(z));
      const road = 1 - THREE.MathUtils.smoothstep(dr, 1.6, 3.2 + Math.sin(z * 0.8) * 0.4);
      c.lerp(z < -60 ? stone : dirt, road * 0.85);
      const plaza = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - cx, z - cz), 7, 11);
      c.lerp(dirt, plaza * 0.6);
      const pz = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - this.map.crypt[0], z - lz), 9, 14);
      c.lerp(stone, pz * 0.8);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const lava = this.map.theme === 'lava' || this.map.theme === 'dragon';
    // subtle procedural detail noise in fragment shader
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWp;
        float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float nn = vn(vWp.xz*1.7)*0.5 + vn(vWp.xz*6.3)*0.3 + vn(vWp.xz*0.35)*0.4;
          diffuseColor.rgb *= 0.78 + nn*0.38;`);
      if (lava) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float cr = vn(vWp.xz*0.22 + vec2(3.1, 7.7)) * 0.7 + vn(vWp.xz*0.9) * 0.3;
          float pool = smoothstep(0.71, 0.75, cr);
          float rim = smoothstep(0.64, 0.71, cr) * (1.0 - pool);
          diffuseColor.rgb *= 1.0 - rim * 0.55;
          totalEmissiveRadiance += vec3(1.0, 0.32, 0.05) * pool * (0.75 + 0.35 * sin(vWp.x * 0.7 + vWp.z * 0.5));`);
    };
    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    this.terrain = terrain;
    this.scene.add(terrain);
  }

  buildProps() {
    const { placements: P, colliders, flames } = generateLayout();
    this.col = colliders;
    for (const f of flames) this.addFlame(new THREE.Vector3(f.x, f.y, f.z), f.size, f.big, f.color);
    this.placements = P;
    this.propsGroup = buildInstancedProps(P);
    this.scene.add(this.propsGroup);
    const SMALL = /bone|skull|ribcage|candle|coin|rock_single|stool|lantern_standing|pumpkin|plaque|shrine|coffin|gravemarker|barrel|crate|box_|keg|table|chest|torch/;
    this.chunks = [];
    for (const im of this.propsGroup.children) {
      if (/^mountain/.test(im.name) || im.userData.zc === undefined) continue;
      im.userData.reach = SMALL.test(im.name) ? 42 : 80;
      this.chunks.push(im);
    }
    // Props between the camera and the player dissolve (dithered) so the hero is never hidden.
    const tc = new THREE.Color(this.vis.tint[0]);
    this.occl = { uCam: { value: new THREE.Vector3() }, uPl: { value: new THREE.Vector3() }, uTint: { value: new THREE.Vector4(tc.r, tc.g, tc.b, this.vis.tint[1]) } };
    const seen = new Set();
    this.propsGroup.traverse((m) => {
      if (!m.isMesh || seen.has(m.material)) return;
      seen.add(m.material);
      const mat = m.material;
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uCam = this.occl.uCam; sh.uniforms.uPl = this.occl.uPl; sh.uniforms.uTint = this.occl.uTint;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWpo;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 wpo = vec4(transformed,1.);\n#ifdef USE_INSTANCING\nwpo = instanceMatrix*wpo;\n#endif\nvWpo = (modelMatrix*wpo).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWpo; uniform vec3 uCam, uPl; uniform vec4 uTint;')
          .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, uTint.rgb * (0.35 + dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) * 1.3), uTint.a);')
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
            vec3 seg = uPl - uCam; float L = length(seg); vec3 dir = seg / L;
            float t = dot(vWpo - uCam, dir);
            if (t > 0.0 && t < L - 1.2) {
              float d = length(vWpo - (uCam + dir * t));
              float k = 1.0 - smoothstep(1.4, 3.2, d);
              vec2 f = mod(gl_FragCoord.xy, 4.0);
              float th = (f.x * 4.0 + f.y) / 16.0;
              th = fract(th * 7.0 + f.x * 0.13);
              if (k * 0.85 > th) discard;
            }`);
      };
      mat.needsUpdate = true;
    });
    // A few real point lights for key locations (cheap glow elsewhere).
    if (this.quality !== 'low') {
      const fire = new THREE.PointLight(0xff8a3c, 40, 22, 1.8); fire.position.set(CAMP_POS.x, heightAt(CAMP_POS.x, CAMP_POS.z) + 1.6, CAMP_POS.z); this.scene.add(fire); this.lights.push({ l: fire, base: 40 });
      if (this.map.crypt) { const crypt = new THREE.PointLight(this.map.theme === 'bones' ? 0xff3322 : (THEMES[this.map.theme]?.flame ?? 0xff3322), 60, 30, 1.6); crypt.position.set(CRYPT_POS.x, 4, CRYPT_POS.z + 11); this.scene.add(crypt); this.lights.push({ l: crypt, base: 60 }); }
    }
  }

  // Swirling portal disc inside the camp's arch.
  buildPortal() {
    const P = this.map.portal; if (!P) return;
    const c = this.map.camp, ry = Math.atan2(c[0] - P.x, c[1] - P.z);
    this.portalU = { uT: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: this.portalU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uT; varying vec2 vUv;
        void main(){ vec2 p = (vUv - 0.5) * 2.0; float r = length(p); if (r > 1.0) discard;
          float a = atan(p.y, p.x) + uT * 1.6 + r * 5.0;
          float sw = 0.5 + 0.5 * sin(a * 4.0 - uT * 3.0);
          vec3 col = mix(vec3(0.25, 0.1, 0.9), vec3(0.4, 0.95, 1.0), sw) * (1.2 - r);
          float edge = smoothstep(1.0, 0.82, r);
          gl_FragColor = vec4(col * 1.6, edge * (0.55 + 0.45 * sw)); }`,
    });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 3.4), mat);
    const y = heightAt(P.x, P.z);
    disc.position.set(P.x, y + 1.85, P.z); disc.rotation.y = ry;
    this.scene.add(disc);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: World.glowTex ||= makeGlowTexture(), color: 0x7a6bff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
    glow.position.copy(disc.position); glow.scale.setScalar(6); this.scene.add(glow);
    this.portal = { disc, glow, pos: new THREE.Vector3(P.x, y, P.z) };
  }

  addFlame(pos, size, big, color = 0xff8a3c) {
    // Billboard glow + flickering particles handled by fx; here a glow sprite
    const tex = World.glowTex ||= makeGlowTexture();
    const mat = new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 });
    const sp = new THREE.Sprite(mat); sp.position.copy(pos); sp.scale.setScalar(size * 3.2);
    this.scene.add(sp);
    this.flames.push({ sp, size, pos: pos.clone(), big, color, seed: Math.random() * 10 });
  }

  buildGrass() {
    const count = Math.round((this.quality === 'high' ? 14000 : 6000) * this.vis.grass);
    if (!count) return;
    const blade = new THREE.BufferGeometry();
    const v = [];
    // Three crossed blades; each triangle duplicated with reversed winding so both sides are lit.
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI + 0.3, ca = Math.cos(a) * 0.09, sa = Math.sin(a) * 0.09;
      const ox = Math.cos(a + 1.57) * 0.08 * (k - 1), oz = Math.sin(a + 1.57) * 0.08 * (k - 1);
      const A = [-ca + ox, 0, -sa + oz], B = [ca + ox, 0, sa + oz], C = [ox * 2.2, 0.42, oz * 2.2];
      v.push(...A, ...B, ...C, ...B, ...A, ...C);
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    blade.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ side: THREE.FrontSide });
    mat.color.set(0xffffff);
    this.grassUniforms = { uTime: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.grassUniforms.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vH;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vH = position.y / 0.42;
          vec4 wp0 = instanceMatrix * vec4(0.,0.,0.,1.);
          float w = sin(uTime*1.7 + wp0.x*0.35 + wp0.z*0.25)*0.5 + sin(uTime*3.1 + wp0.x*0.9)*0.2;
          transformed.x += w * vH * vH * 0.22; transformed.z += w * vH * vH * 0.12;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.55, 1.25, vH);');
      sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.,1.,0.);');
    };
    // Grass is split into bands along z so only the strips near the camera are drawn.
    const R = rng(99), m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    const BAND = 16, bands = new Map(); this.grassChunks = [];
    let n = 0, tries = 0;
    while (n < count && tries++ < count * 4) {
      const x = BOUNDS.minX + R() * (BOUNDS.maxX - BOUNDS.minX), z = BOUNDS.minZ + 8 + R() * (BOUNDS.maxZ - BOUNDS.minZ - 8);
      if (Math.abs(x - roadX(z)) < 3) continue;
      if (Math.hypot(x - this.map.camp[0], z - this.map.camp[1]) < 9 || Math.hypot(x - this.map.crypt[0], z - this.map.crypt[1] - 9) < 13) continue;
      if (z < -60 && R() < 0.6) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28);
      const sc = 0.6 + R() * 0.8;
      m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.02, z), q, new THREE.Vector3(sc, sc * (0.6 + R() * 0.7), sc));
      const zn = ZONES.find((zz) => z >= zz.zMin && z < zz.zMax) || ZONES[1];
      col.set(zn.tint).offsetHSL((R() - 0.5) * 0.05, 0.05, 0.02 + (R() - 0.5) * 0.08);
      const k = Math.floor(z / BAND);
      if (!bands.has(k)) bands.set(k, []);
      bands.get(k).push([m.clone(), col.clone()]);
      n++;
    }
    for (const list of bands.values()) {
      const im = new THREE.InstancedMesh(blade, mat, list.length);
      list.forEach(([mm, cc], i) => { im.setMatrixAt(i, mm); im.setColorAt(i, cc); });
      im.receiveShadow = true;
      im.computeBoundingSphere(); im.boundingSphere.radius += 1;
      im.userData.zc = im.boundingSphere.center.z; im.userData.reach = 46;
      this.scene.add(im); this.grassChunks.push(im);
    }
  }

  buildAmbientMotes() {
    // Floating embers / fireflies near the player.
    const n = 160; const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 60; p[i * 3 + 1] = Math.random() * 6; p[i * 3 + 2] = (Math.random() - 0.5) * 60; ph[i] = Math.random() * 10; }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    this.moteUniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0xffc36b) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.moteUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime; uniform vec3 uCenter; attribute float phase; varying float vA;
        void main(){ vec3 p = position; p.x = mod(p.x - uCenter.x + 30., 60.) - 30. + uCenter.x; p.z = mod(p.z - uCenter.z + 30., 60.) - 30. + uCenter.z;
          p.y += uCenter.y + sin(uTime*0.6+phase)*0.8 + 0.6; p.x += sin(uTime*0.4+phase*2.)*0.9;
          vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
          vA = 0.5+0.5*sin(uTime*2.+phase*3.); gl_PointSize = (6.0 * vA + 2.0) * (40.0 / -mv.z); }`,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d);
        gl_FragColor = vec4(uColor, a*vA*0.8); }`,
    });
    this.motes = new THREE.Points(geo, mat); this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  update(dt, playerPos, fx) {
    this.time += dt;
    if (this.grassUniforms) this.grassUniforms.uTime.value = this.time;
    if (this.portalU) {
      this.portalU.uT.value = this.time;
      this.portal.glow.material.opacity = 0.55 + Math.sin(this.time * 2) * 0.15;
      if (fx && this.portal.pos.distanceToSquared(playerPos) < 900 && Math.random() < 0.6) {
        const p = this.portal.disc.position;
        fx.trail(new THREE.Vector3(p.x + (Math.random() - 0.5) * 2.4, p.y + (Math.random() - 0.5) * 3, p.z + (Math.random() - 0.5) * 0.6), Math.random() < 0.5 ? 0x8a7aff : 0x7fe8ff, 0.35, 0.9);
      }
    }
    this.moteUniforms.uTime.value = this.time;
    this.moteUniforms.uCenter.value.copy(playerPos);
    const zn = this.vis.motes[playerPos.z < -32 ? 2 : playerPos.z < 10 ? 1 : 0];
    this.moteUniforms.uColor.value.lerp(new THREE.Color(zn), dt * 0.8);
    if (this.occl && this.cam) { this.occl.uCam.value.copy(this.cam.position); this.occl.uPl.value.set(playerPos.x, playerPos.y + 1.2, playerPos.z); }
    this.sun.position.set(playerPos.x - 25, 45, playerPos.z + 18);
    this.sun.target.position.copy(playerPos);
    this.sky.position.copy(playerPos); this.stars.position.copy(playerPos);
    this.cullT = (this.cullT || 0) - dt;
    if (this.cullT <= 0) {
      this.cullT = 0.2;
      // Hide chunks the fog has already swallowed; small clutter goes earlier.
      for (const im of this.grassChunks || []) { const dz = im.userData.zc - playerPos.z; im.visible = dz > -46 && dz < 22; }
      for (const im of this.chunks) {
        const dz = im.userData.zc - playerPos.z;
        im.visible = dz > -im.userData.reach && dz < Math.min(26, im.userData.reach * 0.5);
      }
    }
    for (const L of this.lights) L.l.intensity = L.base * (0.85 + Math.sin(this.time * 13 + L.base) * 0.08 + Math.sin(this.time * 7.3) * 0.07);
    for (const f of this.flames) {
      const fl = 0.88 + Math.sin(this.time * 12 + f.seed) * 0.08 + Math.sin(this.time * 23 + f.seed * 2) * 0.05;
      f.sp.scale.setScalar(f.size * 3.2 * fl);
      if (fx && f.pos.distanceToSquared(playerPos) < 900 && Math.random() < (f.big ? 0.9 : 0.25)) fx.flame(f.pos, f.size, f.color);
    }
  }
}

export function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

