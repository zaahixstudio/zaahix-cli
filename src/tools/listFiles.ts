import fs from "fs-extra";
import path from "path";
import { validatePath } from "../utils/path";

export async function listFiles(dir: string = ".") {
  if (!validatePath(dir)) {
    return `❌ Access denied: "${dir}" is outside workspace or blocked`;
  }
  const items = await fs.readdir(dir);

  const result = [];

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = await fs.stat(fullPath);

    result.push({
      name: item,
      path: path.relative(process.cwd(), fullPath).replace(/\\/g, "/"),
      type: stats.isDirectory() ? "folder" : "file",
      size: stats.isDirectory() ? undefined : stats.size,
    });
  }

  return result;
}