import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DS3Character } from '../lib/Character';
import type { PresetControls } from './TabPanel';
import { toArrayBuffer } from '../../../shared/binary';
import { ByteSlider } from '../../../shared/components/FaceEditor';
import '../../../shared/components/FaceEditor/faceEditor.css';
import {
  APPEARANCE_IDS,
  APPEARANCE_ID_VALUES,
  APPEARANCE_COLORS,
  APPEARANCE_SLIDERS,
  APPEARANCE_PRESET_EXTENSION,
  FACE_AGE_NAMES,
  FACE_PUPIL_ID_OFFSETS,
} from '../lib/constants';

interface AppearanceTabProps {
  character: DS3Character;
  onCharacterUpdate: () => void;
  /** Safe mode keeps model IDs on their verified values; off allows free entry. */
  safeMode: boolean;
  /** The game's own six preset slots, null when the system entry is unreadable. */
  presets?: PresetControls | null;
}

const GENDERS = ['Female', 'Male'];
const VOICES = ['Young', 'Mature', 'Aged'];

const hex2 = (v: number) => v.toString(16).padStart(2, '0');
const toCss = (rgb: [number, number, number]) => `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`;
const fromCss = (css: string): [number, number, number] => [
  parseInt(css.slice(1, 3), 16),
  parseInt(css.slice(3, 5), 16),
  parseInt(css.slice(5, 7), 16),
];

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ character, onCharacterUpdate, safeMode, presets = null }) => {
  const [, forceUpdate] = useState({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const importRef = useRef<HTMLInputElement>(null);

  const found = character.findFaceBlock() !== -1;

  useEffect(() => { setError(null); setNotice(null); }, [character]);

  const update = useCallback(() => { forceUpdate({}); onCharacterUpdate(); }, [onCharacterUpdate]);

  const groups = useMemo(() => {
    const out: { name: string; fields: typeof APPEARANCE_SLIDERS }[] = [];
    for (const field of APPEARANCE_SLIDERS) {
      const last = out[out.length - 1];
      if (last && last.name === field.group) last.fields = [...last.fields, field];
      else out.push({ name: field.group, fields: [field] });
    }
    return out;
  }, []);

  const handleExport = () => {
    try {
      const bytes = character.exportAppearancePreset();
      const blob = new Blob([toArrayBuffer(bytes)], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${character.name || 'character'}${APPEARANCE_PRESET_EXTENSION}`;
      a.click();
      URL.revokeObjectURL(url);
      setError(null);
      setNotice('Preset exported.');
    } catch (err: any) {
      setError(err?.message || 'Failed to export the preset');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        character.importAppearancePreset(new Uint8Array(reader.result as ArrayBuffer));
        setError(null);
        setNotice(`Applied ${file.name}.`);
        update();
      } catch (err: any) {
        setNotice(null);
        setError(err?.message || 'Failed to read the preset');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (!found) {
    return (
      <div className="face-tab">
        <h2>Appearance</h2>
        <div className="face-error">
          Could not locate the appearance block in this save slot.
        </div>
      </div>
    );
  }

  return (
    <div className="face-tab">
      <h2>Appearance</h2>

      {error && <div className="face-error">{error}</div>}
      {notice && !error && <div className="face-notice">{notice}</div>}

      {/* ── Presets ── */}
      <div className="face-preset">
        <div className="face-preset-text">
          <div className="face-preset-title">{APPEARANCE_PRESET_EXTENSION} presets</div>
          <div className="face-preset-desc">
            Carries the whole look — hair, brows, beard, colors and every slider.
            Copying a preset is also the safe way to change hair or beard, since it
            brings model IDs from a character that already uses them.
          </div>
        </div>
        <div className="face-preset-buttons">
          <button className="face-btn" onClick={() => importRef.current?.click()}>↑ Import</button>
          <button className="face-btn" onClick={handleExport}>↓ Export</button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept={APPEARANCE_PRESET_EXTENSION}
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>

      {/* ── The game's own presets ── */}
      {presets && (
        <div className="face-section">
          <div className="face-section-title">In-game presets</div>
          <p className="face-hint" style={{ marginTop: 0, marginBottom: '0.6rem' }}>
            The six slots the character creator offers. Saving here puts the look
            in the game itself, so it can be picked when making a new character.
          </p>
          <div className="face-slot-grid">
            {presets.slots.map(({ index, face }) => {
              const skin = face
                ? `rgb(${face[0x24]},${face[0x25]},${face[0x26]})`
                : 'transparent';
              const hair = face
                ? face[0x04] | (face[0x05] << 8) | (face[0x06] << 16) | (face[0x07] << 24)
                : null;
              return (
                <div className={`face-slot ${face ? 'filled' : 'empty'}`} key={index}>
                  <div className="face-slot-head">
                    <span
                      className="face-slot-swatch"
                      style={{ background: skin }}
                      title={face ? `skin ${skin}` : 'empty slot'}
                    />
                    <span className="face-slot-name">Slot {index + 1}</span>
                    <span className="face-slot-meta">
                      {face ? `hair ${hair}` : 'empty'}
                    </span>
                  </div>
                  <div className="face-slot-actions">
                    <button
                      className="face-btn"
                      disabled={!face}
                      onClick={() => {
                        try {
                          character.setFaceBlock(face!);
                          setError(null);
                          setNotice(`Applied slot ${index + 1} to this character.`);
                          update();
                        } catch (err: any) {
                          setError(err?.message || 'Could not apply the preset');
                        }
                      }}
                    >
                      Apply
                    </button>
                    <button
                      className="face-btn"
                      onClick={() => {
                        presets.save(index, character.getFaceBlock());
                        setError(null);
                        setNotice(`Stored this character in slot ${index + 1}.`);
                      }}
                    >
                      Store
                    </button>
                    <button
                      className="face-btn ghost"
                      disabled={!face}
                      onClick={() => {
                        presets.clear(index);
                        setNotice(`Cleared slot ${index + 1}.`);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Basics ── */}
      <div className="face-section">
        <div className="face-section-title">Basics</div>
        <div className="face-basics">
          <label className="face-select">
            <span>Gender</span>
            <select
              value={character.gender}
              onChange={e => { character.gender = parseInt(e.target.value, 10); update(); }}
            >
              {GENDERS.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
          </label>
          <label className="face-select">
            <span>Voice</span>
            <select
              value={character.voice}
              onChange={e => { character.voice = parseInt(e.target.value, 10); update(); }}
            >
              {VOICES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
          </label>
          <label className="face-select">
            <span>Age</span>
            <select
              value={character.faceAge}
              onChange={e => { character.faceAge = parseInt(e.target.value, 10); update(); }}
            >
              {FACE_AGE_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
          </label>
          <label className="face-check">
            <input
              type="checkbox"
              checked={character.muscular}
              onChange={e => { character.muscular = e.target.checked; update(); }}
            />
            <span>Muscular build</span>
          </label>
          <label className="face-check">
            <input
              type="checkbox"
              checked={character.chestHair}
              onChange={e => { character.chestHair = e.target.checked; update(); }}
            />
            <span>Chest hair</span>
          </label>
        </div>
        <div className="face-hint">
          Age, build and chest hair share one byte in the save, so the game only
          allows these twelve combinations — which is why they sit here rather
          than among the model IDs.
        </div>
      </div>

      {/* ── Model IDs ── */}
      <div className="face-section">
        <div className="face-section-title">Hair, brows, beard</div>
        <div className="face-warning">
          These are model IDs, not sliders: a value the game has no model for crashes it
          on load. Safe mode offers only IDs seen in real saves — the game names none of
          them, so they are listed by number.
        </div>
        <div className="face-basics">
          <label className="face-select">
            <span>Pupils (both)</span>
            <select
              value={character.getPupilId() ?? ''}
              onChange={e => { character.setPupilId(parseInt(e.target.value, 10)); update(); }}
            >
              {character.getPupilId() === null && <option value="">mixed</option>}
              {(APPEARANCE_ID_VALUES[FACE_PUPIL_ID_OFFSETS[0]] ?? []).map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
          {APPEARANCE_IDS.map(({ offset, label }) => {
            const value = character.getFaceId(offset);
            const known = APPEARANCE_ID_VALUES[offset] ?? [];
            const options = known.includes(value) ? known : [...known, value].sort((a, b) => a - b);
            return (
              <label className="face-select" key={offset}>
                <span>{label}</span>
                {safeMode ? (
                  <select
                    value={value}
                    onChange={e => { character.setFaceId(offset, parseInt(e.target.value, 10)); update(); }}
                  >
                    {options.map(v => (
                      <option key={v} value={v}>
                        {v}{known.includes(v) ? '' : ' (current)'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={0}
                    value={value}
                    onChange={e => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) { character.setFaceId(offset, v); update(); }
                    }}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Colors ── */}
      <div className="face-section">
        <div className="face-section-title">Colors</div>
        <div className="face-colors">
          {(() => {
            const both = character.getPupilColor();
            return (
              <div className="face-color">
                <input
                  type="color"
                  className="face-swatch"
                  value={toCss(both ?? [0, 0, 0])}
                  onChange={e => {
                    const [r, g, b] = fromCss(e.target.value);
                    character.setPupilColor(r, g, b);
                    update();
                  }}
                />
                <div className="face-color-body">
                  <span className="face-color-label">
                    Pupils (both){both === null && ' — mixed'}
                  </span>
                  <div className="face-channels">
                    {(['R', 'G', 'B'] as const).map((ch, i) => (
                      <input
                        key={ch}
                        type="number"
                        className="face-num"
                        title={ch}
                        value={both ? both[i] : ''}
                        min={0}
                        max={255}
                        onChange={e => {
                          const v = parseInt(e.target.value, 10);
                          if (isNaN(v)) return;
                          const next = [...(both ?? [0, 0, 0])] as [number, number, number];
                          next[i] = v;
                          character.setPupilColor(next[0], next[1], next[2]);
                          update();
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
          {APPEARANCE_COLORS.map(({ offset, label }) => {
            const rgb = character.getFaceColor(offset);
            const set = (next: [number, number, number]) => {
              character.setFaceColor(offset, next[0], next[1], next[2]);
              update();
            };
            return (
              <div className="face-color" key={offset}>
                <input
                  type="color"
                  className="face-swatch"
                  value={toCss(rgb)}
                  onChange={e => set(fromCss(e.target.value))}
                />
                <div className="face-color-body">
                  <span className="face-color-label">{label}</span>
                  <div className="face-channels">
                    {(['R', 'G', 'B'] as const).map((ch, i) => (
                      <input
                        key={ch}
                        type="number"
                        className="face-num"
                        title={ch}
                        value={rgb[i]}
                        min={0}
                        max={255}
                        onChange={e => {
                          const v = parseInt(e.target.value, 10);
                          if (isNaN(v)) return;
                          const next = [...rgb] as [number, number, number];
                          next[i] = v;
                          set(next);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sliders ── */}
      {groups.map(group => {
        const open = openGroups[group.name] ?? false;
        return (
          <div className="face-section" key={group.name}>
            <div
              className="face-section-title clickable"
              onClick={() => setOpenGroups(prev => ({ ...prev, [group.name]: !open }))}
            >
              <span>{group.name}</span>
              <span className="face-count">{group.fields.length}</span>
              <span className="face-chevron">{open ? '▲' : '▼'}</span>
            </div>
            {open && (
              <div className="face-grid">
                {group.fields.map(field => (
                  <ByteSlider
                    key={field.offset}
                    label={field.label}
                    value={character.getFaceByte(field.offset)}
                    onChange={v => { character.setFaceByte(field.offset, v); update(); }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
};
