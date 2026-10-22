import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/800.css';
import '@fontsource/cinzel-decorative/900.css';
import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { loadAll, makeCharacter, Animator } from './assets.js';
import { World, heightAt, CAMP_POS } from './world.js';
import { FX } from './fx.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { initAudio } from './audio.js';
import { CLASSES, GAME_NAME } from './data.js';
import { loadSave, newSave, deleteSave, saveGame } from './save.js';

const $ = (s) => document.querySelector(s);

// ---------- quality ----------
const coarse = matchMedia('(pointer: coarse)').matches;
let qPref = 'auto'; try { qPref = localStorage.getItem('kv-quality') || 'auto'; } catch { /* ignore */ }
let fpsPref = 'auto'; try { fpsPref = localStorage.getItem('kv-fps') || 'auto'; } catch { /* ignore */ }
let showPerf = false; try { showPerf = localStorage.getItem('kv-perf') === '1'; } catch { /* ignore */ }

const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: qPref !== 'low', powerPreference: 'high-performance' });

// Phones are limited by how many pixels the GPU can shade, so the mobile profile is picked from the GPU
// and the resolution stays fixed (changing it mid-game caused hitches).
const gl = renderer.getContext();
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
const GPU = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
function gpuTier(name) {
  const n = name.toLowerCase();
  const adreno = +(n.match(/adreno[^\d]*(\d{3})/) || [])[1] || 0;
  const mali = n.match(/mali-g(\d+)/); const maliN = mali ? +mali[1] : 0;
  if (/apple|immortalis/.test(n) || adreno >= 730) return 3;
  if (adreno >= 640 || maliN >= 68 || /xclipse/.test(n)) return 2;
  return 1;
}
const tier = coarse ? gpuTier(GPU) : 3;
const quality = qPref === 'auto' ? (coarse ? 'medium' : 'high') : qPref;
const dprCap = { high: 2, medium: 1.5, low: 1 }[quality];
const dpr = Math.min(devicePixelRatio, qPref === 'auto' && coarse ? [0, 1.15, 1.35, 1.6][tier] : dprCap);
renderer.setPixelRatio(dpr);
renderer.info.autoReset = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = quality !== 'low';
renderer.shadowMap.type = quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x2d2f36, 0.019);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.3, 140);

let composer = null;
// Bloom post-processing only on desktop-class GPUs; on phones glows come from additive sprites instead.
if (quality === 'high' && !coarse) {
  // Multisampled target keeps edges smooth when post-processing is on.
  const rt = new THREE.WebGLRenderTarget(innerWidth * dpr, innerHeight * dpr, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(dpr);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.5, 0.82));
  composer.addPass(new OutputPass());
}

const ui = new UI();
const input = new Input(canvas, $('#joy'), $('#knob'));
let fx = null, world = null, game = null;

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h; camera.fov = w < h ? 62 : 48; camera.updateProjectionMatrix();
  renderer.setSize(w, h); composer?.setSize(w, h);
  fx?.setScale(h * renderer.getPixelRatio());
  const mm = $('#minimap'); const sz = Math.round(118 * devicePixelRatio);
  if (mm.width !== sz) { mm.width = sz; mm.height = sz; }
}
addEventListener('resize', resize);

// ---------- title scene ----------
let preview = [];
function setupPreview() {
  const base = CAMP_POS.clone();
  [['knight', -1.3], ['mage', 1.3]].forEach(([m, dx]) => {
    const ch = makeCharacter(m, {});
    const an = new Animator(ch); an.loop('Idle');
    ch.root.position.set(base.x + dx, heightAt(base.x + dx, base.z - 3.2), base.z - 3.2);
    ch.root.rotation.y = 0.15 * -Math.sign(dx) + Math.PI * 0;
    scene.add(ch.root); preview.push({ ch, an, m });
  });
}
function clearPreview() { preview.forEach((p) => scene.remove(p.ch.root)); preview = []; }

let titleT = 0;
function titleCamera(dt) {
  titleT += dt;
  const a = Math.sin(titleT * 0.12) * 0.35;
  const c = CAMP_POS;
  camera.position.set(c.x + Math.sin(a) * 9, 3.2, c.z - 3.2 + Math.cos(a) * 9);
  camera.lookAt(c.x, 1.5, c.z - 3.2);
}

