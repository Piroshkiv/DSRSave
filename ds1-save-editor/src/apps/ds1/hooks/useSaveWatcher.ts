import { useState, useRef, useCallback, useEffect } from 'react';
import { watchFileMtime, MtimeWatcher } from '../../../shared/utils/watchFileMtime';
import { decryptAesCbc, encryptAesCbc, calculateMD5 } from '../lib/crypto';
import { Character } from '../lib/Character';
import {
  SAVE_FILE_SIZE,
  SAVE_SLOT_SIZE,
  BASE_SLOT_OFFSET,
  USER_DATA_SIZE,
  USER_DATA_FILE_COUNT,
  AES_KEY,
} from '../lib/constants';

export interface CaptureEntry {
  /** 1-based index within the event */
  index: number;
  fileName: string;
  /** full path of the written .bin */
  path: string;
  capturedAt: Date;
  /** decrypted slot size in bytes */
  size: number;
}

export interface CheckpointEntry {
  /** unique id, also part of the file name */
  id: string;
  /** user-facing label (event name or 'initial'/'manual') */
  label: string;
  fileName: string;
  /** full path of the checkpoint .sl2 copy */
  path: string;
  createdAt: Date;
}

export interface SaveWatcherState {
  filePath: string | null;
  slot: number;
  outDir: string | null;
  eventName: string;
  watching: boolean;
  captures: CaptureEntry[];
  /** event folders found in outDir (past watch runs) */
  eventDirs: string[];
  checkpoints: CheckpointEntry[];
  selectedCheckpointId: string | null;
  status: string;
  isBusy: boolean;
}

const POLL_INTERVAL_MS = 500;
const MAX_CAPTURES_PER_EVENT = 100;
const CHECKPOINT_PREFIX = 'checkpoint_';
const LS_KEY = 'ds1-save-watcher';

export const SLOT_COUNT = USER_DATA_FILE_COUNT;

function dirName(path: string): string {
  const i = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return i > 0 ? path.slice(0, i) : path;
}

function joinPath(...parts: string[]): string {
  return parts.join('\\');
}

function sanitizeLabel(label: string): string {
  return label.replace(/[^\w\-]+/g, '_');
}

async function readSaveFile(path: string): Promise<Uint8Array> {
  const fs = await import('@tauri-apps/plugin-fs');
  return fs.readFile(path);
}

/** Decrypt one character slot out of raw DRAKS0005.sl2 bytes (PC/DSR layout) */
async function decryptSlot(sl2Bytes: Uint8Array, slot: number): Promise<Uint8Array> {
  if (sl2Bytes.length < SAVE_FILE_SIZE) {
    throw new Error('Invalid save file size (expected PC DSR DRAKS0005.sl2)');
  }
  const offset = BASE_SLOT_OFFSET + slot * SAVE_SLOT_SIZE;
  const iv = sl2Bytes.slice(offset, offset + 16);
  const encrypted = sl2Bytes.slice(offset + 16, offset + 16 + USER_DATA_SIZE);
  const decrypted = await decryptAesCbc(encrypted, AES_KEY, iv);
  if (new Character(decrypted, slot).isEmpty) {
    throw new Error(`Slot ${slot} is empty`);
  }
  return decrypted;
}

