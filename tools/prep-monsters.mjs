// Builds optimized monster models from Quaternius "Ultimate Monsters" (CC0).
// Usage: node tools/prep-monsters.mjs <unzipped-pack-dir>
// Each model keeps its own animations; the shared colour atlas is stripped and shipped once (atlas.png).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
const OUT = path.resolve('public/assets/mon');
fs.mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const { ENEMIES, UNIQUES, MOUNTS } = await import('../server/shared/data.js');
const MONSTER_MODELS = [...new Set([...Object.values(ENEMIES), ...Object.values(UNIQUES)].filter((t) => t.rig || ENEMIES[t.type]?.rig).map((t) => t.model).concat(MOUNTS.map((m) => m.model)))].filter((m) => process.argv[3] !== 'missing' || !fs.existsSync(path.resolve('public/assets/mon', m + '.glb')));
let total = 0;
for (const m of MONSTER_MODELS) {
  const fam = m.slice(0, m.indexOf('_')), name = m.slice(m.indexOf('_') + 1);
  const doc = await io.read(path.join(SRC, fam, 'glTF', name + '.gltf'));
  const root = doc.getRoot();
  for (const t of root.listTextures()) t.dispose();
  await doc.transform(resample({ tolerance: 1e-3 }), prune({ keepLeaves: true, keepAttributes: true }), dedup());
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = path.join(OUT, m + '.glb');
  await io.write(out, doc);
  total += fs.statSync(out).size;
  console.log(m, (fs.statSync(out).size / 1024).toFixed(0) + 'KB', root.listAnimations().map((a) => a.getName()).join(','));
}
console.log('total', (total / 1024 / 1024).toFixed(2) + 'MB');
