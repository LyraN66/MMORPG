// Animation rigs. Game code always asks for KayKit clip names (the skeleton enemies' rig); monsters from the
// Quaternius pack have their own clips, so each rig maps the KayKit name to the clip it plays instead.
// Durations (seconds) let the server time attacks exactly like the clients.
export const RIGS = {
  big: {
    map: { Idle: 'Idle', Idle_Combat: 'Idle', Walking_D_Skeletons: 'Walk', Running_C: 'Run', Running_A: 'Run',
      '1H_Melee_Attack_Chop': 'Punch', '1H_Melee_Attack_Slice_Diagonal': 'Weapon', '1H_Melee_Attack_Jump_Chop': 'Jump',
      '2H_Melee_Attack_Spinning': 'Weapon', '2H_Melee_Attack_Chop': 'Weapon', Hit_A: 'HitReact', Death_C_Skeletons: 'Death',
      Death_A: 'Death', Spawn_Ground_Skeletons: 'Jump_Land', Taunt: 'Wave', Spellcast_Shoot: 'Punch', Spellcast_Summon: 'Yes', Cheer: 'Yes', Block: 'Duck' },
    dur: { Death: 0.77, Duck: 1.67, HitReact: 0.6, Idle: 1, Jump: 0.37, Jump_Idle: 0.5, Jump_Land: 0.37, No: 1.67, Punch: 0.87, Run: 0.57, Walk: 1, Wave: 1.67, Weapon: 0.87, Yes: 1.67 },
  },
  blob: {
    map: { Idle: 'Idle', Idle_Combat: 'Idle', Walking_D_Skeletons: 'Walk', Running_C: 'Walk', Running_A: 'Walk',
      '1H_Melee_Attack_Chop': 'Bite_Front', '1H_Melee_Attack_Slice_Diagonal': 'Bite_Front', '1H_Melee_Attack_Jump_Chop': 'Jump',
      '2H_Melee_Attack_Spinning': 'Dance', '2H_Melee_Attack_Chop': 'Bite_Front', Hit_A: 'HitRecieve', Death_C_Skeletons: 'Death',
      Death_A: 'Death', Spawn_Ground_Skeletons: 'Jump', Taunt: 'Dance', Spellcast_Shoot: 'Bite_Front', Spellcast_Summon: 'Yes', Cheer: 'Yes', Block: 'No' },
    dur: { Bite_Front: 0.4, Dance: 0.67, Death: 0.37, HitRecieve: 0.3, Idle: 2, Jump: 0.43, No: 1, Walk: 0.43, Yes: 0.97 },
  },
  fly: {
    map: { Idle: 'Flying_Idle', Idle_Combat: 'Flying_Idle', Walking_D_Skeletons: 'Flying_Idle', Running_C: 'Fast_Flying', Running_A: 'Fast_Flying',
      '1H_Melee_Attack_Chop': 'Punch', '1H_Melee_Attack_Slice_Diagonal': 'Headbutt', '1H_Melee_Attack_Jump_Chop': 'Headbutt',
      '2H_Melee_Attack_Spinning': 'Fast_Flying', '2H_Melee_Attack_Chop': 'Headbutt', Hit_A: 'HitReact', Death_C_Skeletons: 'Death',
      Death_A: 'Death', Spawn_Ground_Skeletons: 'Flying_Idle', Taunt: 'Yes', Spellcast_Shoot: 'Punch', Spellcast_Summon: 'Yes', Cheer: 'Yes', Block: 'No' },
    dur: { Death: 0.67, Fast_Flying: 0.83, Flying_Idle: 1.17, Headbutt: 1.17, HitReact: 0.47, No: 1.17, Punch: 1.17, Yes: 1.17 },
  },
};
// Clip name a rig actually plays for a KayKit clip name (null rig = KayKit itself).
export const rigClip = (rig, name) => (rig ? RIGS[rig].map[name] || 'Idle' : name);
export const rigOf = (model) => (/^Big_/.test(model) ? 'big' : /^Blob_/.test(model) ? 'blob' : /^Flying_/.test(model) ? 'fly' : null);
// Monster models a map needs: { model: rig } for its camps, bosses and their summons.
export function monstersFor(map, ENEMIES, UNIQUES) {
  const out = {}, add = (model) => { const r = rigOf(model); if (r) out[model] = r; };
  for (const c of map.camps) add(ENEMIES[c[2]].model);
  for (const u of Object.values(UNIQUES)) if (u.map === map.id) { add(u.model); for (const t of u.summons || []) add(ENEMIES[t].model); }
  return out;
}
