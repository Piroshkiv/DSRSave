import { NpcCollection } from "../types/npc";
import { Character } from "./Character";

export class NpcEditor {
    private character: Character;
    private npcData: NpcCollection | null = null;
    private static readonly NPC_DATA_PATH = "json/npc_data.json";
  
    constructor(character: Character) {
      this.character = character;
    }
  
    public async loadNpcData(): Promise<void> {
      const isElectron =
        typeof window !== "undefined" && window.location.protocol === "file:";
  
      const paths = isElectron
        ? [`./${NpcEditor.NPC_DATA_PATH}`, `/${NpcEditor.NPC_DATA_PATH}`]
        : [`/${NpcEditor.NPC_DATA_PATH}`, `./${NpcEditor.NPC_DATA_PATH}`];
  
      let lastError: Error | null = null;
  
      for (const jsonPath of paths) {
        try {
          const response = await fetch(jsonPath);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          this.npcData = (await response.json()) as NpcCollection;
          return; 
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
        }
      }
  
      
      throw new Error(
        "Could not load NPC data. Please ensure npc_data.json is available.",
      );
    }
  
    public loadItemsDatabase(): NpcCollection {
      if (!this.npcData) {
        throw new Error("NPC data has not been loaded yet. Call loadNpcData() first.");
      }
      return this.npcData;
    }
  
    public setNpcAlive(name: string, alive: boolean): void {
      const npcData = this.loadItemsDatabase(); 
  
      const npc = npcData.npcs.find((n) => n.name === name);
      if (npc == null) {
        throw new Error(`NPC with name '${name}' not found in data.`);
      }
  
      const baseOffset = this.character.findPattern1();
  
      const rawData = this.character.getRawData();
  
      for (const bitEntry of npc.bits) {
        const relativeOffset = parseInt(bitEntry.offset, 16);
        const absoluteOffset = baseOffset + relativeOffset;
  
        if (absoluteOffset < 0 || absoluteOffset >= rawData.length) {
          throw new Error(
            `Calculated offset ${absoluteOffset} (Base: ${baseOffset}, Relative: ${relativeOffset}) is out of bounds.`,
          );
        }
  
        const bitValue = bitEntry.reverse ? !alive : alive;
  
        this.setBit(rawData, absoluteOffset, bitEntry.bit, bitValue);
      }
    }
  
    private setBit(
      data: Uint8Array,
      offset: number,
      bitPosition: number,
      value: boolean,
    ): void {
      if (bitPosition < 0 || bitPosition > 7) {
        throw new Error("Bit position must be between 0 and 7");
      }
  
      let currentValue = data[offset];
      const mask = 1 << bitPosition;
  
      if (value) {
        currentValue = currentValue | mask;
      } else {
        currentValue = currentValue & ~mask;
      }
  
      data[offset] = currentValue;
    }
  }