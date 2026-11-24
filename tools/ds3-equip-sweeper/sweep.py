"""Live sweep: drive the loaded character through many stat / armor / ring
combinations and compare what the game derives with what the editor's model
(model.py, same tables as Character.ts) predicts.

    python sweep.py [--steam-id 0110000131bf8025] [--slot 0] [--combos 40] [--saves 6] [--persist]

For every combination the comparison is done in memory: effective stats, level,
base and maximum HP / FP / stamina, and the five resist maxima read straight
from the resist module (no waiting for gauges to refill). A few combinations are
additionally forced to disk (ESC x2), decrypted and compared field by field with
both the memory state and the model; those slots are kept as .bin for the
TypeScript check.

The save is copied before anything is touched, and the character's stats and
equipment are put back and saved at the end.

Rings can only be changed through the game's equip routine, so ring
combinations are limited to rings the character owns. Ember cannot be toggled
from here (see live.py).
"""
from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import struct
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'ds3-stat-sweeper'))

import model
from live import Live, SLOT_RING, SLOT_ARMOR, STAT_ORDER
import input_save
import sl2

BARE = [900000, 901000, 902000, 903000]
# Rows below this are not player armor (NPC / placeholder rows with a 999 maximum
# durability). Poking their IDs under a real item makes the game judge the piece
# "at risk" (durability / max <= 0.3) and scale it by 0.7, so they are swept on
# their own, as a durability probe, not as part of the model check.
PLAYER_ARMOR_MIN = 10_000_000

# input_save.py prints Russian progress text; a redirected cp1252 stdout would
# raise in the middle of a run (it did, once, before the character was saved).
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
STABLE_KEYS = ('stats', 'effective', 'level', 'armor', 'rings', 'resistMax')


