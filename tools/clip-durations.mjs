// Writes server/shared/clips.json: animation name -> duration (s). The server times attacks with it.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read('public/assets/anims.glb');
const out = {};
for (const a of doc.getRoot().listAnimations()) {
  let d = 0;
  for (const s of a.listSamplers()) { const arr = s.getInput().getArray(); d = Math.max(d, arr[arr.length - 1]); }
  out[a.getName()] = Math.round(d * 1000) / 1000;
}
fs.writeFileSync('server/shared/clips.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'clips');
