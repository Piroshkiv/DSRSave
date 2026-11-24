# Rhea of Thorolund & the Thorolund Knights — Quest Flag Reference

Companion to `boss-flags.md`/`npc-flags.md`. Covers the escort-questline case
the user flagged as hard/interlinked. All offsets are `pattern1`-relative
(same `pattern1` as `findPattern1()` elsewhere in this codebase).

**Headline finding: Rhea is NOT missing from `npc_data.json` — she already has
a huge (~90 raw bit) entry under `"Reah of Thorolund and Paladine"`. The
problem isn't absence, it's that the entry is one big undifferentiated blob
collected via repeated manual live-diffs, mixing real per-instance/per-escort
flags together with unlabeled, possibly-noisy entries and no structure at
all.** This doc identifies which specific bits inside that blob mean what,
so the editor rewrite can split them into clean, independent fields instead
of one opaque bucket.

## Her real structure: 3 separate map-instances + 2 escort knights

Like Gwyndolin (two bodies) and Asylum/Stray Demon (two tutorial-boss
entities), Rhea is **not a single entity** — the engine places a fresh copy
of her in every map she's scripted to physically appear in during her
escorted journey, each with its own `entity_id` and its own death/exit flag.
Her two knights only get their own tracked entities once the plot reaches
the Tomb of the Giants / Catacombs-2 area — no separate escort entities were
found earlier in the journey (they likely just visually follow her without
individual flags until the betrayal/capture sequence).

| Instance | Map | `character_id` | `entity_id` | `talk_id` | Internal name |
|---|---|---|---|---|---|
| Rhea — Undead Parish | `m10_01_00_00` | 6070 | 6072 | 101607 | `白の聖女` ("White Saintess") |
| Rhea — connecting corridor | `m10_02_00_00` | 6070 | 6070 | 102607 | same |
| Rhea — Tomb of the Giants | `m13_01_00_00` | 6070 | 6071 | 131607 | same |
| Thorolund Knight A | `m10_02_00_00` only | 6080 | 6080 | — (not talkable) | `聖女の騎士A` ("Saintess's Knight A") |
| Thorolund Knight B | `m10_02_00_00` / `m13_01_00_00` | 6090 / 6091 | 6090 / 6091 | — (not talkable) | `聖女の騎士B` (`...拠点` in the corridor copy) |
| Thorolund Knight C | `m10_02_00_00` / `m13_01_00_00` | 6100 / 6101 | 6100 / 6101 | — (not talkable) | `聖女の騎士C` |

**Correction to an earlier pass in this same session**: Knight A (`6080`)
was initially missed because it's only placed in the connecting corridor
(`m10_02_00_00`) — it does **not** get a separate instance in the Tomb of
the Giants map the way B and C do. All 3 knights share the same escort-group
template described in the Aggro/Hostility section below.

## Aggro / hostility mechanism — the real "paladins turn on you" trigger (found via `SetTeamType`, category `(2004,2)`)

Per the coordinator's follow-up request: searched all of Rhea's/the knights'
maps for `SetTeamType` calls, same technique already proven for the
Darkmoon Knightess (Session N+28) and Sif (Session N+27).

**The real mechanism is in `m10_02_00_00` (the connecting corridor), event
`11020501`** — a single shared trigger for the whole 4-member escort group
(Rhea `6070` + Knights A/B/C `6080`/`6090`/`6100`):

```
for each member in [Rhea(6070), KnightA(6080), KnightB(6090), KnightC(6100)]:
    cond[member] = IfHealthRatioComparison(member, <=, 0.9)        -- took ANY damage
                    OR (skipped if member already dead)
                   IfAttacked(member, within 10000 [ms?])          -- OR was directly attacked
-- the 4 per-member conditions are then OR'd together into one master condition
if master_condition (ANY member damaged/attacked):
    for each member NOT already dead:
        SetFlagState(<member's own "alerted" flag>, 1)
        SetCharacterState(member, 1)      -- (re)enable
        SetTeamType(member, HostileAlly)   -- team type 9
```

**In plain terms: if the player attacks (or so much as grazes) ANY ONE of
Rhea or her 3 knights, the WHOLE GROUP flips to `HostileAlly` (team 9)
together** — this is the classic, well-known DS1 "escort turns hostile if
you hit one of them" mechanic, now pinned to exact code. Health threshold
is **90%** (`IfHealthRatioComparison(..., 5, 0.9)` — comparison type 5 =
`<=`, literal float `0.9` decoded from the raw arg `1063675494`), i.e. even
minor chip damage counts, not just a serious hit.

**New "alerted" flags found (distinct from each member's own DEATH flag —
these mark "this member has individually entered the hostile-group state"):**

| Member | Alert flag | Offset | Bit | Shipped on Rhea's entry? |
|---|---|---|---|---|
| Rhea | `1176` | `0xE8` | 7 | not found in her current bits |
| Knight A | `1197` | `0xEE` | 2 | not found |
| Knight B | `1213` | `0xEC` | 2 | not found |
| Knight C | `1223` | `0xEB` | 0 | not found |