// ---------- menus ----------
let chosen = 'knight';
function showTitle() {
  const save = loadSave();
  $('#title').classList.remove('hidden');
  $('#t-continue').classList.toggle('hidden', !save);
  if (save) $('#t-continue').innerHTML = `Devam Et <small>${save.name} · ${CLASSES[save.cls].name} · Sv.${save.level}</small>`;
  $('#t-new').textContent = save ? 'Yeni Karakter' : 'Oyuna Başla';
  $('#t-continue').onclick = () => { initAudio(); startGame(save); };
  $('#t-new').onclick = () => { initAudio(); $('#title').classList.add('hidden'); showClassSelect(); };
}
function showClassSelect() {
  const box = $('#classes'); box.innerHTML = '';
  for (const c of Object.values(CLASSES)) {
    const el = document.createElement('div'); el.className = 'ccard' + (c.id === chosen ? ' sel' : '');
    el.innerHTML = `<div class="cic">${c.id === 'knight' ? '⚔️' : '🔮'}</div><h3>${c.name}</h3><p>${c.desc}</p>
      <div class="cst"><span>Can <b>${c.base.hp}</b></span><span>Mana <b>${c.base.mp}</b></span><span>Saldırı <b>${c.base.atk}</b></span><span>Menzil <b>${c.ranged ? 'Uzak' : 'Yakın'}</b></span></div>
      <div class="csk">${c.skills.map((s) => `<span title="${s.desc}">${s.icon} ${s.name}</span>`).join('')}</div>`;
    el.onclick = () => { chosen = c.id; showClassSelect(); focusPreview(); };
    box.appendChild(el);
  }
  $('#cselect').classList.remove('hidden');
  focusPreview();
  $('#c-back').onclick = () => { $('#cselect').classList.add('hidden'); showTitle(); };
  $('#c-go').onclick = () => {
    const name = $('#c-name').value.trim().slice(0, 14) || CLASSES[chosen].name;
    if (loadSave() && !confirm('Mevcut karakterin silinecek. Emin misin?')) return;
    deleteSave();
    const s = newSave(chosen, name); saveGame(s);
    startGame(s);
  };
}
function focusPreview() {
  for (const p of preview) {
    const on = p.m === chosen;
    if (on && !p.wasOn) p.an.once(p.m === 'knight' ? '1H_Melee_Attack_Slice_Diagonal' : 'Spellcast_Raise', { timeScale: 1, lockFor: 1 });
    p.wasOn = on;
  }
}

function startGame(save) {
  $('#title').classList.add('hidden'); $('#cselect').classList.add('hidden');
  clearPreview();
  game = new Game({ renderer, scene, camera, ui, input, save, quality, world, fx });
  input.onTap = (x, y) => game.handleTap(x, y);
  input.onKey = (k) => {
    if (k === ' ' || k === 'j') game.attackButton();
    else if (k === '1' || k === '2' || k === '3') game.player.useSkill(+k - 1);
    else if (k === 'q') game.player.usePotion('hp');
    else if (k === 'e') game.player.usePotion('mp');
    else if (k === 'i' || k === 'b') ui.openInventory();
    else if (k === 'f') ui.interact();
    else if (k === 'm') { if (document.querySelector('#map').classList.contains('hidden')) ui.openMap(); else ui.closeModal(); }
    else if (k === 'escape') ui.closeModal();
  };
  addEventListener('visibilitychange', () => { if (document.hidden) saveGame(game.save, game.player); });
  addEventListener('pagehide', () => saveGame(game.save, game.player));
}

// ---------- loop ----------
const clock = new THREE.Clock();
let fpsT = 0, frames = 0, good = 0;
// Frame pacing: a steady 30 fps feels smoother than a frame rate jumping between 20 and 50.
let cap = fpsPref === '30' ? 30 : 0, lastFrame = 0, calib = fpsPref === 'auto' && coarse ? { t: 0, n: 0 } : null;
function calibrate(raw) {
  if (!calib || !game) return;
  calib.t += raw; calib.n++;
  if (calib.t > 6) { if (calib.n / calib.t < 48) cap = 30; calib = null; }
}
function loop(now) {
  requestAnimationFrame(loop);
  if (cap && now - lastFrame < 1000 / cap - 4) return;
  lastFrame = now;
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.1);
  renderer.info.reset();
  calibrate(raw);
  input.update();
  if (game) game.update(dt);
  else if (world) {
    titleCamera(dt);
    for (const p of preview) p.an.update(dt);
    world.update(dt, CAMP_POS, fx);
    fx.update(dt, dt);
  }
  if (composer) composer.render(); else renderer.render(scene, camera);
  frames++; fpsT += raw;
  if (fpsT > 1.5) {
    const fps = frames / fpsT;
    const el = $('#fps'); el.classList.toggle('show', showPerf);
    el.textContent = showPerf ? `${Math.round(fps)} fps${cap ? ' (30 kilit)' : ''} · ${dpr.toFixed(2)}x · ${quality} · ${renderer.info.render.calls} çizim · ${GPU.replace(/ANGLE \(|\)$/g, '').slice(0, 40)}` : Math.round(fps) + ' fps';
    frames = 0; fpsT = 0;
  }
}

// ---------- boot ----------
(async function boot() {
  document.title = GAME_NAME;
  resize();
  try {
    await loadAll((k) => { $('#loadbar i').style.width = Math.round(k * 90) + '%'; });
  } catch (e) {
    $('#loadtext').textContent = 'Yükleme hatası: ' + e.message; console.error(e); return;
  }
  $('#loadtext').textContent = 'Dünya kuruluyor…';
  await new Promise((r) => setTimeout(r, 30));
  fx = new FX(scene, camera, $('#overlay'));
  world = new World(scene, quality);
  resize();
  setupPreview();
  window.__kv = { scene, camera, input, renderer, setPerf: (v) => { showPerf = v; }, setFps: (v) => { fpsPref = v; cap = v === '30' ? 30 : 0; calib = v === 'auto' && coarse ? { t: 0, n: 0 } : null; }, get world() { return world; }, get game() { return game; }, THREE };
  // warm up shaders
  renderer.compile(scene, camera);
  $('#loadbar i').style.width = '100%';
  requestAnimationFrame(loop);
  setTimeout(() => { $('#loading').classList.add('done'); if (!game) showTitle(); }, 250);
  if (new URLSearchParams(location.search).has('autostart')) {
    const s = loadSave() || newSave(new URLSearchParams(location.search).get('cls') || 'knight', 'Test');
    startGame(s);
  }
})();
