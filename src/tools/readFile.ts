import fs from "fs-extra";
import { validatePath } from "../utils/path";


export async function readFile(path: string): Promise<string> {
  try {
    if (!validatePath(path)) {
      return `❌ Access denied: "${path}" is outside workspace or blocked`;
    }
    const content = await fs.readFile(path, "utf-8");
    if (content.length > 150000) {
      return content.substring(0, 150000) + `\n... (truncated ${content.length - 150000} bytes)`;
    }
    return content;
  } catch (err: any) {
    return `❌ Error: ${err.message}`;
  }
}