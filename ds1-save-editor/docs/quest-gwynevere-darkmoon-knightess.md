# DS1R Quest Flags — Gwynevere & Darkmoon Knightess

Companion to `boss-flags.md`/`npc-flags.md`. Formula: `buffer_start = pattern1 + 0x53`.
`(region=1, area=15, group=1) → k=13` (validated, Session N+29).

## Key finding: "Gwynevere" has no separate entity — she IS Gwyndolin's disguise form

There is **no distinct "Gwynevere" `MSBCharacter`** anywhere in `m15_00_00_00` or
`m15_01_00_00` (checked both `msb.characters` and `msb.dummy_characters`).
The "Gwynevere, Princess of Sunlight" dialogue the player experiences is
**entity `1510600`** (`m15_01_00_00`, talk IDs `151611`/`151612`) — the exact
same entity already documented as **Gwyndolin's talkable disguise form** in
Session N+26/N+28 (`NpcParam` internal name `"皇母マリア"` = "Empress Mother
Maria"). Confirmed via her ESD content: `IsEquipmentIDObtained(3, 374)`
(Lordvessel gift check) and a flag chain directly referencing Gwyndolin's own
combat-form range (`GetFlagState(1240)`/`1241`/`1242`).

This means `npc_data.json`'s `"Gwynevere (Princess of Sunlight)"` entry and
the already-documented Gwyndolin disguise-form bits are **tracking the same
underlying character from two different name-perspectives** — not two
independent NPCs. Any quest-rollback tool must treat them as one shared
entity: rolling back "Gwynevere" state necessarily touches Gwyndolin's own
illusion, and vice versa.

## Gwynevere (Princess of Sunlight) — shipped bits

**FULL REVIVAL MECHANISM CONFIRMED AND LIVE-TESTED, BOTH DIRECTIONS (2026-11-09).** All 5 bits below are required together — see `project_ds1_gwynevere_talk_bug.md` and `project_ds1_npc_revival_methodology.md` in project memory for the full live-bisection trace (several partial combinations tried and confirmed-failed before landing on this exact set). Tested on a genuine in-game kill, not just a hand-edited state.

| Offset | Bit | Status | Explanation |
|---|---|---|---|
| `0xF1` | 7 | **CONFIRMED (code+live)** | Flag `1232` — the disguise-form's (`1510600`) own standard Template-A death-handler flag (`RunEvent(2, 11510520, [1510600, 1230, 1239, 1232])`, set in map-init event `50`). This is the "clean" generic death flag, distinct from the explicit `SetFlagState(743,1)` in event `11510400` (= `0xB2 bit0`, already tracked under Gwyndolin's own entry). |
| `0xF2` | 1 | **CONFIRMED (code+live), newly found 2026-11-09** | Flag `1230` — the SAME Template-A range's own start/"has-met" flag (not previously shipped at all). Found by decompiling her Talk ESD (`t151611`/`t151612`): `State_20`→`State_56` (her first real greeting, `talk_param_id=21000000`) requires `GetFlagState(1230)==1`; completing it is the ONLY way `State_57` ever sets `SetFlagState(71510020,1)`, which is itself required for the normal repeat-talk transition (`IsPlayerTalkingToMe()` branch). Without this bit, the action-button prompt appears but does nothing — this was the actual missing piece, not any of the 3 bits below. **`reverse: false`** (not a death flag — alive wants bit=1, not bit=0). |
| `0x4684` | 7 | **CONFIRMED (code+live)**, cross-session | Flag `11510400` itself (k=13) — NOT a simple alive/dead flag; it's event `11510400`'s own "have I played the illusion-reveal cutscene" completion marker. It is the ONLY place `SetCharacterState(1510600,1)` is ever called in this map's EMEVD (confirmed by exhaustive grep), and it also gates the global Anor Londo light/dark `SetMapDrawParamSlot` swap. Live-tested: clearing ONLY this bit replays the illusion-reveal cutscene (statue crumbles, Anor Londo darkens) but does NOT by itself fix `CheckSelfDeath()`'s native read — still necessary, but not sufficient alone. |
| `0x4695` | 5 | **CONFIRMED (code+live), fully explained 2026-11-13** | Flag `11510522` — **not native-only after all**. It's Template-A event `11510520`'s own `RelativeToThisEventSlot` completion flag for her slot (slots assigned in event `50`: Darkmoon Knightess=1, Gwynevere=2, Gwyndolin=3 → `event_id+2=11510522`). The engine sets `event_id+slot` automatically on completion, never as a literal `SetFlagState` — that's why neither ESD/EMEVD literal grep nor 7 Ghidra passes ever found a read/write site. If this flag is ON at map load, the template runs `DropMandatoryTreasure(character)` and ends her processing, which is mechanically why clearing it was necessary. Sibling of Gwyndolin's `11510523` (slot3, bit4) and the Knightess's own `11510521` (slot1, bit6, her own shipped-but-"UNEXPLAINED" bit below). Full trace in project memory `project_ds1_quest_aggro_flag_methodology.md`. |
| `0x16D77` | 7 | **CONFIRMED (code+live) as necessary, fully explained 2026-11-12/13** | NOT EventFlag storage at all, and not "region 7" — this whole premise was wrong. `pattern1+0x16D54` onward is a separate `"CHR "`/`"OBJ "`-tagged save section (the real EventFlag buffer ends at `pattern1+0x16D53`), holding a per-map bitmask of "characters to re-kill on load" indexed by MSB character index — Gwynevere's MSB index in `m15_01` is 95, landing on this exact byte/bit. Full mechanism in project memory `project_ds1_chr_obj_blob_mechanism.md`. **Recommended edit technique is no longer "flip this bit directly"**: corrupt the `m15_01` entry's `chr_count` field instead (any value that mismatches the live map's real character count causes the WHOLE entry — including this bit — to be silently skipped on load), which is simpler, confirmed live-working (2026-11-13, character N0), and self-heals on the game's own next save. Flipping `0x16D77` directly still works too, but isn't a fixed per-NPC address — it depends on which map's entry happens to be first in the blob at save time (see that file for the full byte format). |

**Live bisection trace (character N0, slot 9, each round a genuine full map reload):** `0xF2`+`0xF1` alone → FAILED (infinite one-phrase loop, `State_34`: `CheckSelfDeath()==1 and GetFlagState(1232)==0`). Adding back all 3 of `0x4684`/`0x4695 bit5`/`0x16D77` → WORKED. Reverting those 3 → FAILED again. Isolating only `0x4695 bit5`+`0x16D77` (without `0x4684`) → FAILED (same loop). Isolating only `0x4684` (without the other two) → FAILED differently (cutscene replayed, then same loop after). Only the full conjunction of all 5 works. Confirmed symmetric: the exact inverse (set `0xF1`/`0x4684`/`0x4695 bit5`/`0x16D77` to 1, clear `0xF2` to 0) correctly "kills" her via save edit, matching a genuine in-game kill byte-for-byte (verified: a real kill naturally reset `0xF2`/`1230` back to 0 and reasserted all 4 other bits to 1 on its own).

## Darkmoon Knightess (Fire Keeper) — shipped bits

Entity `6010` (`m15_01_00_00.msb`, `c0000_0003`, `NpcParam` name `"暗月の騎士"`
= "Dark Moon Knight", talk ID `151601`).

| Offset | Bit | Status | Explanation |
|---|---|---|---|
| `0xDA` | 5 | **CONFIRMED (code)** | Flag `1034` — her own standard Template-A death flag (`RunEvent(1, 11510520, [6010, 1030, 1036, 1034])`, event `50`). |
| `0x64` | 0 | **RESOLVED 2026-11-13** | Flag `151` — "Fire Keeper (the Knightess) is dead, bonfire `1511960` can't be lit." Setter: `m15_01` event `11510533` (`RunEvent(0,11510533,[6010])` from event `50`), body: `IfCharacterDeathState(6010,dead)` → `SetFlagState(151,1)`, no reset path found. Reader: the flag number IS an event ID — event `151` itself reads its own `RelativeToThisEvent` completion flag (`event_id+0`) and shows the "Fire Keeper is absent" dialogue instead of letting the bonfire light. Same template as Fair Lady (flag `140`, bonfire `1401960`) and Anastacia (flag `102`, reversible). **Editor implication: reviving her requires clearing `151` too, or her bonfire stays dead even though she's alive.** Full trace in `project_ds1_quest_aggro_flag_methodology.md`. |
| `0x4695` | 6 | **RESOLVED 2026-11-13** | Flag `11510521` — her own `RelativeToThisEventSlot` completion flag for Template-A event `11510520` (she's slot1: `event_id+1`). Same mechanism as Gwynevere's `11510522`/Gwyndolin's `11510523` above — NOT native-only, engine-set on event completion, triggers `DropMandatoryTreasure`+disable if ON at load. |
| `0x16D6C` | 0 | **RESOLVED 2026-11-12/13** | Same CHR/OBJ-blob mechanism as Gwynevere's `0x16D77` above (her MSB index in `m15_01` is 0, landing on this exact byte/bit — this is in fact the blob's FIRST bit, which is why it was the address most sessions fixated on). See `project_ds1_chr_obj_blob_mechanism.md`. Same recommended fix: corrupt the map entry's `chr_count` rather than flipping this bit directly. |

### Her other (non-shipped) milestone flags, found but not currently tracked

From event `50`'s `RunEvent` calls and her own Talk ESD — listed for completeness:
`1030`→`0xD3 bit1`, `1031`→`0xD3 bit0`, `1036`→`0xDA bit3` (world-progress milestones:
`1036` is set from `common` event `710` when the Lordvessel is in inventory; `1031`
from `common` events `711..714`; these feed her hostility event's branch A, not pure
dialogue flavor text as originally guessed).

**`1033`→`0xDA bit6` is NOT a dialogue milestone — CORRECTED 2026-11-13: this is her
own persistent hostility flag**, set by her hostility event `11510501` itself once
triggered (see Aggro section below) and re-asserted every load while it's `1`. This
significantly changes the Dependencies section below — she is NOT purely a read-only
OR of foreign flags.

## Aggro / hostility — Darkmoon Knightess (CORRECTED 2026-11-13, she owns her own flag)

**Previous framing below was wrong in one important way: she is NOT a pure
read-only OR of foreign flags — she has her own persistent hostility flag,
`1033` (`0xDA bit6`).** Full corrected logic of event `11510501
[6010, 1033]`:

- **Branch A** (direct-attack trigger): `(1030|1031|1036) AND HP in (0%,90%] AND IfAttacked(player) AND own-event-flag OFF`
- **Branch B** (sympathetic-hostility trigger): `1034==0 AND (1232|1241|1242) AND [additional check] AND own-event-flag OFF`
- **Branch C** (repeat-apply on reload): `1033==1 AND own-event-flag ON`
- All branches that fire do: `SetFlagState(1033,1)` + `SetTeamTypeAndExitStandbyAnimation(6010,9)`

**The OR in branch B is still `1232`/`1241`/`1242`, but their identities are corrected:**
- `1232` = disguise-form (`1510600`/"Gwynevere") death flag = Gwynevere's own shipped `0xF1 bit7`.
- **`1241` is NOT an unexplained intermediate milestone — it's Gwyndolin's OWN hostility flag** (`0xF0 bit6`, set by his own event `11510502` when he turns hostile — see `project_ds1_quest_aggro_flag_methodology.md` for its full trace). So the real condition is "Gwynevere is dead, OR Gwyndolin has turned hostile, OR Gwyndolin is dead" — hostility propagates from Gwyndolin BEFORE his actual death, not only after.
- `1242` = combat-form (`1510650`) death flag = already-shipped `0xF0 bit5`.

**Practical consequence (answers "can Gwyndolin be dead while she stays calm?"): under normal play, no** — his real death sets `1242=1`, which branch B's OR picks up directly, so she's expected to go hostile too once he dies for real (assuming she herself isn't already dead, `1034==0`, and branch B hasn't already fired this reload). This is inferred directly from the EMEVD logic above, not independently live-tested this session.

**For save-editing purposes**, because her hostility is driven by her OWN sticky flag `1033` (set once, then just re-asserted by branch C every load) rather than a live re-check of `1232`/`1241`/`1242` each time, it should be *possible* to force her calm even with Gwyndolin genuinely dead: clear `1033` to `0` AND ensure event `11510501`'s own completion flag is also cleared (otherwise branches A/B — which require that flag OFF — can't re-fire to begin with, but branch C also can't fire once `1033=0`, so either way nothing re-triggers hostility that load). **This has not been live-tested** — the EMEVD logic supports it, but confirm with a real reload before relying on it.

**Gwynevere/`1510600` has NO hostility mechanism of her own at all** — verified, not assumed: searched every `(2004,*)` instruction in `m15_01_00_00.emevd.dcx` referencing entity `1510600`; only two `SetCharacterState` (enable/disable) calls exist, no `SetTeamType`/`SetTeamTypeAndExitStandbyAnimation` anywhere. She never becomes an enemy herself — her death just feeds into the Knightess's (and indirectly Gwyndolin's) hostility via the flag `1232`.

