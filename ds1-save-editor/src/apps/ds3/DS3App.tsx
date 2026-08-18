import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../shared/components/Layout';
import { FileUpload, CharacterList, TabPanel, SaveWarningModal, BanWarningModal, type FileUploadRef } from './components';
import { useDS3SaveEditor } from './hooks';
import type { SaveOutcome } from './hooks/useDS3SaveEditor';
import { detectEnvironment } from '../ds1/lib/adapters';

const isWebEnv = detectEnvironment() === 'web';

const logoImg = (import.meta.env.MODE === 'static' || typeof window !== 'undefined' && window.location.protocol === 'file:')
  ? 'ds3logo.png'
  : '/ds3logo.png';

interface DS3AppProps {
  onHome?: () => void;
}

function useTimeAgo(date: Date | null): string {
  const [label, setLabel] = useState('');

  const compute = useCallback(() => {
    if (!date) return '';
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 60) return 'loaded just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `loaded ${mins} min ago`;
    const hours = Math.floor(mins / 60);
    return `loaded ${hours} hour${hours > 1 ? 's' : ''} ago`;
  }, [date]);

  useEffect(() => {
    if (!date) { setLabel(''); return; }
    setLabel(compute());
    const id = setInterval(() => setLabel(compute()), 30_000);
    return () => clearInterval(id);
  }, [date, compute]);

  return label;
}

