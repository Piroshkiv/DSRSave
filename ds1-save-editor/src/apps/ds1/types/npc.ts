export interface NpcBitEntry {
  offset: string; // Hex offset like "0xFE"
  bit: number; // Bit position 0-7
  reverse: boolean; // If true, invert the alive state
}

export interface Npc {
  name: string;
  bits: NpcBitEntry[];
  warning?: string; // Optional warning message for NPC-specific bugs/issues
}

export interface NpcCollection {
  npcs: Npc[];
}

export interface NpcWithState extends Npc {
  isAlive: boolean | null;
  isBoss: boolean;
}
