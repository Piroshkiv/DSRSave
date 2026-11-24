# DS1R Merchant/Blacksmith NPCs — Flag Reference

Companion to `boss-flags.md`/`npc-flags.md`. Covers: Domhnall of Zena, Vamos
(skeleton blacksmith), Giant Blacksmith, Undead Male Merchant, Undead Female
Merchant. Same status legend as `boss-flags.md` (CONFIRMED (code) /
CANDIDATE / SUSPECT FALSE POSITIVE / OPEN).

**Headline: this cluster is mostly as simple as expected** (one real
"alive/dead" bit each, confirmed via the project's standard regular-NPC
death template), **but Domhnall is NOT simple** — his shop has over a dozen
individually flag-gated item unlocks, and his own "death" handling is wired
into a separate cross-area cleanup trigger, not just a plain kill flag.

## Identity (verified by exact decoded-flag match against the real, shipped `npc_data.json` — not by trusting `NpcParam`'s internal name, per the Session N+31 lesson)

| NPC | Entity ID | Home map |
|---|---|---|
| Giant Blacksmith | `6210` | `m15_01_00_00` (Anor Londo) |
| Vamos | `6200` | `m13_00_00_00` (Catacombs) |
| Undead Male Merchant | `6230` | `m10_01_00_00` (Undead Parish) |
| Undead Female Merchant | `6240` | `m10_02_00_00` |
| Domhnall of Zena | `6260` | `m10_00_00_00` (Lower Undead Burg — not the Catacombs, despite that being a common assumption) |

## Alive/dead flags — all CONFIRMED (code), standard Template-A death handler

| NPC | Offset | Bit | Flag ID | Event |
|---|---|---|---|---|
| Giant Blacksmith | `0x101` | 5 | `1362` | `11510520` |
| Vamos | `0xFC` | 1 | `1342` | `11300520` |
| Undead Male Merchant | `0x104` | 5 | `1402` | `11010520` |
| Undead Female Merchant | `0x103` | 5 | `1412` | `11020530` |
| Domhnall of Zena | `0x108` | 4 | `1435` | `11000533` (a shorter 2-param variant of the standard template: `(character, death_flag)` only, no explicit range args — body: health-watch → `DropMandatoryTreasure` → literal `SetFlagState(1434, 0)` [hardcoded, not a parameter] → `SetFlagState(<death_flag>, 1)`) |

All five match their already-shipped first bit exactly — no bugs found here.

## Domhnall's extra complexity (not shared by the other four)

