# DS1R Quest Flags — Lautrec, Anastacia, Crestfallen Warrior

All three are Firelink Shrine NPCs. Real map ID: **`m10_02_00_00`** (resolved via
`soulstruct.darksouls1r.maps.constants.FIRELINK_SHRINE` — not `m10_00`, which is
Undead Burg). Status legend matches `boss-flags.md`: CONFIRMED (code) /
CANDIDATE / UNEXPLAINED / OPEN.

## Identities (verified by exact decoded-flag match against shipped bits, per the Session N+31 rule — never trust a raw `NpcParam.Name` alone)

| NPC | character_id | entity_id | talk_id | NpcParam internal name |
|---|---|---|---|---|
| Anastacia of Astora (Fire Keeper) | `275000` | `6060` | `0` (silent — no ESD dialogue at all) | `灰色の聖女` ("Ashen/Grey Saint") |
| Knight Lautrec of Carim | `6300` | `6301` | `102630` | `抱かれ騎士ロートレク` ("Caged Knight Lautrec") |
| Crestfallen Warrior | `6270` | `6270` | `102627` | `心折れた戦士` ("Broken-hearted Warrior") |

Anastacia has **no Talk ESD at all** — she's interacted with via the
item-gift mechanic, not dialogue. Her state transitions are purely
EMEVD-driven.

## Confirmed flags (exact match, EMEVD-traced via the standard Template-A/B death handlers in event 50's dispatcher)

| NPC | Flag ID | Offset | Bit | Status | Notes |
|---|---|---|---|---|---|
| Anastacia — death | `1146` | `0xE4` | 5 | CONFIRMED (code) | Template B (`IfCharacterDeathState`), event `11020556`. **Gated by two preconditions**: flag `1141` (own range-floor, not yet in shipped list) AND flag `810` (`0xB9 bit5` — not matched to any shipped bit, plausible "Lautrec has been freed" cross-check; see Dependencies below). |
| Crestfallen — combat death | `1462` | `0x10D` | 1 | CONFIRMED (code) | Standard Template A (health-ratio watch), event `11020530`. |
| Crestfallen — range-floor flag | `1460` | `0x10D` | 3 | CONFIRMED (code) | Already shipped with `reverse:false`; this is literally the lower bound of his `SetFlagRangeState(1460,1464,...)` range. |
| Lautrec — freed/active | `1575` | `0x117` | 0 | CONFIRMED (code) | Template A, event `11020530`, caller args `[6301,1570,1599,1575]`. |
| Lautrec — second state bit | `1572` | `0x117` | 3 | CONFIRMED (code) | Matches his second shipped `0x117 bit3` entry; set via event `11020588`'s multi-branch dispatcher (see below). |

## Aggro / hostility — CONFIRMED (code), corrects the earlier negative result below

**Initial search (plain `SetTeamType`/`SetTeamTypeAndExitStandbyAnimation` with a literal character-ID argument) came back empty — but that was the wrong search shape.** The real mechanism is a **generic, per-map "turn hostile after being attacked" template**, event `11020510` in `m10_02_00_00.emevd.dcx` (the same shape repeats once per map, e.g. `11010510`/`11200510`/etc. — a project-wide engine feature, not NPC-specific). Its body: two `IfHealthRatioComparison` checks (one against a float threshold, one against exactly 0) OR'd with an `IsAttackedBySomeone`-style timer check → `SetCharacterState(0,0)` (brief disable, i.e. a flinch/stagger) → gated by a shared global condition on flag `703` → `SetFlagState(X, 1)` (the per-NPC "has turned hostile" flag, passed in as a template parameter) → **`SetTeamType(0, 9)`** (team 9 = hostile) → return.

Found via its `RunEvent` callers in event 50 (map dispatcher), which pass each NPC's own flag as the 4th argument:

| NPC | Hostility flag | Offset | Bit | Status |
|---|---|---|---|---|
| Crestfallen Warrior | `1461` | `0x10D` | 2 | **CONFIRMED (code)** — `RunEvent([10, 11020510, 6270, 1461])`. This is the exact bit this doc's first draft had flagged as an unexplained "intermediate stage" — it's actually his hostility flag, not a quest-stage milestone. |
| Knight Lautrec of Carim | `1574` | `0x117` | 1 | **CONFIRMED (code)** — `RunEvent([13, 11020510, 6301, 1574])`. |
| Anastacia of Astora | — | — | **not present** | She is NOT wired into this template at all (no `RunEvent(...,11020510,6060,...)` call exists) — confirms she never fights back / can't go hostile, consistent with her lore (passive, simply killed). |

**Practical note**: neither `0x10D bit2` (Crestfallen) nor `0x117 bit1` (Lautrec) is in the currently-shipped `npc_data.json` — both are real, confirmed "is this NPC currently hostile toward the player" bits worth adding if the editor wants to expose/control aggro state, not just alive/dead/quest-stage.

