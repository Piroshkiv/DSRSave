import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DS3Character } from '../../src/apps/ds3/lib/Character';

/**
 * Regression test anchored to a real live capture (see docs/ds3-resist-recalc.md,
 * "Refill rates" + "Confidence"): character VIG 36, ATN 12, END 16, VIT 10,
 * STR 12, DEX 36, INT 10, FTH 8, LCK 9; armor 900000-903000, rings
 * 20700/20010/20450/20540 — none of which carry a resist bonus in the
 * regulation. STR was raised 12->70 directly in the running game's process
 * memory, with a 20s delay before forcing a save so every gauge (slowest:
 * curse, 3 pts/s) had time to fully refill to its new maximum rather than
 * being caught mid-refill. The game itself wrote back `166, 166, 166, 166,
 * 184`, which is exactly what `computeMaxResistances()` predicts for this
 * stat/equipment combination.
 *
 * Uses a frozen decrypted-slot snapshot (`tests/fixtures/ds3_resist_slot0_str12.bin`,
 * taken right before that live edit), not the user's live save — a prior
 * version of this test read the live save directly and started failing once
 * the user equipped different armor in a later play session, which is a
 * fixture-drift bug in the test, not in the formula it's checking.
 */
describe('DS3 resist formula vs a real live game recalculation', () => {
  it('slot 0: setStat(STR, 70) matches the game-recalculated gauges', async () => {
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'ds3_resist_slot0_str12.bin');
    const data = new Uint8Array(await readFile(fixturePath));
    const c = new DS3Character(data, 0);

    expect(c.getStat('STR')).toBe(12); // guards against the fixture itself being swapped out

    c.setStat('STR', 70);

    expect(c.getResistances()).toEqual([166, 166, 166, 166, 184]);
  });
});
