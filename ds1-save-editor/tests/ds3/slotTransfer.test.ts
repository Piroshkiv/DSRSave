import { describe, it, expect } from 'vitest';
import { DS3SaveFileEditor } from '../../src/apps/ds3/lib/SaveFileEditor';
import { DS3Character } from '../../src/apps/ds3/lib/Character';
import {
  SLOT_SUMMARY_SIZE,
  SLOT_SUMMARY_BASE,
  SLOT_ACTIVE_FLAGS_OFFSET,
} from '../../src/apps/ds3/lib/constants';
import {
  copyCharacterSlot,
  importSlotFromBinary,
  packSlotFile,
  unpackSlotFile,
  type DS3SlotEditor,
} from '../../src/apps/ds3/lib/slotTransfer';
import { STEAM_ID_PREFIX } from '../../src/apps/ds3/lib/steamId';
import { hasDS3Save, ds3SaveFile } from '../helpers/saves';
import { makeSlotData, steamIdOf } from '../helpers/ds3Slots';

const ID_A = (STEAM_ID_PREFIX << 32n) + 0x11111111n;
const ID_B = (STEAM_ID_PREFIX << 32n) + 0x22222222n;

/** In-memory stand-in for the editor surface a transfer touches. */
class FakeEditor implements DS3SlotEditor {
  characters: DS3Character[];
  summaries: (Uint8Array | null)[] = Array.from({ length: 10 }, () => null);
  flags: boolean[] = Array.from({ length: 10 }, () => false);
  systemEntry = true;

  constructor(public accountId: bigint | null, slots: (Uint8Array | null)[]) {
    this.characters = slots.map((data, i) => new DS3Character(data ?? new Uint8Array(0x8000), i));
  }

  getCharacters(): DS3Character[] { return this.characters; }
  getSteamId(): bigint | null { return this.accountId; }
  canEditSlotFlags(): boolean { return this.systemEntry; }
  setSlotActive(slot: number, active: boolean): void { this.flags[slot] = active; }

  replaceCharacter(slot: number, plainData: Uint8Array): DS3Character {
    const expected = this.characters[slot].getRawData().length;
    if (plainData.length !== expected) {
      throw new Error(`Slot data must be ${expected} bytes for this save, got ${plainData.length}`);
    }
    const replacement = new DS3Character(new Uint8Array(plainData), slot);
    this.characters[slot] = replacement;
    return replacement;
  }

  readSlotSummary(slot: number): Uint8Array | null {
    if (!this.systemEntry) return null;
    return this.summaries[slot];
  }

  writeSlotSummary(slot: number, block: Uint8Array): void {
    if (!this.systemEntry) throw new Error('System entry is unavailable');
    if (block.length !== SLOT_SUMMARY_SIZE) throw new Error('bad summary size');
    this.summaries[slot] = new Uint8Array(block);
  }
}

function summaryBlock(fill: number): Uint8Array {
  return new Uint8Array(SLOT_SUMMARY_SIZE).fill(fill);
}

describe('DS3 .bin.ds3slot container', () => {
  it('round-trips slot bytes with a summary block', () => {
    const slot = makeSlotData('Solaire', 42);
    const summary = summaryBlock(0x7c);

    const { slotData, summary: back } = unpackSlotFile(packSlotFile(slot, summary));

    expect(slotData).toEqual(slot);
    expect(back).toEqual(summary);
  });

  it('writes a bare slot dump when there is no summary', () => {
    const slot = makeSlotData('Andre', 12);
    expect(packSlotFile(slot, null)).toEqual(slot);
  });

  it('reads a foreign raw slot dump as slot bytes with no summary', () => {
    const raw = makeSlotData('Foreign', 3);
    expect(unpackSlotFile(raw)).toEqual({ slotData: raw, summary: null });
  });

  it('ignores a trailer whose magic does not match', () => {
    const packed = packSlotFile(makeSlotData('X', 1), summaryBlock(1));
    packed[packed.length - 16] ^= 0xff;

    expect(unpackSlotFile(packed).summary).toBeNull();
  });
});

