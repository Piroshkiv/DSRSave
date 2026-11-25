# DS1R Quest Flags — Griggs of Vinheim, Big Hat Logan, Rickert of Vinheim

Companion doc to `boss-flags.md`/`npc-flags.md`. Vinheim sorcery-academy
cluster. Status legend matches the other docs: **CONFIRMED (code)** / **CANDIDATE** / **OPEN**.

## Identity (verified by exact-match against shipped `npc_data.json` bits, per the Session N+31 lesson — not by trusting raw `NpcParam`/MSB names, which are all the generic `c0000` human model)

| Name | Map | character_id | entity_id | talk_id | Notes |
|---|---|---|---|---|---|
| Griggs of Vinheim | `m10_01_00_00` | 6040 | 6040 | 101604 | |
| Griggs of Vinheim | `m10_02_00_00` | 6040 | 6041 | 102604 | relocated instance |
| Griggs of Vinheim | `m15_00_00_00` | 6041 | 6043 | 0 (no dialogue) | relocated instance, non-talkable — likely corpse/inactive placement |
| Big Hat Logan (merchant form) | `m10_02_00_00` | 6030 | 6031 | 102603 | |
| Big Hat Logan (merchant form) | `m15_00_00_00` | 6030 | 6030 | 150603 | relocated instance |
| Big Hat Logan (merchant form) | `m17_00_00_00` | 6031 | 6032 | 170603 | relocated instance |
| **Big Hat Logan (hollow/hostile form)** | `m17_00_00_00` | 6032 | **6033** | 0 (no dialogue) | separate placement, same map |
| Rickert of Vinheim | `m16_00_00_00` | 6220 | 6220 | 160622 | **see caveat below** |

All three are confirmed to be ONE logical character who relocates between
map placements, sharing a single death-tracking flag across every
placement (same design already seen for Griggs: flag `1115` reused in all
3 of his map instances).

**Caveat on map identification**: this project had previously (loosely)
assumed `m16_00` = New Londo Ruins based only on this single flag match.
Rickert's own Talk ESD (talk `160622`) heavily references `area=18`-prefixed
flags (`71810000`-`71810023`, a long sequential run) which by this
project's established area-digit convention point to Oolacile (`m18`), not
New Londo — this is unexplained and NOT resolved this session. Either (a)
`m16_00` is not what this project assumed, or (b) this specific talk ID
isn't really "Rickert" and the flag-1382 match is a coincidence (the same
class of risk flagged by the Andre/Solaire mixup), or (c) his dialogue
template is shared/reused with an unrelated DLC character and the area-18
writes are dead code for this placement. **Flag this explicitly as OPEN —
do not trust the Rickert identification or his flag table below as more
than a CANDIDATE** until someone re-verifies independently (e.g. checking
what real area `m16_00` actually is via a different, unambiguous NPC/boss
already placed there).

## Griggs of Vinheim

| Stage | Flag | Offset | Bit | Status |
|---|---|---|---|---|
| Death (any location) | `1115` | `0xE0` | 4 | **CONFIRMED (code)** — standard Template-A death handler, range `(1110,1119)`, found independently in all 3 of his map placements |

Only his death flag was traced this session (budget went to Logan's hollow
mechanic, the main ask). His other ~20 shipped bits (`0xE1`, `0xF68`,
`0xF8F`, `0xF94`, `0xF95`, `0xC396`, `0x11D59`, `0x11D5A`, the `0x16Dxx`
far-cluster bits) were **not individually traced** — likely dialogue-stage
flags from his own Talk ESD across his 3 placements (not dumped this
session beyond the death-flag cross-match). **OPEN** for a future pass.

## Big Hat Logan — confirmed multi-stage sequence, including the hollow/hostile transition

Event chain in `m17_00_00_00.emevd.dcx`'s map-init event `50`, calling a
family of template events on entity `6032` (and `6033` for the final one),
all sharing the param range `(1090, 1109)`:

