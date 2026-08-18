import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '../../ds1/components/ConfirmModal';
import {
  DS3BackupMeta,
  MAX_PER_SLOT_LIMIT,
  deleteBackup,
  deleteBackups,
  formatBytes,
  listBackups,
} from '../lib/backups';
import { formatSteamIdHex } from '../lib/steamId';

interface BackupsTabProps {
  /** Slot whose history is shown (0-9). */
  slot: number;
  /**
   * SteamID64 (decimal) the loaded save belongs to, '' when it has none.
   * DS3 slots name their owner, so this — not the character name — is what
   * separates two histories that happen to share a slot.
   */
  currentSteamId: string;
  maxPerSlot: number;
  onMaxPerSlotChange: (value: number) => void;
  /** Bumped by the editor whenever the store changes. */
  version: number;
  onBackupNow: () => Promise<{ created: boolean; duplicate?: boolean }>;
  onRestore: (id: number) => Promise<void>;
  onChanged: () => void;
  canBackupNow: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  auto: 'auto',
  manual: 'manual',
  'pre-restore': 'pre-restore',
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Steam IDs are shown in the hex form, the one that names the save folder. */
function formatId(decimal: string): string {
  if (!decimal) return '—';
  try {
    return formatSteamIdHex(BigInt(decimal));
  } catch {
    return decimal;
  }
}

export const BackupsTab: React.FC<BackupsTabProps> = ({
  slot,
  currentSteamId,
  maxPerSlot,
  onMaxPerSlotChange,
  version,
  onBackupNow,
  onRestore,
  onChanged,
  canBackupNow,
}) => {
  const [rows, setRows] = useState<DS3BackupMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyCurrentAccount, setOnlyCurrentAccount] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string>('');
  const [confirm, setConfirm] = useState<
    { kind: 'restore' | 'delete'; row: DS3BackupMeta } | { kind: 'delete-all'; row?: undefined } | null
  >(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listBackups(slot));
    } catch (error) {
      console.error('[BackupsTab] Failed to list backups:', error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [slot]);

  useEffect(() => { void refresh(); }, [refresh, version]);

  // A filter on an ID no backup in this slot carries would hide everything
  const idFilterActive = onlyCurrentAccount && currentSteamId !== '';

  const visible = useMemo(
    () => (idFilterActive ? rows.filter(row => row.steamId === currentSteamId) : rows),
    [rows, idFilterActive, currentSteamId]
  );

  const totalSize = useMemo(() => rows.reduce((sum, row) => sum + row.storedSize, 0), [rows]);

  const handleBackupNow = async () => {
    setNotice('');
    try {
      const result = await onBackupNow();
      setNotice(result.created
        ? 'Backup created.'
        : 'Nothing changed since the last backup.');
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const { kind } = confirm;
    setConfirm(null);
    setBusyId(confirm.row?.id ?? -1);
    setNotice('');
    try {
      if (kind === 'delete') {
        await deleteBackup(confirm.row.id);
      } else if (kind === 'delete-all') {
        // Removes exactly what the list is showing, so the ID filter narrows it too
        await deleteBackups(visible.map(row => row.id));
      } else {
        await onRestore(confirm.row.id);
        setNotice('Restored into the editor — save the file to write it to disk.');
      }
      onChanged();
      await refresh();
    } catch (error) {
      console.error('[BackupsTab] Action failed:', error);
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyId(null);
    }
  };

  const confirmTitle = !confirm
    ? ''
    : confirm.kind === 'restore'
      ? 'Restore this backup?'
      : confirm.kind === 'delete-all'
        ? 'Delete these backups?'
        : 'Delete this backup?';

  const foreignAccount = confirm?.kind === 'restore'
    && currentSteamId !== ''
    && confirm.row.steamId !== ''
    && confirm.row.steamId !== currentSteamId;

  const confirmMessage = !confirm
    ? ''
    : confirm.kind === 'delete'
      ? `"${confirm.row.name || 'Unnamed'}" from ${formatTime(confirm.row.createdAt)} will be removed from the history.`
      : confirm.kind === 'delete-all'
        ? `${visible.length} backup(s) of slot ${slot + 1}${idFilterActive ? ' for this Steam ID' : ''} will be removed from the history.`
        : `"${confirm.row.name || 'Unnamed'}" (Lv ${confirm.row.level}, ${formatTime(confirm.row.createdAt)}) ` +
          `will replace slot ${slot + 1} in the editor. The current character is backed up first, ` +
          `and nothing is written to disk until you save.` +
          (foreignAccount
            ? `\n\nThis backup belongs to Steam ID ${formatId(confirm.row.steamId)}; ` +
              `it will be rebound to this save's account on restore.`
            : '');

  return (
    <div className="backups-tab">
      <div className="backups-toolbar">
        <button
          className="ds1-safemode-btn backups-toggle"
          onClick={() => setOnlyCurrentAccount(v => !v)}
          disabled={!currentSteamId}
          title="Show only backups taken from this save's Steam account"
        >
          <span className={`ds1-safemode-dot ${idFilterActive ? 'on' : 'off'}`}>●</span>
          This Steam ID only
          <span className={`ds1-safemode-badge ${idFilterActive ? 'on' : 'off'}`}>
            {idFilterActive ? 'ON' : 'OFF'}
          </span>
        </button>

        <label className="backups-max">
          <span>Keep per slot</span>
          <input
            type="number"
            min={1}
            max={MAX_PER_SLOT_LIMIT}
            value={maxPerSlot}
            onChange={e => onMaxPerSlotChange(Number(e.target.value))}
          />
        </label>

        <div className="backups-spacer" />

        <span className="backups-usage">
          {rows.length} stored · {formatBytes(totalSize)}
        </span>

        <button
          className="backups-btn danger"
          onClick={() => setConfirm({ kind: 'delete-all' })}
          disabled={visible.length === 0 || busyId !== null}
        >
          Delete all
        </button>

        <button
          className="backups-btn primary"
          onClick={handleBackupNow}
          disabled={!canBackupNow}
          title={canBackupNow ? '' : 'This slot is empty — there is nothing to back up'}
        >
          Back up now
        </button>
      </div>

      {notice && <div className="backups-notice">{notice}</div>}

      {loading ? (
        <div className="backups-empty">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="backups-empty">
          {rows.length === 0
            ? 'No backups for this slot yet.'
            : 'No backups for this Steam ID in this slot.'}
        </div>
      ) : (
        <div className="backups-table-wrap">
          <table className="backups-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Name</th>
                <th>Level</th>
                <th>Slot</th>
                <th>Steam ID</th>
                <th>Source</th>
                <th>Size</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(row => {
                const foreign = currentSteamId !== '' && row.steamId !== '' && row.steamId !== currentSteamId;
                return (
                  <tr key={row.id} className={busyId === row.id ? 'busy' : ''}>
                    <td className="mono">{formatTime(row.createdAt)}</td>
                    <td>{row.name || 'Unnamed'}</td>
                    <td className="mono">{row.level}</td>
                    <td className="mono">{row.slot + 1}</td>
                    <td className={`mono${foreign ? ' foreign' : ''}`} title={row.steamId || 'no Steam ID stored'}>
                      {formatId(row.steamId)}
                    </td>
                    <td>
                      <span className={`backups-source ${row.source}`}>
                        {SOURCE_LABELS[row.source] ?? row.source}
                      </span>
                    </td>
                    <td className="mono">{formatBytes(row.storedSize)}</td>
                    <td className="backups-actions">
                      <button
                        className="backups-btn"
                        disabled={busyId !== null}
                        onClick={() => setConfirm({ kind: 'restore', row })}
                      >
                        Restore
                      </button>
                      <button
                        className="backups-btn danger"
                        disabled={busyId !== null}
                        onClick={() => setConfirm({ kind: 'delete', row })}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={confirm !== null}
        title={confirmTitle}
        message={confirmMessage}
        type={confirm?.kind === 'restore' ? 'warning' : 'neutral'}
        confirmText={confirm?.kind === 'restore' ? 'Restore' : 'Delete'}
        cancelText="Cancel"
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      <style>{`
        .backups-tab {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        /* Mirrors .tabs-header: no panel, just a hairline under the row */
        .backups-toolbar {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex-wrap: wrap;
          padding: 0 0.15rem 0.55rem;
          background: transparent;
          border-bottom: 1px solid #252525;
        }

        .backups-spacer { flex: 1; }

        .backups-max {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          color: #aaa;
          user-select: none;
        }

        /* Same control as the Safe Mode toggle in the header, one size down */
        .backups-toggle {
          padding: 0.22rem 0.5rem;
          font-size: 0.7rem;
          gap: 0.3rem;
        }

        .backups-toggle .ds1-safemode-badge {
          padding: 0.05rem 0.28rem;
          font-size: 0.6rem;
        }

        .backups-toggle .ds1-safemode-dot { font-size: 0.5rem; }

        .backups-toggle:disabled { opacity: 0.4; cursor: not-allowed; }

        .backups-max input {
          width: 4rem;
          padding: 0.25rem 0.45rem;
          background: rgba(255, 255, 255, 0.06);
          border: none;
          border-radius: 6px;
          color: #ddd;
          font-size: 0.8rem;
          outline: none;
        }

        .backups-max input:focus { background: rgba(255, 255, 255, 0.1); }

        .backups-usage {
          font-size: 0.75rem;
          color: #666;
        }

        /* Buttons read as labels: bare text, no frame, no underline — only the
           colour moves, green for restoring and red for destroying */
        .backups-btn {
          padding: 0.25rem 0.1rem;
          background: transparent;
          border: none;
          border-radius: 0;
          color: #d4d4d4;
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 400;
          white-space: nowrap;
          transition: color 0.15s;
        }

        .backups-btn:hover:not(:disabled) { color: #2f9e57; }

        .backups-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .backups-btn.primary { color: #ececec; }

        .backups-btn.primary:hover:not(:disabled) { color: #2f9e57; }

        .backups-btn.danger:hover:not(:disabled) { color: #c0392b; }

        .backups-notice {
          padding: 0 0.15rem;
          background: transparent;
          font-size: 0.78rem;
          color: #ff8f5e;
        }

        .backups-empty {
          padding: 2rem 1rem;
          text-align: center;
          color: #666;
          font-size: 0.85rem;
        }

        .backups-table-wrap { overflow-x: auto; }

        .backups-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }

        .backups-table th {
          text-align: left;
          padding: 0.4rem 0.6rem;
          color: #777;
          font-weight: normal;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .backups-table td {
          padding: 0.45rem 0.6rem;
          color: #bbb;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .backups-table tr:hover td { background: rgba(255, 107, 53, 0.04); }
        .backups-table tr.busy { opacity: 0.5; }

        .backups-table .mono {
          font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
          color: #999;
        }

        /* An ID that isn't this save's: restoring it means a rebind */
        .backups-table .mono.foreign { color: #d08a4a; }

        .backups-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .backups-source {
          padding: 0.1rem 0.4rem;
          border-radius: 3px;
          font-size: 0.7rem;
          background: rgba(255, 255, 255, 0.06);
          color: #888;
        }

        .backups-source.manual { background: rgba(47, 158, 87, 0.14); color: #2f9e57; }
        .backups-source.pre-restore { background: rgba(59, 130, 246, 0.12); color: #7aa7f0; }
      `}</style>
    </div>
  );
};
