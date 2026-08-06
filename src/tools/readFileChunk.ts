import fs from "fs-extra";
import { validatePath } from "../utils/path";


export async function readFileChunk(path: string, start = 0, length = 2000): Promise<{ content: string; start: number; length: number; total: number } | string> {
  try {
    if (!validatePath(path)) {
      return `❌ Access denied: "${path}" is outside workspace or blocked`;
    }

    const content = await fs.readFile(path, "utf-8");
    const total = content.length;

    if (start < 0) start = 0;
    if (start > total) start = total;

    const end = Math.min(total, start + length);
    const slice = content.slice(start, end);

    return { content: slice, start, length: slice.length, total };
  } catch (err: any) {
    return `❌ Error: ${err.message}`;
  }
}
