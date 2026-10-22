// Extra weapons from KayKit Adventurers 2.0 (CC0): bow and arrow. Usage: node tools/prep-weapons2.mjs <KayKit_Adventurers_2.0_FREE dir>
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, mergeDocuments, unpartition, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const out = new Document();
for (const [file, name] of [['bow_withString', 'bow'], ['arrow_bow', 'arrow'], ['axe_1handed', 'axe_1h'], ['quiver', 'quiver']]) {
  const d = await io.read(path.join(process.argv[2], 'Assets/gltf', file + '.gltf'));
  d.getRoot().listScenes()[0].listChildren().forEach((n) => n.setName(name));
  mergeDocuments(out, d);
}
const scenes = out.getRoot().listScenes();
for (const s of scenes.slice(1)) { s.listChildren().forEach((c) => scenes[0].addChild(c)); s.dispose(); }
await out.transform(dedup(), prune(), unpartition(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const f = path.resolve('public/assets/weapons2.glb');
await io.write(f, out);
console.log('weapons2.glb', (fs.statSync(f).size / 1024).toFixed(0) + 'KB', scenes[0].listChildren().map((n) => n.getName()).join(','));
