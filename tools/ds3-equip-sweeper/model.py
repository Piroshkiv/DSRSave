"""Python port of the editor's derived-value formulas (src/apps/ds3/lib/Character.ts).

Data comes from the same generated tables the editor uses:
  public/json/ds3_resist_data.json   (gen_ts.py; twin of resistData.ts)
  src/apps/ds3/lib/constants.ts      (VIGOR_TO_HP / ATTUNEMENT_TO_FP / ENDURANCE_TO_STAMINA)
so a mismatch against the live game is a mismatch of the editor's model.
"""
from __future__ import annotations

import json
import os
import re
import struct

import numpy as np

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ds1-save-editor'))
DATA = json.load(open(os.path.join(REPO, 'public', 'json', 'ds3_resist_data.json'), encoding='utf-8'))
_CONSTANTS = open(os.path.join(REPO, 'src', 'apps', 'ds3', 'lib', 'constants.ts'), encoding='utf-8').read()

STAT_ORDER = DATA['statOrder']                       # VIG ATN END VIT STR DEX INT FTH LCK
RESIST_TYPE_STAT = [3, 3, 2, 8, 0]                   # poison, toxic, bleed, curse, frost
TYPE_TO_SAVE_ORDER = [0, 2, 1, 3, 4]
EMBER_HP_RATE = 1.3
f32 = np.float32


def _table(name: str) -> dict:
    body = re.search(name + r'[^=]*=\s*\{(.*?)\};', _CONSTANTS, re.S).group(1)
    return {int(k): int(v) for k, v in re.findall(r'(\d+):\s*(\d+)', body)}


VIGOR_TO_HP = _table('VIGOR_TO_HP')
ATTUNEMENT_TO_FP = _table('ATTUNEMENT_TO_FP')
ENDURANCE_TO_STAMINA = _table('ENDURANCE_TO_STAMINA')


def _int_keys(d):
    return {int(k): v for k, v in d.items()}


PROTECTOR_RESIST = _int_keys(DATA['protectorResist'])
RING_RESIST_ADD = _int_keys(DATA['ringResistAdd'])
RING_STAT_BONUS = _int_keys(DATA['ringStatBonus'])
RING_VITAL_RATE = _int_keys(DATA['ringVitalRate'])
WEAPON_RESIST_ADD = _int_keys(DATA['weaponResistAdd'])


def graph(g: dict, x) -> np.float32:
    st, gr, adj = [f32(v) for v in g['stage']], [f32(v) for v in g['grow']], [f32(v) for v in g['adj']]
    x = f32(x)
    if st[4] <= x:
        x = st[4]
    if x <= 0:
        return gr[0]
    i = 0
    while i < 3 and x > st[i + 1]:
        i += 1
    width = f32(st[i + 1] - st[i])
    if adj[i] < 0:
        ratio = f32(1) - f32(np.power(f32((width - (x - st[i])) / width), f32(-adj[i])))
    else:
        ratio = f32(np.power(f32((x - st[i]) / width), adj[i]))
    v = f32(ratio * f32(gr[i + 1] - gr[i]) + gr[i])
    lo, hi = min(gr[i], gr[i + 1]), max(gr[i], gr[i + 1])
    return lo if v < lo else hi if v > hi else v


def effective_stats(stats: dict, rings: list) -> dict:
    out = {}
    for s, name in enumerate(STAT_ORDER):
        v = stats[name] + sum(RING_STAT_BONUS.get(r, [0] * 9)[s] for r in rings)
        out[name] = min(99, v)
    return out


def resist_max(stats: dict, armor: list, rings: list, weapons: list, active: list) -> list:
    """Save order: poison, bleed, toxic, curse, frost."""
    flat = [0] * 5

    def add(t):
        if t:
            for k in range(5):
                flat[k] += t[k]
    for a in armor:
        add(PROTECTOR_RESIST.get(a))
    for r in rings:
        add(RING_RESIST_ADD.get(r))
    for hand, slot in enumerate(active):
        if 0 <= slot < 3:
            w = weapons[slot * 2 + hand]
            add(WEAPON_RESIST_ADD.get(w - w % 100))
    eff = effective_stats(stats, rings)
    total = sum(eff.values())
    out = []
    for t in TYPE_TO_SAVE_ORDER:
        base = int(f32(graph(DATA['graphStat'][t], eff[STAT_ORDER[RESIST_TYPE_STAT[t]]])
                       + graph(DATA['graphStatSum'][t], total)))
        out.append(max(1, base + flat[t]))
    return out


def vitals(stats: dict, rings: list, ember: bool) -> dict:
    eff = effective_stats(stats, rings)
    base = [VIGOR_TO_HP[eff['VIG']], ATTUNEMENT_TO_FP[eff['ATN']], ENDURANCE_TO_STAMINA[eff['END']]]
    mx = []
    for k in range(3):
        rate = f32(1)
        for r in rings:
            if r in RING_VITAL_RATE:
                rate = f32(rate * f32(RING_VITAL_RATE[r][k]))
        v = f32(f32(base[k]) * rate)
        if k == 0 and ember:
            v = f32(v * f32(EMBER_HP_RATE))
        mx.append(int(v))
    return {'hpBase': base[0], 'fpBase': base[1], 'spBase': base[2],
            'hpMax': mx[0], 'fpMax': mx[1], 'spMax': mx[2]}


def predict(state: dict) -> dict:
    """Everything the editor derives, from a live.snapshot()-shaped state."""
    stats, rings = state['stats'], state['rings']
    out = {'effective': effective_stats(stats, rings),
           'level': sum(stats.values()) - 89,
           'resistMax': resist_max(stats, state['armor'], rings, state['weapons'], state['active'])}
    out.update(vitals(stats, rings, bool(state['ember'])))
    return out


def compare(state: dict) -> list:
    """[(field, predicted, actual)] for every field that differs."""
    p = predict(state)
    actual = {'effective': state['effective'], 'level': state['level'], 'resistMax': state['resistMax']}
    actual.update({k: state['vitals'][k] for k in ('hpBase', 'fpBase', 'spBase', 'hpMax', 'fpMax', 'spMax')})
    return [(k, p[k], actual[k]) for k in p if p[k] != actual[k]]
