# DS3 status resistances: what the save holds and how to recompute it

What the five "resistance" numbers in a DS3 character slot really are, where they
sit, the formula the game derives them from, and what the editor now does with
them. Companion to `docs/ds3-bonfire-anchor.md` and `docs/ds3-appearance.md`.

Status as of 2026-11-15: **layout and formula solved from the executable and
confirmed against 41 real characters; the editor refills the gauges to the new
maxima on every stat edit.** Nothing was watched in live memory — see
"Confidence".

Two different things are called "resistance" in DS3 and this file keeps them
apart:

- the five **status gauges** — poison, bleed, toxic, curse, frost. In the save.
- the **defense / absorption** numbers of the Equip screen — physical, strike,
  slash, thrust, magic, fire, lightning, dark — plus poise and equip load.
  **Not in the save**; see "Defense, absorption, poise, equip load".

---

## TL;DR

- The slot stores five u32 at `CHARACTER_PATTERN - 0x70` (PlayerGameData `+0xE0..+0xF0`).
  Order in the save: **poison, bleed, toxic, curse, frost**.
- They are **not a cache of the status-screen resistances.** They are the live
  buildup gauges — `current = max − buildup so far` — saved so that quitting does
  not empty a half-filled poison bar. A full gauge reads exactly `max`.
- Any value in `0..max` is something the game writes itself. The only state an
  editor can create that the game cannot is `current > max` (lower a stat, leave
  the gauge). That is what needed fixing.
- `max` has a closed form (below), reproduced exactly on every full-gauge
  character checked: 36 of 36.
- Defense, absorption, poise and equip load are not in the save at all. They
  live in a runtime block (`PlayerGameData +0x830..+0x918`) that is rebuilt from
  the equipped item IDs and never serialized — searched for directly in 24
  armored characters, zero hits.
- Side finding: base HP / FP / Stamina follow the **effective** stat (rings
  included), not the levelled one. The editor used the levelled one — fixed.

## Where the values sit

`PlayerGameData` is serialized linearly up to about `+0x140`, so a memory offset
`X` lands at `pattern + X − 0x150` (Vigor `+0x44` ↔ `−0x10C`, already in
`RELATIVE_OFFSETS`). The memory names are from `DS3_TGA_v3.4.0.CT`.

| save (from pattern) | memory | CT name | game type |
|---|---|---|---|
| `−0x70` | `+0xE0` | Poison Resist | 0 |
| `−0x6C` | `+0xE4` | Blood Resist | 2 |
| `−0x68` | `+0xE8` | Desease Resist (toxic) | 1 |
| `−0x64` | `+0xEC` | Curse Resist | 3 |
| `−0x60` | `+0xF0` | Frost Resist | 4 |

Toxic and bleed are swapped relative to the game's internal type order — the
writer (`FUN_1408c0fd0`) calls the getter with types `0, 2, 1, 3, 4`.

The equipment the formula needs is past the pattern, also at fixed distances
(the pattern is the first of eleven `FF FF FF FF 00×12` records between the stat
block and the equipment block):

| from pattern | content |
|---|---|
| `+0xB0` | 22 × u32 inventory indices of the equipped items |
| `+0x108` | arm style |
| `+0x10C` / `+0x110` | active left / right weapon slot (0..2) |
| `+0x124` | 6 × u32 weapon IDs: L1 R1 L2 R2 L3 R3 |
| `+0x154` | 4 × u32 armor IDs: head, chest, hands, legs |
| `+0x168` | 4 × u32 ring IDs (`0xFFFFFFFF` = empty) |
| `+0x178` | covenant item ID |

