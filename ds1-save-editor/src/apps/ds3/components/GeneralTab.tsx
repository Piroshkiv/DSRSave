import React, { useEffect, useState } from 'react';
import { DS3Character } from '../lib/Character';
import { NumberInput } from '../../ds1/components/NumberInput';
import { MAX_VALUES, PlayerClass, CLASS_NAMES, CLASS_STARTING_STATS, STAT_ORDER } from '../lib/constants';
import { parseSteamId, formatSteamId, formatSteamIdHex, type SteamIdSummary } from '../lib/steamId';
import { FolderIdDialog } from './FolderIdDialog';

interface GeneralTabProps {
  character: DS3Character;
  onCharacterUpdate: () => void;
  safeMode: boolean;
  onSafeModeChange?: (enabled: boolean) => void;
  /** false when the slot holds data but the game marked it deleted */
  slotActive?: boolean;
  /** false when entry10 could not be decrypted, so the flag must not be edited */
  canEditSlotFlags?: boolean;
  onSlotActiveChange?: (slotIndex: number, active: boolean) => void;
  /** Save-wide launch setting; null when entry10 could not be decrypted */
  online?: boolean | null;
  onOnlineChange?: (online: boolean) => void;
  /** Steam IDs found in the save: system entry + one per populated slot */
  steamIdSummary?: SteamIdSummary;
  /** ID read off the save's folder name, when the platform exposes a path */
  folderSteamId?: bigint | null;
  /** Write the ID into this slot only */
  onSlotSteamIdChange?: (slotIndex: number, steamId: bigint) => void;
  /** Write the ID into the system entry and every populated slot */
  onSteamIdApplyAll?: (steamId: bigint) => number;
}

// Mapping from STAT_ORDER names to ClassStats property names
const STAT_MAP: Record<string, keyof Omit<typeof CLASS_STARTING_STATS[PlayerClass.Knight], 'level' | 'totalStatsAtZero'>> = {
  VIG: 'vigor',
  ATN: 'attunement',
  END: 'endurance',
  VIT: 'vitality',
  STR: 'strength',
  DEX: 'dexterity',
  INT: 'intelligence',
  FTH: 'faith',
  LCK: 'luck',
};