His map's dispatcher (`m10_00_00_00` event `50`) also calls a SEPARATE event,
`11000532`, with him (`6260`) as `X0`:
```
(2000,0,[0, 11000532, 6260, 1430, 1459, 1431])
```
Unlike the standard template, `11000532`'s body checks flag `1434` **and**
`1435` **and** `1430`, **and two unrelated cross-area flags**
(`11010700` — decodes to area=10/group=1 — and `11400200` — area=14/group=0)
before resetting range `[1430,1459]`, setting flag `1431`, and disabling
`X0` (Domhnall himself). In plain terms: **once Domhnall's own
death/resolution flags are set AND some other area's progress flags are
also set, he gets despawned/disabled a second time and a separate flag
(`1431` → `pattern1+0x109 bit0`) gets marked.** Not currently in his shipped
`npc_data.json` bits. **OPEN** — not fully chased down this session (what
exactly `11010700`/`11400200` represent wasn't traced); flag for a future
session if his full disappearance/relocation behavior needs modeling, not
just "is he dead."

## Domhnall's shop — much richer than previously documented

`ShopLineupParam` rows **1550–1569** are his shop stock. Already known from
`boss-flags.md`: 4 of these rows (his shipped `0x58E7`/`0x58E8`/`0x58E9`/
`0x58F2` bits) sell Gwyndolin's armor set. **New finding: EVERY row in his
1550–1569 block has its own individual `QuantityFlag`** (`11807020` through
`11807240`, sequential, one per row) — i.e. his entire shop inventory is
item-by-item flag-gated, not just the Gwyndolin set. These almost certainly
correspond to other bosses'/areas' kill/milestone flags (same `area=18,
group=0, k=16` subbank already validated in `boss-flags.md`), one unlock
per defeated boss whose soul/item he sells. **Not individually resolved to
specific bosses this session** (would need the same per-boss decode pass
already done for the Gwyndolin set) — full raw dump at
`C:\gh\logs\merchants_shoplineup_flags.log` if resumed. No other NPC in
this cluster has anywhere near this many conditional shop rows — Vamos,
Giant Blacksmith, and both generic merchants' shop rows were NOT individually
checked this session (time-boxed); worth a follow-up if their full stock
lists matter.

## Aggro/hostility — checked, genuine negative result

Searched every `.emevd.dcx` in the game for a `(2004,2) SetTeamType`
instruction targeting any of these 5 entity IDs. **Exactly one hit, and
it's not NPC-specific hostility:** `common.emevd.dcx` event `770` sets
`SetTeamType(6230, 8)` — but that's the same already-known generic
NG+-cycle-transition reset event documented in `project_ds1_emevd_parsing.md`
Session N+13 (it resets team type for 6 character IDs together as part of a
bulk area-flag reset, not a per-NPC "became hostile after being attacked"
mechanic). **No dedicated, persistent "this merchant/blacksmith turned
hostile" `SetTeamType` write exists anywhere in the game for any of these
5 entities.** This strongly suggests DS1 handles "player attacked a
friendly shop NPC" purely as a **runtime-only team flip** (reverts on
reload) rather than a persisted save flag — consistent with the well-known
in-game behavior that most non-essential shopkeepers return to "friendly"
after a reload unless actually killed (which IS covered by the death flag
above). **Nothing to add to `npc_data.json` for aggro/hostility tracking —
there is no such persisted flag to track.**

**Side note, out of scope but worth flagging**: `project_ds1_emevd_parsing.md`
Session N+13 labeled the 6 characters in event `770` as "6 blacksmiths"
based on them sharing an ambient hammering-animation event. Entity `6230`
is now confirmed (via exact shipped-bit match, this session) to actually be
the **Undead Male Merchant**, not a blacksmith. The other 5 IDs in that
event (`6001`/`6040`/`6072`/`6190`/`6300` — note `6001` is ALSO already
known to be mislabeled, per Session N+31: that's Solaire, not Andre) were
not re-verified this session — the "6 blacksmiths" characterization in that
old note should not be trusted at face value for any of them without the
same exact-bit-match check used throughout this doc.

## Giant Blacksmith / Undead Male+Female Merchant's other shipped bits

Not traced this session (time-boxed, and all three NPCs' remaining bits are
in byte ranges — `0x4695`/`0x16D73`/`0x16D74`/`0x16DA8`/`0xF95`/`0x1493` —
already documented elsewhere in this project as **shared, non-NPC-specific
clusters** reused across dozens of entries: `0x4695`-ish is a common
generic byte seen on Solaire, Siegmeyer, and others; `~0x16D60-0x16E00` is
the already-known shared "quest counter" window first flagged in
`project_ds1_npc_alive_dead.md`. Treat these as **OPEN but low-priority** —
they're very unlikely to be unique per-NPC milestones worth individually
reverse-engineering for a revive/kill tool, since the one bit that matters
(alive/dead) is already fully confirmed above.

## Practical upshot for the editor rewrite

- **Revive/kill for all 5 NPCs**: use the single confirmed flag per NPC above — simple, no dependencies on other NPCs found.
- **Domhnall specifically**: the simple kill flag is solid, but if the editor ever wants to fully "undo" his disappearance/relocation, the separate `1431`/`0x109 bit0` + cross-area-flag mechanism needs more work first (flagged OPEN above).
- **Don't build an "aggro/hostility" field for any of these 5** — confirmed no such persisted flag exists.
- **Domhnall's shop stock is flag-gated per-item** — if the editor ever wants a "unlock everything in Domhnall's shop" button, that's the `11807020`-`11807240` flag range (`pattern1+0x58xx` family, `k=16`), not a single toggle.