Unlike the bonfire block, gestures and face block, these do not drift: they are
before the variable-length inventory. Checked on 41 distinct characters from 4
Steam profiles (`%APPDATA%\DarkSoulsIII\*\` live saves, `.bak_*` copies and
watcher checkpoints, de-duplicated by stat block + equipment block).

## What the game does with them

All addresses are `DarkSoulsIII.exe` 1.15.x, image base `0x140000000`.

**Resist module** (`ChrIns +0x1F90 → +0x20`): `+0x10..+0x20` current gauge × 5,
`+0x24..+0x34` maximum × 5.

- `FUN_1409e71f0` — init: `max = owner->getMax(type)`, `current = max`.
- `FUN_1409e74c0` — per-frame recovery: `current += recovered`, clamped to `0..max`.
- `FUN_1409e75b0` — the maximum moved (level-up, ring swap):
  `current == oldMax ? newMax : clamp(current − oldMax + newMax, 0, newMax)`.
- `FUN_14088ace0` → `FUN_1409e7010` — getter, returns `module[+0x10 + type*4]`,
  i.e. the **current** value.
- `FUN_1408c0fd0` — status snapshot into PlayerGameData; writes the getter's
  result to `+0xE0..+0xF0`. The same function fills the runtime-only block at
  `+0x830..+0x918` (defense, poise, equip load…), none of which reaches the file.

**Maximum** — `FUN_1406384a0(type, playerGameData, armorIds, slotMults, spEffects)`:

```
max[type] = rate × base[type] + armor[type] + add[type]          (floor of 1)

base[type] = trunc( graph(120+type, stat[type]) + graph(110+type, Σ all nine stats) )
             stat: poison VIT, toxic VIT, bleed END, curse LCK, frost VIG

armor[type] = Σ over 4 armor slots of EquipParamProtector u16
              +0xC0 poison, +0xC2 toxic, +0xC4 bleed, +0xC6 curse, +0x12C frost
add[type]   = Σ over active SpEffects of SpEffectParam i32 +0x204 + type*4
rate        = Π over active SpEffects of SpEffectParam f32 +0x108 + type*4 (frost +0x2BC)
```

- `FUN_140636b20` computes `base`; `FUN_1406366e0` builds the stat sum as a
  weighted sum whose nine weights (`.data 0x14456D018…`) are all `1.0`.
- The stats are the **effective** ones at PlayerGameData `+0x200..+0x220`:
  levelled value + SpEffect stat bonuses (`SpEffectParam` s8 `+0x308..+0x310`,
  summed by `FUN_1409fc070`), clamped to 99 (`FUN_140750010`). Not saved.
- `graph(id, x)` is `CalcCorrectGraph` (`FUN_1406425e0`): clamp `x` to the last
  stage, pick the first stage with `x ≤ stage[i+1]`, interpolate with
  `pow(ratio, adj)` (mirrored form for a negative `adj`), clamp to the segment.
  Rows 110..114 are identical — stages `1/150/190/240/891` → `90/120/160/175/200`;
  rows 120..124 too — `0/30/40/60/99` → `0/0/30/40/50`; every `adj` is 1.
- `FUN_140638110` sums the armor; the per-piece reinforce rate it multiplies by
  is looked up with ID −1 and is always `1.0` (DS3 armor is not upgradable).
- `rate` is `1.0` for everything a player can equip. The only rows with another
  value are 7010..7520 (NG+ / phantom scaling), plus a PvP multiplier that needs
  SpEffect 9600. Neither is active in a save at rest.

What feeds `add` and the stat bonus, straight from the regulation:

| item | effect |
|---|---|
| Poisonbite Ring 20110 / +1 20111 | poison +90 / +140 |
| Bloodbite Ring 20100 / +1 20101 | bleed +90 / +140 |
| Cursebite Ring 20120 | curse +150 |
| Fleshbite Ring 20130 / +1 20131 | poison, bleed, curse, frost +40 / +60 (not toxic) |
| ring 21000 | frost +140 |
| weapon 22090000 (resident SpEffect 130220900) | poison, bleed, curse, frost +50 while held |
| Prisoner's Chain 20550 | VIG, END, VIT +5 |
| Knight's 20460 / Hunter's 20470 / Scholar 20150 / Priestess 20160 | STR / DEX / INT / FTH +5 |
| Carthus Milkring 20450 | DEX +3 |

A weapon's resident effect counts only for the weapon in the active slot of
each hand (the one SL802 sample has it in L3 with left slot = 2).

## Validation

`C:\gh\ds3\model.py` implements the formula from the regulation and compares it
with the stored values of every distinct character:

- **36 of 41 exact on all five values.** These include naked level-1..10
  characters, starting classes in their starting armor, mixed armor sets, three
  characters wearing Prisoner's Chain, one with Carthus Milkring, an all-99
  SL802 character holding weapon 22090000, and the game-made slots of the
  `tools/ds3-stat-sweeper` runs (one stat at 99, the rest at 11).
- **5 of 41 below the model, never above** — and each is explained by the gauge
  semantics, not by the formula:
  - two sweeper slots loaded right after a stat was raised from 11 to 99: frost
    198 and curse 175 against a maximum of 207, starting from the 157 the slot
    held before — a gauge caught mid-recovery;
  - `bak_beforerepro2` slots 4 and 5: all five gauges 15..70 below maximum;
  - `checkpoint_initial`: written before the ring bonus was applied; the next
    checkpoint of the same character is exact.

The TypeScript port was then checked against the Python reference: 41/41 on the
maxima, 41/41 on "gauges equal the new maxima after a three-stat edit", and 77,715
`(governing stat, stat sum)` combinations against a float32 reference with zero
mismatches (the game truncates a float32, so the port rounds every intermediate
with `Math.fround`).

Base HP / Stamina: on all 7 captures where a ring changes VIG or END, the stored
base value equals the table entry for the effective stat and never the one for
the levelled stat (e.g. 33 VIG + Prisoner's Chain → 1186, the 38 VIG value).

## Refill rates, and how to read a save taken right after a stat change

When a maximum rises under the gauge, the gauge does not jump: it refills at a
fixed number of points per second, per type. `FUN_1409e7930(type)` reads the
rate from `TentativePlayerParam.stayparam`, floats at `+0x70..+0x80`:

| poison | toxic | bleed | curse | frost |
|---|---|---|---|---|
| 4.0 | 4.0 | 7.0 | 3.0 | 5.0 |

(a second set at `+0x84..+0x94`, all 5.0, is used in two special character
states.) `FUN_1409e74c0` adds `rate x dt` each frame and clamps to `0..max`.

This matters for any measurement of the form "poke a stat in memory, force a
save, read the gauges": **the save shows the gauge mid-refill, not the new
maximum.** A capture made that way on 2026-11-15 is the clearest example:

- character: VIG 36, ATN 12, END 16, VIT 10, STR 12, DEX 36, INT 10, FTH 8,
  LCK 9; bare skin (armor `900000..903000`, all resist fields zero in the
  regulation); rings 20700, 20010, 20450 (Carthus Milkring, DEX +3), 20540
- before: gauges `122, 122, 122, 122, 140` — equal to the computed maxima
- STR written 12 -> 70 in process memory, save forced immediately
- saved gauges (save order): `144, 160, 144, 138, 166`
- computed new maxima: `166, 166, 166, 166, 184`

| | poison | bleed | toxic | curse | frost |
|---|---|---|---|---|---|
| gained since the edit | 22 | 38 | 22 | 16 | 26 |
| refill rate, points/s | 4 | 7 | 4 | 3 | 5 |
| implied elapsed time, s | 5.5 | 5.4 | 5.5 | 5.3 | 5.2 |

Five gauges, five different gains, one elapsed time: the save was written about
5.4 seconds into the refill. Left alone, the gauges reach the computed maxima
after roughly 11 s (poison, toxic), 6.3 s (bleed), 14.7 s (curse) and 8.8 s
(frost). So a correct live check of the formula waits at least 15 seconds after
the memory write before forcing the save — or reads the maxima directly from
the resist module (`+0x24..+0x34`) instead of the gauges.

The same reading explains the two sweeper slots listed under "Validation":
frost +41 at 5/s is 8.2 s, curse +18 at 3/s is 6 s.

This is also the first live-game evidence for the gauge interpretation: the
rates were read out of the executable and the param file before being compared
with the capture.

## Defense, absorption, poise, equip load

These are what the Equip / Status screens show next to the armor: the eight
absorption percentages, the defense values, poise, weight ratio. The question
was whether any of them is cached in the `.sl2`. **They are not.**

Where they live. `FUN_1408c0fd0` (the same snapshot function that writes the
gauges) and `FUN_1408c4038` fill a block at PlayerGameData `+0x830..+0x918`
from the live character:

| memory | content | source |
|---|---|---|
| `+0x830, +0x84C, +0x864..+0x878` | defense values (int) | `ChrIns` vtable `+0x210` |
| `+0x87C..+0x898` | 8 absorption multipliers (float) | `FUN_140637e40` x SpEffects |
| `+0x89C..+0x8AC` | status gauges again, zeroed while immune | `FUN_14088ace0` |
| `+0x8B0..+0x8BC` | armor-only status resist: poison, bleed, curse, frost (int) | `FUN_140638110` |
| `+0x8C0..+0x8E4` | buildup timers | SpEffect module |
| `+0x900` | poise | `ChrIns` vtable `+0x290` |
| `+0x904, +0x910, +0x914, +0x918` | weight class, load ratio, load %, ... | `FUN_140634470`, `FUN_140634710` |

The absorption multiplier is a product over the four armor pieces of
`EquipParamProtector` floats at `+0xE4, +0xE8, +0xEC, +0xE0, +0xF0, +0xF4, +0xF8,
+0x118`; the menu path (`FUN_140750ec0`) recomputes the same numbers from the
item IDs every time the screen is drawn.

Why they are taken to be absent from the save — three independent checks:

1. **Layout.** The serialized stat block is a straight copy of PlayerGameData
   only up to about `+0x140`; right after it come the eleven `FF FF FF FF` records
   and the equipment block. The other piece of PlayerGameData that is saved, the
   face block (`+0x6B8..+0x788`), is followed in the slot by 21 bytes of `0x7F`
   and then item records — not by anything resembling `+0x830`.
2. **Direct search for the armor-resist sums.** `+0x8B0..+0x8BC` are four
   integers that can be computed exactly from the armor IDs (Knight set:
   88, 107, 56, 89). They sit in the middle of the runtime block, so if the
   block were written anywhere they would appear as 16 consecutive bytes. Searched
   the whole decrypted slot of all 24 armored characters, as int32 and as float32,
   in both orders the game uses: **0 hits in 24.** Control: the same search finds
   the five gauges at `pattern - 0x70` in 24 of 24.
3. **Direct search for the absorption values.** The eight multipliers and the
   eight percentages were computed for each of the 24 characters and searched as
   float32 at every byte offset of the slot (tolerance 2e-5). 39 isolated
   coincidences turned up — against 52 for the same number of random values in
   the same range, i.e. chance level — and **not one place where three of a
   character's values sit within 64 bytes of each other.**

(`C:\gh\ds3\search_def.py`, `search_def2.py`, `after_face.py`.)

What this does not cover: the defense integers and poise were not searched for
by value (their formulas were not derived); they are covered only by the layout
argument and by sharing a block with the values that were searched. The slot
serializer itself was not decompiled.

So these numbers cannot be stale in an edited save: there is nothing on disk to
be stale. What a player sees on the Equip screen after an edit is recomputed
from the stats and item IDs that are in the save.

What equipment-related data *does* persist, and is therefore the place to look
if an edit ever leaves the slot inconsistent:

- the equipped-item block itself: 22 inventory indices at `pattern + 0xB0` and
  the matching item IDs at `+0x124..+0x178`. An index and its ID describe the
  same item twice; an inventory edit that removes or changes an equipped item
  has to keep both in step. (Not audited here.)
- the inventory / GA-item table (item IDs, upgrade levels, quantities).
- the hidden current/maximum copies of HP, FP and stamina (`+0x18, +0x1C, +0x24,
  +0x28, +0x34, +0x38`), which the editor does not rewrite — see below.
- level versus the sum of the nine stats, and soul memory versus level — both
  already maintained by the editor.

None of these was examined for server-side checks; the executable shows what is
stored, not what the servers do with it.

## Rings: what each kind of effect touches

Ring names below come from `public/json/ds3_items.json`; the effects were read
from the regulation, by dumping every field of each ring's SpEffect rows that
differs from the value most rings share (`C:\gh\ds3\rings.py`, full list in
`C:\gh\ds3\rings.txt` — 124 accessory rows).

A ring can act through four separate mechanisms, and only the first three reach
anything stored in the save:

| mechanism | SpEffectParam field | rings | lands in |
|---|---|---|---|
| stat bonus | s8 `+0x308..+0x310` | Prisoner's Chain, Knight's, Hunter's, Scholar, Priestess, Carthus Milkring | effective stat -> base HP/FP/stamina, resist maxima |
| flat status resist | i32 `+0x204..+0x214` | Poisonbite, Bloodbite, Cursebite, Fleshbite, 21000 | resist maxima |
| max HP / FP / stamina multiplier | f32 `+0x10 / +0x14 / +0x18` | Life Ring (+0..+3), Ring of Favor (+0..+3), Dusk Crown Ring | stored maximum of that vital |
| everything else | attack rates, absorption, regen, estus, equip load `+0xE4`, ... | all other rings | runtime only |

The four rings of the character used for the live checks:

| ID | name | non-default SpEffect fields | effect on saved values |
|---|---|---|---|
| 20700 | Estus Ring | `+0x2EC = 1.2` (HP restored by Estus) | none |
| 20010 | Chloranthy Ring | `+0xB8 = 7` (stamina recovery) | none |
| 20450 | Carthus Milkring | `+0x30C` DEX +3 | stat sum +3 |
| 20540 | Flynn's Ring | `+0x48, +0x228..+0x234 = 1.15` (attack, load-dependent) | none |

So "only 20450 contributes" was right, and the reason is that the other three
work through mechanisms that never touch a stored number. (20540 is Flynn's
Ring, not Ring of Favor; Ring of Favor is 20030..20033.)

## HP, FP and stamina: current, maximum, base

Each vital is three u32 in the stat block:

| | current | maximum | base |
|---|---|---|---|
| HP | `-0x138` | `-0x134` | `-0x130` |
| FP | `-0x12C` | `-0x128` | `-0x124` |
| stamina | `-0x11C` | `-0x118` | `-0x114` |

```
base    = table[effective stat]                 (VIGOR_TO_HP etc.; stat rings count)
maximum = trunc(base x ring multipliers x 1.3 if embered)        (ember: HP only)
```

- Ring multipliers are the third row of the table above: Life Ring 1.07 / 1.08 /
  1.09 / 1.10 HP; Ring of Favor 1.03 / 1.045 / 1.05 / 1.06 HP and 1.09 / 1.10 /
  1.11 / 1.12 stamina; Dusk Crown Ring 0.85 HP. No ring changes max FP. No
  weapon or armor resident effect carries such a multiplier (every row scanned).
- Ember is the byte at PlayerGameData `+0x100` (`pattern - 0x50`); the effect is
  SpEffect 490, `maxHpRate = 1.3`.
- **41 of 41 characters reproduce all three stored maxima exactly** — 24 of them
  embered, 6 captures (3 characters) wearing Ring of Favor+3, both together in
  all 6 (`C:\gh\ds3\hpcheck.py`).

The editor used to write only the base and leave current / maximum to the game.
That worked — the July sweeper experiment showed the game rewriting the maximum
on load (555 -> 1819 for VIG 99, embered) — but the slot was inconsistent until
then, and for a ring wearer the gap was larger than the stat table suggests. Now
the maximum is written together with the base, a bar that was full stays full,
and a current value above the new maximum is capped. Re-writing the existing
base of each of the 41 characters leaves the slot byte-identical, i.e. the write
path reproduces what the game had stored.

Not covered: the multiplication order of ring rate and ember rate in the game
was not traced (float32 rounding could differ by 1 at a boundary; it did not on
the 6 captures that have both), and a buff active at save time is not modelled.

## Temporary buffs: do they survive a save and reload?

The question matters because the resist maxima and vital maxima above ignore
buffs. The buffs that add status resist are four SpEffects:

| SpEffect | effect | duration |
|---|---|---|
| 3600 | +15 all five | permanent while applied |
| 3610 | +45 all five | permanent while applied |
| 3820 | +80 all five | 120 s |
| 3901 | +150 frost | 60 s |

What was established:

- **The active-effect list is not stored as IDs.** Every ring effect is active
  for as long as the ring is on, so if active SpEffects were serialized their
  IDs would be in the slot. Searched all 11 ring-wearing captures for the int32
  ID of each of their ring SpEffects (40+ IDs): 0 hits, while the ring item IDs
  themselves are found in 11 of 11.
- **The game has a selective export of active effects** (function around
  `0x140A019F3`): it walks the list and keeps only effects whose
  `SpEffectParam` byte `+0x15D` is in `0..9`, recording that byte and the u16 at
  `+0x300`. In the regulation 24 of 3450 rows qualify — none of them has a
  resist bonus, a vital multiplier or a stat bonus. All four buffs above have
  `-1` there, as do the ember effect and every ring effect.
- **No capture contradicts it**: none of the 41 characters has a gauge above
  the computed maximum or a vital maximum off the formula.

What was not established: where that export is consumed (it was not traced into
the save writer), and nothing was tested live. The decisive check is to drink
Siegbrau, quit to the menu within the minute, and reload: frost resistance
either is or is not still raised.

What it means for the editor either way: a save written *while* a buff is
running holds a gauge up to the buffed maximum — that is a legitimate case of a
stored gauge above this file's computed maximum, and the game caps it on the
first frame without the buff. The editor itself only ever writes the unbuffed
maximum, which is at or below the real one in every case.

## Armor durability

A worn piece of armor counts for less. `FUN_140633b20(durability, maxDurability)`
returns the weight of one piece, and it is a three-step staircase, not a curve:

```
max <= 0                      -> 1.0
ratio = durability / max
ratio  > 0.3                  -> 1.0
0 < ratio <= 0.3              -> 0.7     ("at risk")
ratio <= 0                    -> 0.5     (broken)
```

Read off the instructions, not sampled: `comiss max,0 / jbe` (non-positive max
skips everything), `divss`, `comiss ratio,[0x14456CE70] / ja` (strictly above the
threshold is normal, so exactly 30% already counts as at risk), `comiss ratio,0 /
setbe` (zero or below is broken). The four constants sit together at
`0x14456CE70`: `0.3, 1.0, 0.7, 0.5`. There is no step between 30% and 0%.

The weight multiplies each piece's value inside the armor sum
(`FUN_14062fbd0`: `u16 x reinforce rate x weight`; the reinforce rate is 1.0 for
every `ReinforceParamProtector` row, field `+0x34`), the four pieces are added
as floats, and the total is truncated once. The same weight goes into the
absorption product (`FUN_140637e40`).

**Durability is a per-item value and it is in the save.** Three hops from the
equip block:

```
pattern + 0xB0 + slot*4     i32   equip index = inventory index + 128     (slots 12..15 = armor)
inventory + (index-128)*16        record { u32 handle, u32 item id | category, u32 quantity, ... }
GA item table (0x70)              60-byte entry { u32 handle, u32 item id, u32 durability, ... }
```

The maximum is `EquipParamProtector` u16 `+0xAC` (`FUN_1406bda90`; weapons use
`EquipParamWeapon +0xBE`).

Evidence:

- **Chain.** 76 of the 94 real armor pieces equipped across the 41 reference
  characters resolve to a GA entry carrying the same item ID. The other 18 are
  in three slots of the `bak_beforehdrfix` save, where the inventory record under
  the index belongs to a different item (helm index pointing at the chest
  piece) — saves from the inventory-header experiments. The code treats a
  mismatch as "unknown" and keeps the piece at 1.0.
- **Maximum.** The stored durabilities sit at or just under the table value:
  249/250, 359/360, 369/370, the rest exactly full; none above.
- **The 0.7 step, live.** Writing a low-ID armor row (maximum durability 999)
  into a slot whose real item has a few hundred points left puts the ratio under
  0.3. Four such probes, 20 values, all exact with `trunc(base + sum(value x
  0.7f))`: e.g. row `[16, 16, 23, 20, 0]` on a bare `232 / 280 / 232 / 232` gave
  `243 / 296 / 243 / 246`.
- **No reference character is affected**: the lowest ratio in the set is 0.996.
  So the 0.5 step and the exact `<= 0.3` boundary rest on the code alone.

The editor now applies the weight (`armorDurabilityScales()` in `Character.ts`).
On the 41 characters nothing changes — 41 of 41 maxima as before. The
implementation was exercised by patching the stored durability of each resolved
piece to five values (30%, 0, 30% + 1, 1, full) and comparing with the rule: 380
of 380. That is a check of the code against the rule, not of the rule against
the game.

Absorption and the other Equip-screen numbers scale the same way but are not in
the save, so nothing follows for them.

## Live sweep (tools/ds3-equip-sweeper)

A driver for the running game: `live.py` (memory access, the game's equip
routine), `model.py` (the editor's formulas, reading
`public/json/ds3_resist_data.json` and the tables in `constants.ts`), `sweep.py`
(the sweep). Base pointers come from the AOBs of `DS3_TGA_v3.4.0.CT`.

What a plain memory write does on 1.15.2:

| write | effect |
|---|---|
| a stat | effective stats, base and maximum vitals, resist maxima follow at once |
| an armor item ID | resist maxima follow at once (the piece is weighed with the *real* item's durability) |
| a ring item ID | nothing — the ring's SpEffect is attached only by the equip routine |
| the ember byte | nothing — same reason |

Rings are therefore changed through the game's equip function, located by the
CT's AOB (`?? 8b f1 ?? 8b d8 ?? 63 ea ?? 8b f9`, minus `0x2B`; `0x140584FF0` in
1.15.2) and called on a remote thread as the CT's `EquipItem` does. It only
accepts items the character owns.

**Do not use the CT's "Activate SpEffects" scripts on this build.** They call a
hard-coded `DarkSoulsIII.exe+9F3C30`, which in the 1.15.2 executable is 0x20
bytes into an unrelated function with a different signature. Live and on-disk
code are identical there, so it is the table that is off. This is also why
ember could not be toggled from the tool.

One run was made (2026-11-16). Its per-record file was lost to a crash — a
Russian progress string from `input_save.py` on a cp1252 stdout — so what
follows comes from the log, which printed mismatches only:

| phase | steps | mismatches |
|---|---|---|
| single-stat sweeps: VIG, ATN, END, VIT, LCK, STR, each 1..99 | 594 | 0 — effective stats, level, base and maximum HP / FP / stamina (embered), five resist maxima |
| armor table, one set per step | about 150 | 15 sets, all low-ID rows (60xxxx..93xxxx): the durability artifact above. No player armor mismatched |
| mixed: random stats x random armor x owned-ring sets | 40 | 8, all small overestimates of resist maxima. The armor pool included the low-ID rows; armor IDs were not logged, so the cause is presumed, not shown |
| forced saves | 0 | none completed |

Also seen live along the way: the gauges refilling at exactly 4 / 7 / 4 / 3 / 5
points per second after an armor swap, Bloodbite Ring raising the bleed maximum
by exactly 90 through the equip routine, and the effective-stat block at
`PlayerGameData +0x200` showing DEX 39 for 36 + Carthus Milkring.

Not exercised: Life Ring, Ring of Favor, Dusk Crown Ring and Prisoner's Chain
(not owned), ember off, hollowing.

The crash left the character in a sweep state that the game autosaved; it was
put back through the equip routine and the game's own next save matches the
pre-sweep backup. `sweep.py` now forces UTF-8 output, writes each record to
`records.jsonl` as it goes, draws armor only from player rows, and makes forced
saves (`--saves N`) and the final save (`--persist`) opt-in. It has not been run
again since.

## Smaller questions settled

**Weapon SpEffect fields.** `EquipParamWeapon` references SpEffects from
`+0x40 / +0x44 / +0x48` (on hit), `+0x4C / +0x50 / +0x54` (resident) and `+0xAC`.
Across all 2515 rows two effects touch a stored value: Wolf Knight's Greatshield
(22090000, `+0x50`, SpEffect 130220900: poison, bleed, curse, frost +50 — the
upgraded shield uses the same row) and the Hollow infusion (141 rows, `+0x54`,
SpEffect `129001500 + level`: LCK +2..+5, behind a condition flag). The
generator walks all three resident fields; the output is unchanged.

**Stamina / HP regeneration rate.** Not found in the fixed-layout block. The 41
captures were grouped by Chloranthy Ring level (none 30, +0 one, +3 ten) and
every byte offset in `pattern - 0x150 .. + 0x180` was tested as u32, float, u16
and u8 for a value constant inside each group and different between groups: no
offset qualifies. The variable-layout rest of the slot was not searched.

**Prisoner's Chain is +5 VIG, +5 END, +5 VIT.** The regulation says so
(`SpEffectParam +0x308`: `05 00 05 05`) and game-written saves of three wearers
agree: the stat-sum term of their resist maxima only works with VIT +5 (one
needs a sum of 141..145; +5/+5/+5 gives 144, +5/+5/-5 gives 134 and a maximum two
points lower than stored). The ring's cost is the `1.04` on its damage-taken
fields. Not checked live — the test character does not own it.

**A note on offsets in the research scripts.** `C:\gh\ds3\ds3save.py` keeps the
16-byte IV block in front of each decrypted slot, so absolute offsets printed by
those scripts are 16 higher than the editor's. Everything in this file is
pattern-relative or in editor coordinates.

## What the editor does now

`src/apps/ds3/lib/Character.ts`:

- `computeMaxResistances()` — the gauge formula above, from the slot's own
  stats and equipment IDs.
- `resetResistances()` — writes `current = max` for all five gauges (no
  buildup). `setStat()` calls it after every stat write and `updateDerivedStats()`
  calls it too. Every stat matters, not just the four governing ones, because of
  the stat-sum term. A first version mirrored `FUN_1409e75b0` and preserved
  partial buildup across the edit; that was dropped for the plain refill — the
  buildup drains by itself in play, and the simpler rule has no edge cases.
  "Full" has no sentinel value, it is the maximum itself, so the formula is
  still needed.
- `armorDurabilityScales()` — the weight of each equipped piece from its stored
  durability; feeds `computeMaxResistances()`.
- `getResistances()` — the five stored values, save order.
- `getEffectiveStat()` — levelled stat + ring bonus, capped at 99; base HP / FP /
  Stamina now use it.
- `computeVitalMax()` and the `hp` / `fp` / `stamina` setters — writing a base
  value now also writes the stored maximum (ring multipliers, ember) and keeps
  the current value consistent with it.

`src/apps/ds3/lib/resistData.ts` is generated by `C:\gh\ds3\gen_ts.py` from the
decrypted regulation: the ten graph rows, 484 armor rows with their maximum
durability, ring resist / stat / vital tables, the one weapon effect. The same run writes the same tables to
**`public/json/ds3_resist_data.json`** for other tools; both files come from one
dict built in one pass, so they cannot drift apart. `Character.ts` imports the
TypeScript file and does not fetch the JSON. The generator walks every row
(593 armor, 133 accessory, 2515 weapon) and omits only rows that contribute
nothing. Regenerate both if the regulation ever changes.

`useDS3SaveEditor.ts`: the five gauges were added to `statsFingerprint()`, so any
change to them trips the existing offline guard like a stat change does.

### Deliberately not done

- **The offline guard and `BanWarningModal` are unchanged.** A stat edit still
  switches the save offline and still asks for one offline load. The gauges were
  never the reason for that advice — they are legitimate at any value up to the
  maximum, and the game re-derives the maximum on load regardless. Whether the
  servers look at anything in this block is not something the executable can
  tell us; removing the guard would be a guess.
- **Two inputs the save does not record are left out of the maximum**, and both
  can only make the real value higher than the computed one: a buff active at
  save time (SpEffects 3600 / 3610 / 3820 add +15 / +45 / +80 to all five), and
  the luck a Hollow-infused weapon grants at 15+ hollowing (SpEffect
  `129001500 + upgrade level`, +2..+5 LCK). An underestimate leaves the gauge a
  few points short of full, which is an ordinary state; an overestimate would
  not be, so nothing is guessed upward.

## Confidence

| finding | basis |
|---|---|
| offsets of the five gauges and the equipment IDs | static RE + 41 characters |
| formula for the maximum | static RE + 36/36 exact matches |
| "current gauge, not a cached maximum" | static RE of the module + the below-maximum captures + one live poke-and-save capture whose five gains match the five refill rates at a single elapsed time |
| formula for the maximum, checked live | **confirmed 2026-11-16**: same character, STR 12→70 again, 20 s settle delay before forcing the save (long enough for curse, the slowest at 3 pts/s) — saved gauges `166, 166, 166, 166, 184`, exactly `computeMaxResistances()`'s prediction. See `tests/ds3/resistLive.test.ts`. |
| gauge is read back from the save on load | inferred from the two mid-recovery captures only |
| inactive-slot weapons do not count | one sample |
| durability staircase (0.3 / 0.7 / 0.5) | disassembly + constants; the 0.7 step also live (4 probes); the 0.5 step and the boundary from code only |
| durability is stored per item and reachable from the equip block | 76 / 94 pieces resolve with matching item IDs; the rest are in known-inconsistent experimental saves |
| base / maximum vitals and resist maxima across all stat values | live sweep, 594 steps, 0 mismatches (log only; record file lost) |
| Prisoner's Chain VIT +5 | regulation + three wearers' saves; not live |
| no regeneration rate in the fixed block | group-consistency search, 41 captures; rest of the slot not searched |
| formula for the maximum, live | confirmed by the coordinator's 20 s settle capture and a live armor swap (`tests/ds3/resistLive.test.ts`) |
| rings 20700 / 20010 / 20540 have no effect on saved values | names from the item database + full SpEffect row dump |
| HP / FP / stamina maximum = base x ring rates x ember | 41 / 41 captures; multiplication order not traced; no live check with Life Ring or Dusk Crown Ring |
| resist / vital buffs are not restored from a save | ID search (0 / 11) + the save-category export excludes them; consumer of the export not traced, **not tested live** |
| absorption multipliers and armor resist sums are not in the save | layout + direct search over 24 armored characters with a positive control |
| defense integers, poise, equip load are not in the save | layout only (same runtime block); not searched by value; serializer not decompiled |

A live check that would close the third row (gauge read back from the save on
load, not just written to it): take poison buildup, quit, read
`pattern − 0x70`, reload and watch the bar.

## Reproducing

Ghidra was used without the full auto-analysis — the image is imported once
with `-noanalysis` and functions are disassembled and decompiled on demand,
about 12 s per batch:

- project `C:\gh\project_ds3` (name `DS3`), input `C:\gh\DarkSoulsIII.exe`
- `C:\gh\ds3\dec.sh <name> <hex addr>...` → `C:\gh\logs\ds3\<name>.c`
  (script `C:\gh\ds3\gscripts\D3Dec.java`)
- `C:\gh\ds3\d3fn.py`, `flow.py`, `xref.py`, `find_pat.py` — capstone helpers:
  function bounds from `.pdata`, jump-following disassembly, rel32 / pointer
  xrefs, byte-pattern search grouped by function
- `C:\gh\ds3\regulation.py` — decrypts `Data0.bdt` (AES-256-CBC, DCX, BND4) and
  splits a 64-bit PARAM into rows
- `C:\gh\ds3\ds3save.py`, `resid.py`, `model.py` — save decryption, residuals,
  the reference model and its 41-character check

The executable carries SteamStub (`.bind`) but `.text` is stored in the clear.
Some functions are split by obfuscation thunks, which is why `flow.py` follows
unconditional jumps instead of trusting `.pdata` ranges.
