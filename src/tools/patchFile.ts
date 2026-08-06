import fs from "fs-extra";
import { validatePath } from "../utils/path";
import { atomicWrite, createBackup, removeBackup } from "../utils/fs";
import chalk from "chalk";

export async function patchFile(
  filePath: string,
  search: string,
  replace: string
): Promise<string> {
  try {
    if (!validatePath(filePath)) {
      return `❌ Access denied: Cannot edit "${filePath}"`;
    }

    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return `❌ Error: File does not exist at "${filePath}"`;
    }

    const content = await fs.readFile(filePath, "utf-8");

    // Count occurrences of the search block
    const firstIndex = content.indexOf(search);
    if (firstIndex === -1) {
      return `❌ Error: The search block was not found in "${filePath}". Ensure you match the spacing, indentation, and content exactly.`;
    }

    const lastIndex = content.lastIndexOf(search);
    if (firstIndex !== lastIndex) {
      return `❌ Error: Multiple occurrences of the search block were found in "${filePath}". Please make the search block more specific to target a unique region.`;
    }

    // Create backup before patching
    await createBackup(filePath);

    // Perform replacement
    const newContent = content.substring(0, firstIndex) + replace + content.substring(firstIndex + search.length);

    // Use atomic write
    await atomicWrite(filePath, newContent);

    // Show diff
    const searchLines = search.split("\n");
    const replaceLines = replace.split("\n");
    console.log(chalk.gray(`\n📝 Diff for ${filePath}:`));
    console.log(chalk.red(`- ${searchLines[0]}${searchLines.length > 1 ? "..." : ""}`));
    console.log(chalk.green(`+ ${replaceLines[0]}${replaceLines.length > 1 ? "..." : ""}`));

    // Remove backup on success
    await removeBackup(filePath);

    return `✅ File patched successfully: "${filePath}"`;
  } catch (err: any) {
    return `❌ Error patching file: ${err.message}`;
  }
}
