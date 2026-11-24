# DS1R Quest Flags — Laurentius, Quelana, Eingyi, Alvina

Companion to `boss-flags.md`/`npc-flags.md`. Status legend: **CONFIRMED (code)** /
**CANDIDATE** / **UNEXPLAINED** (same convention as the other docs). All
offsets are `pattern1`-relative; `buffer_start = pattern1 + 0x53`.

## Identity (all verified via exact match against the real, shipped `npc_data.json`)

| NPC | Entity ID(s) | Map(s) | Talk ID(s) | Model |
|---|---|---|---|---|
| Laurentius (Pyromancer) | `6130` (Lower Burg), `6131` (relocated/"saved" instance), `6132` (Blighttown, hollowed) | `m10_00_00_00`, `m10_02_00_00`, `m14_00_00_00` | `100613`, `102613`, **`0`** (no talk — see below) | generic `c0000` |
| Quelana of Izalith | `6170` | `m14_00_00_00` (Quelaag's Domain is part of this map file) | `140617` | generic `c0000` |
| Eingyi | `6160` (`character_id=321001`) | `m14_00_00_00` | `140616` | unique model `c3210` (not generic — only one of these four with a real unique model) |
| Alvina (cat) | `6380` (`character_id=536100`) | `m12_00_00_00` (Darkroot Garden) | `120638` | unique model `c5361` |

## Core status flags — all 4 CONFIRMED (code), exact match to shipped bits

| NPC | Flag | Offset | Bit | Mechanism |
|---|---|---|---|---|
| Laurentius | `1254` | `0xEF` | 1 | Standard Template-A death handler (`RunEvent(11400520,[6132,1250,1259,1254])`), fired on his Blighttown entity `6132` |
| Quelana | `1295` | `0xFA` | 0 | Standard Template-A death handler (`RunEvent(11400520,[6170,1290,1309,1295])`) |
| Eingyi | `1284` | `0xF3` | 3 | Standard death handler on entity `6160` (not individually re-traced this session, but entity/flag pairing already confirmed exact-match in `npc-flags.md`) |
| Alvina | `1711` | `0x12E` | 0 | Standard death handler on entity `6380` |

**Alvina is in fact killable and tracked like any other NPC** — not a pure
dialogue fixture as hypothesized going in. She has a normal alive/dead flag
exactly like the others; no separate "covenant leader" mechanic was found
gating her presence.

## Laurentius — the real "goes hollow" mechanism (CONFIRMED, more mechanical than narrative)

**His Blighttown placement (`6132`) has `talk_id = 0` — he is NOT talkable in
that form at all.** This alone is strong, direct evidence for "hollowed =
silent," independent of any flag.

Event `50` (map-load dispatcher) in `m14_00_00_00.emevd.dcx`:
```
[8]  SkipLinesIfFlagState(257, 1257)              -- re-entry guard: skip the whole block below if flag 1257 already set
[9]  SetCharacterState(6132, 0)                   -- disabled by default
[10] SetTeamTypeAndExitStandbyAnimation(6132, 9)  -- team type 9 (hostile) assigned regardless of enable state
[11] RunEvent(0, 11400520, 6132, 1250, 1259, 1254) -- standard death-watch template -> flag 1254 (his main "dead" bit)
[12] RunEvent(0, 11400530, 6132, 1250, 1259, 1257) -- SAME shape, writes flag 1257 instead (this event's own "ran once" flag)
```
`SetCharacterState(6132, 0)` means this entity starts DISABLED at every map
load — something else (not captured in this pass; likely his `6130`/`6131`
instance's own talk ESD, checking whatever stage flag decides "player failed
to help him in time") must explicitly `SetCharacterState(6132, 1)` to make
the hollow form appear. **This specific enabling trigger was NOT traced this
session** — see Open Items.

**Practical takeaway: his hollow form is a literal separate map entity, not
a flag-driven transformation of the same NPC.** For a save-editor's "move
his stage" feature, moving Laurentius backward from "hollow" means disabling
`6132` and re-enabling `6130`/`6131` as appropriate — not just flipping a bit.

## Quelana — bonus finding: she has 4 additional stage-milestone flags beyond death

Same event-50 block (`m14_00_00_00`) also runs, for entity `6170`:
```
RunEvent(3, 11400510, 6170, 1294)                  -- single-arg variant, likely initial "met her" flag (1294)
RunEvent(0, 11400520, 6170, 1290, 1309, 1295)       -- death (already covered above)
RunEvent(0, 11400536, 6170, 1290, 1309, 1291)
RunEvent(0, 11400537, 6170, 1290, 1309, 1292)
RunEvent(0, 11400538, 6170, 1290, 1309, 1293)
RunEvent(0, 11400539, 6170, 1290, 1309, 1296)
```
Flags `1291`/`1292`/`1293`/`1296` all share her milestone range `[1290,1309]`
— by the project's established pattern (same range-reset-then-set shape used
for Andre/Solaire's non-death stage flags), these are very likely her
successive pyromancy-teaching unlocks, not yet individually matched to
specific spell unlocks this session. `1294` (the single-arg `11400510` call)
is likely "first met/talked to." **None of these 5 extra flags currently
appear in her shipped `npc_data.json` entry (only `0xFA bit0`/`bit4` are
shipped)** — decode them (region0, no k needed, trivial) and consider
whether any should be added for finer-grained quest-stage tracking.

## Aggro / hostility check (all 4, per explicit request)

Searched all four NPCs' home maps for `SetTeamTypeAndExitStandbyAnimation`
(category `2004`, index `44` — the real DS1R team-type setter, same
instruction family already used for Sif/Darkmoon Knightess in Sessions
N+27/N+28) referencing any of their entity IDs:

- **Laurentius (`6132`, Blighttown instance only): YES** — see above, team
  type `9` assigned unconditionally at map load (not flag-gated at the
  SetTeamType call itself; the gating is almost certainly "is this entity
  even enabled," per the open item above).
- **Quelana (`6170`), Eingyi (`6160`), Alvina (`6380`): NO SetTeamType call
  found anywhere in their home maps.** None of them have a scripted
  hostility/aggro mechanic — consistent with none of them being described as
  capable of turning hostile. (They can still become hostile via the
  player's own aggression triggering normal AI combat state, which is
  runtime-only and not save-persisted — not a flag/EventFlag question.)

## Open items, not resolved this session

1. **What exactly enables entity `6132`** (Laurentius's hollow Blighttown
   form) — not found this session, likely a `SetCharacterState(6132, 1)` in
   `6130`'s or `6131`'s own Talk ESD, gated on a timeout/stage-failure
   condition. Decode his talk ESDs' full condition set (not just the
   `SetFlagState` writes already dumped) to find it.
2. **The many per-dialogue-line flags found in all four ESD dumps**
   (`71XXXXXX`-pattern personal milestones, e.g. Laurentius's
   `71000000`-`71000022` across his 3 instances; Alvina's
   `71200035`-`71200048`) were found but NOT individually decoded/explained
   this session — they all decode cleanly (region0 fast path or a
   `k`-lookup already in the table) but doing so for ~60 individual flags
   was out of scope for this pass. Script `C:\gh\scripts\decode_flag_verify_n24.py`'s
   formula applies directly if anyone wants to enumerate them.
3. **The `11XXXXXX`-pattern flags found in the same dumps** (e.g.
   `11026102`, `11025021`, `11020103`, `11020602` in Laurentius's `m10_02`
   talk; `11406100`-`11406104`, `11405021`, `11400591`-`11400595` in the
   `m14_00` talks; `11205050`, `11206101`, `11200592`-`11200596` in Alvina's
   talk) are region1 flags whose `(area, group)` pairs are **NOT yet in this
   project's validated k-table** (these look like `area=10/group=2`,
   `area=14/group=5/6`, `area=12/group=5/6` — all new, untried pairs). A
   fresh k-search (same brute-force-against-a-known-anchor method used for
   the boss/Gwyndolin work) would be needed before these can be decoded to
   real byte/bit positions. **Caution**: a blind k brute-force across many
   maps' generic per-map flag patterns (e.g. `71XXX005/008/009/010/043/057`,
   `1XXXX580`) produced many FALSE positive matches this session before this
   was caught — these patterns repeat near-identically in nearly every map
   as generic ambient-NPC-chat/gift scaffolding, not NPC-specific. Don't
   trust a k found this way without a second independent confirmation (same
   rule already established for the boss-bit work).
4. Eingyi's own full talk-ESD condition/write dump was not done this session
   (only his death-template confirmation, already known from `npc-flags.md`)
   — his unique model (`c3210`) and his association with Quelana's
   Chaos-Servant-covenant area may be worth a dedicated look if the user
   wants his pyromancy-teaching stages mapped too.