export const GeneralTab: React.FC<GeneralTabProps> = ({ character, onCharacterUpdate, safeMode, slotActive = true, canEditSlotFlags = false, onSlotActiveChange, online = null, onOnlineChange, steamIdSummary, folderSteamId = null, onSlotSteamIdChange, onSteamIdApplyAll }) => {
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const calculateLevel = (): number => {
    const classData = CLASS_STARTING_STATS[character.playerClass];
    if (!classData) return Math.max(1, character.level);

    let currentTotalStats = 0;
    for (const statName of STAT_ORDER) {
      currentTotalStats += character.getStat(statName);
    }

    return currentTotalStats - classData.totalStatsAtZero;
  };

  // Robust safeMode effect: collect changes, apply them, then recompute level and update once.
  useEffect(() => {
    if (!safeMode) return;

    const classData = CLASS_STARTING_STATS[character.playerClass];
    if (!classData) return;

    const changes: { stat: string; from: number; to: number }[] = [];

    for (const statName of STAT_ORDER) {
      const current = character.getStat(statName);
      const propertyName = STAT_MAP[statName];
      const min = classData[propertyName] ?? 0;

      if (typeof current === 'number' && current < min) {
        changes.push({ stat: statName, from: current, to: min });
      }
    }

    // Apply all stat changes in batch (sequentially), but avoid re-rendering until finished.
    if (changes.length > 0) {
      for (const ch of changes) {
        // setStat may update derived stats synchronously in your implementation
        character.setStat(ch.stat, ch.to);
      }
    }

    // Recalculate level after applying stat corrections
    const correctLevel = calculateLevel();

    const levelChanged = character.level !== correctLevel;
    const hadChanges = changes.length > 0;

    // Check and correct Estus Flask values in safe mode
    let estusChanged = false;
    const estusSum = character.estusMax + character.ashenEstusMax;
    if (estusSum < 4 || estusSum > 15) {
      // If sum is out of bounds, adjust to safe values
      if (estusSum < 4) {
        // Set to minimum: 3 HP, 1 Mana (or distribute 4 total)
        character.estusMax = Math.max(1, character.estusMax);
        character.ashenEstusMax = 4 - character.estusMax;
      } else if (estusSum > 15) {
        // Proportionally reduce to 15 total
        const ratio = 15 / estusSum;
        character.estusMax = Math.floor(character.estusMax * ratio);
        character.ashenEstusMax = 15 - character.estusMax;
      }
      estusChanged = true;
    }

    if (levelChanged) {
      const prevLevel = character.level;
      character.level = correctLevel;
      character.applyLevelProgression(prevLevel);
    }

    // Only re-render / notify if we actually changed something
    if (hadChanges || levelChanged || estusChanged) {
      bump();
      onCharacterUpdate();
    }
    // Depend on playerClass and safeMode to re-run when class or safeMode toggles,
    // and on character reference in case parent swaps the object.
  }, [character, character.playerClass, safeMode]);

  // Handlers (unchanged semantics)
  const handleStatChange = (statName: string, numValue: number) => {
    const prevLevel = character.level;
    const classData = CLASS_STARTING_STATS[character.playerClass];
    if (safeMode && classData) {
      const propertyName = STAT_MAP[statName];
      const minStat = classData[propertyName] || 0;
      numValue = Math.max(minStat, numValue);
    }

    character.setStat(statName, numValue);

    if (safeMode) {
      // recalc synchronously after setStat
      character.level = calculateLevel();
    }

    character.applyLevelProgression(prevLevel);

    bump();
    onCharacterUpdate();
  };

  const handleClassChange = (value: string) => {
    const newClass = parseInt(value, 10) as PlayerClass;
    if (isNaN(newClass) || !CLASS_STARTING_STATS[newClass]) return;

    character.playerClass = newClass;

    if (safeMode) {
      const classData = CLASS_STARTING_STATS[newClass];
      // enforce minimums for the new class
      const corrections: { stat: string; from: number; to: number }[] = [];
      for (const statName of STAT_ORDER) {
        const current = character.getStat(statName);
        const propertyName = STAT_MAP[statName];
        const min = classData[propertyName] ?? 0;
        if (typeof current === 'number' && current < min) {
          corrections.push({ stat: statName, from: current, to: min });
        }
      }
      const prevLevel = character.level;
      for (const c of corrections) character.setStat(c.stat, c.to);
      character.level = calculateLevel();
      character.applyLevelProgression(prevLevel);
    }

    bump();
    onCharacterUpdate();
  };

  const handleLevelChange = (numValue: number) => {
    const prevLevel = character.level;
    character.level = numValue;
    character.applyLevelProgression(prevLevel);
    bump();
    onCharacterUpdate();
  };

  const handleSoulMemoryChange = (numValue: number) => {
    character.soulMemory = numValue;
    bump();
    onCharacterUpdate();
  };

  const handleSoulsChange = (numValue: number) => {
    const prevSouls = character.souls;
    character.souls = numValue;
    character.applySoulsProgression(prevSouls);
    bump();
    onCharacterUpdate();
  };

  const handleHPChange = (numValue: number) => {
    character.hp = numValue;
    bump();
    onCharacterUpdate();
  };

  const handleFPChange = (numValue: number) => {
    character.fp = numValue;
    bump();
    onCharacterUpdate();
  };

  const handleStaminaChange = (numValue: number) => {
    character.stamina = numValue;
    bump();
    onCharacterUpdate();
  };

  const handleNGCycleChange = (numValue: number) => {
    character.ngCycle = numValue;
    bump();
    onCharacterUpdate();
  };

  // A slot only counts as deleted when it still holds data but the active flag is off.
  const isSlotDeleted = !character.isEmpty && !slotActive;

  const handleSlotToggle = () => {
    if (!onSlotActiveChange) return;
    if (!isSlotDeleted && !confirm(
      `Remove slot ${character.slotIndex + 1} ("${character.name || 'Unnamed'}")?\n\n` +
      'The character disappears from the in-game load menu. Its data stays in the file and can be restored here.'
    )) return;

    onSlotActiveChange(character.slotIndex, isSlotDeleted);
    bump();
    onCharacterUpdate();
  };

  // ===== STEAM ID =====
  // The field always shows one ID: this slot's, falling back to the save-wide
  // one from the system entry when the slot carries none.
  const slotSteamId =
    steamIdSummary?.slots.find((s) => s.slotIndex === character.slotIndex)?.steamId ?? null;
  const currentSteamId = slotSteamId ?? steamIdSummary?.system ?? null;

  const [steamIdInput, setSteamIdInput] = useState('');
  const [steamIdNotice, setSteamIdNotice] = useState('');
  // In the browser there is no path to read the folder from, so the user types
  // it once and we keep it for the rest of the session.
  const [askedFolderId, setAskedFolderId] = useState<bigint | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const knownFolderId = folderSteamId ?? askedFolderId;
  // Which notation the field shows. Both are accepted on input either way;
  // hex is the default because that is what the save folder is named after.
  const [idFormat, setIdFormat] = useState<'hex' | 'dec'>('hex');

  const showSteamId = (steamId: bigint, format = idFormat) =>
    format === 'hex' ? formatSteamIdHex(steamId) : formatSteamId(steamId);

  // Re-sync when the slot changes or the ID moves under us (apply-all), but not
  // while typing: an input that already parses to the current ID is left alone,
  // so hex input isn't rewritten into decimal mid-keystroke.
  useEffect(() => {
    if (parseSteamId(steamIdInput) === currentSteamId) return;
    setSteamIdInput(currentSteamId === null ? '' : showSteamId(currentSteamId));
    setSteamIdNotice('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSteamId, character.slotIndex]);

  const parsedSteamId = parseSteamId(steamIdInput);
  const steamIdInvalid = steamIdInput.trim() !== '' && parsedSteamId === null;

  // An empty slot carries no ID field, so there is nothing to write into it —
  // the field still shows the save-wide ID, just read-only.
  const canEditSteamId = !!onSlotSteamIdChange && slotSteamId !== null;

  /** Writes into this slot as soon as the field holds a complete ID. */
  const applySteamIdToSlot = (steamId: bigint) => {
    if (!canEditSteamId || steamId === slotSteamId) return;
    onSlotSteamIdChange(character.slotIndex, steamId);
    setSteamIdNotice('');
    bump();
    onCharacterUpdate();
  };

  const handleSteamIdInput = (text: string) => {
    setSteamIdInput(text);
    setSteamIdNotice('');
    const parsed = parseSteamId(text);
    if (parsed !== null) applySteamIdToSlot(parsed);
  };

  const useSteamId = (steamId: bigint) => {
    setSteamIdInput(showSteamId(steamId));
    applySteamIdToSlot(steamId);
  };

  // Switching notation only rewrites what is on screen — the save is untouched.
  const changeIdFormat = (format: 'hex' | 'dec') => {
    setIdFormat(format);
    if (parsedSteamId !== null) setSteamIdInput(showSteamId(parsedSteamId, format));
  };

  const handleUseFolderId = () => {
    if (knownFolderId !== null) {
      useSteamId(knownFolderId);
      return;
    }
    setFolderDialogOpen(true);
  };

  const handleFolderIdEntered = (steamId: bigint) => {
    setAskedFolderId(steamId);
    setFolderDialogOpen(false);
    useSteamId(steamId);
  };

  // The ID the *other* populated slots agree on, when they do and this slot
  // disagrees — the "one imported character among your own" case.
  const otherSlotIds = (steamIdSummary?.slots ?? [])
    .filter((s) => s.slotIndex !== character.slotIndex && s.steamId !== null)
    .map((s) => s.steamId as bigint);
  const sharedOtherId =
    otherSlotIds.length > 0 && otherSlotIds.every((id) => id === otherSlotIds[0])
      ? otherSlotIds[0]
      : null;
  const canTakeFromOtherSlots = sharedOtherId !== null && sharedOtherId !== slotSteamId;

  const handleSteamIdApplyToAll = () => {
    if (!parsedSteamId || !onSteamIdApplyAll) return;
    const patched = onSteamIdApplyAll(parsedSteamId);
    setSteamIdNotice(`Applied to ${patched} slot${patched === 1 ? '' : 's'}.`);
    bump();
    onCharacterUpdate();
  };

  const playtimeSec = Math.floor(character.playtimeMs / 1000);
  const playtimeParts = {
    h: Math.floor(playtimeSec / 3600),
    m: Math.floor((playtimeSec % 3600) / 60),
    s: playtimeSec % 60,
  };

  const handlePlaytimeChange = (part: 'h' | 'm' | 's', numValue: number) => {
    const p = { ...playtimeParts, [part]: numValue };
    // preserve sub-second ms so an untouched value round-trips exactly
    const ms = character.playtimeMs % 1000;
    character.playtimeMs = (p.h * 3600 + p.m * 60 + p.s) * 1000 + ms;
    bump();
    onCharacterUpdate();
  };

  const handleEstusMaxChange = (numValue: number) => {
    if (safeMode) {
      // Clamp input to 0-15
      numValue = Math.max(0, Math.min(15, numValue));

      let estusValue = numValue;
      let ashenValue = character.ashenEstusMax;

      // Special case: if estus >= 15, set to 15/0
      if (estusValue >= 15) {
        estusValue = 15;
        ashenValue = 0;
      }
      // Special case: if estus <= 0, set to 0/4
      else if (estusValue <= 0) {
        estusValue = 0;
        ashenValue = 4;
      }
      // Normal case: adjust ashen to maintain sum between 4-15
      else {
        const sum = estusValue + ashenValue;

        if (sum > 15) {
          // Reduce ashen to make sum = 15
          ashenValue = 15 - estusValue;
        } else if (sum < 4) {
          // Increase ashen to make sum = 4
          ashenValue = 4 - estusValue;
        }
      }

      character.estusMax = estusValue;
      character.ashenEstusMax = ashenValue;
    } else {
      numValue = Math.max(0, Math.min(20, numValue));
      character.estusMax = numValue;
    }

    bump();
    onCharacterUpdate();
  };

  const handleAshenEstusMaxChange = (numValue: number) => {
    if (safeMode) {
      // Clamp input to 0-15
      numValue = Math.max(0, Math.min(15, numValue));

      let estusValue = character.estusMax;
      let ashenValue = numValue;

      // Special case: if ashen >= 15, set to 0/15
      if (ashenValue >= 15) {
        estusValue = 0;
        ashenValue = 15;
      }
      // Special case: if ashen <= 0, set to 4/0
      else if (ashenValue <= 0) {
        estusValue = 4;
        ashenValue = 0;
      }
      // Normal case: adjust estus to maintain sum between 4-15
      else {
        const sum = estusValue + ashenValue;

        if (sum > 15) {
          // Reduce estus to make sum = 15
          estusValue = 15 - ashenValue;
        } else if (sum < 4) {
          // Increase estus to make sum = 4
          estusValue = 4 - ashenValue;
        }
      }

      character.estusMax = estusValue;
      character.ashenEstusMax = ashenValue;
    } else {
      numValue = Math.max(0, Math.min(20, numValue));
      character.ashenEstusMax = numValue;
    }

    bump();
    onCharacterUpdate();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    character.name = e.target.value;
    bump();
    onCharacterUpdate();
  };

  const handleExportToBinary = () => {
    try {
      const rawData = character.getRawData();
      const dataToExport = new Uint8Array(rawData);
      const blob = new Blob([dataToExport], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `character_slot${character.slotIndex}_raw.bin`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export character data:', error);
      alert('Failed to export character data');
    }
  };

  return (
    <div className="general-tab-compact">
      <div className="compact-layout">
        <div className="stats-column">
          <h3>Stats</h3>
          <div className="stats-list">
            <div className="stat-row">
              <label>Level</label>
              <NumberInput
                value={character.level}
                onChange={handleLevelChange}
                min={1}
                max={MAX_VALUES.LEVEL}
                disabled={safeMode}
              />
            </div>
            {STAT_ORDER.map((statName) => (
              <div key={statName} className="stat-row">
                <label>{statName}</label>
                <NumberInput
                  value={character.getStat(statName)}
                  onChange={(value) => handleStatChange(statName, value)}
                  min={0}
                  max={99}
                />
              </div>
            ))}
          </div>

          <button
            className={`ds3-net-toggle ${online ? 'net-online' : 'net-offline'}`}
            onClick={() => onOnlineChange?.(!online)}
            disabled={online === null || !onOnlineChange}
            title={
              online === null
                ? 'The launch setting could not be read from this save.'
                : 'Applies to the whole save file, not just this character. Load an edited character offline once before going online.'
            }
          >
            <span className="ds3-slot-status-dot" />
            <span>{online === null ? 'Unavailable' : online ? 'Online' : 'Offline'}</span>
          </button>
        </div>

        <div className="info-column">
          <h3>General</h3>

          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={character.name}
              onChange={handleNameChange}
              maxLength={16}
              placeholder="Character name"
            />
          </div>

          <div className="form-group">
            <label>Class</label>
            <select value={character.playerClass} onChange={(e) => handleClassChange(e.target.value)}>
              {Object.entries(CLASS_NAMES).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="ds3-two-col">
            <div>
              <div className="form-group">
                <label>HP</label>
                <NumberInput value={character.hp} onChange={handleHPChange} min={0} max={9999} disabled={safeMode} />
              </div>

              <div className="form-group">
                <label>FP</label>
                <NumberInput value={character.fp} onChange={handleFPChange} min={0} max={999} disabled={safeMode} />
              </div>

              <div className="form-group">
                <label>Stamina</label>
                <NumberInput value={character.stamina} onChange={handleStaminaChange} min={0} max={999} disabled={safeMode} />
              </div>
            </div>

            <div>
              <div className="form-group">
                <label>NG+ Cycle</label>
                <NumberInput value={character.ngCycle} onChange={handleNGCycleChange} min={0} max={MAX_VALUES.NG_CYCLE} />
              </div>

              <div className="form-group">
                <label>Souls</label>
                <NumberInput value={character.souls} onChange={handleSoulsChange} min={0} max={MAX_VALUES.SOULS} />
              </div>

              <div className="form-group">
                <label>Soul Memory (total collected)</label>
                <NumberInput
                  value={character.soulMemory}
                  onChange={handleSoulMemoryChange}
                  min={0}
                  max={0xFFFFFFFF}
                  disabled={safeMode}
                />
                {safeMode && (
                  <p className="ds3-export-hint" title="Auto-set to a plausible minimum for the level (level-up cost + 20%)">
                    Auto-set from level (+20%).
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Play Time (h/m/s)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <NumberInput
                value={playtimeParts.h}
                onChange={(value) => handlePlaytimeChange('h', value)}
                min={0}
                max={1193}
                style={{ flex: 1 }}
                disabled={safeMode}
              />
              <span style={{ color: '#666' }}>:</span>
              <NumberInput
                value={playtimeParts.m}
                onChange={(value) => handlePlaytimeChange('m', value)}
                min={0}
                max={59}
                style={{ flex: 1 }}
                disabled={safeMode}
              />
              <span style={{ color: '#666' }}>:</span>
              <NumberInput
                value={playtimeParts.s}
                onChange={(value) => handlePlaytimeChange('s', value)}
                min={0}
                max={59}
                style={{ flex: 1 }}
                disabled={safeMode}
              />
            </div>
            {safeMode && (
              <p className="ds3-export-hint">+5 min per gained level (auto). Editable in unsafe mode.</p>
            )}
          </div>

          <div className="form-group">
            <label>Estus Flask (hp/mana)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <NumberInput
                value={character.estusMax}
                onChange={handleEstusMaxChange}
                min={0}
                max={safeMode ? 15 : 20}
                style={{ flex: 1 }}
              />
              <span style={{ color: '#666' }}>/</span>
              <NumberInput
                value={character.ashenEstusMax}
                onChange={handleAshenEstusMaxChange}
                min={0}
                max={safeMode ? 15 : 20}
                style={{ flex: 1 }}
              />
              {safeMode && (
                <span style={{ fontSize: '0.85em', color: '#666', whiteSpace: 'nowrap' }}>
                  (Σ: {character.estusMax + character.ashenEstusMax})
                </span>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <button className="ds3-export-btn" onClick={handleExportToBinary}>
              📥 Export Character Data (.bin)
            </button>
            <p className="ds3-export-hint">
              Download raw decrypted character data for pattern analysis
            </p>
          </div>
        </div>
      </div>

      <div className="ds3-slot-section">
        <h3>Save Slot</h3>
        <button
          className={`ds3-slot-status ${isSlotDeleted ? 'deleted' : 'active'}`}
          onClick={handleSlotToggle}
          disabled={!canEditSlotFlags || character.isEmpty}
        >
          <span className="ds3-slot-status-dot" />
          <span>{isSlotDeleted ? 'Restore Slot' : 'Remove Slot'}</span>
        </button>
        <p className="ds3-export-hint">
          Slot {character.slotIndex + 1} — {isSlotDeleted ? 'Deleted' : 'Active'}.{' '}
          {!canEditSlotFlags
            ? 'Slot flags could not be read from this save, so they cannot be changed.'
            : isSlotDeleted
              ? 'The game hides this slot, but its data is intact. Restoring flips the flag back so the character reappears in the load menu.'
              : 'Removing only hides it from the load menu — the data stays in the file and can be restored here.'}
        </p>
      </div>

      {steamIdSummary && (
        <div className="ds3-slot-section">
          <h3>Steam ID</h3>

          <div className="ds3-steamid-row">
            <input
              type="text"
              className={`ds3-steamid-input${steamIdInvalid ? ' invalid' : ''}`}
              value={steamIdInput}
              placeholder={idFormat === 'hex' ? '0110000100000000' : '76561198000000000'}
              spellCheck={false}
              readOnly={!canEditSteamId}
              onChange={(e) => handleSteamIdInput(e.target.value)}
            />
            <span className="ds3-idformat">
              {(['hex', 'dec'] as const).map((format, i) => (
                <React.Fragment key={format}>
                  {i > 0 && <span className="ds3-idformat-sep">/</span>}
                  <button
                    className={`ds3-idformat-link${idFormat === format ? ' active' : ''}`}
                    onClick={() => changeIdFormat(format)}
                  >
                    {format}
                  </button>
                </React.Fragment>
              ))}
            </span>
            <button
              className="ds3-steamid-btn"
              onClick={handleUseFolderId}
              disabled={!canEditSteamId || knownFolderId === slotSteamId}
              title={knownFolderId !== null ? showSteamId(knownFolderId) : 'Enter the save folder name'}
            >
              Use folder ID
            </button>
            {canTakeFromOtherSlots && (
              <button
                className="ds3-steamid-btn"
                onClick={() => useSteamId(sharedOtherId!)}
                disabled={!canEditSteamId}
                title={showSteamId(sharedOtherId!)}
              >
                Take ID from other slots
              </button>
            )}
            {steamIdSummary.mismatched && (
              <button
                className="ds3-steamid-btn primary"
                onClick={handleSteamIdApplyToAll}
                disabled={!onSteamIdApplyAll || parsedSteamId === null}
              >
                Apply ID to other slots
              </button>
            )}
          </div>

          <p className="ds3-export-hint">
            {steamIdInvalid
              ? 'Not a Steam ID — use hex (the save folder name) or the decimal form.'
              : (parsedSteamId ?? currentSteamId) !== null
                ? <>
                    The game won&apos;t load a save bound to another ID:{' '}
                    <code>{showSteamId((parsedSteamId ?? currentSteamId)!)}</code>
                    {idFormat === 'hex' && ' — the save folder is named after it.'}
                  </>
                : 'The game won’t load a save bound to another ID. The save folder is named after it, in hex.'}
          </p>

          {steamIdSummary.mismatched && (
            <p className="ds3-steamid-warning">
              ⚠ Slots are bound to different accounts:{' '}
              {steamIdSummary.slots
                .filter((s) => s.steamId !== null)
                .map((s) => `slot ${s.slotIndex + 1}: ${showSteamId(s.steamId!)}`)
                .join(' · ')}
            </p>
          )}

          {/*
            No ID in a slot is not a conflict: characters imported from a save
            that was never bound to an account simply have no ID field, the game
            loads them, and there is nothing for "apply to all" to write into.
          */}
          {steamIdSummary.unbound.length > 0 && (
            <p className="ds3-steamid-notice">
              {steamIdSummary.unbound.length === 1 ? 'Slot ' : 'Slots '}
              {steamIdSummary.unbound.map((i) => i + 1).join(', ')}
              {steamIdSummary.unbound.length === 1 ? ' carries' : ' carry'} no account ID —
              imported characters usually don&apos;t. The game still loads them, and there is
              no ID field to rewrite, so rebinding skips these slots.
            </p>
          )}

          {steamIdNotice && <p className="ds3-steamid-notice">{steamIdNotice}</p>}

          <FolderIdDialog
            isOpen={folderDialogOpen}
            onCancel={() => setFolderDialogOpen(false)}
            onConfirm={handleFolderIdEntered}
          />
        </div>
      )}
    </div>
  );
};