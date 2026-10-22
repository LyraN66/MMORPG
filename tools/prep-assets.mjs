// Builds optimized game assets from KayKit (CC0) source packs.
// Usage: node tools/prep-assets.mjs <dir-containing-KayKit-packs>
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, mergeDocuments, unpartition, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
const OUT = path.resolve('public/assets');
fs.mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const find = (rel) => {
  const p = path.join(SRC, rel);
  if (!fs.existsSync(p)) throw new Error('missing ' + p);
  return p;
};

const HERO_ANIMS = ['Idle', 'Running_A', 'Walking_A', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal',
  '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Chop',
  'Block', 'Hit_A', 'Death_A', 'Cheer', 'Dodge_Forward', 'Spellcast_Raise', 'Spellcast_Shoot', 'Spellcast_Long',
  'Spellcasting', 'Jump_Full_Short', 'Use_Item', 'PickUp', 'Interact'];
const SKEL_ANIMS = ['Idle_Combat', 'Idle', 'Walking_D_Skeletons', 'Running_C', 'Running_A', '1H_Melee_Attack_Chop',
  '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spinning', '2H_Melee_Attack_Chop',
  'Hit_A', 'Death_C_Skeletons', 'Death_A', 'Spawn_Ground_Skeletons', 'Taunt', 'Spellcast_Shoot', 'Spellcast_Summon',
  'Cheer', 'Block'];

async function character(rel, outName, keepAnims, keepMeshes, { animsOnly = false, noAnims = false } = {}) {
  const doc = await io.read(find(rel));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (noAnims || !keepAnims.includes(a.getName())) {
    a.listChannels().forEach((c) => c.dispose());
    a.listSamplers().forEach((sm) => sm.dispose());
    a.dispose();
  }
  for (const n of root.listNodes()) {
    const m = n.getMesh();
    if (!m) continue;
    if (animsOnly || (keepMeshes && !keepMeshes.some((k) => n.getName().startsWith(k)))) n.dispose();
  }
  await doc.transform(resample({ tolerance: 1e-3 }), prune({ keepLeaves: true }), dedup());
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(path.join(OUT, outName), doc);
  console.log(outName, (fs.statSync(path.join(OUT, outName)).size / 1024).toFixed(0) + 'KB', root.listAnimations().length, 'anims');
}

const ADV = 'KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures';
const SK = 'KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons';
// All KayKit characters share one rig, so animations are exported once and shared.
await character(`${SK}/Characters/gltf/Skeleton_Warrior.glb`, 'anims.glb', [...new Set([...HERO_ANIMS, ...SKEL_ANIMS])], null, { animsOnly: true });
await character(`${ADV}/Characters/gltf/Knight.glb`, 'knight.glb', [], ['Knight_', '1H_Sword', 'Badge_Shield'], { noAnims: true });
await character(`${ADV}/Characters/gltf/Mage.glb`, 'mage.glb', [], ['Mage_', '2H_Staff'], { noAnims: true });
await character(`${ADV}/Characters/gltf/Rogue_Hooded.glb`, 'rogue.glb', [], ['Rogue_', '1H_Crossbow'], { noAnims: true });
for (const s of ['Minion', 'Warrior', 'Rogue', 'Mage'])
  await character(`${SK}/Characters/gltf/Skeleton_${s}.glb`, `skel_${s.toLowerCase()}.glb`, [], null, { noAnims: true });

