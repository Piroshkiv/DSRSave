"""Собрать HTML-вьюер по захвату `--watch-region`.

    python viewer.py out/region_everything.json [out/viewer.html]

Показывает три вещи, которые в консоли не видны:

- карту face-блока: 208 клеток, раскрашенных по тому, известен ли байт таблице
  и шевелился ли он в захвате — сразу видно, где в структуре дыры;
- таблицу всех изменившихся байт со шкалой наблюдённых значений;
- поля, которые в захвате НЕ менялись, то есть до которых не дошли руки.
"""

from __future__ import annotations

import json
import sys

import constants as C

FACE_START, FACE_SIZE = C.BLOCKS["face"]
IDS = [(0x00, "build / age"), (0x04, "hair"), (0x08, "pupil L"), (0x0C, "pupil R"),
       (0x10, "brow"), (0x14, "beard"), (0x18, "unused"), (0x1C, "tattoo"),
       (0x20, "eyelashes")]
COLORS = [(0x24, "skin"), (0x28, "hair"), (0x2C, "pupil L"), (0x30, "pupil R"),
          (0x34, "brow"), (0x38, "beard"), (0x3C, "unused"), (0x40, "tattoo"),
          (0x44, "eyelashes")]


def face_map(moved: set) -> list:
    """По байту face-блока: чем он занят и шевелился ли."""
    kind = {}
    for off, label in IDS:
        for k in range(4):
            kind[off + k] = ("id", f"{label} id", k)
    for off, label in COLORS:
        for k in range(4):
            kind[off + k] = ("color", f"{label} color", k)
    for pgd, ftype, group, name, _slug in C.FIELDS:
        block, boff = C.block_of(pgd)
        if block != "face" or boff in kind:
            continue
        for k in range(C.field_size(ftype)):
            kind[boff + k] = ("slider", f"{name} · {group}", k)

    cells = []
    for i in range(FACE_SIZE):
        role, label, part = kind.get(i, ("unknown", "not described anywhere", 0))
        cells.append({
            "offset": i,
            "role": role,
            "label": label,
            "part": part,
            "moved": (FACE_START + i) in moved,
        })
    return cells


def span_map() -> dict:
    """Каждый байт КАЖДОГО поля -> (имя, группа, номер байта внутри поля).

    Важно брать все байты, а не только первый: у float-полей body-блока хвост
    из трёх байт иначе выглядит «ничьим» и попадает в безымянные.
    """
    out = {}
    for pgd, ftype, group, name, _slug in C.FIELDS:
        for k in range(C.field_size(ftype)):
            out[pgd + k] = (name, group, k)
    return out


def build(capture: dict) -> dict:
    raw = capture["bytes"]
    moved = {int(k, 16) for k in raw}
    spans = span_map()

    rows = []
    for key, rec in raw.items():
        pgd = int(key, 16)
        known = spans.get(pgd)
        rows.append({
            "pgd": pgd,
            "block": rec.get("block"),
            "in_block": rec.get("in_block"),
            "name": known[0] if known else None,
            "group": known[1] if known else None,
            "part": known[2] if known else 0,
            "values": rec["values"],
        })
    rows.sort(key=lambda r: r["pgd"])

    untouched = []
    for pgd, ftype, group, name, _slug in C.FIELDS:
        if any(pgd + k in moved for k in range(C.field_size(ftype))):
            continue
        block, boff = C.block_of(pgd)
        untouched.append({"pgd": pgd, "block": block, "in_block": boff,
                          "name": name, "group": group})

    cells = face_map(moved)
    return {
        "label": capture.get("label"),
        "start": capture["start"],
        "face_start": FACE_START,
        "size": capture["size"],
        "rows": rows,
        "untouched": untouched,
        "cells": cells,
        "summary": {
            "watched": capture["size"],
            "moved": len(rows),
            "named": sum(1 for r in rows if r["name"]),
            "unnamed": sum(1 for r in rows if not r["name"]),
            "face_moved": sum(1 for c in cells if c["moved"]),
            "face_unknown_moved": sum(1 for c in cells
                                      if c["moved"] and c["role"] == "unknown"),
            "face_size": FACE_SIZE,
            "untouched": len(untouched),
            "fields": C.FIELD_COUNT,
        },
    }


