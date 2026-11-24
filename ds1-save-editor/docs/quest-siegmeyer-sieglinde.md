# Siegmeyer of Catarina / Sieglinde — Quest-Stage & Aggro Reference

Companion to `boss-flags.md`/`npc-flags.md`. All offsets are `pattern1`-relative
(`buffer_start = pattern1 + 0x53`, same formula as the rest of this project's
reference docs). Status legend: **CONFIRMED (code)** = traced to the exact
EMEVD/ESD instruction; **CANDIDATE** = decoded but not in-game tested;
**OPEN** = found something real but couldn't close it; **SUSPECT** = inferred
from context, not directly proven.

## TL;DR for the editor rewrite

- Siegmeyer is **4 (or more) separate map placements** of the same logical
  character, each with its own local MSB entity and its own local flag
  sub-range. Only two of them were confirmed against the real, shipped
  `npc_data.json` this session (Demon Ruins, Blighttown) — see the identity
  table below for what's solid vs. what's an educated guess.
- There is **one single, shared, global "has gone hollow" flag** (`1512` →
  `pattern1+0x116 bit7`) that is NOT currently tracked in `npc_data.json` at
  all. This is the cleanest, single most useful addition this session found.
- **"Goes hostile" is implemented two different ways depending on map** — a
  second, dedicated hostile-body entity in Demon Ruins, vs. an in-place
  `SetTeamType` on his own body in Blighttown. Neither is a simple persisted
  "is hostile" flag by itself — see the Aggro section.
- **Sieglinde was NOT found with confidence this session.** She is not in the
  shipped `npc_data.json` at all (confirmed — searched for "Sieg" in the real
  file, only Siegmeyer exists). One candidate entity (Catacombs, `6320`) was
  found but could not be disambiguated from "Siegmeyer's own Catacombs
  placement" vs. "Sieglinde." Flagged as the top open item below — don't
  guess in the editor, re-investigate with a live test if this blocks anything.

## Identity table — which map entity is which

| Map | Entity ID | Talk ID | Role | Confidence |
|---|---|---|---|---|
| `m14_01_00_00` (Demon Ruins, Chaos Eaters bonfire) | `6286` | `141628` | Siegmeyer, friendly body | **CONFIRMED** — his own `GetFlagState(1513)` check decodes to `0x116 bit6`, an exact, repeated match in the real shipped entry |
| `m14_01_00_00` | `6004` | — (no talk_id, silent) | Siegmeyer, hollow/hostile body | **CONFIRMED** structurally (shares the same quest-flag range and is the explicit target of the hollow-switch event), not independently cross-matched against a shipped bit since it has no dialogue of its own |
| `m14_01_00_00` | `6002` | `141600` | Invisible quest-state tracker/timer for the Demon Ruins placement (NOT a visible NPC) | CONFIRMED structurally (owns the hollow-trigger event as its `RunEvent` caller), identity ("tracker, not a real NPC") is inferred from behavior, not independently labeled anywhere |
| `m14_00_00_00` (Blighttown) | `6282` | `140628` | Siegmeyer, single body (both friendly and hollow states — see Aggro section) | **CONFIRMED** — same `0x116 bit6` exact match |
| `m10_00_00_00` (Lower Burg) | `6130` or `6260` | `100613` / `100626` | Candidate early-stage Siegmeyer placement(s) | **SUSPECT, not confirmed** — own flag ranges (`1250s`/`1430s`) found, but neither decodes to any bit in his shipped entry; could be him, could be unrelated NPCs. Not disambiguated this session. |
| `m13_00_00_00` (Catacombs) | `6320` | `130632` | Candidate — Siegmeyer's Catacombs placement, OR possibly Sieglinde | **OPEN, genuinely ambiguous** — own flag range (`1620`-`1638`), doesn't overlap his confirmed `1490`-`1514` range at all, and doesn't match any shipped bit either. The dialogue references `ComparePlayerStatus(12, 0, ...)` (a covenant-status check) — consistent with either character. Not resolved; see "Open items." |

**Why the early-stage placements couldn't be confirmed**: the real shipped
`npc_data.json` entry for Siegmeyer is a flat, deduplicated list of 31
(offset, bit) pairs that look like **3 separate before/after snapshots
concatenated together** (classic signature of the project's already-known old
derivation method — run the diff multiple times, keep what looked
consistent). This session's method (decode a flag found in an NPC's own ESD,
check for an *exact* match against the shipped list) is reliable by
construction when it hits, but a miss doesn't prove the candidate is wrong —
it may just mean that particular early-stage snapshot was never captured by
whoever built the original file. Treat the "CONFIRMED" rows as solid and the
others as real leads needing a live test, not as disproven.

