/**
 * Formats file path to show last N directories
 * Example: "C:\Users\...\NBGI\DARK SOULS REMASTERED\1269862397\DRAKS0005.sl2"
 * becomes: "...\NBGI\DARK SOULS REMASTERED\1269862397\DRAKS0005.sl2"
 *
 * @param file File object
 * @param maxDirs Maximum number of directories to show (default: 3)
 * @returns Formatted path string
 */
export function formatFilePath(file: File, maxDirs: number = 3): string {
  // Try to get full path from webkitRelativePath (Chrome/Edge)
  const webkitPath = (file as any).webkitRelativePath;

  if (webkitPath) {
    return formatPathString(webkitPath, maxDirs);
  }

  // Try to extract path from file name if it contains path separators
  if (file.name.includes('\\') || file.name.includes('/')) {
    return formatPathString(file.name, maxDirs);
  }

  // Browsers don't provide full path due to security restrictions
  // Show standard Dark Souls path format with filename
  return `...\\NBGI\\DARK SOULS REMASTERED\\[Steam ID]\\${file.name}`;
}

/**
 * Formats a path string to show only last N directories
 *
 * @param fullPath Full path string
 * @param maxDirs Maximum number of directories to show
 * @returns Formatted path with "..." prefix
 */
function formatPathString(fullPath: string, maxDirs: number): string {
  // Normalize path separators
  const normalized = fullPath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(p => p.length > 0);

  if (parts.length <= maxDirs + 1) {
    // If path is short enough, return as is
    return parts.join('\\');
  }

  // Take last maxDirs directories + filename
  const relevantParts = parts.slice(-maxDirs - 1);
  return '...\\' + relevantParts.join('\\');
}

/**
 * Attempts to get file path from File System Access API handle
 * Note: This is limited by browser security - full paths are not available
 *
 * @param file File object
 * @param handle FileSystemFileHandle if available
 * @returns Best available path representation
 */
export async function getFilePathFromHandle(
  file: File,
  handle?: FileSystemFileHandle | null
): Promise<string> {
  // Try to get path from handle (not supported by current API, but future-proof)
  if (handle && 'getFile' in handle) {
    try {
      // Future API might provide path information
      // For now, this will just return the name
      const handleFile = await handle.getFile();
      return formatFilePath(handleFile);
    } catch (error) {
      console.debug('Could not extract path from handle:', error);
    }
  }

  // Fallback to file object
  return formatFilePath(file);
}

/**
 * Extracts just the filename from a path string
 *
 * @param pathOrFilename Path or filename string
 * @returns Just the filename without path
 */
export function extractFilename(pathOrFilename: string): string {
  // Handle both forward and backward slashes
  const normalized = pathOrFilename.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || pathOrFilename;
}