## Dependencies (for the rollback tool)

- **Gwynevere and Gwyndolin's disguise form are the same save-state** — a quest-rollback tool must never let the user independently "revive Gwynevere" and "kill Gwyndolin's disguise" as two separate operations; they're the same flag set (`1232`/`743`/`0xF1 bit7`/`0xB2 bit0`/`11510400`-derived `0x4684 bit7`).
- **CORRECTED: the Darkmoon Knightess's hostility is NOT purely read-only** — she has her own sticky flag `1033` (`0xDA bit6`). Rolling back her hostility means clearing `1033` itself (and her event's own completion flag), not just the 3 foreign trigger flags (`1232`/`1241`/`1242`) — clearing only the triggers while leaving `1033=1` would NOT un-aggro her, since branch C re-asserts hostility from `1033` alone every load.
- **`1241` is Gwyndolin's own flag, not hers** — rolling back Gwyndolin's hostility (separately from his death) now means clearing `1241`, which is a new, previously-undocumented lever.
- **Covenant/Darkmoonblade miracle disable is a side effect of her hostility** — not a separate flag to manage.
- Her covenant-rank progression (if tracked at all) was NOT found in this map's own EMEVD/ESD — check the project's existing `project_ds1_covenant_bonfire_kindle.md` memory for the generic covenant-rank mechanism before assuming she has her own.
- **General aggro-flag registry**: `common` events `770` (Oswald's absolution — resets essentially every persistent hostility flag in the game, including `1033` and `1241`) and `772` (aggregates them all into flag `744`) are the canonical reference for what to reset together for ANY NPC, not just this cluster — see `project_ds1_quest_aggro_flag_methodology.md` for the full flag list.

## Open items — RESOLVED 2026-11-13 (kept here for history)

1. ~~`0x64 bit0` (flag `151`) — setter not found~~ RESOLVED: it's the "Fire Keeper dead, bonfire unusable" flag, see her shipped-bits table above.
2. ~~Flag `1241`'s exact meaning~~ RESOLVED: it's Gwyndolin's own hostility flag, see Aggro section above.
3. ~~The shared `0x4695`/`0x16D6C`/`0x16D77` cluster bits~~ RESOLVED: `0x4695`-range bits are `RelativeToThisEventSlot` Template-A completion flags (one per NPC slot); `0x16D6C`/`0x16D77` are CHR-blob bits (MSB-index-addressed, not EventFlag at all) — see `project_ds1_quest_aggro_flag_methodology.md` and `project_ds1_chr_obj_blob_mechanism.md` respectively.
4. Gwynevere's remaining ESD-side milestone flags (`71510015`-`71510042` range, `11515350`/`11515351`/`11510592`-`11510597` etc.) were found but NOT individually decoded/matched — none landed on any of the 8 shipped target bits across an exhaustive k=0-30 search for regions 1/5/6/7, suggesting they're lower-priority dialogue-state flags not represented in the curated shipped file. Full list in `C:\gh\logs\gwynevere_esd_151611_151612.log`. **Still genuinely open.**
