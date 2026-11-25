# Solaire of Astora — Quest/Death Flag Reference

Status legend (matches `boss-flags.md`): **CONFIRMED (code)**, **CANDIDATE**,
**SUSPECT FALSE POSITIVE**, **OPEN**.

## Identity (corrects a years-old project mislabeling)

Solaire is `NpcParam` row `6000` / entity `6001`, placed **exactly once**,
in `m10_01_00_00.msb` (`c0000_0002`, `talk_id=101600`). Verified by exhaustive
MSB search across every Burg/Depths/Anor Londo map (`m10_00`, `m10_01`,
`m10_02`, `m11_00`, `m15_00`, `m15_01`) — no second `c0000`-model placement
anywhere matches character_id `6000`/entity_id `6001`. **He is not placed via
MSB anywhere else in the game** — his later encounters (Depths, Anor Londo,
corrupted fight) do not correspond to a second static map placement the way
e.g. Gwyndolin's two-entity split does. This is the opposite situation from
what the task brief assumed (that he has multiple placements); instead, if
his "gone mad" form exists as a distinct game object at all, it's most likely
a runtime-spawned/state-swapped version of the SAME entity `6001` (same
pattern already found for Great Grey Wolf Sif's team-type flip and for
Artorias/Ciaran, who also have no DLC-hub MSB placement) — not confirmed,
see Open Items.

Prior project memory (`project_ds1_npc_alive_dead.md` and this file's own
earlier "Andre" sessions) used entity `6001`/flag `1005` as its Andre
test case — **that was always Solaire**, not Andre (corrected in memory
2026-11-08, see `project_ds1_emevd_parsing.md` Session N+31).

## CONFIRMED: his death flag

| Field | Offset | Bit | Status | Mechanism |
|---|---|---|---|---|
| Permanent death | `0xD6` | 2 | **CONFIRMED (code)** | Flag `1005`. Standard Template-A regular-NPC death handler (`RunEvent(0, 11010520, [6001, 1000, 1029, 1005])` from `m10_01_00_00.emevd.dcx` event 50) — health-ratio watch → `DropMandatoryTreasure(6001)` → range-reset → `SetFlagState(1005,1)`. Same mechanism documented for every other regular NPC project-wide. |

His map-load init chain also touches flags `1001`/`1004`/`1007`/`1008` — but
**these are NOT Solaire-specific**: a raw-byte scan across all 32
`.emevd.dcx` files shows each of these small numbers reused by dozens of
*other* NPCs' own local init chains in *other* maps (e.g. `1001` alone has
hundreds of hits across nearly every map file) — this project's standing
convention is that the `1000-1029`-style range is a **local, per-map-reused
scratch pool**, not a globally unique ID space, so a literal number match in
a different map proves nothing about Solaire. Only `m10_01`'s own copy of
`1005` (used inside his specific `RunEvent(...,11010520,...)` call) is his.

## OPEN: the rest of his shipped bit list is NOT resolved

The real, shipped `npc_data.json` entry for Solaire has ~17-20 bits total
(`0xD5`, `0xD6`, `0x4695`, `0x16D6C`×2, `0xB1`, `0xF95`, `0xF8F`, `0xF94`,
`0x469C`, `0x11D5E`, `0x15453`, `0x3C8F`, `0x3C94`×3, `0x3C95`, `0x12762`,
`0x14A59`, `0x17E97`). Only `0xD6 bit2` (above) was resolved this session.

