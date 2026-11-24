# DS1R Boss Flags — Consolidated Reference

Collected from the multi-session RE project documented in Claude's memory
(`project_ds1_emevd_parsing.md`, sessions N+16 through N+30). All offsets are
**`pattern1`-relative** byte offsets into a decrypted save slot (same
`pattern1` as `findPattern1()`/`find_pattern1()` already used elsewhere in
this codebase). `reverse: true` means the bit reads as "1 = not yet
triggered" in the existing `npc_data.json` convention (flip before use)
unless noted otherwise.

Status legend:
- **CONFIRMED (code)** — traced to the exact EMEVD/ESD instruction that writes it, decode re-derived from first principles, no guessing.
- **CONFIRMED (in-game)** — the above, PLUS directly observed flipping in a live save via `watch_live_save.py` at the exact moment of the triggering action.
- **CANDIDATE** — code-confirmed decode, but not yet observed in-game. Treat as "should be right" but verify once before trusting in a shipped tool.
- **SUSPECT FALSE POSITIVE** — currently shipped in `npc_data.json`, but this project found no code-level support for it at all. Likely a stale/incorrect artifact from the original 2-run manual derivation method.
- **OPEN** — real, relevant, but the writing mechanism was not found despite real effort. Noted so nobody re-chases the same dead ends.

## The underlying flag-storage formula (for context)

`buffer_start = pattern1 + 0x53`. A flag ID's digits decode as:
`region = flag // 10_000_000 % 10`, `area = flag // 100_000 % 100`,
`group = flag // 10_000 % 10`, `zone = flag // 1_000 % 10`,
`local = flag % 1_000`, `word = local // 32`, `bit_idx = 31 - (local % 32)`,
`byte_in_word = bit_idx // 8`, `bit_in_byte = bit_idx % 8`.

- **region 0** (flag < 10,000,000): single flat global buffer, offset = `zone*128 + word*4 + byte_in_word` from `buffer_start`. No subbank lookup needed — this is why flags like `120`, `121`, `743`, `1242`, `4047` decode unambiguously.
- **region 1** (flag ≥ 10,000,000, first digit 1): needs a per-`(area, group)` subbank index `k`. Offset = `1280 + k*1280 + zone*128 + word*4 + byte_in_word`. Known validated `k` values so far:

| area | group | k |
|---|---|---|
| 10 | 1 | 2 |
| 12 | 0 | 5 |
| 12 | 1 | 6 |
| 14 | 1 | 11 |
| 15 | 1 | **13** (new, Session N+29) |
| 18 | 0 | 16 |

## Boss roster byte (`0x55`/`0x56`) — 13 bosses, one shared "roster" mechanic

All 13 share one event template: `KillBoss(game_area_param_id)` followed by
`SetFlagState(N, 1)` where `N` is a small sequential integer (2–15). All
13/13 CODE-CONFIRMED, exact matches to already-shipped values.

| Boss | Offset | Bit |
|---|---|---|
| Gwyn, Lord of Cinder | `0x55` | 0 |
| Seath the Scaleless | `0x55` | 1 |
| Four Kings | `0x55` | 2 |
| Ornstein & Smough | `0x55` | 3 |
| Iron Golem | `0x55` | 4 |
| Bed of Chaos | `0x55` | 5 |
| Chaos Witch Quelaag | `0x55` | 6 |
| Gravelord Nito | `0x56` | 0 |
| Pinwheel | `0x56` | 1 |
| Great Grey Wolf Sif | `0x56` | 2 |
| Crossbreed Priscilla | `0x56` | 3 |
| Bell Gargoyles | `0x56` | 4 |
| Gaping Dragon | `0x56` | 5 |

**Note:** `0x54 bit6` (Manus, see below) is the same roster byte-family, just
on a third byte. The real `npc_data.json` file has Manus/Bed of Chaos
correct; a STALE snapshot once seen (`Downloads\npc_data.json`) had these
two swapped — if that file is ever consulted again, don't trust it.

