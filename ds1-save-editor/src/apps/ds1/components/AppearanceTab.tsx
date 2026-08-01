import React, { useState, useRef } from 'react';
import { Character } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';
import {
  PHYSIQUE_NAMES_EN, PHYSIQUE_NAMES_ZH,
  HAIRSTYLE_FEMALE_EN, HAIRSTYLE_FEMALE_ZH,
  HAIRSTYLE_MALE_EN, HAIRSTYLE_MALE_ZH,
  HAIRSTYLE_SAVE_BASE,
  FACE_PARAM_LABELS,
} from '../lib/constants';

interface AppearanceTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

function dsrchrHairstyleToIndex(id: number, sex: number): number {
  let index = 0;
  if (sex === 0) {
    index = Math.round((id - 1200) / 100);
  } else {
    index = Math.round((id - 3000) / 100);
  }
  return Math.max(0, Math.min(9, index));
}

function saveIndexToDsrchrHairstyle(index: number, sex: number): number {
  if (sex === 0) return 1200 + index * 100;
  return 3000 + index * 100;
}

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

// Piecewise approximation based on known points:
// 0→0, 1.0→145, 1.5→210, 2.0→249
function floatToDisplayByte(v: number): number {
  if (v <= 0) return 0;
  if (v <= 1.0) return Math.round(v * 145);
  if (v <= 1.5) return Math.round(145 + (v - 1.0) * 130);
  if (v <= 2.0) return Math.round(210 + (v - 1.5) * 78);
  return Math.min(255, Math.round(249 + (v - 2.0) * 30));
}

interface FloatChannelProps {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}

