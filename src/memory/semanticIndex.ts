import fs from "fs-extra";
import path from "path";
import crypto from "crypto";

const INDEX_FILE = ".zaahix/semantic-index.json";
const INDEX_VERSION = 1;

export interface SemanticIndex {
  version: number;
  root: string;
  index: Record<string, string[]>; // token -> array of file paths (serializable)
  fileHashes: Record<string, string>; // file path -> content hash
  lastBuilt: string;
}

interface FileHashes {
  [filePath: string]: string; // file path -> content hash
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function hashContent(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

function getIndexPath(root: string): string {
  return path.join(root, INDEX_FILE);
}

/**
 * Load existing index from disk.
 */
function loadIndex(root: string): SemanticIndex | null {
  try {
    const indexPath = getIndexPath(root);
    if (fs.existsSync(indexPath)) {
      const data = fs.readJsonSync(indexPath);
      if (data && data.version === INDEX_VERSION && data.root === root) {
        return data;
      }
    }
  } catch (err) {
    // Ignore errors
  }
  return null;
}

/**
 * Save index to disk.
 */
function saveIndex(index: SemanticIndex): void {
  try {
    const indexPath = getIndexPath(index.root);
    const dir = path.dirname(indexPath);
    fs.ensureDirSync(dir);
    fs.writeJsonSync(indexPath, index, { spaces: 2 });
  } catch (err) {
    // Ignore errors
  }
}

/**
 * Get files that have changed since last index build.
 */
async function getChangedFiles(
  root: string,
  currentFiles: string[],
  existingHashes: FileHashes
): Promise<{ changed: string[]; removed: string[]; added: string[] }> {
  const changed: string[] = [];
  const removed: string[] = [];
  const added: string[] = [];

  // Check for changed and added files
  for (const file of currentFiles) {
    try {
      const content = await fs.readFile(path.join(root, file), "utf-8");
      const hash = hashContent(content);

      if (!existingHashes[file]) {
        added.push(file);
      } else if (existingHashes[file] !== hash) {
        changed.push(file);
      }
      // else: unchanged, skip
    } catch (err) {
      // Skip unreadable files
    }
  }

  // Check for removed files
  for (const file of Object.keys(existingHashes)) {
    if (!currentFiles.includes(file)) {
      removed.push(file);
    }
  }

  return { changed, removed, added };
}

/**
 * Build or update the semantic index.
 * Supports incremental indexing - only re-indexes changed files.
 */
export async function buildIndex(
  root = ".",
  files: string[] = []
): Promise<SemanticIndex> {
  const targetFiles = files.length ? files : await collectFiles(root);

  // Try to load existing index
  const existingIndex = loadIndex(root);

  if (existingIndex) {
    // Incremental update
    const existingHashes = existingIndex.fileHashes || {};
    const { changed, removed, added } = await getChangedFiles(
      root,
      targetFiles,
      existingHashes
    );

    // If nothing changed, return existing index
    if (changed.length === 0 && removed.length === 0 && added.length === 0) {
      // Convert arrays back to sets for in-memory use
      return existingIndex;
    }

    console.log(
      `📊 Index update: ${added.length} new, ${changed.length} changed, ${removed.length} removed`
    );

    // Remove tokens for removed/changed files
    const filesToRemove = [...removed, ...changed];
    for (const file of filesToRemove) {
      const oldTokens = existingIndex.fileHashes[file]
        ? Object.keys(existingIndex.index).filter((token) =>
            existingIndex.index[token]?.includes(file)
          )
        : [];

      for (const token of oldTokens) {
        if (existingIndex.index[token]) {
          existingIndex.index[token] = existingIndex.index[token].filter(
            (f) => f !== file
          );
          if (existingIndex.index[token].length === 0) {
            delete existingIndex.index[token];
          }
        }
      }
    }

    // Add tokens for new/changed files
    const filesToAdd = [...added, ...changed];
    for (const file of filesToAdd) {
      try {
        const content = await fs.readFile(path.join(root, file), "utf-8");
        const hash = hashContent(content);
        const tokens = tokenize(content).slice(0, 2000);
        const unique = [...new Set(tokens)];

        for (const t of unique) {
          if (!existingIndex.index[t]) {
            existingIndex.index[t] = [];
          }
          if (!existingIndex.index[t].includes(file)) {
            existingIndex.index[t].push(file);
          }
        }

        existingIndex.fileHashes[file] = hash;
      } catch (err) {
        // Skip unreadable files
      }
    }

    // Remove hashes for deleted files
    for (const file of removed) {
      delete existingIndex.fileHashes[file];
    }

    existingIndex.lastBuilt = new Date().toISOString();
    saveIndex(existingIndex);
    return existingIndex;
  }

  // Full build (no existing index)
  const idx: Record<string, string[]> = {};
  const fileHashes: FileHashes = {};

  for (const f of targetFiles) {
    try {
      const content = await fs.readFile(path.join(root, f), "utf-8");
      const hash = hashContent(content);
      const tokens = tokenize(content).slice(0, 2000);
      const unique = [...new Set(tokens)];

      for (const t of unique) {
        if (!idx[t]) idx[t] = [];
        idx[t].push(f);
      }

      fileHashes[f] = hash;
    } catch (err) {
      // ignore unreadable files
    }
  }

  const newIndex: SemanticIndex = {
    version: INDEX_VERSION,
    root,
    index: idx,
    fileHashes,
    lastBuilt: new Date().toISOString(),
  };

  saveIndex(newIndex);
  return newIndex;
}

async function collectFiles(root: string): Promise<string[]> {
  const res: string[] = [];

  async function walk(dir: string) {
    const items = await fs.readdir(dir);
    for (const it of items) {
      const full = path.join(dir, it);
      const st = await fs.stat(full);
      if (st.isDirectory()) {
        if (it === "node_modules" || it === ".git" || it === "dist" || it === ".zaahix") continue;
        await walk(full);
      } else {
        const rel = path.relative(root, full).replace(/\\/g, "/");
        res.push(rel);
      }
    }
  }

  await walk(root);
  return res;
}

export function queryIndex(idx: SemanticIndex, q: string, top = 10): string[] {
  const tokens = tokenize(q);
  const score: Record<string, number> = {};

  for (const t of tokens) {
    const files = idx.index[t];
    if (!files) continue;
    for (const f of files) {
      score[f] = (score[f] || 0) + 1;
    }
  }

  const ranked = Object.entries(score)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([file]) => file);

  return ranked;
}

/**
 * Check if the index exists for a given root.
 */
export function indexExists(root: string): boolean {
  const indexPath = getIndexPath(root);
  return fs.existsSync(indexPath);
}

/**
 * Get index statistics.
 */
export function getIndexStats(root: string): {
  exists: boolean;
  totalFiles: number;
  totalTokens: number;
  lastBuilt: string | null;
} {
  const index = loadIndex(root);
  if (!index) {
    return { exists: false, totalFiles: 0, totalTokens: 0, lastBuilt: null };
  }

  return {
    exists: true,
    totalFiles: Object.keys(index.fileHashes).length,
    totalTokens: Object.keys(index.index).length,
    lastBuilt: index.lastBuilt,
  };
}

/**
 * Force a full rebuild of the index.
 */
export async function rebuildIndex(root = ".", files: string[] = []): Promise<SemanticIndex> {
  // Delete existing index
  const indexPath = getIndexPath(root);
  try {
    if (fs.existsSync(indexPath)) {
      fs.removeSync(indexPath);
    }
  } catch (err) {
    // Ignore errors
  }

  return buildIndex(root, files);
}