## Other new / undocumented candidates found (not hostility-related, NOT currently in `npc_data.json`)

| NPC | Flag ID | Offset | Bit | What it looks like |
|---|---|---|---|---|
| Crestfallen — "vanished/gave up" | `1464` | `0x10C` | 7 | Set by event `11020577`, which ALSO calls `SetCharacterState(0, 0)` (disables him) — gated by two extra guard checks (`IfFlagState` on `1461` [his hostility flag, see above] and `1464` itself, plus an unidentified `(3,8)` packed condition and a reference to event-own flag `11020597`). Strong candidate for his late-game "disappears / goes fully hollow" branch, distinct from simple combat death — and now clearly linked to his hostility state as a precondition. |
| Lautrec — state-machine bits | `1571`/`1573` | `0x117` | 4/2 | Appear inside event `11020588`, a 3-way dispatcher that also does `SetRandomFlagInRange(11025120, 11025122, 1)` (picks one of 3 outcomes at random — purpose not fully decoded, possibly unrelated restocking/flavor logic sharing this event rather than Lautrec's own fate) and branches on `IfFlagState(4, 11020691)`. |
| Lautrec — state-machine bits | `1577`/`1578` | `0x11E` | 6/5 | Same dispatcher family, likely downstream relocation/outcome flags. |
| Anastacia — stage companion | `1141` | `0xE5` | 2 | Her own range-floor-adjacent flag (range `1140`–`1169`), not individually traced. |

**None of these remaining candidates have been in-game tested** — code-confirmed as real, active flags, but exact narrative meaning not fully pinned down. Recommend a live-watcher diff around each scenario (Crestfallen vanishing, Lautrec's various fates) before trusting them in the editor.

## Dependencies (the actual point of this doc)

- **Anastacia's death-check is explicitly gated by flag `810`** (`0xB9 bit5`), found as an `IfFlagState(257, 810)` precondition inside her own death-handler event `11020556`. This is concrete, code-level evidence of the cross-NPC dependency the user was worried about: **her death can't be correctly registered unless flag 810 is also in the right state.** Flag `810` was not matched to any of the 3 NPCs' own shipped bit lists — it may belong to Lautrec (a "freed from cage" marker, consistent with the fact that he must be freed before he can reach and kill her) or be a separate world-state flag. **If the editor ever needs to force-set Anastacia to "dead," flag 810 should be set too, or her death flag may not read correctly in-game — this was NOT verified live, treat as a real risk, not a confirmed requirement.**
- No dependency was found running the other direction (nothing in Lautrec's or Crestfallen's own events reads Anastacia's or each other's flags).
- **Rhea of Thorolund and her 3 escort knights are ALSO placed in this same map** (`m10_02`, entity `6070` = Rhea herself per internal name `白の聖女` "White Saint", escorts `6080`/`6090`/`6100`) — found incidentally while scanning for `SetTeamType` calls (see below). This is a different fork's scope (Rhea/Paladins questline) — flagging the entity IDs here in case useful, not developed further in this doc.

## Aggro / hostility — see the dedicated section above (corrected)

An initial literal-argument `SetTeamType` scan came back empty and was WRONG — see the "Aggro / hostility — CONFIRMED (code)" section earlier in this doc for the real mechanism (a generic per-map `11020510`-style template, found via its `RunEvent` callers, not via a direct literal scan). Kept this note here as a pointer so nobody re-runs the naive literal scan and concludes there's nothing to find.

Separately confirmed: `common.emevd.dcx` event `770` → `SetTeamType(6300, 8)` is the **already-documented generic NG+-cycle "blacksmith" team-type reset** (see `project_ds1_emevd_parsing.md` Session N+13), unrelated to hostility — just confirms Lautrec (`char_id 6300`) is in that generic reset cluster.

Incidental finding: Rhea (`6070`) and her 3 escorts (`6080`/`6090`/`6100`) get the SAME `11020510`-style hostility template (`SetTeamType(..., 9)`) in event `11020501` — relevant to the Rhea/Paladins questline, not this doc's scope, flagged for that fork's awareness.

## Open items

- Flag `810`'s owner/meaning (the Anastacia-death gate) — not resolved.
- The exact narrative meaning of Lautrec's `11020588` 3-way dispatcher and its random-range pick (`11025120-11025122`) — not resolved, may be unrelated logic sharing the event.
- Crestfallen's `(3,8)` packed condition in event `11020577` — not decoded (this is the same class of byte-packed-argument issue flagged in Session N+28's correction; don't assume its meaning from the raw monkeypatched dump alone).
- None of the new candidate flags above have been in-game verified.
