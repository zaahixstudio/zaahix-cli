import fs from "fs-extra";
import path from "path";

export interface ProjectContext {
  files: string[];
  structure: Record<string, any>;
  packageJson?: any;
  tsConfig?: any;
  fileStats: {
    totalFiles: number;
    totalFolders: number;
    totalTypescriptFiles: number;
    totalSizeBytes: number;
    extensionCounts: Record<string, number>;
  };
}

const ignoredFolders = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
];

export async function scanProject(
  dir: string = "."
): Promise<ProjectContext> {
  const files: string[] = [];
  const structure: Record<string, any> = {};

  let folderCount = 0;
  let tsCount = 0;
  let totalSize = 0;
  const extensionCounts: Record<string, number> = {};

  function normalizePath(fullPath: string) {
    return path.relative(path.resolve(dir), fullPath).replace(/\\/g, "/");
  }

  async function walk(
    currentPath: string,
    tree: Record<string, any>
  ) {
    const items = await fs.readdir(currentPath);

    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stats = await fs.stat(fullPath);

      if (
        stats.isDirectory() &&
        ignoredFolders.includes(item)
      ) {
        continue;
      }

      if (stats.isDirectory()) {
        folderCount++;

        tree[item] = {};

        await walk(fullPath, tree[item]);
      } else {
        const relative = normalizePath(fullPath);

        tree[item] = "file";

        files.push(relative);
        totalSize += stats.size;

        const ext = path.extname(item) || "<none>";
        extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;

        if (
          item.endsWith(".ts") ||
          item.endsWith(".tsx")
        ) {
          tsCount++;
        }
      }
    }
  }

  await walk(dir, structure);

  let packageJson = null;
  let tsConfig = null;

  try {
    packageJson = await fs.readJson(
      path.join(dir, "package.json")
    );
  } catch {}

  try {
    tsConfig = await fs.readJson(
      path.join(dir, "tsconfig.json")
    );
  } catch {}

  return {
    files,
    structure,
    packageJson,
    tsConfig,
    fileStats: {
      totalFiles: files.length,
      totalFolders: folderCount,
      totalTypescriptFiles: tsCount,
      totalSizeBytes: totalSize,
      extensionCounts,
    },
  };
}