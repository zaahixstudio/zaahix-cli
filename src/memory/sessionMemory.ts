import fs from "fs-extra";
import path from "path";

export interface SessionMemory {
  projectScan: any;
  projectAnalysis: any;
  lastPlan: any;
  lastTool: string | null;
  lastToolResult: any;
  conversationSummary: string;
  lastEmbeddings: any;
}

const SESSION_FILE = ".zaahix/session-memory.json";
const MAX_SESSION_SIZE = 1024 * 1024; // 1MB limit

let sessionMemory: SessionMemory = {
  projectScan: null,
  projectAnalysis: null,
  lastPlan: null,
  lastTool: null,
  lastToolResult: null,
  conversationSummary: "",
  lastEmbeddings: null,
};

function getSessionPath(): string {
  return path.join(process.cwd(), SESSION_FILE);
}

/**
 * Load session memory from disk if it exists.
 */
export function loadSessionMemory(): void {
  try {
    const sessionPath = getSessionPath();
    if (fs.existsSync(sessionPath)) {
      const stat = fs.statSync(sessionPath);
      if (stat.size > MAX_SESSION_SIZE) {
        // Session file is too large, reset it
        console.warn("⚠️  Session memory file is too large, resetting...");
        clearMemory();
        return;
      }

      const data = fs.readJsonSync(sessionPath);
      if (data && typeof data === "object") {
        sessionMemory = {
          projectScan: data.projectScan || null,
          projectAnalysis: data.projectAnalysis || null,
          lastPlan: data.lastPlan || null,
          lastTool: data.lastTool || null,
          lastToolResult: null, // Don't persist large tool results
          conversationSummary: data.conversationSummary || "",
          lastEmbeddings: null, // Don't persist embeddings (too large)
        };
      }
    }
  } catch (err) {
    // Ignore errors, start with empty memory
  }
}

/**
 * Save session memory to disk.
 */
export function saveSessionMemory(): void {
  try {
    const sessionPath = getSessionPath();
    const dir = path.dirname(sessionPath);
    fs.ensureDirSync(dir);

    // Don't persist large objects
    const dataToSave = {
      projectScan: sessionMemory.projectScan,
      projectAnalysis: sessionMemory.projectAnalysis,
      lastPlan: sessionMemory.lastPlan,
      lastTool: sessionMemory.lastTool,
      lastToolResult: null, // Don't persist large tool results
      conversationSummary: sessionMemory.conversationSummary,
      lastEmbeddings: null, // Don't persist embeddings
      savedAt: new Date().toISOString(),
    };

    fs.writeJsonSync(sessionPath, dataToSave, { spaces: 2 });
  } catch (err) {
    // Ignore errors
  }
}

/**
 * Update session memory with new data.
 * Automatically saves to disk.
 */
export function updateMemory(data: Partial<SessionMemory>) {
  Object.assign(sessionMemory, data);

  // Auto-save after updates (debounced in production)
  saveSessionMemory();
}

/**
 * Get the current session memory.
 */
export function getMemory(): SessionMemory {
  return sessionMemory;
}

/**
 * Clear all session memory.
 */
export function clearMemory() {
  sessionMemory.projectScan = null;
  sessionMemory.projectAnalysis = null;
  sessionMemory.lastPlan = null;
  sessionMemory.lastTool = null;
  sessionMemory.lastToolResult = null;
  sessionMemory.conversationSummary = "";
  sessionMemory.lastEmbeddings = null;

  saveSessionMemory();
}

/**
 * Get a summary of the current session memory.
 */
export function getMemorySummary(): {
  hasProjectScan: boolean;
  hasProjectAnalysis: boolean;
  lastTool: string | null;
  hasEmbeddings: boolean;
} {
  return {
    hasProjectScan: sessionMemory.projectScan !== null,
    hasProjectAnalysis: sessionMemory.projectAnalysis !== null,
    lastTool: sessionMemory.lastTool,
    hasEmbeddings: sessionMemory.lastEmbeddings !== null,
  };
}

// Load session memory on module initialization
loadSessionMemory();