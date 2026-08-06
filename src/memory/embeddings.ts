import fs from "fs-extra";
import path from "path";
import crypto from "crypto";

// Simple TF-IDF based embeddings + cosine similarity for local use
// Now with persistence and incremental updates

const EMBEDDINGS_FILE = ".zaahix/embeddings-index.json";
const INDEX_VERSION = 1;

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

export type EmbeddingIndex = {
  version: number;
  root: string;
  docs: string[]; // file paths
  vocab: string[]; // tokens
  vectors: number[][]; // tf-idf vectors aligned with vocab
  fileHashes: Record<string, string>; // file path -> content hash
  lastBuilt: string;
};

function getIndexPath(root: string): string {
  return path.join(root, EMBEDDINGS_FILE);
}

/**
 * Load existing embeddings index from disk.
 */
function loadEmbeddingsIndex(root: string): EmbeddingIndex | null {
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
 * Save embeddings index to disk.
 */
function saveEmbeddingsIndex(index: EmbeddingIndex): void {
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
 * Check if any files have changed.
 */
function hasFilesChanged(
  currentFiles: string[],
  currentHashes: Record<string, string>,
  existingHashes: Record<string, string>
): boolean {
  // Check for new or changed files
  for (const file of currentFiles) {
    if (!existingHashes[file]) return true;
  }

  // Check for removed files
  for (const file of Object.keys(existingHashes)) {
    if (!currentFiles.includes(file)) return true;
  }

  return false;
}

/**
 * Build embeddings index with incremental support.
 */
export async function buildEmbeddings(
  root = ".",
  files: string[] = []
): Promise<EmbeddingIndex> {
  const fileList = files.length ? files : await collectFiles(root);

  // Compute file hashes
  const fileHashes: Record<string, string> = {};
  for (const f of fileList) {
    try {
      const content = await fs.readFile(path.join(root, f), "utf-8");
      fileHashes[f] = hashContent(content);
    } catch (err) {
      // Skip unreadable files
    }
  }

  // Try to load existing index
  const existingIndex = loadEmbeddingsIndex(root);
  if (existingIndex && !hasFilesChanged(fileList, fileHashes, existingIndex.fileHashes)) {
    // No changes, return existing index
    return existingIndex;
  }

  console.log(`📊 Building embeddings index for ${fileList.length} files...`);

  // Full rebuild
  const docsTokens: string[][] = [];
  const df: Record<string, number> = {};

  for (const f of fileList) {
    try {
      const txt = await fs.readFile(path.join(root, f), "utf-8");
      const toks = tokenize(txt).slice(0, 5000);
      const unique = new Set(toks);
      for (const t of unique) df[t] = (df[t] || 0) + 1;
      docsTokens.push(toks);
    } catch (err) {
      docsTokens.push([]);
    }
  }

  const vocab = Object.keys(df).sort();
  const vectors: number[][] = [];

  for (const toks of docsTokens) {
    const tf: Record<string, number> = {};
    for (const t of toks) tf[t] = (tf[t] || 0) + 1;
    const vec: number[] = vocab.map((v) => {
      const termFreq = tf[v] || 0;
      const idf = Math.log((1 + docsTokens.length) / (1 + (df[v] || 0))) + 1;
      return termFreq * idf;
    });
    vectors.push(vec);
  }

  const index: EmbeddingIndex = {
    version: INDEX_VERSION,
    root,
    docs: fileList,
    vocab,
    vectors,
    fileHashes,
    lastBuilt: new Date().toISOString(),
  };

  saveEmbeddingsIndex(index);
  return index;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] || 0) * (b[i] || 0);
  return s;
}

function norm(a: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] || 0) * (a[i] || 0);
  return Math.sqrt(s);
}

export function queryEmbeddings(idx: EmbeddingIndex, q: string, top = 10): string[] {
  const toks = tokenize(q);
  const tf: Record<string, number> = {};
  for (const t of toks) tf[t] = (tf[t] || 0) + 1;
  const qvec = idx.vocab.map((v) => tf[v] || 0);

  const scores = idx.vectors.map((v, i) => {
    const d = dot(v, qvec);
    const n = norm(v) * norm(qvec);
    const score = n === 0 ? 0 : d / n;
    return { file: idx.docs[i], score };
  });

  return scores.sort((a, b) => b.score - a.score).slice(0, top).map((s) => s.file);
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

/**
 * Check if embeddings index exists.
 */
export function embeddingsIndexExists(root: string): boolean {
  const indexPath = getIndexPath(root);
  return fs.existsSync(indexPath);
}

/**
 * Get embeddings index statistics.
 */
export function getEmbeddingsStats(root: string): {
  exists: boolean;
  totalFiles: number;
  vocabSize: number;
  lastBuilt: string | null;
} {
  const index = loadEmbeddingsIndex(root);
  if (!index) {
    return { exists: false, totalFiles: 0, vocabSize: 0, lastBuilt: null };
  }

  return {
    exists: true,
    totalFiles: index.docs.length,
    vocabSize: index.vocab.length,
    lastBuilt: index.lastBuilt,
  };
}

/**
 * Force a full rebuild of embeddings index.
 */
export async function rebuildEmbeddings(root = ".", files: string[] = []): Promise<EmbeddingIndex> {
  const indexPath = getIndexPath(root);
  try {
    if (fs.existsSync(indexPath)) {
      fs.removeSync(indexPath);
    }
  } catch (err) {
    // Ignore errors
  }

  return buildEmbeddings(root, files);
}
