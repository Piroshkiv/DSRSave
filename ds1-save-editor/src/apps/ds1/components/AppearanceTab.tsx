import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Character, hairIdForIndex, hairIndexForId } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';
import { ByteSlider } from '../../../shared/components/FaceEditor';
import '../../../shared/components/FaceEditor/faceEditor.css';
import {
  PHYSIQUE_NAMES_EN, PHYSIQUE_NAMES_ZH,
  HAIRSTYLE_FEMALE_EN, HAIRSTYLE_FEMALE_ZH,
  HAIRSTYLE_MALE_EN, HAIRSTYLE_MALE_ZH,
  FACE_PARAM_LABELS,
} from '../lib/constants';

interface AppearanceTabProps {
  character: Character;
  onCharacterUpdate: () => void;
  /** Safe mode keeps colours inside the in-game 0..1 range; off allows up to 10. */
  safeMode: boolean;
}

const PRESET_TOOL_URL = 'https://www.nexusmods.com/darksoulsremastered/mods/713?tab=posts';

/** Face bytes 0..31 have names; 32..49 are stored but the game labels none of them. */
const FACE_LABELLED = FACE_PARAM_LABELS.length;
const FACE_SIZE = 50;

function parseHexBlock(hex: string, expectedLen: number): Uint8Array | null {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length !== expectedLen * 2) return null;
  const result = new Uint8Array(expectedLen);
  for (let i = 0; i < expectedLen; i++) {
    const byte = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (isNaN(byte)) return null;
    result[i] = byte;
  }
  return result;
}

