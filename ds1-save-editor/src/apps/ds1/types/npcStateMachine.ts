// Mirrors tools/npc-state-machine/npc_state_machine.json (schema_version 2) and
// DSRSave/Editors/NpcStateMachine/Schema.cs field-for-field. See cli.py's own
// docstring and project memory for the methodology this schema encodes.

export interface FlagAddressFormula {
  buffer_start_offset: string;
  k_table_by_map: Record<string, number>;
  megabank_by_region: Record<string, number>;
}

export interface ChrBlobConfig {
  offset_from_pattern1: string;
}

export interface ChrBitRef {
  map: string;
  msb_index: number;
}

export interface ObjBitsRef {
  map: string;
  indices: number[];
}

export interface AxisStageConfig {
  set_true: Record<string, number>;
  set_false: Record<string, number>;
  /** Optional, narrower dicts used ONLY for status detection (summarize/describe),
   * when an NPC has more than one real native path into "true"/"false" that don't
   * share every flag set_true/set_false writes (e.g. alvina: the editor's Aggressive
   * button writes 1711, but a real in-game betrayal sets 1712 instead -- detect_true
   * lets both read as hostile without changing what the button writes). Falls back
   * to set_true/set_false when absent -- every other NPC is unaffected. */
  detect_true?: Record<string, number>;
  detect_false?: Record<string, number>;
  always_clear_traps?: number[];
  chr_map?: string;
  chr_bit?: ChrBitRef;
  obj_bits?: ObjBitsRef;
  verified?: boolean;
}

export interface StatusAxis {
  per_stage: Record<string, AxisStageConfig>;
}

export interface KeyStage {
  flags_on: number[];
  verified?: boolean;
}

export interface NonKeyStage {
  parent: string;
  flags_on_add?: number[];
  flags_off?: number[];
}

export interface DependentEnemyGroup {
  entity_ids?: number[];
  chr_map: string;
  msb_indices: number[];
  event_slot_flags?: number[];
  revive_at_stages: string[];
  kill_at_stages: string[];
}

export interface NpcBody {
  id: string;
  map: string;
  msb_index?: number;
  disable_initialize_dead?: boolean;
}

export interface NpcEntry {
  personal_flag_range?: [number, number];
  coupled_npcs?: Record<string, string>;
  transition_traps_always_clear?: number[];
  dependent_enemies?: Record<string, DependentEnemyGroup>;
  status_axes?: Record<string, StatusAxis>;
  key_stages?: Record<string, KeyStage>;
  non_key_stages?: Record<string, NonKeyStage>;
  bodies?: NpcBody[];
  /** `key_stages` exist purely so `alive`/`hostile` can pick the right
   * per-map chr_bit/trap (e.g. domhnall_of_zena's stage is really just
   * "which of his 2 map placements is he physically at", not a quest
   * stage) -- still detected and still shown as a read-only badge, but no
   * stage-select/rollback control renders for the user. */
  stages_read_only?: boolean;
}

export interface NpcGroup {
  members: string[];
  primary_member: string;
  secondary_member?: string;
  combo_stages?: Record<string, Record<string, string>>;
  deadlock_notes?: Record<string, string>;
}

export interface StateMachineSchema {
  schema_version: number;
  flag_address_formula: FlagAddressFormula;
  chr_blob: ChrBlobConfig;
  npcs: Record<string, NpcEntry>;
  npc_groups: Record<string, NpcGroup>;
}

export type TriState = 'true' | 'false' | 'unknown';

export interface NpcSummary {
  id: string;
  stage: string;
  alive: TriState | 'n/a';
  hostile: TriState | 'n/a';
}