/** Rebuild checkpoint list from checkpoint_*.sl2 files on disk */
async function scanCheckpoints(outDir: string): Promise<CheckpointEntry[]> {
  const fs = await import('@tauri-apps/plugin-fs');
  if (!(await fs.exists(outDir))) return [];
  const entries = await fs.readDir(outDir);
  const found: CheckpointEntry[] = [];
  for (const e of entries) {
    if (e.isFile && e.name.startsWith(CHECKPOINT_PREFIX) && e.name.endsWith('.sl2')) {
      const id = e.name.slice(CHECKPOINT_PREFIX.length, -'.sl2'.length);
      const path = joinPath(outDir, e.name);
      let createdAt = new Date(0);
      try {
        const info = await fs.stat(path);
        if (info.mtime) createdAt = new Date(info.mtime);
      } catch { /* keep epoch */ }
      // label = id without the trailing _HHMMSS timestamp
      const label = id.replace(/_\d{6}$/, '');
      found.push({ id, label, fileName: e.name, path, createdAt });
    }
  }
  found.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return found;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Find the max existing capture index in an event dir (to continue numbering, never overwrite) */
async function maxExistingIndex(eventDir: string, eventName: string): Promise<number> {
  const fs = await import('@tauri-apps/plugin-fs');
  if (!(await fs.exists(eventDir))) return 0;
  const entries = await fs.readDir(eventDir);
  let max = 0;
  const re = new RegExp(`^${escapeRe(eventName)}_(\\d+)\\.bin$`);
  for (const e of entries) {
    const m = e.name.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

/** List event capture folders inside outDir */
async function scanEventDirs(outDir: string): Promise<string[]> {
  const fs = await import('@tauri-apps/plugin-fs');
  if (!(await fs.exists(outDir))) return [];
  const entries = await fs.readDir(outDir);
  return entries.filter(e => e.isDirectory).map(e => e.name).sort();
}

/** Read all captures of an event from disk */
async function readEventCaptures(outDir: string, eventName: string): Promise<CaptureEntry[]> {
  const fs = await import('@tauri-apps/plugin-fs');
  const dir = joinPath(outDir, eventName);
  if (!(await fs.exists(dir))) return [];
  const entries = await fs.readDir(dir);
  const re = new RegExp(`^${escapeRe(eventName)}_(\\d+)\\.bin$`);
  const caps: CaptureEntry[] = [];
  for (const e of entries) {
    if (!e.isFile) continue;
    const m = e.name.match(re);
    if (!m) continue;
    const path = joinPath(dir, e.name);
    let capturedAt = new Date(0);
    let size = 0;
    try {
      const info = await fs.stat(path);
      if (info.mtime) capturedAt = new Date(info.mtime);
      size = info.size;
    } catch { /* keep defaults */ }
    caps.push({ index: parseInt(m[1], 10), fileName: e.name, path, capturedAt, size });
  }
  caps.sort((a, b) => a.index - b.index);
  return caps;
}

function loadPersisted(): Partial<Pick<SaveWatcherState, 'filePath' | 'slot' | 'outDir' | 'eventName'>> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useSaveWatcher() {
  const persisted = useRef(loadPersisted()).current;
  const [state, setState] = useState<SaveWatcherState>({
    filePath: persisted.filePath ?? null,
    slot: persisted.slot ?? 0,
    outDir: persisted.outDir ?? null,
    eventName: persisted.eventName ?? 'event1',
    watching: false,
    captures: [],
    eventDirs: [],
    checkpoints: [],
    selectedCheckpointId: null,
    status: persisted.filePath ? 'Restored previous session' : 'Select a save file to begin',
    isBusy: false,
  });

  // Mutable watcher internals (poll callback must not see stale state)
  const watcherRef = useRef<MtimeWatcher | null>(null);
  const captureCountRef = useRef<number>(0);
  const watchParamsRef = useRef<{ filePath: string; slot: number; eventDir: string; eventName: string } | null>(null);
  const prevSl2Ref = useRef<Uint8Array | null>(null);

  const setStatus = useCallback((status: string) =>
    setState(s => ({ ...s, status })), []);

  const stopWatcher = () => {
    watcherRef.current?.stop();
    watcherRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => stopWatcher, []);

  // Persist settings + rescan checkpoints from disk whenever file/outDir change
  useEffect(() => {
    const { filePath, slot, outDir, eventName } = state;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ filePath, slot, outDir, eventName }));
    } catch { /* quota — non-fatal */ }
  }, [state.filePath, state.slot, state.outDir, state.eventName]);

  useEffect(() => {
    const outDir = state.outDir;
    if (!outDir) return;
    let cancelled = false;
    void (async () => {
      try {
        const [checkpoints, eventDirs] = await Promise.all([
          scanCheckpoints(outDir),
          scanEventDirs(outDir),
        ]);
        if (!cancelled) {
          setState(s => ({
            ...s,
            checkpoints,
            eventDirs,
            selectedCheckpointId:
              s.selectedCheckpointId && checkpoints.some(c => c.id === s.selectedCheckpointId)
                ? s.selectedCheckpointId
                : (checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].id : null),
          }));
        }
      } catch (e) {
        if (!cancelled) setStatus(`Checkpoint scan error: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => { cancelled = true; };
  }, [state.outDir, setStatus]);

  /** Copy the current .sl2 into a new uniquely-named checkpoint file */
  const createCheckpoint = useCallback(async (filePath: string, outDir: string, label: string): Promise<CheckpointEntry> => {
    const bytes = await readSaveFile(filePath);
    // sanity: the file must look like a PC DSR save
    if (bytes.length < SAVE_FILE_SIZE) {
      throw new Error('Invalid save file size (expected PC DSR DRAKS0005.sl2)');
    }

    const now = new Date();
    const hhmmss = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const id = `${sanitizeLabel(label)}_${hhmmss}`;
    const fileName = `${CHECKPOINT_PREFIX}${id}.sl2`;
    const path = joinPath(outDir, fileName);

    const fs = await import('@tauri-apps/plugin-fs');
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path, bytes);

    const entry: CheckpointEntry = { id, label, fileName, path, createdAt: now };
    setState(s => ({
      ...s,
      checkpoints: [...s.checkpoints, entry],
      selectedCheckpointId: entry.id,
      status: `Checkpoint "${label}" created → ${fileName}`,
    }));
    return entry;
  }, []);

  /** Pick the .sl2 via dialog; auto-creates the initial checkpoint */
  const browseFile = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({
        title: 'Open DS1 Save File',
        filters: [{ name: 'DS1 Save', extensions: ['sl2'] }],
        multiple: false,
      });
      if (!path || typeof path !== 'string') return;

      const outDir = joinPath(dirName(path), 'watcher');
      setState(s => ({ ...s, isBusy: true, filePath: path, outDir, status: 'Creating checkpoint...' }));
      await createCheckpoint(path, outDir, 'initial');
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setState(s => ({ ...s, isBusy: false }));
    }
  }, [createCheckpoint, setStatus]);

  const browseOutDir = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const dir = await open({ title: 'Output directory for .bin captures', directory: true });
      if (dir && typeof dir === 'string') setState(s => ({ ...s, outDir: dir }));
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [setStatus]);

  const setSlot = useCallback((slot: number) => setState(s => ({ ...s, slot })), []);
  const setEventName = useCallback((eventName: string) => setState(s => ({ ...s, eventName })), []);
  const setSelectedCheckpointId = useCallback((id: string) =>
    setState(s => ({ ...s, selectedCheckpointId: id })), []);

  /** Manual checkpoint of the current save state (label = current event name) */
  const checkpointNow = useCallback(async () => {
    const { filePath, outDir, eventName } = state;
    if (!filePath || !outDir) return;
    setState(s => ({ ...s, isBusy: true, status: 'Creating checkpoint...' }));
    try {
      await createCheckpoint(filePath, outDir, eventName.trim() || 'manual');
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setState(s => ({ ...s, isBusy: false }));
    }
  }, [state, createCheckpoint, setStatus]);

  /** Write the selected checkpoint back over the save file (game must be closed) */
  const rollback = useCallback(async () => {
    const { filePath, watching, checkpoints, selectedCheckpointId } = state;
    const cp = checkpoints.find(c => c.id === selectedCheckpointId);
    if (!filePath || !cp) return;
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      const ok = await ask(
        `Overwrite the save file with checkpoint "${cp.label}" (${cp.createdAt.toLocaleTimeString()})?\n\nMake sure Dark Souls Remastered is CLOSED — the game caches the save and would overwrite the rollback.`,
        { title: 'Rollback to checkpoint', kind: 'warning' }
      );
      if (!ok) return;

      if (watching) stopWatcher();
      setState(s => ({ ...s, watching: false, isBusy: true, status: 'Rolling back...' }));

      const fs = await import('@tauri-apps/plugin-fs');
      const bytes = await fs.readFile(cp.path);
      await fs.writeFile(filePath, bytes);
      // the rollback itself bumps mtime — resync so a running watch doesn't capture it
      await watcherRef.current?.resync();
      setStatus(`Rolled back to "${cp.label}" (${bytes.length.toLocaleString()} bytes)`);
    } catch (e) {
      setStatus(`Rollback error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setState(s => ({ ...s, isBusy: false }));
    }
  }, [state, setStatus]);

  /** Load past captures of an event folder from disk into the table */
  const loadEventCaptures = useCallback(async (eventName: string) => {
    const { outDir } = state;
    if (!outDir || !eventName) return;
    setState(s => ({ ...s, isBusy: true, status: `Loading captures of "${eventName}"...` }));
    try {
      const caps = await readEventCaptures(outDir, eventName);
      setState(s => ({
        ...s,
        captures: caps,
        status: `Loaded ${caps.length} capture(s) from "${eventName}"`,
      }));
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setState(s => ({ ...s, isBusy: false }));
    }
  }, [state, setStatus]);

  /** Re-encrypt a captured slot .bin back into the save file (game must be closed) */
  const rollbackToCapture = useCallback(async (cap: CaptureEntry) => {
    const { filePath, slot, watching } = state;
    if (!filePath) return;
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      const ok = await ask(
        `Write capture "${cap.fileName}" into slot ${slot} of the save file?\n\nMake sure Dark Souls Remastered is CLOSED — the game caches the save and would overwrite the rollback.`,
        { title: 'Rollback to capture', kind: 'warning' }
      );
      if (!ok) return;

      if (watching) stopWatcher();
      setState(s => ({ ...s, watching: false, isBusy: true, status: 'Writing capture...' }));

      const fs = await import('@tauri-apps/plugin-fs');
      const slotBytes = await fs.readFile(cap.path);
      const sl2 = await fs.readFile(filePath);
      const off = BASE_SLOT_OFFSET + slot * SAVE_SLOT_SIZE;
      if (sl2.length < off + SAVE_SLOT_SIZE) {
        throw new Error('Save file too small for the selected slot');
      }
      // same layout as SaveFileEditor.exportSaveFile: [md5 16][ciphertext USER_DATA_SIZE]
      const iv = sl2.slice(off, off + 16);
      const encrypted = await encryptAesCbc(slotBytes, AES_KEY, iv);
      if (16 + encrypted.length > SAVE_SLOT_SIZE) {
        throw new Error(`Capture size ${slotBytes.length} does not fit the slot after encryption`);
      }
      const checksum = await calculateMD5(encrypted);
      sl2.set(checksum, off);
      sl2.set(encrypted, off + 16);
      await fs.writeFile(filePath, sl2);

      // the rollback itself bumps mtime — resync so a running watch doesn't capture it
      await watcherRef.current?.resync();
      prevSl2Ref.current = sl2;
      setStatus(`Capture "${cap.fileName}" written into slot ${slot} (${slotBytes.length.toLocaleString()} bytes)`);
    } catch (e) {
      setStatus(`Rollback error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setState(s => ({ ...s, isBusy: false }));
    }
  }, [state, setStatus]);

  /** One change tick: capture the slot. Returns false to retry the same change next tick. */
  const captureTick = useCallback(async (): Promise<boolean | void> => {
    const params = watchParamsRef.current;
    if (!params) return;
    try {
      // read + decrypt; on failure (e.g. partial write) retry next tick
      let sl2: Uint8Array;
      try {
        sl2 = await readSaveFile(params.filePath);
      } catch {
        return false; // baseline not advanced — next tick retries
      }

      // The game only rewrites the slots it touched. If the save changed but the
      // watched slot's ciphertext didn't, the user is almost certainly watching
      // the wrong slot — warn instead of capturing an identical .bin.
      const prev = prevSl2Ref.current;
      if (prev && prev.length === sl2.length) {
        const changedSlots: number[] = [];
        for (let i = 0; i < USER_DATA_FILE_COUNT; i++) {
          const off = BASE_SLOT_OFFSET + i * SAVE_SLOT_SIZE;
          const end = off + SAVE_SLOT_SIZE;
          let same = true;
          for (let j = off; j < end; j++) {
            if (sl2[j] !== prev[j]) { same = false; break; }
          }
          if (!same) changedSlots.push(i);
        }
        if (!changedSlots.includes(params.slot)) {
          prevSl2Ref.current = sl2;
          setStatus(
            `⚠ Save changed (slot ${changedSlots.join(', ') || 'none'}) but watched slot ${params.slot} is unchanged — wrong slot? No capture written.`
          );
          return;
        }
      }

      let slotBytes: Uint8Array;
      try {
        slotBytes = await decryptSlot(sl2, params.slot);
      } catch {
        return false; // baseline not advanced — next tick retries
      }
      prevSl2Ref.current = sl2;

      const index = captureCountRef.current + 1;
      const fileName = `${params.eventName}_${String(index).padStart(3, '0')}.bin`;
      const path = joinPath(params.eventDir, fileName);
      const fs = await import('@tauri-apps/plugin-fs');
      await fs.writeFile(path, slotBytes);
      captureCountRef.current = index;

      const entry: CaptureEntry = { index, fileName, path, capturedAt: new Date(), size: slotBytes.length };
      const reachedLimit = index >= MAX_CAPTURES_PER_EVENT;
      if (reachedLimit) stopWatcher();
      setState(s => ({
        ...s,
        captures: [...s.captures, entry],
        watching: reachedLimit ? false : s.watching,
        status: reachedLimit
          ? `Capture limit (${MAX_CAPTURES_PER_EVENT}) reached — watch stopped`
          : `Captured ${fileName} (${slotBytes.length.toLocaleString()} bytes)`,
      }));
    } catch (e) {
      setStatus(`Watch error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [setStatus]);

  const startWatch = useCallback(async () => {
    const { filePath, slot, outDir, eventName } = state;
    if (!filePath || !outDir) return;
    const name = eventName.trim();
    if (!name) {
      setStatus('Enter an event name first');
      return;
    }
    setState(s => ({ ...s, isBusy: true, status: 'Starting watch...' }));
    try {
      // validate slot decrypts before starting
      const sl2 = await readSaveFile(filePath);
      await decryptSlot(sl2, slot);

      // auto-checkpoint the pre-event state, so every event has a restore point
      await createCheckpoint(filePath, outDir, name);

      const eventDir = joinPath(outDir, name);
      const fs = await import('@tauri-apps/plugin-fs');
      await fs.mkdir(eventDir, { recursive: true });

      // never overwrite older captures of the same event — continue numbering
      const existing = await maxExistingIndex(eventDir, name);

      captureCountRef.current = existing;
      watchParamsRef.current = { filePath, slot, eventDir, eventName: name };
      prevSl2Ref.current = sl2;

      stopWatcher();
      watcherRef.current = await watchFileMtime(filePath, captureTick, POLL_INTERVAL_MS);
      setState(s => ({
        ...s,
        watching: true,
        isBusy: false,
        captures: [],
        eventDirs: s.eventDirs.includes(name) ? s.eventDirs : [...s.eventDirs, name].sort(),
        status: existing > 0
          ? `Watching "${name}" — continuing from #${String(existing + 1).padStart(3, '0')} (${existing} older capture(s) kept)`
          : `Watching "${name}" — save the game to capture (slot ${slot}, every ${POLL_INTERVAL_MS} ms)`,
      }));
    } catch (e) {
      setState(s => ({
        ...s,
        isBusy: false,
        status: `Error: ${e instanceof Error ? e.message : String(e)}`,
      }));
    }
  }, [state, captureTick, createCheckpoint, setStatus]);

  const stopWatch = useCallback(() => {
    stopWatcher();
    setState(s => {
      // auto-increment a trailing number in the event name for the next run
      let next = s.eventName;
      if (s.captures.length > 0) {
        const m = s.eventName.match(/^(.*?)(\d+)$/);
        next = m ? `${m[1]}${Number(m[2]) + 1}` : `${s.eventName}2`;
      }
      return {
        ...s,
        watching: false,
        eventName: next,
        status: `Watch stopped — ${s.captures.length} capture(s) saved`,
      };
    });
  }, []);

  return {
    state,
    MAX_CAPTURES_PER_EVENT,
    browseFile,
    browseOutDir,
    setSlot,
    setEventName,
    setSelectedCheckpointId,
    checkpointNow,
    rollback,
    loadEventCaptures,
    rollbackToCapture,
    startWatch,
    stopWatch,
  };
}
