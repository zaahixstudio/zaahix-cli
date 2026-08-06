import { validatePath } from "../utils/path";
import { atomicWrite, createBackup, removeBackup } from "../utils/fs";

export async function writeFile(
  filePath: string,
  content: string,
  options: { backup?: boolean } = {}
): Promise<string> {
  try {
    if (!validatePath(filePath)) {
      return `❌ Access denied: Cannot write to "${filePath}"`;
    }

    // Create backup if requested
    if (options.backup) {
      await createBackup(filePath);
    }

    // Use atomic write to prevent corruption
    await atomicWrite(filePath, content);

    // Remove backup on success
    if (options.backup) {
      await removeBackup(filePath);
    }

    return `✅ File written: ${filePath}`;
  } catch (err: any) {
    return `❌ Error writing file: ${err.message}`;
  }
}