const FloatChannel: React.FC<FloatChannelProps> = ({ label, value, max, onChange }) => {
  const [local, setLocal] = useState<string | undefined>(undefined);

  const handleBlur = () => {
    if (local === undefined) return;
    const n = parseFloat(local);
    if (!isNaN(n)) onChange(Math.max(0, Math.min(max, n)));
    setLocal(undefined);
  };

  return (
    <div className="appearance-float-channel">
      <span className="appearance-channel-label">{label}</span>
      <input
        type="number"
        className="appearance-float-input"
        value={local !== undefined ? local : value.toFixed(4)}
        min={0}
        max={max}
        step={0.001}
        onChange={e => setLocal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
    </div>
  );
};

interface HexFieldProps {
  value: Uint8Array;
  onChange: (bytes: Uint8Array) => void;
}

const HexField: React.FC<HexFieldProps> = ({ value, onChange }) => {
  const [local, setLocal] = useState<string | undefined>(undefined);
  const len = value.length;

  const apply = (raw: string) => {
    const bytes = parseHexBlock(raw, len);
    if (bytes) onChange(bytes);
    setLocal(undefined);
  };

  return (
    <input
      type="text"
      className="appearance-hex-input"
      value={local !== undefined ? local : toHexString(value)}
      onChange={e => setLocal(e.target.value)}
      onBlur={e => apply(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      spellCheck={false}
    />
  );
};

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ character, onCharacterUpdate }) => {
  const { lang } = useLang();
  const [, forceUpdate] = useState({});
  const [faceExpanded, setFaceExpanded] = useState(false);
  const [skinExpanded, setSkinExpanded] = useState(false);
  const [safeMode, setSafeMode] = useState(true);
  const importRef = useRef<HTMLInputElement>(null);

  const colorMax = safeMode ? 1 : 10;

  const hairstyleIndex = Math.max(0, Math.min(9, character.hairstyle - HAIRSTYLE_SAVE_BASE));
  const hairstyleNames = character.gender === 0
    ? (lang === 'zh' ? HAIRSTYLE_FEMALE_ZH : HAIRSTYLE_FEMALE_EN)
    : (lang === 'zh' ? HAIRSTYLE_MALE_ZH : HAIRSTYLE_MALE_EN);
  const hairColor = character.getHairColor();
  const eyeColor = character.getEyeColor();
  const faceData = character.getFaceData();
  const skinData = character.getSkinColor();

  const update = () => { forceUpdate({}); onCharacterUpdate(); };

  const handleGender = (v: string) => { character.gender = parseInt(v, 10); update(); };
  const handlePhysique = (v: string) => { character.physique = parseInt(v, 10); update(); };
  const handleHairstyle = (v: string) => { character.hairstyle = HAIRSTYLE_SAVE_BASE + parseInt(v, 10); update(); };

  const setHair = (ch: 0 | 1 | 2, val: number) => {
    const c = [...hairColor] as [number, number, number];
    c[ch] = val; character.setHairColor(c[0], c[1], c[2]); update();
  };
  const setEye = (ch: 0 | 1 | 2, val: number) => {
    const c = [...eyeColor] as [number, number, number];
    c[ch] = val; character.setEyeColor(c[0], c[1], c[2]); update();
  };

  const handleFaceParam = (idx: number, val: number) => {
    const d = character.getFaceData();
    d[idx] = Math.max(0, Math.min(255, val));
    character.setFaceData(d); update();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result as ArrayBuffer;
      if (buf.byteLength < 130) return;
      const view = new DataView(buf);
      const sex = view.getUint8(0);
      const physique = view.getUint8(1);
      const hairstyleId = view.getInt32(2, true);
      character.gender = sex;
      character.physique = physique;
      character.hairstyle = HAIRSTYLE_SAVE_BASE + dsrchrHairstyleToIndex(hairstyleId, sex);
      character.setHairColor(view.getFloat32(6, true), view.getFloat32(10, true), view.getFloat32(14, true));
      character.setEyeColor(view.getFloat32(18, true), view.getFloat32(22, true), view.getFloat32(26, true));
      character.setFaceData(new Uint8Array(buf, 30, 50));
      character.setSkinColor(new Uint8Array(buf, 80, 50));
      update();
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExport = () => {
    const buf = new ArrayBuffer(130);
    const view = new DataView(buf);
    const hc = character.getHairColor();
    const ec = character.getEyeColor();
    const fd = character.getFaceData();
    const sd = character.getSkinColor();
    view.setUint8(0, character.gender);
    view.setUint8(1, character.physique);
    view.setInt32(2, saveIndexToDsrchrHairstyle(hairstyleIndex, character.gender), true);
    view.setFloat32(6, hc[0], true); view.setFloat32(10, hc[1], true); view.setFloat32(14, hc[2], true);
    view.setFloat32(18, ec[0], true); view.setFloat32(22, ec[1], true); view.setFloat32(26, ec[2], true);
    const out = new Uint8Array(buf);
    for (let i = 0; i < 50; i++) out[30 + i] = fd[i];
    for (let i = 0; i < 50; i++) out[80 + i] = sd[i];
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name || 'character'}.dsrchr`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="appearance-tab">

      {/* ── Preset block ── */}
      <div className="appearance-preset-block">
        <div className="appearance-preset-info">
          <div className="appearance-preset-title">{t('appearance', lang)} .dsrchr Presets</div>
          <div className="appearance-preset-desc">
            {lang === 'zh' ? (
              <>与 <a href="https://www.nexusmods.com/darksoulsremastered/mods/713?tab=posts" target="_blank" rel="noopener noreferrer" className="appearance-preset-link">DSR Appearance Preset Tool</a> (作者 <span className="appearance-preset-author">BobDoleOwndU</span>) 兼容。导入 .dsrchr 文件以应用所有外观数据，或导出当前角色。</>
            ) : (
              <>Compatible with{' '}<a href="https://www.nexusmods.com/darksoulsremastered/mods/713?tab=posts" target="_blank" rel="noopener noreferrer" className="appearance-preset-link">DSR Appearance Preset Tool</a>{' '}by <span className="appearance-preset-author">BobDoleOwndU</span>. Import a .dsrchr file to apply all appearance data, or export the current character.</>
            )}
          </div>
        </div>
        <div className="appearance-preset-buttons">
          <button className="action-button" onClick={() => importRef.current?.click()}>
            ↑ {t('importDsrchr', lang)}
          </button>
          <button className="action-button" onClick={handleExport}>
            ↓ {t('exportDsrchr', lang)}
          </button>
        </div>
        <input ref={importRef} type="file" accept=".dsrchr" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      {/* ── Two columns ── */}
      <div className="appearance-columns">

        {/* Left: Appearance + Hair Color */}
        <div className="appearance-left">
          <h3>{t('appearance', lang)}</h3>

          <div className="form-group">
            <label>{t('gender', lang)}</label>
            <select value={character.gender} onChange={e => handleGender(e.target.value)}>
              <option value={0}>{t('female', lang)}</option>
              <option value={1}>{t('male', lang)}</option>
            </select>
          </div>

          <div className="form-group">
            <label>{t('physique', lang)}</label>
            <select value={character.physique} onChange={e => handlePhysique(e.target.value)}>
              {(lang === 'zh' ? PHYSIQUE_NAMES_ZH : PHYSIQUE_NAMES_EN).map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('hairstyle', lang)}</label>
            <select value={hairstyleIndex} onChange={e => handleHairstyle(e.target.value)}>
              {hairstyleNames.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>

          <div className="appearance-mode-row">
            <span className="appearance-mode-label">{t('colorRange', lang)}</span>
            <button
              className={`appearance-mode-btn ${safeMode ? 'active' : ''}`}
              onClick={() => setSafeMode(true)}
            >
              {t('safe', lang)}
            </button>
            <button
              className={`appearance-mode-btn ${!safeMode ? 'active' : ''}`}
              onClick={() => setSafeMode(false)}
            >
              {t('unsafe', lang)}
            </button>
          </div>
          {!safeMode && (
            <div className="appearance-unsafe-warning">
              {t('unsafeWarning', lang)}
            </div>
          )}

          <h3>{t('eyeColor', lang)}</h3>
          <div className="appearance-color-row">
            <div className="appearance-color-group">
              <div className="appearance-color-note">{t('gameMax', lang)}</div>
              <FloatChannel label="R" value={eyeColor[0]} max={colorMax} onChange={v => setEye(0, v)} />
              <FloatChannel label="G" value={eyeColor[1]} max={colorMax} onChange={v => setEye(1, v)} />
              <FloatChannel label="B" value={eyeColor[2]} max={colorMax} onChange={v => setEye(2, v)} />
            </div>
            <div className="appearance-color-swatch-wrap">
              <div
                className="appearance-color-swatch"
                style={{ background: `rgb(${floatToDisplayByte(eyeColor[0])},${floatToDisplayByte(eyeColor[1])},${floatToDisplayByte(eyeColor[2])})` }}
              />
              <div className="appearance-swatch-note">{t('approximate', lang)}</div>
            </div>
          </div>
        </div>

        {/* Right: Hair Color + Face Data + Skin Color */}
        <div className="appearance-right">

          <h3>{t('hairColor', lang)}</h3>
          <div className="appearance-color-row">
            <div className="appearance-color-group">
              <div className="appearance-color-note">{t('gameMax', lang)}</div>
              <FloatChannel label="R" value={hairColor[0]} max={colorMax} onChange={v => setHair(0, v)} />
              <FloatChannel label="G" value={hairColor[1]} max={colorMax} onChange={v => setHair(1, v)} />
              <FloatChannel label="B" value={hairColor[2]} max={colorMax} onChange={v => setHair(2, v)} />
            </div>
            <div className="appearance-color-swatch-wrap">
              <div
                className="appearance-color-swatch"
                style={{ background: `rgb(${floatToDisplayByte(hairColor[0])},${floatToDisplayByte(hairColor[1])},${floatToDisplayByte(hairColor[2])})` }}
              />
              <div className="appearance-swatch-note">{t('approximate', lang)}</div>
            </div>
          </div>

          {/* Face Data collapsible */}
          <div
            className={`appearance-section-header ${faceExpanded ? 'expanded' : ''}`}
            onClick={() => setFaceExpanded(v => !v)}
            style={{ marginTop: '1rem' }}
          >
            <span>{t('faceData', lang)}</span>
            <span className="expand-icon">{faceExpanded ? '▲' : '▼'}</span>
          </div>
          {faceExpanded && (
            <div className="appearance-section-body">
              <div className="appearance-hex-label">{t('fullHex', lang)}</div>
              <HexField
                value={faceData}
                onChange={bytes => { character.setFaceData(bytes); update(); }}
              />
              <div className="appearance-params-divider">{t('params', lang)}</div>
              <div className="face-params-list">
                {FACE_PARAM_LABELS.map((label, i) => (
                  <div key={i} className="face-param-row">
                    <span className="face-param-label">{label}</span>
                    <input
                      type="number"
                      className="face-param-input"
                      value={faceData[i]}
                      min={0}
                      max={255}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v)) handleFaceParam(i, v);
                      }}
                    />
                    <input
                      type="range"
                      className="face-param-slider"
                      value={faceData[i]}
                      min={0}
                      max={255}
                      onChange={e => handleFaceParam(i, parseInt(e.target.value, 10))}
                    />
                  </div>
                ))}
              </div>
              <div className="appearance-params-divider">{t('unlabeled', lang)}</div>
              <HexField
                value={faceData.slice(32, 50)}
                onChange={bytes => {
                  const d = character.getFaceData();
                  for (let i = 0; i < 18; i++) d[32 + i] = bytes[i];
                  character.setFaceData(d); update();
                }}
              />
            </div>
          )}

          {/* Skin Color collapsible */}
          <div
            className={`appearance-section-header ${skinExpanded ? 'expanded' : ''}`}
            onClick={() => setSkinExpanded(v => !v)}
            style={{ marginTop: '0.75rem' }}
          >
            <span>{t('skinColor', lang)}</span>
            <span className="expand-icon">{skinExpanded ? '▲' : '▼'}</span>
          </div>
          {skinExpanded && (
            <div className="appearance-section-body">
              <HexField
                value={skinData}
                onChange={bytes => { character.setSkinColor(bytes); update(); }}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