**Also found while tracing the same event — Knight A's own death flag,
previously unknown**: `1198` → `pattern1+0xEE bit1`, which **IS already
present in Rhea's shipped entry** (another case of an escort member's flag
silently mixed into her blob, same pattern as the already-confirmed B/C
death flags).

**A second, separate `SetTeamType` site exists in `m13_01_00_00` (Tomb of
the Giants) event `50`**, the map's own init dispatcher: it sets Knights B
(`6091`) and C (`6101`) to `HostileAlly` seemingly unconditionally at every
load of that map (only gated by the standard "already initialized, don't
redo" `SkipLinesIfFlagState` re-entry guard, not by anything resembling a
fresh betrayal check). **Interpretation, not fully certain**: either (a)
their team TYPE is simply a fixed classification re-applied at every map
load regardless of story state, with actual hostile BEHAVIOR toward the
player gated separately (by AI/ESD, not re-checked here), or (b) by the time
the player has physically reached this deeper map, the group's fate is
already narratively settled one way or another and this is just
re-asserting consistency. Not resolved this session — if the editor needs
to know definitively "are they ACTUALLY attacking the player right now" vs.
"are they merely capable of it," this would need live-game verification or
tracing their ESD/AI script directly (out of scope this session).

**Rhea's Undead-Parish instance (`6072`) also appears in a `SetTeamType`
call — but it's unrelated to betrayal**: `common.emevd.dcx` event `770`
(the already-known NG+-cycle-reset event from Session N+13) sets her back
to team `Ally` (8) — a baseline reset on NG+ transition, not a quest-stage
mechanic. Not relevant to the hostility question, noted only so it isn't
mistaken for a second betrayal trigger if re-found later.

**Practical implication for the editor**: "are the paladins hostile right
now" is NOT a single flag to toggle — it's really "has the group's shared
attacked/damaged condition ever fired," tracked individually per living
member via these 4 new alert flags (`1176`/`1197`/`1213`/`1223`), layered on
top of (but distinct from) each member's own death flag. Resetting a
"betrayal" state would need to clear whichever of these 4 alert flags are
set, not just revive whoever died.

## Confirmed flags (CODE-CONFIRMED — found via the project's standard
regular-NPC death-template scan, `C:\gh\scripts\scan_death_templates_v2.py`,
then exact-matched against her already-shipped bits)

| Field | Flag | Offset | Bit | Status |
|---|---|---|---|---|
| Rhea exits/dies — Undead Parish instance | `1181` | `0xE8` | 2 | **CONFIRMED (code)** — exact match on shipped entry |
| Rhea exits/dies — connecting-corridor instance | `1177` | `0xE8` | 6 | **CONFIRMED (code)** — exact match (appears twice in shipped entry) |
| Rhea exits/dies — Tomb of the Giants instance | `1174` | `0xE9` | 1 | **CONFIRMED (code)** — exact match |
| Thorolund Knight B dies | `1214` | `0xEC` | 1 | **CONFIRMED (code)** — exact match (appears twice in shipped entry) |
| Thorolund Knight C dies | `1224` | `0xF2` | 7 | **CONFIRMED (code)** — exact match (appears twice in shipped entry) |

All 5 are region-0 fast-path flags (no subbank `k` needed) — same decode
formula as every other regular-NPC death flag in this project.

**Important nuance**: these are generic "this specific map-instance's entity
died" flags from the standard engine-wide death template — NOT necessarily
the same thing as "betrayed and killed by her own knights" specifically. The
template fires on ANY death (monster, knight betrayal, or otherwise) for
that instance. If the editor needs to distinguish *how* she died (to decide
whether reviving her should also neutralize/reset the knights), that
specific branch was not found this session — see Open Items.

## Quest-dialogue milestone flags (found via Talk ESD, partially pinned down)