class Sweep:
    def __init__(self, args):
        self.args = args
        self.live = Live()
        self.records = []
        self.rng = random.Random(args.seed)
        self.save_path = os.path.join(os.environ['APPDATA'], 'DarkSoulsIII', args.steam_id, 'DS30000.sl2')
        self.out = os.path.join(HERE, 'out', time.strftime('%Y%m%d_%H%M%S'))
        os.makedirs(self.out, exist_ok=True)
        self.log = open(os.path.join(self.out, 'records.jsonl'), 'w', encoding='utf-8')

    def keep(self, rec):
        """Append a record and flush it to disk at once, so a crash loses nothing."""
        self.records.append(rec)
        self.log.write(json.dumps(rec) + chr(10))
        self.log.flush()

    # --- helpers --------------------------------------------------------------
    def settled(self, timeout=4.0):
        """Snapshot once the derived values stopped moving."""
        time.sleep(0.25)
        prev = self.live.snapshot()
        end = time.time() + timeout
        while time.time() < end:
            time.sleep(0.2)
            cur = self.live.snapshot()
            if all(cur[k] == prev[k] for k in STABLE_KEYS) and cur['vitals']['hpMax'] == prev['vitals']['hpMax']:
                return cur
            prev = cur
        return prev

    def record(self, phase, label, state=None):
        state = state or self.settled()
        diff = model.compare(state)
        late = None
        if diff:
            # tell a slow update apart from a wrong prediction: look again later
            late = [{'field': f, 'predicted': p, 'actual': a} for f, p, a in diff]
            time.sleep(1.5)
            state = self.settled()
            diff = model.compare(state)
        self.keep({'phase': phase, 'label': label, 'state': state, 'firstReadDiffered': late,
                             'predicted': model.predict(state),
                             'mismatches': [{'field': f, 'predicted': p, 'actual': a} for f, p, a in diff]})
        if diff:
            print(f'  MISMATCH [{phase}] {label}: {diff}')
        return state

    def set_stats(self, stats):
        for k in STAT_ORDER:
            self.live.set_stat(k, stats[k])

    def set_armor(self, ids):
        for i, a in enumerate(ids):
            self.live.set_armor(i, a)

    def equip_rings(self, item_ids):
        """Equip four owned rings (by item id) through the game's routine."""
        index = {}
        for i, _h, item, _q in self.live.inventory():
            if item >> 28 == 2:
                index.setdefault(item & 0xFFFFFFF, i)
        for _attempt in range(2):
            current = self.live.snapshot()['rings']
            for slot, ring in enumerate(item_ids):
                if current[slot] != ring:
                    self.live.equip(SLOT_RING + slot, index[ring])
                    time.sleep(0.15)
                    current = self.live.snapshot()['rings']
            if current == list(item_ids):
                return True
        return False

    def equip_armor(self, inv_indices):
        for slot, idx in enumerate(inv_indices):
            if idx is not None:
                self.live.equip(SLOT_ARMOR + slot, idx)
                time.sleep(0.15)

    def wait_gauges_full(self, timeout=40.0):
        end = time.time() + timeout
        while time.time() < end:
            s = self.live.snapshot()
            if s['resistCurrent'] == s['resistMax']:
                return True
            time.sleep(0.5)
        return False

    def forced_save(self, label):
        """ESC-save, decrypt the slot, compare it with memory and with the model."""
        full = self.wait_gauges_full()
        state = self.settled()
        ok = input_save.save_via_esc(self.save_path, pre_delay=1.5, gap=0.3, presses=2,
                                     retries=3, retry_gap=1.0, timeout=10.0)
        data = sl2.decrypt_slot(open(self.save_path, 'rb').read(), self.args.slot, verify_md5=False)
        pat = sl2.find_character_pattern(data)
        u = lambda rel, n=1: list(struct.unpack_from('<%dI' % n, data, pat + rel))
        slot = {
            'stats': dict(zip(['VIG', 'ATN', 'END', 'STR', 'DEX', 'INT', 'FTH', 'LCK'], u(-0x10C, 8)), VIT=u(-0xE4)[0]),
            'level': u(-0xE0)[0],
            'vitals': dict(zip(['hp', 'hpMax', 'hpBase', 'fp', 'fpMax', 'fpBase'], u(-0x138, 6)),
                           **dict(zip(['sp', 'spMax', 'spBase'], u(-0x11C, 3)))),
            'ember': data[pat - 0x50],
            'resist': u(-0x70, 5),
            'active': u(0x10C, 2), 'weapons': u(0x124, 6), 'armor': u(0x154, 4), 'rings': u(0x168, 4),
        }
        problems = []
        if not ok:
            problems.append('save not confirmed by mtime')
        if not full:
            problems.append('gauges did not refill in time')
        for key in ('stats', 'level', 'ember', 'active', 'weapons', 'armor', 'rings'):
            mem = state[key] if key != 'stats' else state['stats']
            if slot[key] != mem:
                problems.append(f'slot {key} {slot[key]} != memory {mem}')
        for k in ('hpMax', 'hpBase', 'fpMax', 'fpBase', 'spMax', 'spBase'):
            if slot['vitals'][k] != state['vitals'][k]:
                problems.append(f'slot {k} {slot["vitals"][k]} != memory {state["vitals"][k]}')
        pred = model.predict(state)
        if slot['resist'] != pred['resistMax']:
            problems.append(f'slot gauges {slot["resist"]} != predicted maxima {pred["resistMax"]}')
        for k in ('hpMax', 'hpBase', 'fpMax', 'fpBase', 'spMax', 'spBase'):
            if slot['vitals'][k] != pred[k]:
                problems.append(f'slot {k} {slot["vitals"][k]} != predicted {pred[k]}')
        name = f'save_{len([r for r in self.records if r["phase"] == "save"]):02d}.bin'
        open(os.path.join(self.out, name), 'wb').write(data)
        self.keep({'phase': 'save', 'label': label, 'bin': name, 'state': state, 'slot': slot,
                             'predicted': pred,
                             'mismatches': [{'field': 'save', 'detail': p} for p in problems]})
        print(f'  save {name}: {"OK" if not problems else problems}')

    # --- phases -----------------------------------------------------------------
    def phase_armor_table(self):
        """Every armor row with a resist value, written into its own slot."""
        print('phase A: armor table')
        groups = {}
        for item in sorted(model.PROTECTOR_RESIST):
            slot = (item // 1000) % 10
            if slot <= 3 and item >= PLAYER_ARMOR_MIN:
                groups.setdefault(item // 10000, {})[slot] = item
        for base, pieces in sorted(groups.items()):
            self.set_armor([pieces.get(i, BARE[i]) for i in range(4)])
            self.record('armor', f'set {base}')

    def phase_stat_curves(self, original):
        print('phase B: single-stat sweeps')
        for key in ('VIG', 'ATN', 'END', 'VIT', 'LCK', 'STR'):
            for value in range(1, 100):
                self.live.set_stat(key, value)
                self.record('stat', f'{key}={value}')
            self.live.set_stat(key, original['stats'][key])
        self.settled()

    def phase_combinations(self, original, ring_sets, n):
        print('phase C: mixed combinations')
        armor_by_slot = [[i for i in model.PROTECTOR_RESIST if (i // 1000) % 10 == s and i >= PLAYER_ARMOR_MIN]
                         + [BARE[s]] for s in range(4)]
        for k in range(n):
            rings = ring_sets[k % len(ring_sets)]
            if not self.equip_rings(rings):
                print('  could not equip', rings)
            stats = {s: self.rng.choice([self.rng.randint(1, 99), self.rng.randint(25, 45), 99, 1][:3])
                     for s in STAT_ORDER}
            if k % 5 == 0:                                   # push the stat sum to its extremes
                stats = {s: (99 if k % 10 == 0 else 1) for s in STAT_ORDER}
            self.set_stats(stats)
            self.set_armor([self.rng.choice(armor_by_slot[s]) for s in range(4)])
            self.record('combo', f'#{k} rings={rings}')

    def phase_saves(self, original, ring_sets, owned_armor, n):
        print('phase D: forced saves')
        for k in range(n):
            rings = ring_sets[(k * 2 + 1) % len(ring_sets)]
            self.equip_rings(rings)
            stats = {s: self.rng.randint(5, 99) for s in STAT_ORDER}
            self.set_stats(stats)
            # armor through the equip routine so index and id stay consistent in the save
            self.equip_armor([self.rng.choice(owned_armor[s]) if owned_armor[s] else None for s in range(4)])
            self.forced_save(f'#{k} rings={rings} stats={stats}')

    # --- run --------------------------------------------------------------------
    def run(self):
        backup = self.save_path + f'.before_equip_sweep_{int(time.time())}.bak'
        shutil.copy2(self.save_path, backup)
        print('save backup:', backup)

        original = self.live.snapshot()
        json.dump(original, open(os.path.join(self.out, 'original_state.json'), 'w'), indent=1)
        tail = self.live.i32(self.live.pgd() + 0x3F4)
        original_armor_idx = [i - tail for i in original['equipIndices'][12:16]]
        self.record('baseline', 'as found', original)

        owned = {}
        owned_armor = [[], [], [], []]
        for i, _h, item, _q in self.live.inventory():
            if item >> 28 == 2:
                owned.setdefault(item & 0xFFFFFFF, i)
            elif item >> 28 == 1:
                a = item & 0xFFFFFFF
                if (a // 1000) % 10 <= 3:
                    owned_armor[(a // 1000) % 10].append(i)
        interesting = [r for r in owned if r in model.RING_RESIST_ADD or r in model.RING_STAT_BONUS
                       or r in model.RING_VITAL_RATE]
        filler = [r for r in owned if r >= 20000 and r not in interesting]
        print('owned rings with a modelled effect:', interesting, '| other rings:', len(filler))
        ring_sets = [list(original['rings'])]
        for k in range(1, 2 ** len(interesting)):
            chosen = [r for b, r in enumerate(interesting) if k >> b & 1][:4]
            rest = [r for r in filler if r not in chosen]
            self.rng.shuffle(rest)
            ring_sets.append(chosen + rest[:4 - len(chosen)])

        try:
            self.phase_armor_table()
            self.set_armor(original['armor'])
            self.phase_stat_curves(original)
            self.phase_combinations(original, ring_sets, self.args.combos)
            self.set_armor(original['armor'])
            self.phase_saves(original, ring_sets, owned_armor, self.args.saves)
        finally:
            print('restoring the character')
            self.set_stats(original['stats'])
            self.equip_rings(original['rings'])
            self.equip_armor(original_armor_idx)
            self.set_armor(original['armor'])
            self.wait_gauges_full()
            end = self.settled()
            restored = all(end[k] == original[k] for k in ('stats', 'level', 'armor', 'rings', 'equipIndices', 'resistMax'))
            saved = None
            if self.args.persist:
                saved = input_save.save_via_esc(self.save_path, pre_delay=1.5, gap=0.3, presses=2,
                                                retries=3, retry_gap=1.0, timeout=10.0)
            else:
                print('NOTE: the restored state is in memory only. The game may have autosaved a sweep '
                      'state; open and close the menu in game (or rerun with --persist) so it saves again.')
            print('restored in memory:', restored, '| final save confirmed:', saved)
            summary = {
                'backup': backup, 'restored': restored, 'finalSaveConfirmed': saved,
                'counts': {p: sum(1 for r in self.records if r['phase'] == p)
                           for p in ('baseline', 'armor', 'stat', 'combo', 'save')},
                'mismatched': [r for r in self.records if r['mismatches']],
                'ringSets': ring_sets,
            }
            json.dump({'summary': summary, 'records': self.records},
                      open(os.path.join(self.out, 'sweep.json'), 'w'), indent=1)
            print(json.dumps({k: v for k, v in summary.items() if k != 'mismatched'}, indent=1))
            print('records with a mismatch:', len(summary['mismatched']), '| output:', self.out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--steam-id', default='0110000131bf8025')
    ap.add_argument('--slot', type=int, default=0)
    ap.add_argument('--combos', type=int, default=40)
    ap.add_argument('--saves', type=int, default=0,
                    help='how many combinations to force to disk with ESC x2 (takes keyboard focus)')
    ap.add_argument('--persist', action='store_true',
                    help='ESC-save once more after the character is restored')
    ap.add_argument('--seed', type=int, default=1)
    Sweep(ap.parse_args()).run()
