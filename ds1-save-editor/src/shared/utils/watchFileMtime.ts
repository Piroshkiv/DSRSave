// Shared mtime-polling file watcher (Tauri only — uses @tauri-apps/plugin-fs).
// Single polling implementation behind both the editor's auto-detect reload
// (TauriFSAdapter.watchFile) and the dev Save Watcher tabs (useSaveWatcher).

export interface MtimeWatcher {
  /** Stop polling. Safe to call more than once. */
  stop(): void;
  /** Re-read the file's mtime as the new baseline (call after writing the file yourself). */
  resync(): Promise<void>;
}

async function getMtimeMs(path: string): Promise<number> {
  const fs = await import('@tauri-apps/plugin-fs');
  const info = await fs.stat(path);
  return info.mtime ? new Date(info.mtime).getTime() : 0;
}

/**
 * Poll `path` every `intervalMs` and call `onChange` when its mtime changes.
 * Ticks never overlap: while `onChange` runs, further ticks are skipped.
 * If `onChange` returns false the baseline is not advanced, so the next tick
 * retries the same change (for transient read failures mid-write).
 */
export async function watchFileMtime(
  path: string,
  onChange: (mtimeMs: number) => boolean | void | Promise<boolean | void>,
  intervalMs: number,
): Promise<MtimeWatcher> {
  let lastMtime: number;
  try {
    lastMtime = await getMtimeMs(path);
  } catch {
    lastMtime = Date.now(); // file unreadable right now — treat "now" as baseline
  }

  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    void (async () => {
      try {
        const mtime = await getMtimeMs(path);
        if (mtime !== lastMtime) {
          const advance = await onChange(mtime);
          if (advance !== false) lastMtime = mtime;
        }
      } catch {
        // stat failed (file locked/moved) — retry next tick
      } finally {
        busy = false;
      }
    })();
  }, intervalMs);

  return {
    stop() { clearInterval(timer); },
    async resync() { lastMtime = await getMtimeMs(path); },
  };
}