## Quest-stage flag cluster (Demon Ruins / Blighttown, shared global flags)

All of these are **region-0 flags — globally shared, not map-specific** —
despite being referenced from map-specific EMEVD events. Decoded via the
standard formula (no subbank `k` needed, flag IDs are all < 2000):

| Flag | Offset | Bit | Meaning (inferred from EMEVD context) | In shipped file? |
|---|---|---|---|---|
| `1503` | `0x110` | 0 | Early stage marker (set by map-load dispatcher `11410540`/equivalent) | NOT shipped as this exact bit (shipped has `0x110 bit6`, a different bit in the same byte) |
| `1504` | `0x10F` | 7 | Stage marker (`11410541`) | not shipped |
| `1505` | `0x10F` | 6 | Stage marker (`11410542`) | not shipped |
| `1506` | `0x10F` | 5 | Stage marker (`11410543`) | not shipped |
| `1507` | `0x10F` | 4 | Stage marker (`11410544`) | not shipped |
| `1508` | `0x10F` | 3 | Referenced in death/attack guard conditions alongside 1513/1506 | not shipped |
| **`1512`** | **`0x116`** | **7** | **"Has gone hollow" — set by event `11410501` for the Demon Ruins placement.** Checked directly by his own ESD (`if GetFlagState(1512) == 1:`) to gate dialogue. | **NOT in the shipped file at all — genuinely missing, recommend adding.** |
| **`1513`** | **`0x116`** | **6** | **"Quest resolved" — set by TWO independent paths** (events `11410545` and `11410546` in Demon Ruins; also referenced identically in Blighttown's `11400520`). This is the bit already tracked and confirmed. | **CONFIRMED, already shipped and correct.** |
| `1514` | `0x116` | 5 | Upper bound of the `[1490,1514]` reset range, also independently set by event `11410550` | not shipped, likely a redundant/bookkeeping bit, not a new real milestone |

**Practical note for the editor**: if the goal is just "is he alive/dead/hollow",
`1512` (hollow) + `1513` (resolved/dead-or-done) + the standard combat-death
flag already in the shipped file are probably sufficient. The `1503`-`1508`
sequence looks like fine-grained narrative bookkeeping (which specific line
of dialogue has played), not meaningfully different game states — lower
priority to expose in a rollback UI.

## Aggro / Hostility — confirmed, and it's NOT a simple flag

Per the coordinator's explicit follow-up: searched EMEVD for `SetTeamType`
(`(2004,2)`) and `SetTeamTypeAndExitStandbyAnimation` (`(2004,44)`) calls tied
to Siegmeyer's entities. **Confirmed: two different implementations depending
on map, neither of which is a simple "is hostile" persisted bit** — the
TeamType itself is set fresh every time the relevant event runs; the *cause*
is the `1512` hollow flag above, not a separate hostility flag.

- **Demon Ruins (`m14_01`)**: a **dedicated second entity** (`6004`) exists
  purely to be his hostile form. It has `TeamType = 9` (confirmed via
  `soulstruct`'s `TeamType` enum: `9 = HostileAlly`) baked into both the
  map's own init event (`event 50`) and the specific hollow-trigger event
  `11410531`. That event, called as `RunEvent(0, 11410531, 6002, 1000, 1029,
  1002)` (`6002` = the invisible tracker entity, not Siegmeyer's visible
  body), does: `SetFlagRangeState(1000,1029,0)` → `SetFlagState(1002,1)` →
  `SetCharacterState(6002, 0)` (disable the tracker itself) → **unconditionally
  `SetCharacterState(6004, 1)` + `SetTeamTypeAndExitStandbyAnimation(6004,
  9)`** (enable the hostile body and mark it `HostileAlly`).
  **Open gap**: this event does NOT appear to explicitly disable the friendly
  body (`6286`) itself — only the tracker (`6002`). Whatever prevents both
  `6286` and `6004` from being simultaneously active and visible was not
  found this session; worth checking before trusting this mechanism blindly
  in an editor that force-sets flags without also managing character-enable
  state.
- **Blighttown (`m14_00`)**: **no second entity** — his own single body
  (`6282`) gets `SetTeamTypeAndExitStandbyAnimation(6282, 9)` directly, via
  event `11400510` (a parameterized template: `character` is a real
  substituted argument here, not hardcoded), called as `RunEvent(4,
  11400510, 6282, 1512)` — note the 4th argument is the **same flag `1512`**
  used by the Demon Ruins placement. This confirms `1512` is the one true
  shared "hollow" signal driving hostility in BOTH maps, just wired to two
  structurally different enable mechanisms.
- **The exact real-time trigger condition** for *when* `1512` gets set (what
  specifically counts as "failed/timed out") was not fully decoded — the
  gating instructions in event `11410531`/`11400510` mix `IfFlagState`,
  `IfTimeElapsed`, and (in Blighttown's case) `IfHealthRatioComparison`
  checks whose raw arguments are ambiguous under this project's standard
  raw-int32 EMEVD dump (several args get byte-packed together — the same
  class of pitfall Session N+28 already caught once for Gwyndolin). Not
  re-derived rigorously this session; if exact trigger semantics matter
  (e.g. "is it a pure timer, or does the player's distance/action matter"),
  budget a follow-up session specifically for that, using the arg-dict
  cross-check method Session N+28 established.

**Practical recommendation for the editor**: implement "revive Siegmeyer from
hollow" as: clear `1512` (`pattern1+0x116`, clear bit 7), ensure `6286`
(Demon Ruins) or `6282` (Blighttown, same entity either way) is the
re-enabled/friendly one, and don't rely on reading a `TeamType` value from
the save at all — team type isn't something this project found to be
save-persisted per se, it's re-applied by the relevant map's own init event
every time the map loads, driven by whatever flags ARE persisted (`1512`
chief among them).

## Sieglinde — NOT resolved this session (highest-priority open item)

- Confirmed she has **no entry at all** in the real, shipped `npc_data.json`.
- The subtitle-text search method (looking up her known line "I am
  Sieglinde of Catarina" in the `Subtitles` FMG category) found entry IDs
  `39000001`/`39000141`, but this project's subtitle-ID numbering was
  confirmed (via a cross-check against a known-good Andre/Solaire example)
  to have **no direct relationship to ESD talk IDs** — don't try to derive a
  talk ID from a subtitle ID again, that approach is a dead end.
- The one candidate found (`6320` in `m13_00_00_00`/Catacombs) could not be
  confirmed as her specifically — see the identity table above.
- **Recommended next step if this blocks the editor**: a live before/after
  save-diff test (same method already proven elsewhere in this project via
  `watch_live_save.py`) — visit her in the Catacombs, talk to her, and watch
  which flag(s) change. This would settle her identity and real flag(s)
  directly, faster than more static EMEVD/ESD guessing.

## Dependencies between Siegmeyer and Sieglinde

**Not found this session** — with Sieglinde's own entity/flags unresolved,
no cross-reference could be confirmed either direction (does her dialogue
read his `1512`/`1513`? does his own EMEVD ever reference her entity?). The
project's own prior precedent (Lord's Blade Ciaran reading Artorias's kill
flag directly, Session N+27) shows this exact kind of "NPC B's own watcher
event reads NPC A's flag and writes NPC B's own separate flag" pattern is
real and common in this engine — likely the same shape applies here once
she's identified, but this is a prediction, not a confirmed finding.

## Reusable scripts/logs this session

`C:\gh\logs\sieg_candidate_esd.log`, `sieg_full_flags.log`,
`sieg_teamtype_scan.log`, `sieg_event_531_full.log`,
`sieg_event_554_551_552.log`, `m14_00_teamtype_scan.log`,
`sieglinde_candidates.log`, `entity6320_flags.log`. No new named scripts were
checkpointed separately — all work reused `scan_flag_instructions.py` and
inline one-shot decode scripts following this project's established pattern.

## Next steps if resumed

1. **Sieglinde**: live save-diff test (see above) — highest priority, this
   session made no confirmed progress on her identity.
2. Disambiguate `6320` (Catacombs) — is it Siegmeyer or Sieglinde? A live test
   visiting the Catacombs specifically would settle this too.
3. Confirm/rule out `6130`/`6260` (Lower Burg) as early Siegmeyer placements.
4. Decode the exact real-time trigger condition for flag `1512` (the
   IfFlagState/IfTimeElapsed/IfHealthRatioComparison mix in events `11410531`
   /`11400510`) if the editor ever needs to simulate or predict *when* he'll
   hollow, not just read/write the end state.
5. Find what (if anything) explicitly disables entity `6286` when `6004`
   (the Demon Ruins hollow body) gets enabled — currently an open gap, could
   matter for an editor that manipulates these flags directly without going
   through the game's own load-time dispatcher.
