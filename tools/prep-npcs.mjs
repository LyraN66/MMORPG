// NPC models from KayKit Adventurers 2.0 (CC0). Usage: node tools/prep-npcs.mjs <KayKit_Adventurers_2.0_FREE dir>
// The 2.0 rig uses the same bone names as the 1.0 animations the game ships (anims.glb), so they share clips.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
for (const [src, out] of [['Barbarian', 'npc_barbarian'], ['Rogue', 'npc_rogue'], ['Ranger', 'npc_ranger']]) {
  const doc = await io.read(path.join(process.argv[2], 'Characters/gltf', src + '.glb'));
  for (const a of doc.getRoot().listAnimations()) a.dispose();
  await doc.transform(prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const f = path.resolve('public/assets', out + '.glb');
  await io.write(f, doc);
  console.log(out, (fs.statSync(f).size / 1024).toFixed(0) + 'KB');
}
