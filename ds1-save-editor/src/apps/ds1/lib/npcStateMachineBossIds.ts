/** Which npc_state_machine.json ids are "boss fight" bosses (big health-bar
 * fights) vs. regular/quest NPCs, for splitting the new NPCs/Bosses pages.
 * There is no category field in the schema itself (unlike the old
 * npc_data.json's "(boss)" name suffix), so this is a hand-maintained list
 * based on real DS1 lore -- update it if new boss ids are ever added to the
 * schema. Darkmoon Knightess/Gwynevere are hostile NPCs, not boss fights
 * (no boss health bar), so they're deliberately NOT in this set. */
export const BOSS_IDS = new Set<string>([
  'asylum_demon_revisit',
  'taurus_demon',
  'bell_gargoyles',
  'capra_demon',
  'gaping_dragon',
  'moonlight_butterfly',
  'great_grey_wolf_sif',
  'chaos_witch_quelaag',
  'iron_golem',
  'centipede_demon',
  'ceaseless_discharge',
  'demon_firesage',
  'bed_of_chaos',
  'pinwheel',
  'gravelord_nito',
  'four_kings',
  'ornstein_and_smough',
  'gwyndolin',
  'seath',
  'crossbreed_priscilla',
  'black_dragon_kalameet',
  'knight_artorias',
  'manus',
  'gwyn',
]);
