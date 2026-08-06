import fs from "fs-extra";
import path from "path";
import os from "os";

/**
 * Atomic write: writes to a temp file first, then renames to target.
 * This prevents corruption if the process crashes mid-write.
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.ensureDir(dir);

  const tempPath = path.join(
    dir,
    `.zaahix-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  try {
    await fs.writeFile(tempPath, content, "utf-8");
    await fs.rename(tempPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try {
      await fs.remove(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Create a backup of a file before modifying it.
 * Returns the backup path, or null if no backup was created.
 */
export async function createBackup(filePath: string): Promise<string | null> {
  const exists = await fs.pathExists(filePath);
  if (!exists) return null;

  const backupPath = `${filePath}.bak`;
  await fs.copy(filePath, backupPath);
  return backupPath;
}

/**
 * Remove a backup file.
 */
export async function removeBackup(filePath: string): Promise<void> {
  const backupPath = `${filePath}.bak`;
  try {
    await fs.remove(backupPath);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Check if a file exists and is a regular file (not a directory).
 */
export async function isFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Get file size in bytes.
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}