| Event | Flag set | Offset | Bit | Status | What it represents |
|---|---|---|---|---|---|
| `11700510` | `1096` (likely — see note) | `0xE2` | 7 | CANDIDATE | Probably "has met Logan" gate — required (`IfFlagState[1,1096]`) by every later transition event, but not individually confirmed this session (didn't find `0xE2 bit7` in his shipped list — possible gap, or this flag may not be shipped at all) |
| `11700520` (ran for BOTH entity `6032` and `6033`) | `1090` | `0xDB` | 5 | **CONFIRMED (code)** | First milestone (matches shipped) |
| `11700530` | `1092` | `0xDB` | 3 | **CONFIRMED (code)** | Second milestone (matches shipped) |
| `11700531` | `1093` | `0xDB` | 2 | **CONFIRMED (code)** | Third milestone (matches shipped) |
| `11700532` | `1094` | `0xDB` | 1 | found, **NOT in shipped file** | Fourth milestone — real gap, not currently tracked by the tool |
| `11700520`'s shared death flag | `1097` | `0xE2` | 6 | **CONFIRMED (code)** | His simple death flag — shared across ALL his map placements AND both his merchant/hollow entities (`6032` and `6033` both reference the same flag `1097` via the same template call) |
| **`11700533` (the hollow-transition event)** | **`1099`** | **`0xE2`** | **4** | **CONFIRMED (code)** | **"Logan has gone hollow/insane" — exact match to shipped file** |

### Aggro / hostility — CONFIRMED, found via `SetTeamTypeAndExitStandbyAnimation` (not plain `SetTeamType`)

Per the coordinator's follow-up: a direct `(2004,2) SetTeamType` scan across
every map found **zero** hits for Logan — the mechanism is a DIFFERENT
instruction, `(2004,44) SetTeamTypeAndExitStandbyAnimation`, applied
**unconditionally at map load** to his hollow-form entity `6033`:

```
SetTeamTypeAndExitStandbyAnimation(character=6033, team_type=9)  -- TeamType.HostileAlly
```

This is a **static property of the hollow-form placement**, not a live
flip — entity `6033` is ALWAYS `HostileAlly` whenever it's active; the real
"did he go hollow" trigger is entirely about WHICH entity is currently
enabled, controlled by event `11700533` below.

**Event `11700533`'s real body** (decoded via `evs_args_list`
param-substitution, same technique as the project's regular death-template
work):

```
SkipLinesIfFlagState(258, state=?, flag=11700595)   -- re-entry guard (own "done" flag)
SetObjectState(1701664, 0)                          -- map object toggle (door/wall?)
SetObjectActivation(1701664, -1, 0)
-- condition chain: IfFlagState on 1096/1095/14/728/11700592/etc. (gates WHEN this can fire)
SetFlagRangeState(1090, 1109, 0)                    -- reset his own milestone range
SetFlagState(1099, 1)                               -- SET THE HOLLOW FLAG
SetCharacterState(6032, 0)                          -- DISABLE merchant form
SetCharacterState(6033, 1)                          -- ENABLE hollow/hostile form
SetFlagState(11700595, 1)                           -- mark this event done
```

**This is a clean, fully-confirmed finding, not a guess**: killing/losing
Logan's "good" path disables entity `6032` and enables entity `6033`
(pre-set to `HostileAlly` team), while persisting flag `1099` →
`pattern1+0xE2 bit4`, which exactly matches his already-shipped
`npc_data.json` entry. **Recommend treating `0xE2 bit4` as the definitive
"Logan is hollow/hostile" indicator for the editor rewrite** — it's
independent of (and in addition to) his separate death flag (`0xE2 bit6`).

**Not resolved this session** (OPEN, lower priority): the exact gating
condition chain inside `11700533` that decides WHEN this transition is
allowed to fire (flags `1095`, `14`, `728`, `11700592` appear in the
condition list but weren't individually traced) — this is the actual
"what causes Logan to go hollow" trigger condition (e.g. tied to story
progress / a timer), as opposed to the mechanism itself (which is now
fully mapped). Also open: flags `11700594`/`11700595` (events `531`/`532`'s
own "done" markers) are region1 (`area=17`) — no validated subbank `k`
exists yet for `area=17`, so they can't be decoded to a byte/bit without
further work (same class of task as the boss `k`-table).

## Rickert of Vinheim — CANDIDATE ONLY, identity itself in question (see caveat above)

| Flag | Offset | Bit | Status |
|---|---|---|---|
| `1382` | `0xFF` | 1 | CANDIDATE — matches shipped, but see the map-identity caveat above before trusting |

His Talk ESD (`160622`) sets a long run of flags in the `71810xxx` range
(area 18) plus a handful of low region0 flags (`355`,`356`,`357`,`367`) —
none individually decoded/cross-matched this session. **Do not build on
this without re-verifying the map/identity question first.**

## Dependencies (for the quest-rollback feature)

- **Logan's hollow transition and his plain death are INDEPENDENT flags** (`0xE2 bit4` vs `0xE2 bit6`) sharing the same byte — a rollback tool must handle both bits together when "reviving" him, and must also flip his ENABLED ENTITY back from `6033` to `6032` (not just clear flags) if the editor ever needs to move live game state, not just save bits, into a consistent position. A save-only rollback (just clearing the bits) should be enough for the game's own EMEVD to re-evaluate and re-enable the correct entity next time its init event runs — but this is NOT verified in-game this session, flag as a CANDIDATE assumption.
- Griggs's and Logan's paths do not appear to cross-reference each other's flags directly (no shared flag ID found connecting them) — the "are they linked" question from the task brief found **no evidence of a direct dependency**, though Griggs's non-death flags weren't fully traced so this isn't 100% certain.
- Rickert's dependency question is moot until his identity/map caveat is resolved.

## Scripts/logs this session
`C:\gh\logs\griggs_logan_rickert_shipped.log`, `griggs_logan_rickert_msb2.log`, `griggs_logan_rickert_esd.log`, `griggs_logan_rickert_teamtype.log`, `logan_m17_events.log`, `logan_hollow_events.log`. No new persistent `.py` scripts saved (all one-off `python -c` inline this session) — reuse the decode formula / monkeypatch pattern from `C:\gh\scripts\scan_flag_instructions.py` if resuming.
