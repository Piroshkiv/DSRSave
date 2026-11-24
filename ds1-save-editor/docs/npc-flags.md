# DS1R Regular-NPC Death Flags — Consolidated Reference

Companion doc to `boss-flags.md`, covering **regular (non-boss) NPCs** found via
the project's two generic EMEVD death-handler templates (Template A:
health-ratio watch; Template B: `IfCharacterDeathState` check). Source scan:
`C:\gh\scripts\scan_death_templates_v2.py` → `C:\gh\logs\scan_death_templates_v2.log`
(131 raw `character_id → death_flag_id` pairs across 17 maps). Every flag found
this way is in the `0-9999` range (region 0, "fast path") and decodes to
`pattern1+0xXXXX bitY` with **zero ambiguity** — no subbank `k` lookup needed
(see `boss-flags.md` for the formula).

**Coverage caveat**: this only catches NPCs using the two known generic death
templates. It will NOT include any NPC with a custom/quest-specific death
mechanism (same class of exception as Gwyndolin/Artorias in `boss-flags.md`),
and may miss NPCs placed via `MSB.dummy_characters` rather than
`MSB.characters` (not checked this pass — see Open Items).

## ⚠️ Critical correction to existing project history: "Andre, entity 6001, flag 1005" was Solaire all along

Every earlier session in this project's memory (`project_ds1_emevd_parsing.md`
sessions N+13 through N+15) that demonstrated the regular-NPC death-flag
mechanism used **entity `6001` in `m10_01_00_00`, flag `1005`** as its running
example and called it "Andre." **This was a misidentification, confirmed two
independent ways:**

1. `NpcParam` row `6000` (the stat/behavior template entity `6001` uses)
   has `Name = "太陽の騎士…"` ("Knight of the Sun") — **this is Solaire's own
   dev-internal name**, not Andre's.
2. Decoding flag `1005` gives `pattern1+0xD6 bit2` — this is **exactly** one
   of the already-shipped bits on `"Solaire of Astora"` in the real
   `npc_data.json`, and does **not** appear anywhere in the shipped
   `"Andre of Astora (blackmish)"` entry.