Attempted both of the project's standard search methods on the rest, both
came back **completely empty**:
1. Reverse-decoded every other bit to its literal flag ID using the
   project's own formula (verified correct against 3 known-good examples:
   `0xF0 bit5→1242`, `0xB2 bit0→743`, `0x5F bit7→120`, all exact). This
   produced flag IDs `1008`, `744`, and six-digit values `30510`/`30520`/
   `30531`/`120510`/`120520`/`120530`/`120531`/`120534`/`140520`/`140594`/
   `570064`/`590096`/`660040`/`680031` (plus `730212`/`730215` for the
   `0x16D6C` byte, which is almost certainly a *shared, generic*
   "area-visited" counter reused across many NPCs per prior project
   findings, not a Solaire-specific flag ID at all — don't chase it as one).
2. Raw-byte-scanned every `.emevd.dcx` in the game for all of these literals:
   **zero hits** for every six-digit candidate (only the small numbers
   1008/744 hit, scattered across unrelated maps/NPCs, same caveat as above).
3. Regex-scanned every `.talkesdbnd.dcx`'s `.to_esp()` output game-wide for
   `SetFlagState`/`SetEventFlagRange` calls matching any candidate:
   **zero hits** for all of them, including the small numbers this time.

**This is a real, well-covered negative result, not a half-effort — but it
means one of two things, and this session could not distinguish which:**
- These flags are set via `EventArgRepl`-style parameter substitution
  through a shared template event (the literal number never appears
  anywhere in the files; it'd require finding the template event and its
  caller args, the same technique that cracked the generic death-template
  in `project_ds1_emevd_parsing.md` Session N+14) — not attempted this
  session, time did not allow tracing ~14 distinct candidate numbers this way.
- Some or all of these are **false positives** from the original 2-run
  manual live-diff derivation (same root cause already confirmed for
  Gwyndolin's `0x5F bit6` in Session N+26/N+28) — plausible given his entry
  is unusually large (17-20 bits) relative to how simple his core state
  actually is (alive/dead + a few milestones).

## Aggro / hostility — checked, genuine negative result on entity `6001`

Searched every `.emevd.dcx` in the game for `(2004,2) SetTeamType(character, new_team)`
and `(2004,44) SetTeamTypeAndExitStandbyAnimation` instructions referencing
entity/character `6001`/`6000` (same technique that found the Darkmoon
Knightess's 3-flag-OR hostility check and Sif's WhitePhantom flip in prior
sessions). **Exactly one hit in the entire game:**

```
common.emevd.dcx event=770: SetTeamType(6001, Ally)
```

`new_team=8` decodes to `TeamType.Ally` (verified against the real enum,
not guessed) — i.e. this instruction makes Solaire **friendly**, not
hostile. It's inside the same generic NG+-cycle-transition reset event
already identified in `project_ds1_emevd_parsing.md` Session N+13 (which
also resets several blacksmiths, e.g. entity `6190`=the real Andre, to
`Ally`) — a defensive "make sure these NPCs are friendly again" reset at
NG+ boundary, not a corruption-specific mechanic.

**No instruction anywhere sets entity `6001` to a hostile team type**
(`Enemy`/`Boss`/`HostileAlly`/etc.) — a clean, exhaustive negative result,
not a partial search. Combined with the "no second MSB placement" finding
above, this is fairly strong evidence that **"Mad Solaire" is not
entity `6001` turning hostile at all** — it's more likely an entirely
separate character/boss entity (possibly runtime-spawned, same pattern as
Artorias having no DLC-hub MSB placement) that merely resembles him. This
directly narrows the "OPEN: corruption branch" item below: stop looking for
a team-type flip or flag on entity `6001` for this specific question, and
instead search for a SEPARATE NpcParam row/entity representing the mad
form, per the recommendation already in that section.

## OPEN: the corruption ("Mad Solaire") branch — not found

Could not locate ANY code-level trace of the branch where Solaire turns
hostile/hollow in Anor Londo's Chasm of the Abyss. Specifically checked and
ruled out:
- No second MSB placement anywhere (see Identity section above) — so if this
  is a distinct in-game object, it is NOT a static map placement.
- No literal flag write found connecting his death template to anything
  resembling a "corruption" state.
- Did not have time this session to check whether this fight is
  **runtime-spawned** the way Artorias is (no MSB entry, spawned by a
  cutscene/trigger event) — this is the most promising untried lead, same
  method as `project_ds1_emevd_parsing.md` Session N+22 used to find
  Artorias's real encounter event via a raw literal scan for his
  `game_area_param_id`. Solaire's hostile form, if it has one, likely needs
  the same treatment: find his NpcParam-equivalent for the mad form (may be
  a DIFFERENT `NpcParam` row entirely, reusing the `c0000` model with
  different AI/stats) and raw-byte-scan for ITS id, not entity `6001`'s.

## OPEN: Lautrec cross-reference — not attempted

Did not reach this within the session's time budget. Lautrec's own
entity/flag identity was not independently verified this session (per the
Session N+31 lesson, his `NpcParam` internal name should NOT be trusted
without a shipped-bit cross-match first — this has not been done). No
flag cross-reference between Solaire's and Lautrec's EMEVD/ESD was
attempted. Flagging this as fully untouched, not a dead end.

## OPEN: summon-sign flags (O&S / Four Kings co-op) — not attempted

Not investigated this session. Likely candidates would be the
`PlaceSummonSign` instruction (`(2003,25)`, already known from
`project_ds1_emevd_parsing.md`'s Artorias/Kalameet work) called with entity
`6001`/character `6000` as an argument somewhere in `m15_00`/`m15_01`
(O&S's arena) and wherever Four Kings' arena is — a direct instruction-arg
scan for `6001`/`6000` restricted to `(2003,25)` calls specifically (not yet
run) would likely find this quickly in a follow-up session.

## Dependencies (for the rollback-tool use case)

**What IS safe to roll back right now, with no known side effects:**
rolling back `0xD6 bit2` (his death flag) by itself appears mechanically
isolated — nothing else in this codebase's findings reads it except his own
death-template logic, which only runs forward (sets the flag), never reads
it back as a gate for anything else found so far.

**What is NOT yet safe to build a rollback feature around:** the other
~16-19 bits in his shipped entry, because their real meaning (if any) is
unknown — a rollback tool cannot safely toggle bits whose effect on other
systems hasn't been traced. Do not expose "rollback Solaire's quest stage"
as a single clean operation in the new editor until at least the
corruption-branch flag and the real meaning of the six-digit flag cluster
(`120xxx` is the largest, 5 bits — most likely his actual quest-stage
milestones) are found.

## Recommended next session

1. Trace the `120xxx`-flag cluster (5 bits, the largest unexplained group)
   via `EventArgRepl` template-argument tracing rather than literal search —
   find any shared event taking a flag-ID parameter that could resolve to
   these values when called with Solaire-specific arguments.
2. Search for Solaire's mad-form NpcParam row (NOT entity 6001) and
   raw-byte-scan for ITS id to find the corruption-trigger event, same
   method as Artorias's Session N+22 breakthrough.
3. Only after 1-2: attempt the Lautrec cross-reference and summon-sign scan.