## Individual bosses outside the roster template

| Boss | Offset(s) | Bit | Status | Mechanism |
|---|---|---|---|---|
| Manus, Father of the Abyss | `0x54` | 6 | CONFIRMED (code) | Roster-style (N=17) |
| Manus, Father of the Abyss (2nd field) | `0x2356` | 5 | shipped, not re-traced this project | DLC-area companion field |
| Asylum Demon | `0x54` | 7 | CONFIRMED (code) | Own event, entity `1810800` only (the real/Peculiar-Doll revisit kill, NOT the weaponless prologue encounter) |
| Stray Demon (prologue revisit, entity `1810810`) | — | — | **OPEN** | No persistent flag write found for this entity at all — may simply not be independently tracked, or needs a fresh search; don't assume it shares Asylum Demon's flag |
| Taurus Demon | `0xFC6` | 2 | CONFIRMED (code) | Own event ID `11010901` |
| Capra Demon | `0xFC6` | 1 | CONFIRMED (code) | Own event ID `11010902` |
| Centipede Demon | `0x3CC6` | 2 | CONFIRMED (code) | Own event ID `11410901` |
| Demon Firesage | `0x3C83` | 5 | **CONFIRMED (in-game)** | Own event ID `11410410`. **Shipped value was wrong (`0x3F83`) — confirmed bug, fixed via live watcher test 2026-11-07.** |
| Moonlight Butterfly | `0x1EC6` | 3 | **CONFIRMED (in-game, prior session)** | Own event ID `11200900`, k=5. Shipped value was once wrong (`0x21C6`, a CT transcription error) — already corrected in the real `npc_data.json`. |
| Ceaseless Discharge | `0x3CC6` | 3 | CONFIRMED (code) | Own event ID `11410900` |
| Ceaseless Discharge (companion/world-state bits) | `0x84`b5, `0xCC`b3, `0x3CBA`b6/7, `0x3EF7`b5-7, `0x3EF8`b0/1, `0x17597`b0, plus a large sequential block `0x1772F`–`0x177B8` | — | shipped, not individually traced | Presumed multi-stage lava/world-state tracking tied to his fight — only `0x3CC6 bit3` is the actual "kill" bit |
| Knight Artorias | `0x2356` | 6 | CONFIRMED (code) | Own event `11210001` (`m12_01_00_00`) |
| Black Dragon Kalameet ("Killed") | `0x2356` | 3 | CONFIRMED (code) | Shared defeat-flag event, same map |
| Black Dragon Kalameet (fight-specific kill, undocumented) | `0x2356` | 2 | found, NOT shipped | Narrower "died via player damage" signal — likely redundant with bit3 in normal play, not recommended to add |
| Black Dragon Kalameet ("Enabled") | `0x239C` | 7 | **CANDIDATE** | Set via dialogue with Hawkeye Gough (`m12_01_00_00` talk ID `121672`) — answering **"Yes"** to his prompt about facing the dragon sets this (+ companion flag `71210076`). **Caveat (user, 2026-11-08): you must actually reach Gough's location for this dialogue to even trigger, and it's not 100% certain whether "Enabled" means "activated/huntable" vs "shot down" — needs in-game testing to confirm meaning, not just that the bit flips.** |
| Dark Sun Gwyndolin — combat-form kill | `0xF0` | 5 | CONFIRMED (code) | Flag `1242`, standard Template-A death handler on entity `1510650` |
| Dark Sun Gwyndolin — disguise-form death | `0xB2` | 0 | CONFIRMED (code) | Flag `743`, on entity `1510600` (the talkable decoy) |
| Dark Sun Gwyndolin — shop-unlock ×4 (Domhnall's armor set) | `0x58E7`/`0x58E8`/`0x58E9`/`0x58F2` | 1/3/5/1 | CONFIRMED (code) | `ShopLineupParam.QuantityFlag` for his 4 armor pieces — these are the SAME flags his kill event resets to 0; not generic, this is his real shop-unlock mechanism |
| Dark Sun Gwyndolin — corridor change (infinite loop → normal) | `0x46C6` | 3 | **CANDIDATE** | Flag `11510900` (his kill event's own unconditional "done" marker). k=13 found/validated 2026-11-08, not yet in-game tested |
| Dark Sun Gwyndolin — `0x5F bit6` | `0x5F` | 6 | **SUSPECT FALSE POSITIVE** | No code-level support found for this specific bit anywhere |
| Dark Sun Gwyndolin — `0x5F bit7` (flag `120`) | `0x5F` | 7 | found, NOT currently shipped, complicated | Only gets set if Ornstein & Smough's own kill flag (`12` → `0x55 bit3`) is ALREADY true — i.e. this is gated behind O&S being dead first. A live test with O&S still alive showed this correctly stays 0. Don't recommend shipping without re-testing with O&S dead. |
| Dark Sun Gwyndolin — Darkmoon Knightess aggro / covenant+Darkmoonblade disable | — (no new flag) | — | CONFIRMED (code), no action needed | Her hostility event checks an OR of 3 death flags, one being `1242` (= already-tracked `0xF0 bit5`). Covenant/miracle disable is a side effect of her going hostile, not separately tracked. |

## Lord's Blade Ciaran (newly identified — this is "the NPC that appears after Artorias dies")

Entity ID `6740`, found in Artorias's own map `m12_01_00_00` (NOT a DLC-hub
map as originally assumed).

| Field | Offset | Bit | Status | Mechanism |
|---|---|---|---|---|
| Availability/appeared | `0x13B` | 2 | CONFIRMED (code) | Flag `1861`. Her own watcher event READS Artorias's kill flag directly (event `11210001`), and on success WRITES this separate persisted flag — i.e. it's a read-then-write relay, not a pure "checks his bit live" mechanism. |
| Combat death | `0x142` | 7 | CONFIRMED (code) | Flag `1864`, standard Template-A death handler |
| Other shipped bits | `0xB1`b7, `0x2395`b4, `0x2396`b6, `0x1315B`b6, `0x16D6C`b1 | — | not traced | Likely 2 of these are generic shared "met"/"aggro" bits reused across many NPCs; 3 unexplained |

## Side-findings (not bosses, but discovered along the way)

- **Great Grey Wolf Sif's own entities get set to the `WhitePhantom` team type once Manus is confirmed dead** — a real, previously-undocumented mechanic (found in Session N+27 while chasing a different lead).
- Gwyndolin is actually **two separate map entities**: `1510600` (talkable disguise, `talk_id=151611`) and `1510650` (real combat/serpent form, non-talkable). Every bit above is tagged to whichever one actually owns it.
- Artorias is **not placed in any Oolacile DLC-hub MSB** at all — he's spawned dynamically; his real encounter map is `m12_01_00_00` (deeper Darkroot), not `m18_00`/`m18_01`.

## Known-wrong / historical artifacts (do not reintroduce)

- `Downloads\npc_data.json` is a **stale snapshot** — missing newer NPCs (Big Hat Logan, Crestfallen Warrior, Lord's Blade Ciaran, Undead Female Merchant), missing later bits on several quest NPCs, and has Manus/Bed of Chaos swapped plus Moonlight Butterfly reverted to a known-bad CT value. The real file is `ds1-save-editor/public/json/npc_data.json` in this repo.
- The hand-made Cheat Engine table (`1FRDarkSoulsRemastered.CT`) is a useful lead-generator but has at least 2 confirmed transcription errors (Moonlight Butterfly off by `0x300`, Gwyndolin's "2nd field" removed from `npc_data.json` for the same reason) — never trust its `<Offset>` values without independent code confirmation.
