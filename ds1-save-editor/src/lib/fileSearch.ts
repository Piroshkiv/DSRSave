// Recursive file search utility for File System Access API

export interface SearchResult {
  fileHandle: FileSystemFileHandle;
  path: string[];
}

/**
 * Recursively searches for .sl2 files in a directory
 * @param dirHandle - Directory handle to search in
 * @param maxDepth - Maximum recursion depth (default: 10)
 * @param currentPath - Current path for tracking (internal use)
 * @param currentDepth - Current depth (internal use)
 * @returns First .sl2 file found, or null
 */
export async function findFirstSL2File(
  dirHandle: FileSystemDirectoryHandle,
  maxDepth: number = 10,
  currentPath: string[] = [],
  currentDepth: number = 0
): Promise<SearchResult | null> {
  // Prevent infinite recursion
  if (currentDepth > maxDepth) {
    return null;
  }

  try {
    // Iterate through directory entries
    for await (const entry of dirHandle.values()) {
      // Check if it's a .sl2 file
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.sl2')) {
        console.log(`Found .sl2 file: ${[...currentPath, entry.name].join('/')}`);
        return {
          fileHandle: entry as FileSystemFileHandle,
          path: [...currentPath, entry.name]
        };
      }

      // Recursively search subdirectories
      if (entry.kind === 'directory') {
        try {
          const subDirHandle = entry as FileSystemDirectoryHandle;
          const result = await findFirstSL2File(
            subDirHandle,
            maxDepth,
            [...currentPath, entry.name],
            currentDepth + 1
          );

          if (result) {
            return result;
          }
        } catch (err) {
          // Skip directories we can't access
          console.warn(`Cannot access directory: ${entry.name}`, err);
          continue;
        }
      }
    }
  } catch (err) {
    console.error('Error searching directory:', err);
  }

  return null;
}

/**
 * Finds all .sl2 files in a directory (non-recursive for performance)
 * @param dirHandle - Directory handle to search in
 * @returns Array of found .sl2 files
 */
export async function findAllSL2Files(
  dirHandle: FileSystemDirectoryHandle,
  maxDepth: number = 10,
  currentPath: string[] = [],
  currentDepth: number = 0
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  if (currentDepth > maxDepth) {
    return results;
  }

  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.sl2')) {
        results.push({
          fileHandle: entry as FileSystemFileHandle,
          path: [...currentPath, entry.name]
        });
      }

      if (entry.kind === 'directory') {
        try {
          const subDirHandle = entry as FileSystemDirectoryHandle;
          const subResults = await findAllSL2Files(
            subDirHandle,
            maxDepth,
            [...currentPath, entry.name],
            currentDepth + 1
          );
          results.push(...subResults);
        } catch (err) {
          console.warn(`Cannot access directory: ${entry.name}`, err);
          continue;
        }
      }
    }
  } catch (err) {
    console.error('Error searching directory:', err);
  }

  return results;
}
