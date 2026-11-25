# Trusty Patches — Quest Flag Reference

Status legend matches `boss-flags.md`: **CONFIRMED (code)** / **CANDIDATE** /
**SUSPECT FALSE POSITIVE** / **OPEN**.

## Identity / stage graph

Patches is **one character design reused across 3 narrative identities**,
each with its own `NpcParam` row (internal dev names in Japanese) and its
own map placement(s). All three share `ai_id=6320` (confirming they're the
same underlying AI/behavior template), but each has a distinct
`character_id`.

| Identity | `character_id` (NpcParam) | Internal name | Placements (map / `entity_id` / `talk_id`) |
|---|---|---|---|
| 1. "Trickster" (trapped-prisoner disguise) | `6260` | `トリックスター` ("Trickster") | `m10_00_00_00` (Lower Undead Burg) entity `6260` talk `100626`; **also** `m10_02_00_00` (Firelink Shrine) entity `6261` talk `102626` |
| 2. "Graveyard 1" (revealed Patches, Catacombs) | `6320` | `墓地の卑怯者パッチ　墓地1` ("Graveyard's Coward Patches, Graveyard 1") | `m13_00_00_00` (Catacombs) entity `6320` talk `130632` |
| 3. "Graveyard 2 / Base" (revealed Patches, relocated) | `6321` | `墓地の卑怯者パッチ　墓地2〜拠点` ("...Graveyard 2 ~ Base") | `m13_01_00_00` (Tomb of the Giants) entity `6321` talk `131632`; **also** `m10_02_00_00` (Firelink Shrine) entity `6322` talk `102632` |

**Correction to the pre-investigation lore assumption**: his trap is in
**Lower Undead Burg** (`m10_00`), not the Depths. His merchant form can end
up in **either** Tomb of the Giants **or** Firelink Shrine depending on
which placement is enabled — these are alternate map instances of the same
narrative stage, gated by flags, same mechanism as every other
multi-map-placement NPC in this project (only one `EnableCharacter`'d at a
time).

## Confirmed flags

| Meaning | Flag ID (literal, EMEVD) | Offset | Bit | Status | Mechanism |
|---|---|---|---|---|---|
| Firelink-placement (entity `6322`) revealed/dead marker | `1626` | `0x120` | 5 | **CONFIRMED (code)** | Standard Template-A call in `m10_02_00_00` event 50: `RunEvent(0, 11020411, [6322, 1620, 1629, 1626])` |
| Catacombs/Tomb-of-Giants-placement (entity `6320`/`6321`) revealed/dead marker | `1628` | `0x120` | 3 | **CONFIRMED (code)** | Template-B calls in both `m13_00_00_00` (`RunEvent(0,11300531,[6320,1628])`) and `m13_01_00_00` (`RunEvent(0,11310542,[6321,1628])`) — same flag shared by both placements of this identity |
| "Has encountered this disguise" first-contact milestone (shared across Trickster AND Graveyard-1 identities) | `71310063` (Catacombs ESD) / `71320063` (Trickster ESD) | `0x14057` | 0 | **CONFIRMED (code)** | Both land on the exact same bit via a newly-validated region7 subbank (see below) — set from each identity's own Talk ESD |

**New k-table entry found this session**: `(region=7, area=13, group=1) → k=9` and `(region=7, area=13, group=2) → k=9` (same k for both groups — empirically validated, not yet mechanistically explained why groups 1 and 2 share a k; flag for a future session if the underlying reason ever matters). This is the **first validated region7 k** in this project — every prior k-table entry (`boss-flags.md`) was region1 only. Add to the shared formula reference.

## Aggro / hostility — explicit negative result (per coordinator's follow-up request)

**No `SetTeamType` instruction references any of Patches' entity IDs (`6260`/`6261`/`6320`/`6321`/`6322`) anywhere in his 4 maps' EMEVD.** Full instruction-level scan (every instruction in every event, all 4 maps) found only:
- `(2004,45) HumanityRegistration(character, event_flag)` — ties him to the generic humanity-restoration-on-kill mechanic (flags `8430`/`8478`), unrelated to hostility.
- `(2004,29) SetBackreadState(character, remove)` — a render-distance/streaming optimization toggle, not combat-related.
- `(2004,3) MoveToEntity(character, destination_type, destination, dummy_id)` — called 3× for entity `6321` with the same destination — this is almost certainly the scripted "kick the player down the pit" trap mechanism (it moves/repositions the character, consistent with a scripted fall-trigger), not a hostility flip.
- Standard `SetCharacterState`/`HumanityRegistration` map-load setup, nothing else.

**Conclusion: unlike the Darkmoon Knightess (Session N+28) or Sif (Session N+27), Patches' "becomes hostile" behavior is NOT implemented as a scripted `SetTeamType` flip tied to a death/quest flag.** If he turns hostile when attacked prematurely, that is almost certainly generic ESD-level self-defense (`IsAttackedBySomeone()`-gated dialogue/AI branching, same mechanism seen in every other regular NPC's Talk ESD in this project) rather than a persisted, trackable "is hostile" save bit. **Nothing to add to the editor for aggro state** — there likely isn't a save-file bit for it at all.

## Unexplained shipped bits (not traced this session — budget-limited single pass)

`0xB1 bit7`, `0x1495 bit3`, `0x1495 bit4`, `0x149A bit7`, `0x16D8F bit4`, `0x117 bit0`, `0x117 bit3`, `0x117 bit5`, `0xF95 bit1`, `0xF96 bit3`, `0x14F5A bit2`, `0x16D6C bit4`, `0x1493 bit0`, `0x14F58 bit1`, `0x16D6D bit1`.

Note: `0x16D6C`/`0x16D6D`/`0x16D8F` fall in the **same narrow `~0x16D60-0x16E00` byte window** that `project_ds1_npc_alive_dead.md` already flagged as a "genuinely-varying generic bit, one per NPC checked" cluster shared across Andre, Solaire, Oswald, Vamos, Hawkeye Gough, etc. — likely a shared "has met/talked to" or NG+-cycle-related system, not identity-specific. Not re-derived here; same open question as in that file.

`0xB1 bit7` also recurs verbatim on several OTHER NPCs' shipped entries (Oswald, Ciaran, Siegmeyer all have it too, per earlier diffs in this project) — near-certainly another shared/generic bit, not Patches-specific.

The remaining bits (`0x1493`/`0x1495`/`0x149A`/`0xF95`/`0xF96`/`0x14F58`/`0x14F5A`) were checked against the now-validated `k=9` decode and did **not** match any of the ~70 dialogue-flag literals found in his ESD dump — they're in different bytes entirely and remain unexplained; likely a different subbank/region (not yet searched) or driven by EMEVD rather than ESD.

**New finding from completing the k=9 decode sweep**: the ~70 `713Xxxxx` ESD-write flags decode to a tight, contiguous, **currently 100% UNTRACKED** byte range — `0x14055`, `0x14056`, `0x14057` (partially tracked, see above), `0x1405B`–`0x1405E`, `0x14062` — one bit per dialogue/quest-stage milestone (same "one bit per flavor-line heard" convention as Andre/Solaire's `711000xx` flags elsewhere in this project). **Only `0x14057 bit0` of this entire ~6-byte, ~45-bit range is in the current shipped file.** This is a real, code-confirmed, substantial gap: a whole block of his actual dialogue/quest progression is invisible to the current editor. Not individually mapped to specific dialogue lines this session (would need matching each flag back to its exact ESD state — mechanical but not done here); flag as a concrete "add this byte range" candidate for the editor rewrite, full byte-by-byte mapping as a follow-up if wanted.