HTML = """<title>Face Block Byte Map</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap">
<style>
:root {
  --ground: #f4f2ef;
  --surface: #ffffff;
  --surface-2: #eceae6;
  --line: #d8d4ce;
  --ink: #23201d;
  --ink-2: #5f5952;
  --ink-3: #8d867d;
  --ember: #c9501f;
  --ember-soft: rgba(201, 80, 31, 0.13);
  --id: #7a5cc4;
  --color: #1f7a6b;
  --slider: #4a6fa5;
  --unknown: #b0392b;
  --still: #cfcac3;
}
:root:not([data-theme="light"]) { color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #16151a;
    --surface: #1d1c22;
    --surface-2: #26242c;
    --line: #34313b;
    --ink: #e6e2dc;
    --ink-2: #a7a19a;
    --ink-3: #756f68;
    --ember: #ff6b35;
    --ember-soft: rgba(255, 107, 53, 0.16);
    --id: #a78bfa;
    --color: #4fc4ac;
    --slider: #74a3e0;
    --unknown: #ef6a58;
    --still: #35323b;
  }
}
:root[data-theme="dark"] {
  --ground: #16151a;
  --surface: #1d1c22;
  --surface-2: #26242c;
  --line: #34313b;
  --ink: #e6e2dc;
  --ink-2: #a7a19a;
  --ink-3: #756f68;
  --ember: #ff6b35;
  --ember-soft: rgba(255, 107, 53, 0.16);
  --id: #a78bfa;
  --color: #4fc4ac;
  --slider: #74a3e0;
  --unknown: #ef6a58;
  --still: #35323b;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.5;
}
.wrap {
  max-width: 1180px;
  margin: 0 auto;
  padding-inline: 20px;
  padding-block: 40px 72px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}
h1 {
  font-size: clamp(1.6rem, 4vw, 2.1rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0 6px;
  text-wrap: balance;
}
.lede { color: var(--ink-2); margin: 0; max-width: 62ch; }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }

.stats { display: flex; flex-wrap: wrap; gap: 28px 40px; margin-top: 24px; }
.stat-n {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 1.75rem; font-weight: 700; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.stat-l {
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.09em;
  color: var(--ink-3); margin-top: 6px;
}
.stat.hot .stat-n { color: var(--ember); }

section > h2 {
  font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.11em;
  color: var(--ink-3); font-weight: 600;
  margin: 0 0 4px; padding-bottom: 10px; border-bottom: 1px solid var(--line);
}
.note { color: var(--ink-2); font-size: 0.87rem; margin: 12px 0 0; max-width: 68ch; }

/* byte map */
.map { display: grid; grid-template-columns: repeat(16, 1fr); gap: 3px; margin-top: 18px; }
.cell {
  aspect-ratio: 1; border-radius: 2px; background: var(--still);
  position: relative; cursor: help; border: 1px solid transparent;
}
.cell.moved.id { background: var(--id); }
.cell.moved.color { background: var(--color); }
.cell.moved.slider { background: var(--slider); }
.cell.moved.unknown { background: var(--unknown); }
.cell.unknown:not(.moved) { border: 1px dashed var(--ink-3); background: transparent; }
.cell:focus-visible { outline: 2px solid var(--ember); outline-offset: 2px; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 16px; font-size: 0.8rem; color: var(--ink-2); }
.legend span { display: inline-flex; align-items: center; gap: 7px; }
.swatch { width: 11px; height: 11px; border-radius: 2px; display: inline-block; }
.readout {
  margin-top: 14px; min-height: 2.6em; padding: 10px 13px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 4px;
  font-size: 0.85rem; color: var(--ink-2);
}
.readout b { color: var(--ink); font-weight: 600; }

/* table */
.controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 18px 0 14px; }
.chip {
  font: inherit; font-size: 0.8rem; padding: 5px 13px; border-radius: 999px;
  border: 1px solid var(--line); background: transparent; color: var(--ink-2); cursor: pointer;
}
.chip[aria-pressed="true"] { background: var(--ember-soft); border-color: var(--ember); color: var(--ember); }
.chip:focus-visible { outline: 2px solid var(--ember); outline-offset: 2px; }
input[type="search"] {
  font: inherit; font-size: 0.85rem; padding: 5px 11px; margin-left: auto;
  min-width: 190px; border-radius: 4px;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink);
}
.scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 5px; background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
th {
  text-align: left; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--ink-3); font-weight: 600; padding: 9px 12px;
  border-bottom: 1px solid var(--line); white-space: nowrap;
  position: sticky; top: 0; background: var(--surface);
}
td { padding: 7px 12px; border-bottom: 1px solid var(--line); vertical-align: middle; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: var(--surface-2); }
td.off { font-family: 'JetBrains Mono', ui-monospace, monospace; white-space: nowrap; }
td.n { font-family: 'JetBrains Mono', ui-monospace, monospace; text-align: right; font-variant-numeric: tabular-nums; }
.tag {
  font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 2px 7px; border-radius: 3px; background: var(--surface-2); color: var(--ink-2);
}
.tag.new { background: var(--ember-soft); color: var(--ember); font-weight: 600; }
.strip { position: relative; height: 15px; min-width: 150px; background: var(--surface-2); border-radius: 2px; }
.strip i { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--slider); opacity: 0.85; }
.strip.new i { background: var(--ember); }
.empty { padding: 22px; color: var(--ink-3); font-size: 0.87rem; }
@media (max-width: 640px) {
  .map { grid-template-columns: repeat(8, 1fr); }
  input[type="search"] { margin-left: 0; width: 100%; }
}
</style>

<div class="wrap">
  <header>
    <h1>Face Block Byte Map</h1>
    <p class="lede">
      Every byte of <span class="mono">PlayerGameData</span> that moved while the
      character creator was driven through all of its controls. Read it to see
      which bytes the reference table already names, and which the game touches
      without anyone having named them.
    </p>
    <div class="stats" id="stats"></div>
  </header>

  <section>
    <h2>The face block, byte by byte</h2>
    <div class="map" id="map"></div>
    <div class="legend">
      <span><i class="swatch" style="background:var(--id)"></i> model id</span>
      <span><i class="swatch" style="background:var(--color)"></i> colour</span>
      <span><i class="swatch" style="background:var(--slider)"></i> slider</span>
      <span><i class="swatch" style="background:var(--unknown)"></i> moved, unnamed</span>
      <span><i class="swatch" style="background:var(--still)"></i> named, never moved</span>
      <span><i class="swatch" style="border:1px dashed var(--ink-3)"></i> unnamed, never moved</span>
    </div>
    <div class="readout" id="readout">Hover or focus a cell to read it.</div>
    <p class="note" id="mapnote"></p>
  </section>

  <section>
    <h2>Bytes that moved</h2>
    <div class="controls">
      <button class="chip" id="f-all" aria-pressed="true">All</button>
      <button class="chip" id="f-new" aria-pressed="false">Unnamed only</button>
      <button class="chip" id="f-face" aria-pressed="false">Face block only</button>
      <input type="search" id="q" placeholder="filter by name or offset">
    </div>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>PGD</th><th>In block</th><th>Field</th><th>Group</th>
            <th style="text-align:right">Values</th><th>Range 0–255</th>
          </tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>Named fields the capture never touched</h2>
    <p class="note" id="untouched-note"></p>
    <div class="scroll" id="untouched-wrap">
      <table>
        <thead><tr><th>PGD</th><th>In block</th><th>Field</th><th>Group</th></tr></thead>
        <tbody id="untouched"></tbody>
      </table>
    </div>
  </section>
</div>

<script id="data" type="application/json">__DATA__</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
const hex = (n, w = 2) => n.toString(16).toUpperCase().padStart(w, '0');

// ---- summary ----------------------------------------------------------
const s = D.summary;
const stats = [
  { n: s.watched, l: 'bytes watched' },
  { n: s.moved, l: 'bytes moved' },
  { n: s.named, l: 'of them named' },
  { n: s.unnamed, l: 'unnamed', hot: s.unnamed > 0 },
  { n: s.face_moved + ' / ' + s.face_size, l: 'of the face block' },
  { n: s.untouched, l: 'named fields untouched' },
];
document.getElementById('stats').innerHTML = stats.map(x =>
  `<div class="stat${x.hot ? ' hot' : ''}"><div class="stat-n">${x.n}</div><div class="stat-l">${x.l}</div></div>`
).join('');

// ---- byte map ---------------------------------------------------------
const map = document.getElementById('map');
map.innerHTML = D.cells.map(c => {
  const cls = ['cell', c.role, c.moved ? 'moved' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}" tabindex="0" data-i="${c.offset}"></div>`;
}).join('');

const readout = document.getElementById('readout');
const describe = (c) => {
  const pgd = D.face_start + c.offset;
  const part = c.role === 'unknown' ? '' : ` · byte ${c.part} of the field`;
  const state = c.moved ? 'moved in this capture' : 'never moved';
  return `<b>face+0x${hex(c.offset)}</b> &nbsp; PGD+0x${hex(pgd, 3)} &nbsp;— ${c.label}${part} &nbsp;·&nbsp; ${state}`;
};
map.addEventListener('mouseover', e => {
  const el = e.target.closest('.cell');
  if (el) readout.innerHTML = describe(D.cells[+el.dataset.i]);
});
map.addEventListener('focusin', e => {
  const el = e.target.closest('.cell');
  if (el) readout.innerHTML = describe(D.cells[+el.dataset.i]);
});

const unknownMoved = D.cells.filter(c => c.moved && c.role === 'unknown');
document.getElementById('mapnote').textContent = unknownMoved.length
  ? `${unknownMoved.length} bytes moved that no field describes: `
    + unknownMoved.map(c => 'face+0x' + hex(c.offset)).join(', ')
    + '. Those are real appearance data the reference table is missing.'
  : 'Every byte that moved is already described by a field.';

// ---- table ------------------------------------------------------------
const tbody = document.getElementById('rows');
const strip = (values, isNew) =>
  `<div class="strip${isNew ? ' new' : ''}">` +
  values.map(v => `<i style="left:calc(${(v / 255) * 100}% - 1px)"></i>`).join('') +
  '</div>';

let filter = 'all';
let query = '';

function render() {
  const rows = D.rows.filter(r => {
    if (filter === 'new' && r.name) return false;
    if (filter === 'face' && r.block !== 'face') return false;
    if (!query) return true;
    const hay = ((r.name || '') + ' ' + (r.group || '') + ' ' + hex(r.pgd, 3)).toLowerCase();
    return hay.includes(query);
  });
  tbody.innerHTML = rows.length ? rows.map(r => {
    const inBlock = r.block ? `${r.block}+0x${hex(r.in_block)}` : '—';
    const name = r.name
      ? r.name + (r.part ? ` <span class="tag">byte ${r.part}</span>` : '')
      : '<span class="tag new">unnamed</span>';
    return `<tr>
      <td class="off">0x${hex(r.pgd, 3)}</td>
      <td class="off">${inBlock}</td>
      <td>${name}</td>
      <td>${r.group ? `<span class="tag">${r.group}</span>` : ''}</td>
      <td class="n">${r.values.length}</td>
      <td>${strip(r.values, !r.name)}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" class="empty">Nothing matches.</td></tr>';
}

const chips = { all: document.getElementById('f-all'), new: document.getElementById('f-new'), face: document.getElementById('f-face') };
for (const [key, el] of Object.entries(chips)) {
  el.addEventListener('click', () => {
    filter = key;
    for (const [k, b] of Object.entries(chips)) b.setAttribute('aria-pressed', String(k === key));
    render();
  });
}
document.getElementById('q').addEventListener('input', e => {
  query = e.target.value.trim().toLowerCase();
  render();
});
render();

// ---- untouched --------------------------------------------------------
const ut = document.getElementById('untouched');
if (D.untouched.length === 0) {
  document.getElementById('untouched-wrap').innerHTML =
    '<div class="empty">Every named field moved at least once — the capture covered the whole table.</div>';
  document.getElementById('untouched-note').textContent = '';
} else {
  document.getElementById('untouched-note').textContent =
    `${D.untouched.length} of the ${D.summary.fields} fields in the table stayed put. Either the control was not reached, or the field is not what the table thinks it is.`;
  ut.innerHTML = D.untouched.map(r => `<tr>
    <td class="off">0x${hex(r.pgd, 3)}</td>
    <td class="off">${r.block}+0x${hex(r.in_block)}</td>
    <td>${r.name}</td>
    <td><span class="tag">${r.group}</span></td>
  </tr>`).join('');
}
</script>
"""


def main() -> None:
    C.use_utf8_stdout()
    src = sys.argv[1] if len(sys.argv) > 1 else "out/region_everything.json"
    dst = sys.argv[2] if len(sys.argv) > 2 else "out/viewer.html"
    with open(src, encoding="utf-8") as f:
        capture = json.load(f)
    data = build(capture)
    html = HTML.replace("__DATA__", json.dumps(data, ensure_ascii=False)
                        .replace("</", "<\\/"))
    with open(dst, "w", encoding="utf-8") as f:
        f.write(html)
    s = data["summary"]
    print(f"Захват {capture.get('label')}: шевелились {s['moved']} байт "
          f"({s['named']} названных, {s['unnamed']} безымянных); "
          f"в face-блоке {s['face_moved']} из {s['face_size']}; "
          f"не тронуто полей {s['untouched']}.")
    print(f"Вьюер: {dst}")


if __name__ == "__main__":
    main()
