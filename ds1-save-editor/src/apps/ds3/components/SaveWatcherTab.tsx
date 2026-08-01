import React from 'react';
import { useSaveWatcher } from '../hooks/useSaveWatcher';

interface SaveWatcherTabProps {
  onClose: () => void;
}

export const SaveWatcherTab: React.FC<SaveWatcherTabProps> = ({ onClose }) => {
  const {
    state,
    MAX_CAPTURES_PER_EVENT,
    browseFile,
    browseOutDir,
    setSlot,
    setEventName,
    setSelectedCheckpointId,
    checkpointNow,
    rollback,
    startWatch,
    stopWatch,
  } = useSaveWatcher();

  const {
    filePath, slot, outDir, eventName, watching, captures,
    checkpoints, selectedCheckpointId, status, isBusy,
  } = state;

  return (
    <div className="offset-search-page">
      <div className="offset-search-page-header">
        <span className="offset-search-title">DS3 Save Watcher</span>
        <span className="offset-search-hint">Ctrl+Shift+W to toggle</span>
        <button className="offset-search-back" onClick={onClose}>← Back to Editor</button>
      </div>

      <div className="offset-search-body">
        <div className="offset-search-controls">
          <div className="offset-search-control-group">
            <label>Save file</label>
            <div className="offset-search-file-row">
              <input
                type="text"
                readOnly
                value={filePath ?? ''}
                placeholder="No file selected"
                className="offset-search-filepath"
              />
              <button onClick={browseFile} disabled={isBusy || watching}>Browse</button>
            </div>
          </div>

          <div className="offset-search-control-group">
            <label>Character slot</label>
            <select
              value={slot}
              onChange={e => setSlot(Number(e.target.value))}
              disabled={isBusy || watching}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i}>Slot {i}</option>
              ))}
            </select>
          </div>

          <div className="offset-search-control-group">
            <label>Output directory</label>
            <div className="offset-search-file-row">
              <input
                type="text"
                readOnly
                value={outDir ?? ''}
                placeholder="Auto: <save dir>\watcher"
                className="offset-search-filepath"
              />
              <button onClick={browseOutDir} disabled={isBusy || watching || !filePath}>Browse</button>
            </div>
          </div>
        </div>

        <div className="offset-search-controls">
          <div className="offset-search-control-group">
            <label>Checkpoints ({checkpoints.length})</label>
            <div className="offset-search-file-row">
              <select
                value={selectedCheckpointId ?? ''}
                onChange={e => setSelectedCheckpointId(e.target.value)}
                disabled={isBusy || checkpoints.length === 0}
                style={{ minWidth: 220 }}
              >
                {checkpoints.length === 0 && <option value="">— none —</option>}
                {checkpoints.map(cp => (
                  <option key={cp.id} value={cp.id}>
                    {cp.label} — {cp.createdAt.toLocaleTimeString()}
                  </option>
                ))}
              </select>
              <button onClick={checkpointNow} disabled={isBusy || watching || !filePath || !outDir}>
                + Checkpoint Now
              </button>
              <button onClick={rollback} disabled={isBusy || !selectedCheckpointId}>
                ⟲ Rollback
              </button>
            </div>
          </div>

          <div className="offset-search-control-group">
            <label>Event name</label>
            <input
              type="text"
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              disabled={watching}
              placeholder="e.g. levelup"
              style={{
                background: '#2a2a2a', border: '1px solid #555', borderRadius: 4,
                color: '#e0e0e0', padding: '0.4rem 0.6rem', fontSize: '0.9rem',
              }}
            />
          </div>

          <div className="offset-search-control-group offset-search-start-group">
            {!watching ? (
              <button
                className="offset-search-btn-start"
                onClick={startWatch}
                disabled={isBusy || !filePath || !outDir || !eventName.trim()}
              >
                ▶ Start View
              </button>
            ) : (
              <button className="offset-search-btn-start" onClick={stopWatch}>
                ■ Stop View
              </button>
            )}
            <span style={{ color: watching ? '#ff6b35' : '#666', fontSize: '0.9rem', alignSelf: 'center' }}>
              {captures.length} / {MAX_CAPTURES_PER_EVENT}
            </span>
          </div>
        </div>

        <div className="offset-search-status">{status}</div>

        {captures.length > 0 && (
          <div className="offset-search-table-wrapper">
            <table className="offset-search-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>File</th>
                  <th>Time</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {captures.map(c => (
                  <tr key={c.index}>
                    <td className="offset-search-offset-cell">{c.index}</td>
                    <td className="offset-search-offset-cell">{c.fileName}</td>
                    <td className="offset-search-value-cell">{c.capturedAt.toLocaleTimeString()}</td>
                    <td className="offset-search-value-cell">{c.size.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