**The real Andre is a separate entity, `6190`** (same map, model `c2640` —
a unique model, not the shared generic human skeleton), internal name
literally `"城下１・後　鍛冶屋アンドレ"` ("Undead Burg 1, later — Blacksmith
Andre"). His real death flag is `1322` → `pattern1+0xFE bit5` — **exactly**
the first bit on the already-shipped `"Andre of Astora (blackmish)"` entry.

**The MECHANISM found in those earlier sessions (health-ratio-watch →
`DropMandatoryTreasure` → `SetFlagRangeState` → `SetFlagState`, the
"Template A" death handler) is still 100% correct and reusable** — only the
specific example character's NAME was wrong. Nothing needs to be re-derived,
just relabeled: that whole mechanistic breakthrough was actually demonstrated
on Solaire, not Andre.

## Methodology note: don't trust `NpcParam.Name` alone for `c0000`-model entries

`c0000` is DS1's shared generic human skeleton, reused by dozens of distinct
named NPCs (differentiated by equipment/Talk-ESD, not by model). Its
underlying `NpcParam` row's internal Japanese name can be a **leftover/reused
label that does NOT describe the actual story character occupying a given
map placement** (proven above: row `6000`'s label is Solaire's, but was
reused for Oswald's own placement in one example found this session — see
`Oswald of Carim` below, labeled `"ドラゴンの神官"` "Dragon Priest" internally
but empirically confirmed via flag-match to be Oswald). **The reliable
identification method, used throughout this doc, is matching a flag's
*decoded byte+bit* against what's already shipped in `npc_data.json`** — this
is strictly more trustworthy than the internal name lookup. Where no shipped
match exists, names below are the internal label, explicitly flagged as
unverified.

## Confirmed matches — already-shipped NPC, mechanism now code-traced

These 73 (of 131) raw log entries land exactly on a bit already present in
the real `npc_data.json`. This is a confirmation/provenance pass, not new
data — but it's the first time each of these has been traced to its actual
EMEVD write site.

| NPC (shipped name) | entity_id(s) | death_flag(s) | decoded |
|---|---|---|---|
| Solaire of Astora | 6001 (m10_01), 6002 (m14_01), 6003 (m15_01) | 1005 | `0xD6` bit2 — same global flag reused at all 3 of his story locations |
| Andre of Astora (blackmish) | 6190 (m10_01) | 1322 | `0xFE` bit5 |
| Laurentius (Pyromancer) | 6130 (m10_00), 6131 (m10_02), 6132 (m14_00) | 1254 | `0xEF` bit1 |
| Griggs of Vinheim | 6040 (m10_01), 6041 (m10_02), 6043 (m15_00) | 1115 | `0xE0` bit4 |
| Reah of Thorolund and Paladine | 6072/6070/6071/6073, 6090/6091, 6100/6101 (several maps) | 1181, 1177, 1174, 1214, 1224 | `0xE8` bit2/bit6, `0xE9` bit1, `0xEC` bit1, `0xF2` bit7 |
| Undead Male Merchant | 6230 (m10_01) | 1402 | `0x104` bit5 |
| Knight Lautrec of Carim (CORRECTED 2026-11-13: this whole row is Lautrec only, not a Patches/Lautrec pair) | 6300 (m10_01, Parish cell), 6301 (m10_02, Firelink), 6302 (m15_01, Anor Londo) | 1575 | `0x117` bit0 — one character, 3 real locations, same shared flag (Solaire-style pattern), NOT a "mutually exclusive pair" with Patches. Hostile flag `1574`. Trusty Patches' real identity is `6320/6321/6322` with death flag `1628` — see the corrected "Graveyard's Coward Patches" row below; that row IS the real Patches, this row never was. |
| Oswald of Carim | 6370 (m10_01) | 1702 | `0x127` bit1 — internal label is a reused "Dragon Priest" name, see methodology note |
| Big Hat Logan | 6031/6032/6033 (m10_02/m17_00) | 1097 | `0xE2` bit6 |
| Anastacia of Astora (fire keeper) | 6060 (m10_02) | 1146 | `0xE4` bit5 |
| Ingward (Keeper of Seal) | 6180/6181 (m10_02/m16_00) | 1315, 1312 | `0xF7` bit4, `0xF7` bit7 |
| Undead Female Merchant | 6240 (m10_02) | 1412 | `0x103` bit3 |
| Crestfallen Warrior | 6270/6271 (m10_02/m16_00) | 1462 | `0x10D` bit1 |
| Siegmeyer of Catarina | 6280/6281/6282/6283/6286/6287 (several maps) | 1513, 1494 | `0x116` bit6, `0x111` bit1 |
| Dusk of Oolacile (Revive golem) | 6050/6051 (m12_00) | 1125 | `0xDF` bit2 |
| Shiva of the East and Bodyguard | 6310/6311/6380/6420/6421 (m12_00/m14_00) | 1712, 1604, 1764 | `0x12D` bit7, `0x11B` bit3, `0x12F` bit3 |
| Alvina (cat) | 6380 (m12_00) | 1711 | `0x12E` bit0 |
| Hawkeye Gough | 6720 (m12_01) | 1823, 1821 | `0x138` bit0, `0x138` bit2 |
| Marvellous Chester | 6730 (m12_01) | 1842 | `0x13D` bit5 |
| Elizabeth (Mushroom) / Dusk of Oolacile | 6750 (m12_01) | 1872 | `0x141` bit7 — shared bit |
| Lord's Blade Ciaran | 6740 (m12_01) | 1864 | `0x142` bit7 — matches the independently-found value from `boss-flags.md` |
| Vamos (skeleton blackmish) | 6200 (m13_00) | 1342 | `0xFC` bit1 |
| Quelaag's Sister/The Fair Lady (fire keeper) | 1400700 (m14_00) | 1272 | `0xF4` bit7 |
| Eingyi | 6160 (m14_00) | 1284 | `0xF3` bit3 |
| Quelana of Izalith | 6170 (m14_00) | 1295 | `0xFA` bit0 |
| Darkmoon Knightess (fire keeper) | 6010 (m15_01) | 1034 | `0xDA` bit5 |
| Gwynevere (Princess of Sunlight) | 1510600 (m15_01) | 1232 | `0xF1` bit7 — this is Gwyndolin's talkable disguise form, see `boss-flags.md` |
| Dark Sun Gwyndolin (boss) | 1510650 (m15_01) | 1242 | `0xF0` bit5 — matches `boss-flags.md` exactly |
| Giant Blacksmith | 6210 (m15_01) | 1362 | `0x101` bit5 |
| Rickert of Vinheim (blackmish) | 6220 (m16_00) | 1382 | `0xFF` bit1 |

## Candidate new NPCs — not currently in `npc_data.json`, worth adding

| Internal label (JP) | Entity ID(s) / map(s) | Decoded flag(s) | Confidence |
|---|---|---|---|
| `たまねぎ騎士の娘` ("Onion Knight's Daughter" — "Onion Knight" is Siegmeyer's own well-known dev nickname) | 6290 (m13_02), 6291 (m17_00), 6292 (m10_02) — same flag across 3 maps, a real traveling NPC pattern | `1548` → `0x11A` bit3 (+ companion `1541`→`0x113`bit2, `1542`→`0x113`bit1 in m17_00 only) | **CONFIRMED real (2026-11-13): this is Sieglinde**, Siegmeyer's actual daughter in DS1's English localization — not cut/unknown. Death flag `1548`, hostile `1547`, personal range `[1540,1569]`, 3 real map placements. |
| `心折れた商人` ("Crestfallen/Broken-hearted Merchant") | 6250 (m15_00) | `1422` → `0x10A` bit1 | **CONFIRMED real (2026-11-13)**: a distinct 3rd merchant type at Sen's Fortress, death `1422`, hostile `1421`. Not the same entity as "Crestfallen Warrior." |
| `騎士オストラ` / `騎士オストラ（亡者）` ("Knight Ostra" / "Knight Ostra (Hollow)") | 6023/6024 (`m18_01` — **CORRECTED 2026-11-13: this is the Undead Asylum revisit, NOT Oolacile Township DLC** (`m18_01_00_00` = `constants.UNDEAD_ASYLUM`; DLC is `m12_01`/`constants.OOLACILE`) | `1073` → `0xDD` bit6, `1062` → `0xD7` bit1 | **CONFIRMED real** (2026-11-13, direct EMEVD read): two distinct forms, 6023 (normal, death flag 1073) and 6024 (Hollow variant, hostile 1061 + death 1062), same personal range `[1060,1074]`. Still uses the generic `c0000` model; not in the shipped `npc_data.json`. |
| `墓地の卑怯者パッチ　墓地1`/`墓地2` ("Graveyard's Coward Patches") | 6320 (m13_00, Catacombs), 6321 (m13_01, Tomb of Giants), **+ a 3rd real body not in this doc's original scan: 6322 (m10_02, Firelink disguise)** | `1621`/`1624` are personal-range MILESTONE flags, NOT separate death bits | **CORRECTED 2026-11-13, CONFIRMED real via direct EMEVD read**: this row (6320/6321/6322) IS the real Trusty Patches — the "6300" entity in the main table above is NOT him, it's Lautrec. Patches' real death flag is `1628` (same across all 3 locations, Solaire-style shared flag), hostile `1627`, personal range `[1620,1631]`. `1621` is a Catacombs-only milestone, `1623`/`1624`/`1625` are Tomb-of-Giants-only milestones, `1626` is a Firelink-only milestone. |
| `地の王の探索者（フラムト）` / `（カアス）` ("Seeker of the Earth-King (Framt / Kaathe?)") | 6330/6331 (m10_02/m18_00), 6340/6341 (m16_00/m18_00) | `1643/1644/1649` → `0x126`/`0x125`, `1672/1673/1674/1678` → `0x12A` | **LOW/UNCERTAIN** — "フラムト"/"カアス" read like the Primordial Serpents Frampt/Kaathe, but those are immortal lore NPCs not normally "killed." Could be an unrelated enemy reusing the name as a dev codename, or DLC-era cut content. Needs clarification before treating as real. |

## Open items (not resolved this session)

1. **`m11_00_00_00` (The Depths) cluster**: entities `11105210`–`11105213`, each with 4 distinct flags (`1102020/1102030/1102040/1102050`) — **no corresponding `MSBCharacter` found** (checked `msb.characters` only, NOT `msb.dummy_characters` — that's the likely next place to look). Could be trap/trigger dummies rather than real NPCs.
2. **`m14_00_00_00` entity `1400500`**, flags `11405301`–`11405304` — these are **region 1** (≥10,000,000), need a validated subbank `k` for whatever `(area, group)` they decode to; not resolved this session (same class of work as `boss-flags.md`'s `k`-table).
3. **Entity `6006` in `m14_01_00_00`** (flag `1012` → `0xD5 bit3`) — no MSB match found either; per `project_ds1_emevd_parsing.md` Session N+15, this ID was previously traced as "a mundane enemy sharing Quelaag's map," consistent with it not being a real named NPC — low priority.
4. This pass did not check `msb.dummy_characters` for ANY map — doing so might resolve items 1 and 3 above, and could reveal additional NPCs this scan missed entirely.

## Scripts (persistent, reusable)

- `C:\gh\scripts\resolve_npc_names.py` — resolves every scan hit's `NpcParam` name (JP + English via `MSGDirectory.NPCNames`) through the MSB `entity_id → character_id` mapping. **Remember the methodology caveat above before trusting its `name_en`/`name_jp` output blindly.**
- `C:\gh\scripts\decode_and_match_148.py` — decodes every scan hit to `pattern1+0xXXXX bitY` and cross-matches against the real, current `npc_data.json`. **This is the authoritative identification method used for the "Confirmed matches" table above** — prefer it over name-based resolution.
- `C:\gh\scripts\verify_andre_vs_solaire.py` — the targeted check that caught the Andre/Solaire mixup; reusable pattern for spot-checking any other suspicious identification.
