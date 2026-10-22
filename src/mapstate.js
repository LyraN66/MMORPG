// Switches every shared module to the given map before the world is built.
import { useTerrain } from '../server/shared/terrain.js';
import { useMapData } from './data.js';
import { mapById } from '../server/shared/maps.js';
import { useQuestMap } from './quests.js';

export function activateMap(id) {
  const m = mapById(id);
  useTerrain(m.id); useMapData(m.id); useQuestMap();
  return m;
}