Her Talk ESD (`m10_01_00_00.talkesdbnd.dcx` talk `101607`,
`m13_01_00_00.talkesdbnd.dcx` talk `131607`) sets many `71XXXXXX`-style
region-7 flags — the same per-NPC "quest milestone" numbering scheme already
established project-wide (e.g. Andre's `711000xx` cluster). These decode
into two distinct clusters by `(area, group)`:

### Cluster 1: `region=7, area=10, group=2` — candidate `k=3` (moderately confident)

Found by brute-forcing `k` against her shipped bits: 2 of 9 flags in this
cluster land exactly on already-shipped bits, AND all 9 decode to a tight,
sequential pair of adjacent bytes (`0x1225B`/`0x1225C`) — the same
"one bit per dialogue line" clustering pattern seen elsewhere in this
project (e.g. Andre's `711000xx` flags), which independently supports `k=3`
being correct beyond just the 2 direct hits.

| Flag | Offset | Bit | Shipped? |
|---|---|---|---|
| `71020080` | `0x1225C` | 7 | no |
| `71020088` | `0x1225B` | 7 | no |
| `71020089` | `0x1225B` | 6 | no |
| `71020081` | `0x1225C` | 6 | **yes, exact match** |
| `71020082` | `0x1225C` | 5 | **yes, exact match** |
| `71020083` | `0x1225C` | 4 | no |
| `71020090` | `0x1225B` | 5 | no |
| `71020084` | `0x1225C` | 3 | no |
| `71020085` | `0x1225C` | 2 | no |

New `(region=7, area=10, group=2) → k=3` mapping — add to the project's
k-table alongside the ones in `boss-flags.md`.

### Cluster 2: `region=7, area=13, group=1` — k **NOT FOUND**, fully OPEN

`71310000/01/02/03/07/08` (from her Tomb-of-the-Giants dialogue) and
`71310043/44/45/50/51` (also referenced from her EARLIER Undead-Parish
dialogue — same quest-milestone space, tracked ahead of time) all decode to
this `(area=13, group=1)` pair. **No `k` value 0–29 landed any of them on
an already-shipped bit** — either her shipped entry simply doesn't track
any of these specific milestones (plausible — the manual 2-run diff method
is unlikely to have caught every fine dialogue flag), or the real `k` is
outside the range checked. **This is the main open item if anyone wants
her exact late-game/capture dialogue states decoded.**

## Dependencies / stage-graph (from the data above + the flags' own call sites)

```
Rhea present (Undead Parish, entity 6072)
    ↓ escorted journey progresses (she relocates between maps)
Rhea + Knights A(6080)/B(6090)/C(6100) present together (corridor, m10_02)
    │
    ├─ player never attacks/damages any of the 4 group members
    │     → group stays team "Ally", journey continues normally
    │
    └─ player attacks OR damages (>10% HP) ANY ONE of the 4 members
          → ALL 4 flip to team "HostileAlly" together (event 11020501)
          → each non-dead member's own "alerted" flag sets (1176/1197/1213/1223)
          → group becomes actively hostile to the player (this IS the real
            "betrayal" — it's player-triggered, not a scripted knights-vs-
            Rhea cutscene the way the original ask assumed)
    ↓
Rhea + Knights B(6091)/C(6101) relocate to Tomb of the Giants (m13_01)
    │  (Knight A does not get a further instance here)
    ├─ whichever members are still alive get re-initialized, team re-set to
    │   HostileAlly again at this map's load (exact trigger for THIS specific
    │   re-assertion not fully resolved — see Aggro section above)
    ├─ group members killed (in retaliation, or by a monster) → their own
    │   death flags set (1174 Rhea / 1214 KnightB / 1224 KnightC / 1198 KnightA)
    └─ Rhea reaches the end of her questline alive if never provoked
         → end-state/reward flag not traced this session
```

**For the editor's "revive/kill/roll back" feature**: reviving Rhea cleanly
most likely means clearing `0xE8 bit2` AND `0xE8 bit6` AND `0xE9 bit1`
together (all three of her map-instances' exit/death flags) rather than just
one — since it's not yet confirmed which instance's flag the game actually
consults at any given point in a save (may depend on which map she was last
active in). Clearing only one could leave her in an inconsistent state.
**Not yet verified in-game — treat as the most-likely approach, not a
certainty, until tested.**

## Open items (not resolved this session)

1. **`(region=7, area=13, group=1)`'s real `k`** — not found; her late-game
   capture/fate-branch dialogue flags remain fully undeciphered. Highest-value
   next step if this questline is revisited.
2. **Partially resolved**: the group-hostility TRIGGER is now known exactly
   (see Aggro section — player attacks/damages any of the 4 members → all 4
   flip hostile). What's still open: the standard death template itself
   doesn't distinguish "died while hostile to the group" vs "died to an
   unrelated monster" — both just set the same per-instance death flag. If
   the editor wants to show "died via betrayal" specifically (as opposed to
   merely "is dead"), check whether the member's own alert flag
   (1176/1197/1213/1223) is also set at time of death — not verified this
   session, but should work in principle since those flags persist once set.
3. **Which of her 3 instance flags the game actually reads at save-load
   time** was not determined — i.e. whether clearing just one is sufficient
   for a "revive" action, or all three are needed together. Needs either
   more EMEVD tracing (what checks these flags downstream) or an in-game
   before/after test with the live watcher.
4. The remaining ~80 raw bits in her shipped entry (`0xB9`, `0xEB`, `0xED`,
   `0xEE`, `0xF93`, `0x1490`, `0x1494`, `0x1497`, `0x13657`, `0x13B53/54`,
   `0x16D8E`, `0x16E30/31`, `0x16E6E`, `0x16E76`, `0x16E80/81/82`, `0x2D94/95`,
   `0x16D87`, `0x16E02`, `0x26/27`, `0xAC/AD`, `0x12D7-0x12E6` cluster,
   `0xF9D`, plus the duplicate entries already noted) were **not individually
   traced this session** — some are likely more dialogue milestones from the
   untraced `area13/group1` cluster above, some may be noise from the
   original manual-diff collection method. Not claiming any of them are
   wrong, just genuinely unexamined.
