import pathModule from "path";

const BLOCKED_PATTERNS = [
  /\.env$/i,
  /\.env\..*$/i,
  /\.git(\/|\\|$)/i,
  /node_modules(\/|\\|$)/i,
  /\.(bak|tmp|temp)$/i,
];

const BLOCKED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
]);

/**
 * Validates that a file path is safe to access.
 * Checks for blocked paths (.env, .git, node_modules) and verifies
 * that the resolved path is within the workspace boundary to prevent traversal attacks.
 */
export function validatePath(filePath: string): boolean {
  const normalized = pathModule.normalize(filePath);
  const resolved = pathModule.resolve(process.cwd(), normalized);
  const workspaceRoot = pathModule.resolve(process.cwd());

  const relative = pathModule.relative(workspaceRoot, resolved);

  // Block traversal attacks
  if (relative.startsWith("..") || pathModule.isAbsolute(relative)) {
    return false;
  }

  // Check each path segment against blocked directories
  const segments = relative.split(pathModule.sep).filter(Boolean);
  for (const segment of segments) {
    if (BLOCKED_DIRECTORIES.has(segment.toLowerCase())) {
      return false;
    }
  }

  // Check filename against blocked patterns
  const fileName = pathModule.basename(resolved);
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(fileName)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a file is readable (not blocked by security rules).
 */
export function isReadable(filePath: string): boolean {
  return validatePath(filePath);
}

/**
 * Get a list of ignored directories for file walking.
 */
export function getIgnoredDirectories(): string[] {
  return Array.from(BLOCKED_DIRECTORIES);
}