function toHexString(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Piecewise approximation of how the game renders a colour — DS1 colours
// come out duller than byte/255 would suggest. Known points:
// 0→0, 1.0→145, 1.5→210, 2.0→249
function floatToDisplayByte(v: number): number {
  if (v <= 0) return 0;
  if (v <= 1.0) return Math.round(v * 145);
  if (v <= 1.5) return Math.round(145 + (v - 1.0) * 130);
  if (v <= 2.0) return Math.round(210 + (v - 1.5) * 78);
  return Math.min(255, Math.round(249 + (v - 2.0) * 30));
}

/** Float channel that only commits on blur/Enter, so typing "0." is possible. */
const FloatChannel: React.FC<{
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}> = ({ label, value, max, onChange }) => {
  const [local, setLocal] = useState<string | undefined>(undefined);

  const commit = () => {
    if (local === undefined) return;
    const n = parseFloat(local);
    if (!isNaN(n)) onChange(Math.max(0, Math.min(max, n)));
    setLocal(undefined);
  };

  return (
    <input
      type="number"
      className="face-num wide"
      title={label}
      value={local !== undefined ? local : value.toFixed(4)}
      min={0}
      max={max}
      step={0.001}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
};

/** Hex text field for a whole byte block; applies only a complete, valid value. */
const HexField: React.FC<{ value: Uint8Array; onChange: (bytes: Uint8Array) => void }> = ({ value, onChange }) => {
  const [local, setLocal] = useState<string | undefined>(undefined);

  const apply = (raw: string) => {
    const bytes = parseHexBlock(raw, value.length);
    if (bytes) onChange(bytes);
    setLocal(undefined);
  };

  return (
    <input
      type="text"
      className="face-hex"
      value={local !== undefined ? local : toHexString(value)}
      onChange={e => setLocal(e.target.value)}
      onBlur={e => apply(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      spellCheck={false}
    />
  );
};

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ character, onCharacterUpdate, safeMode }) => {
  const { lang } = useLang();
  const [, forceUpdate] = useState({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setError(null); setNotice(null); }, [character]);

  const update = useCallback(() => { forceUpdate({}); onCharacterUpdate(); }, [onCharacterUpdate]);

  const colorMax = safeMode ? 1 : 10;
  const hairId = character.hairstyle;
  const hairIsListed = hairIndexForId(character.gender, hairId) >= 0;
  const hairstyleNames = character.gender === 0
    ? (lang === 'zh' ? HAIRSTYLE_FEMALE_ZH : HAIRSTYLE_FEMALE_EN)
    : (lang === 'zh' ? HAIRSTYLE_MALE_ZH : HAIRSTYLE_MALE_EN);
  const faceData = character.getFaceData();
  const skinData = character.getSkinColor();

  const handleGender = (v: string) => {
    // Keep the same creator hairstyle, like the game does when gender flips.
    const index = hairIndexForId(character.gender, hairId);
    character.gender = parseInt(v, 10);
    if (index >= 0) character.hairstyle = hairIdForIndex(character.gender, index);
    update();
  };

  const setFaceByte = (i: number, v: number) => {
    const d = character.getFaceData();
    d[i] = v;
    character.setFaceData(d);
    update();
  };

  const setSkinByte = (i: number, v: number) => {
    const d = character.getSkinColor();
    d[i] = v;
    character.setSkinColor(d);
    update();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        character.importDsrchr(new Uint8Array(reader.result as ArrayBuffer));
        setError(null);
        setNotice(`${t('presetApplied', lang)} ${file.name}`);
        update();
      } catch (err) {
        setNotice(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
    const blob = new Blob([character.exportDsrchr().buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name || 'character'}.dsrchr`;
    a.click();
    URL.revokeObjectURL(url);
    setError(null);
    setNotice(t('presetExported', lang));
  };

  const colors: { key: string; label: string; rgb: [number, number, number]; set: (c: [number, number, number]) => void }[] = [
    {
      key: 'hair',
      label: t('hairColor', lang),
      rgb: character.getHairColor(),
      set: c => character.setHairColor(c[0], c[1], c[2]),
    },
    {
      key: 'eye',
      label: t('eyeColor', lang),
      rgb: character.getEyeColor(),
      set: c => character.setEyeColor(c[0], c[1], c[2]),
    },
  ];

  const sliderGroups: { name: string; rows: { label: string; value: number; set: (v: number) => void }[] }[] = [
    {
      name: t('faceShape', lang),
      rows: FACE_PARAM_LABELS.map((label, i) => ({ label, value: faceData[i], set: v => setFaceByte(i, v) })),
    },
    {
      name: t('faceUnlabelled', lang),
      rows: Array.from({ length: FACE_SIZE - FACE_LABELLED }, (_, k) => {
        const i = FACE_LABELLED + k;
        return { label: `${t('byteLabel', lang)} ${i}`, value: faceData[i], set: (v: number) => setFaceByte(i, v) };
      }),
    },
    {
      name: t('skinTone', lang),
      rows: Array.from({ length: FACE_SIZE }, (_, i) => (
        { label: `${t('byteLabel', lang)} ${i}`, value: skinData[i], set: (v: number) => setSkinByte(i, v) }
      )),
    },
  ];

  const toggle = (name: string) => setOpenGroups(prev => ({ ...prev, [name]: !prev[name] }));
  const rawOpen = openGroups.__raw ?? false;

  return (
    <div className="face-tab">
      <h2>{t('appearance', lang)}</h2>

      {error && <div className="face-error">{error}</div>}
      {notice && !error && <div className="face-notice">{notice}</div>}

      {/* ── Presets ── */}
      <div className="face-preset">
        <div className="face-preset-text">
          <div className="face-preset-title">.dsrchr {t('presets', lang)}</div>
          <div className="face-preset-desc">
            {lang === 'zh' ? (
              <>与 <a href={PRESET_TOOL_URL} target="_blank" rel="noopener noreferrer">DSR Appearance Preset Tool</a>（作者 BobDoleOwndU）兼容。导入 .dsrchr 文件以应用全部外观（包括发型），或导出当前角色。</>
            ) : (
              <>Compatible with <a href={PRESET_TOOL_URL} target="_blank" rel="noopener noreferrer">DSR Appearance Preset Tool</a> by BobDoleOwndU. Import a .dsrchr file to apply the whole look, hairstyle included, or export this character.</>
            )}
          </div>
        </div>
        <div className="face-preset-buttons">
          <button className="face-btn" onClick={() => importRef.current?.click()}>{t('importDsrchr', lang)}</button>
          <button className="face-btn" onClick={handleExport}>{t('exportDsrchr', lang)}</button>
        </div>
        <input ref={importRef} type="file" accept=".dsrchr" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      {/* ── Basics ── */}
      <div className="face-section">
        <div className="face-section-title">{t('basics', lang)}</div>
        <div className="face-basics">
          <label className="face-select">
            <span>{t('gender', lang)}</span>
            <select value={character.gender} onChange={e => handleGender(e.target.value)}>
              <option value={0}>{t('female', lang)}</option>
              <option value={1}>{t('male', lang)}</option>
            </select>
          </label>
          <label className="face-select">
            <span>{t('physique', lang)}</span>
            <select value={character.physique} onChange={e => { character.physique = parseInt(e.target.value, 10); update(); }}>
              {(lang === 'zh' ? PHYSIQUE_NAMES_ZH : PHYSIQUE_NAMES_EN).map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </label>
          <label className="face-select">
            <span>{t('hairstyle', lang)}</span>
            <select value={hairId} onChange={e => { character.hairstyle = parseInt(e.target.value, 10); update(); }}>
              {!hairIsListed && <option value={hairId}>ID {hairId}</option>}
              {hairstyleNames.map((name, i) => (
                <option key={i} value={hairIdForIndex(character.gender, i)}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="face-hint">{t('hairstyleHint', lang)}</div>
      </div>

      {/* ── Colors ── */}
      <div className="face-section">
        <div className="face-section-title">{t('colors', lang)}</div>
        {!safeMode && <div className="face-warning">{t('unsafeWarning', lang)}</div>}
        <div className="face-colors float">
          {colors.map(({ key, label, rgb, set }) => (
            <div className="face-color" key={key}>
              <div
                className="face-swatch"
                title={t('approximate', lang)}
                style={{ background: `rgb(${rgb.map(floatToDisplayByte).join(',')})`, cursor: 'default' }}
              />
              <div className="face-color-body">
                <span className="face-color-label">{label}</span>
                <div className="face-channels">
                  {(['R', 'G', 'B'] as const).map((ch, i) => (
                    <FloatChannel
                      key={ch}
                      label={ch}
                      value={rgb[i]}
                      max={colorMax}
                      onChange={v => {
                        const next = [...rgb] as [number, number, number];
                        next[i] = v;
                        set(next);
                        update();
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="face-hint">{t('gameMax', lang)}</div>
      </div>

      {/* ── Sliders ── */}
      {sliderGroups.map(group => {
        const open = openGroups[group.name] ?? false;
        return (
          <div className="face-section" key={group.name}>
            <div className="face-section-title clickable" onClick={() => toggle(group.name)}>
              <span>{group.name}</span>
              <span className="face-count">{group.rows.length}</span>
              <span className="face-chevron">{open ? '▲' : '▼'}</span>
            </div>
            {open && (
              <div className="face-grid">
                {group.rows.map(row => (
                  <ByteSlider key={row.label} label={row.label} value={row.value} onChange={row.set} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Raw bytes ── */}
      <div className="face-section">
        <div className="face-section-title clickable" onClick={() => toggle('__raw')}>
          <span>{t('rawHex', lang)}</span>
          <span className="face-chevron">{rawOpen ? '▲' : '▼'}</span>
        </div>
        {rawOpen && (
          <>
            <div className="face-color-label">{t('faceShape', lang)} (50)</div>
            <HexField value={faceData} onChange={bytes => { character.setFaceData(bytes); update(); }} />
            <div className="face-color-label">{t('skinTone', lang)} (50)</div>
            <HexField value={skinData} onChange={bytes => { character.setSkinColor(bytes); update(); }} />
          </>
        )}
      </div>
    </div>
  );
};