describe('DS3 slot transfer', () => {
  it('copies the character, its summary and the slot flag', () => {
    const source = new FakeEditor(ID_A, [makeSlotData('Artorias', 77, ID_A), null]);
    source.summaries[0] = summaryBlock(0x5a);
    const dest = new FakeEditor(ID_A, [null, null]);

    const result = copyCharacterSlot(source, dest, 0, 1);

    expect(dest.characters[1].name).toBe('Artorias');
    expect(dest.characters[1].level).toBe(77);
    expect(dest.summaries[1]).toEqual(summaryBlock(0x5a));
    expect(dest.flags[1]).toBe(true);
    expect(result.summaryCopied).toBe(true);
  });

  it('rebinds an imported slot to the destination account', () => {
    const source = new FakeEditor(ID_A, [makeSlotData('Traveller', 30, ID_A), null]);
    const dest = new FakeEditor(ID_B, [null, null]);

    const result = copyCharacterSlot(source, dest, 0, 1);

    expect(result.steamId).toBe(ID_B);
    expect(result.reboundSteamId).toBe(true);
    expect(steamIdOf(dest.characters[1])).toBe(ID_B);
    // The source is left exactly as it was
    expect(steamIdOf(source.characters[0])).toBe(ID_A);
  });

  it('leaves the stored ID alone when asked to', () => {
    const source = new FakeEditor(ID_A, [makeSlotData('Guest', 5, ID_A), null]);
    const dest = new FakeEditor(ID_B, [null, null]);

    const result = copyCharacterSlot(source, dest, 0, 1, { steamId: null });

    expect(result.reboundSteamId).toBe(false);
    expect(steamIdOf(dest.characters[1])).toBe(ID_A);
  });

  it('imports without a summary when the destination has no system entry', () => {
    const dest = new FakeEditor(ID_A, [null]);
    dest.systemEntry = false;

    const result = importSlotFromBinary(dest, makeSlotData('Lone', 9, ID_A), 0, {
      summary: summaryBlock(3),
    });

    expect(result.summaryCopied).toBe(false);
    expect(dest.characters[0].name).toBe('Lone');
    expect(dest.flags[0]).toBe(false);
  });

  it('refuses slot data of the wrong size', () => {
    const dest = new FakeEditor(ID_A, [null]);
    expect(() => importSlotFromBinary(dest, new Uint8Array(64), 0)).toThrow(/bytes/);
  });

  it('refuses an out-of-range destination slot', () => {
    const dest = new FakeEditor(ID_A, [null]);
    expect(() => importSlotFromBinary(dest, makeSlotData('X', 1), 10)).toThrow(/between 0 and 9/);
  });

  it('refuses to copy an empty source slot', () => {
    const source = new FakeEditor(ID_A, [null, null]);
    const dest = new FakeEditor(ID_A, [null, null]);
    expect(() => copyCharacterSlot(source, dest, 0, 1)).toThrow(/empty/);
  });
});

describe.skipIf(!hasDS3Save)('DS3 slot transfer (real save)', () => {
  async function loadPair(): Promise<[DS3SaveFileEditor, DS3SaveFileEditor]> {
    return [
      await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null),
      await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null),
    ];
  }

  it('moves a character into an empty slot of another save and re-exports', async () => {
    const [source, dest] = await loadPair();
    const hero = source.getCharacters().find((c) => !c.isEmpty)!;
    const emptySlot = dest.getCharacters().find((c) => c.isEmpty)?.slotIndex;
    expect(emptySlot, 'fixture needs an empty slot').toBeDefined();

    const result = copyCharacterSlot(source, dest, hero.slotIndex, emptySlot!);

    const moved = dest.getCharacter(emptySlot!)!;
    expect(moved.name).toBe(hero.name);
    expect(moved.level).toBe(hero.level);
    expect(moved.getRawData()).toEqual(hero.getRawData());
    expect(result.summaryCopied).toBe(true);
    expect(dest.isSlotActive(emptySlot!)).toBe(true);

    // The load menu now describes the character that is actually there
    expect(dest.readSlotSummary(emptySlot!)).toEqual(source.readSlotSummary(hero.slotIndex));

    // Entry sizes still line up, so the save can be written back out
    const exported = await dest.exportSaveFile();
    expect(exported.length).toBe((await ds3SaveFile()).size);
  });

  it('rebinds a transferred character to the destination account', async () => {
    const [source, dest] = await loadPair();
    dest.setSteamId(ID_B);

    const hero = source.getCharacters().find((c) => !c.isEmpty)!;
    const target = dest.getCharacters().find((c) => c.isEmpty)?.slotIndex ?? 9;

    const result = copyCharacterSlot(source, dest, hero.slotIndex, target);

    expect(result.reboundSteamId).toBe(true);
    expect(dest.getCharacter(target)!.getSteamId()).toBe(ID_B);
  });

  it('writes the summary and the flag without disturbing the other slots', async () => {
    const [source, dest] = await loadPair();
    const before = dest.getSystemEntryData()!.slice();

    const hero = source.getCharacters().find((c) => !c.isEmpty)!;
    const target = dest.getCharacters().find((c) => c.isEmpty)?.slotIndex ?? 9;
    copyCharacterSlot(source, dest, hero.slotIndex, target);

    const after = dest.getSystemEntryData()!;
    const touchedFrom = SLOT_SUMMARY_BASE + SLOT_SUMMARY_SIZE * target;
    const touchedTo = touchedFrom + SLOT_SUMMARY_SIZE;

    for (let i = 0; i < before.length; i++) {
      const isSummary = i >= touchedFrom && i < touchedTo;
      const isOwnFlag = i === SLOT_ACTIVE_FLAGS_OFFSET + target;
      if (isSummary || isOwnFlag) continue;
      if (before[i] !== after[i]) {
        throw new Error(`system entry changed outside slot ${target} at 0x${i.toString(16)}`);
      }
    }
  });

  it('exports a slot file that imports back byte for byte', async () => {
    const [source, dest] = await loadPair();
    const hero = source.getCharacters().find((c) => !c.isEmpty)!;
    const target = dest.getCharacters().find((c) => c.isEmpty)?.slotIndex ?? 9;

    const packed = packSlotFile(hero.getRawData(), source.readSlotSummary(hero.slotIndex));
    const { slotData, summary } = unpackSlotFile(packed);
    importSlotFromBinary(dest, slotData, target, { summary });

    expect(dest.getCharacter(target)!.getRawData()).toEqual(hero.getRawData());
    expect(dest.readSlotSummary(target)).toEqual(source.readSlotSummary(hero.slotIndex));
  });
});
