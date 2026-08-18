import { ItemCatalog, type RawItemDatabase } from './ItemCatalog';

/**
 * I/O for the item catalogue, kept apart from parsing so `ItemCatalog.from`
 * stays a pure function that needs no `fetch` to test.
 */

/** Candidate URLs for a catalogue file, ordered by how likely they are to work. */
export function catalogPaths(fileName: string): string[] {
  // Electron serves the app over file://, where an absolute path resolves to
  // the filesystem root rather than the bundle.
  const isFileProtocol =
    typeof window !== 'undefined' && window.location?.protocol === 'file:';

  return isFileProtocol
    ? [`./json/${fileName}`, `/json/${fileName}`]
    : [`/json/${fileName}`, `./json/${fileName}`];
}

/** Fetch the raw catalogue JSON, trying each candidate path in turn. */
export async function fetchItemDatabase(fileName: string): Promise<RawItemDatabase> {
  let lastError: Error | null = null;

  for (const path of catalogPaths(fileName)) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return (await response.json()) as RawItemDatabase;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[ItemCatalog] could not load ${path}:`, lastError);
    }
  }

  throw new Error(
    `Could not load item database "${fileName}" from any path. Last error: ${lastError?.message}`,
  );
}

/** Fetch and index a catalogue in one step. */
export async function loadItemCatalog(
  fileName: string,
): Promise<{ catalog: ItemCatalog; raw: RawItemDatabase }> {
  const raw = await fetchItemDatabase(fileName);
  return { catalog: ItemCatalog.from(raw), raw };
}