export const DS3App: React.FC<DS3AppProps> = ({ onHome }) => {
  const fileUploadRef = useRef<FileUploadRef>(null);
  const [showSaveWarning, setShowSaveWarning] = useState(false);
  const [saveWarningTriggersSave, setSaveWarningTriggersSave] = useState(false);
  const [banWarning, setBanWarning] = useState<{ switchedOffline: boolean } | null>(null);
  const navigate = useNavigate();

  const {
    saveEditor,
    characters,
    selectedCharacterIndex,
    originalFilename,
    isSlotActive,
    canEditSlotFlags,
    setSlotActive,
    online,
    setOnline,
    steamIdSummary,
    folderSteamId,
    setSlotSteamId,
    applySteamIdToAll,
    autoBackup,
    maxBackupsPerSlot,
    backupCounts,
    backupsVersion,
    setAutoBackup,
    setMaxBackupsPerSlot,
    backupSlotNow,
    restoreBackup,
    notifyBackupsChanged,
    handleFileLoaded,
    handleCharacterSelect,
    handleCharacterUpdate,
    handleSave,
    handleSaveAs,
    handleReload,
  } = useDS3SaveEditor(fileUploadRef);

  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [safeMode, setSafeMode] = useState(true);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const timeAgo = useTimeAgo(loadedAt);

  useEffect(() => {
    if (saveEditor) setLoadedAt(new Date());
  }, [saveEditor]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        navigate('/ds3/offset-search');
      }
      if (import.meta.env.DEV && e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        navigate('/ds3/save-watcher');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const handleOpenWarning = () => {
    setSaveWarningTriggersSave(false);
    setShowSaveWarning(true);
  };

  /**
   * The ban warning is only useful when stats actually moved, and .co2 saves are
   * console exports that never reach the PC servers, so they are exempt.
   */
  const reportSaveOutcome = (outcome: SaveOutcome) => {
    if (!outcome.statsChanged) return;
    if (originalFilename.toLowerCase().endsWith('.co2')) return;
    setBanWarning({ switchedOffline: outcome.switchedOffline });
  };

  const runSaveAs = async () => {
    try {
      reportSaveOutcome(await handleSaveAs());
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message === 'User cancelled file save') return;
      console.error('Save As error:', err);
      handleOpenWarning();
    }
  };

  const handleSaveAsClick = () => {
    const hasShownWarning = localStorage.getItem('ds3-save-as-warning-shown');
    if (!hasShownWarning) {
      setSaveWarningTriggersSave(true);
      setShowSaveWarning(true);
    } else {
      runSaveAs();
    }
  };

  const handleSaveClick = async () => {
    try {
      reportSaveOutcome(await handleSave());
    } catch (err: any) {
      console.error('Save error:', err);
      const isRestricted =
        err?.name === 'NotAllowedError' ||
        err?.name === 'SecurityError' ||
        (err?.message ?? '').toLowerCase().includes('system');
      if (isWebEnv && isRestricted) {
        handleOpenWarning();
      } else {
        alert('Error saving file. Please try again.');
      }
    }
  };

  const handleWarningConfirm = () => {
    localStorage.setItem('ds3-save-as-warning-shown', 'true');
    setShowSaveWarning(false);
    if (saveWarningTriggersSave) {
      setSaveWarningTriggersSave(false);
      runSaveAs();
    }
  };

  const selectedCharacter = selectedCharacterIndex !== null
    ? characters[selectedCharacterIndex]
    : null;

  const canSave = !!saveEditor?.hasFileHandle();

  // Which account this save belongs to, for the backup history filter. The
  // system entry is the authority; a save whose entry wouldn't decrypt falls
  // back to the first slot that names an owner, then to the folder name.
  const saveSteamId =
    steamIdSummary.system ??
    steamIdSummary.slots.find(slot => slot.steamId !== null)?.steamId ??
    folderSteamId;

  const webLimitsButton = isWebEnv ? (
    <button className="tutorial-button" onClick={handleOpenWarning} title="Browser limitations for DS3 saves">
      <span className="button-icon">⚠️</span>
      <span className="button-text">Web Limits</span>
    </button>
  ) : undefined;

  const sidebar = (
    <>
      <FileUpload
        ref={fileUploadRef}
        onFileLoaded={handleFileLoaded}
        onAutoLoadAttempt={setIsAutoLoading}
      />
      {isAutoLoading && (
        <div className="loading-indicator">
          Loading last save file...
        </div>
      )}
      {characters.length > 0 && (
        <CharacterList
          characters={characters}
          selectedIndex={selectedCharacterIndex}
          onSelectCharacter={handleCharacterSelect}
          isSlotActive={isSlotActive}
          backupCounts={backupCounts}
        />
      )}
    </>
  );

  return (
    <AppLayout
      title="Dark Souls 3 Save Editor"
      icon={logoImg}
      showHomeButton={!!onHome}
      onHome={onHome}
      sidebar={sidebar}
      showTutorialButton={false}
      showGameNav={true}
      currentGame="ds3"
      extraActions={webLimitsButton}
    >
      <div style={{
        background: 'linear-gradient(135deg, #7a3a00, #5a2a00)',
        border: '1px solid #c8650a',
        borderRadius: '6px',
        padding: '10px 16px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '0.9rem',
        color: '#ffd580',
      }}>
        <span style={{ fontSize: '1.1rem' }}>⚠️</span>
        <span>
          <strong>Beta:</strong> DS3 editor is still being tested. It is recommended to use it <strong>offline only</strong> to avoid bans.
        </span>
      </div>
      {saveEditor && (
        <div className="ds1-subheader">
          <div className="ds1-subheader-info">
            <span className="ds1-filename">{originalFilename}</span>
            {timeAgo && <span className="ds1-loaded-label">{timeAgo}</span>}
          </div>
          <div className="ds1-subheader-actions">
            <button className="ds1-action-btn" onClick={handleReload}>
              ⟳ Reload
            </button>
            <button
              className="ds1-safemode-btn"
              onClick={() => setSafeMode(v => !v)}
              title="Auto-adjust Level, HP/FP/Stamina based on stats."
            >
              <span className={`ds1-safemode-dot ${safeMode ? 'on' : 'off'}`}>●</span>
              Safe Mode
              <span className={`ds1-safemode-badge ${safeMode ? 'on' : 'off'}`}>
                {safeMode ? 'ON' : 'OFF'}
              </span>
            </button>
            <button
              className="ds1-safemode-btn"
              onClick={() => setAutoBackup(!autoBackup)}
              title="Snapshot every character slot when a save is loaded and after each save."
            >
              <span className={`ds1-safemode-dot ${autoBackup ? 'on' : 'off'}`}>●</span>
              Auto Backup
              <span className={`ds1-safemode-badge ${autoBackup ? 'on' : 'off'}`}>
                {autoBackup ? 'ON' : 'OFF'}
              </span>
            </button>
            <button
              className="ds1-action-btn"
              onClick={handleSaveClick}
              disabled={!canSave}
            >
              Save
            </button>
            <button className="ds1-action-btn" onClick={handleSaveAsClick}>
              Save As
            </button>
          </div>
        </div>
      )}

      <TabPanel
        character={selectedCharacter}
        onCharacterUpdate={handleCharacterUpdate}
        safeMode={safeMode}
        onSafeModeChange={setSafeMode}
        slotActive={selectedCharacter ? isSlotActive(selectedCharacter.slotIndex) : true}
        canEditSlotFlags={canEditSlotFlags}
        onSlotActiveChange={setSlotActive}
        online={online}
        onOnlineChange={setOnline}
        steamIdSummary={saveEditor ? steamIdSummary : undefined}
        folderSteamId={folderSteamId}
        onSlotSteamIdChange={setSlotSteamId}
        onSteamIdApplyAll={applySteamIdToAll}
        backups={saveEditor ? {
          maxPerSlot: maxBackupsPerSlot,
          setMaxPerSlot: setMaxBackupsPerSlot,
          version: backupsVersion,
          currentSteamId: saveSteamId != null ? saveSteamId.toString(10) : '',
          backupSlotNow,
          restoreBackup,
          notifyChanged: notifyBackupsChanged,
        } : null}
      />

      <SaveWarningModal
        isOpen={showSaveWarning}
        onConfirm={handleWarningConfirm}
      />

      <BanWarningModal
        isOpen={banWarning !== null}
        switchedOffline={banWarning?.switchedOffline ?? false}
        online={online}
        onConfirm={() => setBanWarning(null)}
      />
    </AppLayout>
  );
};
