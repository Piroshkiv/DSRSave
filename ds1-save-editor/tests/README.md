# Tests

Characterization suite for the DS1 and DS3 save-file cores. Its purpose is to
make the DS1/DS3 unification safe: it pins current behaviour — including the
bugs — so that any change in observable behaviour shows up as a failing test.

## Running

```bash
npm test          # one-shot run
npm run test:watch
npm run test:types  # type-check the suite (tsconfig.test.json)
```

## Save fixtures

Most suites run against **real save files**, which live outside the repo and
are never committed. Default locations:

| Game | Default path | Override |
|------|--------------|----------|
| DS1  | `~/Documents/NBGI/DARK SOULS REMASTERED/<id>/DRAKS0005.sl2` | `DS1_SAVE_PATH` |
| DS3  | `~/AppData/Roaming/DarkSoulsIII/<id>/DS30000.sl2`           | `DS3_SAVE_PATH` |

```bash
DS1_SAVE_PATH=/path/to/DRAKS0005.sl2 npm test
```

**The suite never writes to these files.** Every fixture read returns a fresh
in-memory copy (`readSaveBytes` in `helpers/saves.ts`); all editing happens on
that copy and exported bytes are only ever compared, never saved.

When a fixture is missing its suites **skip** rather than fail, so the
fixture-independent tests (crypto, item databases, stat vocabulary — 47 of
them) still run on any machine.

## Layout

| Path | Covers |
|------|--------|
| `crypto.test.ts` | AES-CBC round trips, RFC 1321 MD5 vectors, and the equivalence of DS1's `js-md5` with DS3's hand-rolled MD5 |
| `ds1/saveFile.test.ts` | Slot geometry, PKCS#7 padding, checksums, byte-identical export |
| `ds1/character.test.ts` | Name, stats, appearance, Pattern1 anchor, bonfire flags, world-event flags |
| `ds1/inventory.test.ts` | Item database, add/stack/delete, weapon level calibration |
| `ds3/saveFile.test.ts` | BND4 container, per-entry checksums, IV reuse, export idempotence |
| `ds3/character.test.ts` | Pattern anchor, stats and derived values, soul memory, bonfire block |
| `ds3/inventory.test.ts` | GA table, storage box, weapon memory, `Safe` flag enforcement |
| `data/itemsDatabase.test.ts` | Invariants over `public/json/*.json` — no save file needed |
| `parity/editors.test.ts` | The shared DS1↔DS3 contract and every known divergence |

## Reading the suite before you unify

Two test-name prefixes carry special meaning:

- **`KNOWN BUG:`** — current behaviour is wrong, and the test asserts the wrong
  behaviour on purpose so the suite stays green. Fix the code and the test
  together.
- **`KNOWN DIVERGENCE:`** — DS1 and DS3 disagree. `parity/editors.test.ts`
  collects these; each one is a decision unification has to make explicitly.
  When you close a divergence, delete its pin in the same commit.

The most dangerous divergence is in `parity/editors.test.ts`:
**`VIT` means Vitality/HP in DS1 but Vitality/equip-load in DS3**, where HP
comes from `VIG`. Any shared stat model keyed on names alone will silently
write the wrong attribute.
