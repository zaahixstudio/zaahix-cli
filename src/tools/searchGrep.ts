import fs from "fs-extra";
import path from "path";
import { validatePath } from "../utils/path";

export interface SearchMatch {
  file: string;
  line: number;
  content: string;
  context?: string;
}

export interface SearchOptions {
  query: string;
  dirPath?: string;
  isRegex?: boolean;
  includePattern?: string;
  caseSensitive?: boolean;
  contextLines?: number;
  maxResults?: number;
}

const ignoredFolders = ["node_modules", ".git", "dist", "build", "coverage", ".next", ".zaahix"];

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".pdf", ".zip", ".tar", ".gz",
  ".map", ".mp3", ".mp4", ".exe", ".dll", ".bin", ".o", ".a", ".so", ".dylib",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
]);

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function matchesIncludePattern(filePath: string, pattern?: string): boolean {
  if (!pattern) return true;
  const ext = path.extname(filePath).toLowerCase();
  const patternExt = pattern.startsWith(".") ? pattern : `.${pattern}`;
  return ext === patternExt.toLowerCase();
}

export async function searchGrep(
  query: string,
  dirPath = ".",
  isRegex = false,
  options: Partial<SearchOptions> = {}
): Promise<SearchMatch[] | string> {
  const {
    includePattern,
    caseSensitive = false,
    contextLines = 0,
    maxResults = 100,
  } = options;

  try {
    if (!validatePath(dirPath)) {
      return `❌ Access denied: Directory "${dirPath}" is outside workspace or blocked`;
    }

    const matches: SearchMatch[] = [];
    let regex: RegExp;

    if (isRegex) {
      regex = new RegExp(query, caseSensitive ? "" : "i");
    }

    async function walk(dir: string) {
      const items = await fs.readdir(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = await fs.stat(fullPath);

        if (stats.isDirectory() && ignoredFolders.includes(item)) {
          continue;
        }

        if (stats.isDirectory()) {
          await walk(fullPath);
        } else {
          // Skip binary files
          if (isBinaryFile(item)) {
            continue;
          }

          // Apply include pattern filter
          if (!matchesIncludePattern(item, includePattern)) {
            continue;
          }

          try {
            // Try to read as text, skip if encoding fails
            let content: string;
            try {
              content = await fs.readFile(fullPath, "utf-8");
            } catch {
              // Skip files that can't be read as UTF-8
              continue;
            }

            const lines = content.split("\n");
            const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, "/");

            for (let index = 0; index < lines.length; index++) {
              const line = lines[index];
              const matched = isRegex
                ? regex.test(line)
                : caseSensitive
                  ? line.includes(query)
                  : line.toLowerCase().includes(query.toLowerCase());

              if (matched) {
                // Build context around the match
                let context = "";
                if (contextLines > 0) {
                  const start = Math.max(0, index - contextLines);
                  const end = Math.min(lines.length - 1, index + contextLines);
                  context = lines.slice(start, end + 1).join("\n");
                }

                matches.push({
                  file: relPath,
                  line: index + 1,
                  content: line.trim(),
                  context,
                });

                if (matches.length >= maxResults) {
                  return;
                }
              }
            }
          } catch {
            // Ignore unreadable files
          }
        }
      }
    }

    await walk(dirPath);
    return matches;
  } catch (err: any) {
    return `❌ Error searching: ${err.message}`;
  }
}