// Static props merged into one file; each prop becomes a top-level node named after the prop.
async function props(outName, list) {
  const out = new Document();
  for (const [rel, name] of list) {
    const d = await io.read(find(rel));
    d.getRoot().listScenes()[0].listChildren().forEach((n) => n.setName(name));
    mergeDocuments(out, d);
  }
  const scenes = out.getRoot().listScenes();
  const main = scenes[0];
  for (const s of scenes.slice(1)) { s.listChildren().forEach((c) => main.addChild(c)); s.dispose(); }
  await out.transform(dedup(), prune(), unpartition(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(path.join(OUT, outName), out);
  console.log(outName, (fs.statSync(path.join(OUT, outName)).size / 1024).toFixed(0) + 'KB', main.listChildren().length, 'props');
}

const HW = 'KayKit-Halloween-Bits-1.0/addons/kaykit_halloween_bits/Assets/gltf';
const HX = 'KayKit-Medieval-Hexagon-Pack-1.0/addons/kaykit_medieval_hexagon_pack/Assets/gltf';
const DG = 'KayKit-Dungeon-Remastered-1.0/addons/kaykit_dungeon_remastered/Assets/gltf';
const findIn = (base, file) => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [file, file.replace('.gltf.glb', '.glb')].includes(e.name) ? [path.join(d, e.name)] : []);
  const r = walk(path.join(SRC, base));
  if (!r.length) throw new Error('missing ' + file);
  return path.relative(SRC, r[0]);
};
const hw = ['tree_dead_large', 'tree_dead_medium', 'tree_dead_small', 'tree_dead_large_decorated',
  'tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_yellow_large', 'tree_pine_yellow_medium',
  'tree_pine_orange_small', 'grave_A', 'grave_B', 'grave_A_destroyed', 'gravestone', 'gravemarker_A', 'gravemarker_B',
  'crypt', 'arch', 'arch_gate', 'fence', 'fence_broken', 'fence_pillar', 'fence_gate', 'lantern_standing',
  'post_lantern', 'post_skull', 'shrine_candles', 'coffin', 'coffin_decorated', 'skull', 'ribcage', 'bone_A', 'bone_B',
  'pumpkin_orange_jackolantern', 'pumpkin_yellow', 'candle_triple', 'pillar', 'bench_decorated', 'plaque_candles'];
const hx = ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass', 'rock_single_A', 'rock_single_B',
  'rock_single_C', 'rock_single_D', 'rock_single_E', 'tree_single_A', 'tree_single_B', 'trees_A_large', 'trees_B_large'];
const dg = ['barrel_large', 'barrel_small_stack', 'box_stacked', 'crates_stacked', 'chest', 'chest_gold', 'torch_lit',
  'banner_patternA_red', 'banner_shield_red', 'pillar_decorated', 'column', 'wall_broken', 'rubble_large',
  'rubble_half', 'coin_stack_large', 'coin', 'sword_shield_gold', 'table_long_decorated_A', 'keg_decorated',
  'stool', 'floor_tile_large', 'wall_arched', 'wall_half'];
await props('props.glb', [
  ...hw.map((n) => [findIn(HW.replace('/Assets/gltf', ''), n + '.gltf'), n]),
  ...hx.map((n) => [findIn(HX.replace('/Assets/gltf', ''), n + '.gltf'), n]),
  ...dg.map((n) => [findIn(DG.replace('/Assets/gltf', ''), n + '.gltf.glb'), n]),
]);
const ADVA = `${ADV}/Assets/gltf`, SKA = `${SK}/Assets/gltf`;
await props('weapons.glb', [
  [`${SKA}/Skeleton_Blade.gltf`, 'sk_blade'], [`${SKA}/Skeleton_Axe.gltf`, 'sk_axe'],
  [`${SKA}/Skeleton_Staff.gltf`, 'sk_staff'], [`${SKA}/Skeleton_Shield_Small_A.gltf`, 'sk_shield_s'],
  [`${SKA}/Skeleton_Shield_Large_A.gltf`, 'sk_shield_l'], [`${SKA}/Skeleton_Crossbow.gltf`, 'sk_crossbow'],
  [`${ADVA}/dagger.gltf`, 'dagger'], [`${ADVA}/axe_2handed.gltf`, 'axe_2h'], [`${ADVA}/sword_2handed_color.gltf`, 'sword_2h'],
]);
