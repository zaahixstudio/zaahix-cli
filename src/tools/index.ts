import { readFile } from "./readFile";
import { readFileChunk } from "./readFileChunk";
import { writeFile } from "./writeFile";
import { listFiles } from "./listFiles";
import { patchFile } from "./patchFile";
import { searchGrep } from "./searchGrep";
import readline from "readline";

import { scanProject } from "../memory/projectScanner";
import { analyzeProject } from "../memory/projectAnalyzer";

import {
  updateMemory,
  getMemory,
} from "../memory/sessionMemory";
import { buildIndex, queryIndex, indexExists, getIndexStats, rebuildIndex } from "../memory/semanticIndex";
import { buildEmbeddings, queryEmbeddings, embeddingsIndexExists, getEmbeddingsStats, rebuildEmbeddings } from "../memory/embeddings";
import { createBranch, commitAndPush, createPullRequest, gitDiff, gitStatus } from "./git";
import { requestApproval } from "../utils/approval";

export async function runTool(
  tool: string,
  args: any,
  rl?: readline.Interface
) {
  switch (tool) {
    case "read_file": {
      const result = await readFile(args.path);

      updateMemory({
        lastTool: tool,
        lastToolResult: result,
      });

      return result;
    }

    case "read_file_chunk": {
      const result = await readFileChunk(args.path, args.start || 0, args.length || 2000);

      updateMemory({
        lastTool: tool,
        lastToolResult: result,
      });

      return result;
    }

    case "write_file": {
      const preview = typeof args.content === "string" ? args.content.slice(0, 300) : "(binary/large content)";
      const approval = await requestApproval("write_file", args.path, preview, rl);

      if (!approval.approved) {
        return `❌ Write cancelled by user: ${args.path}`;
      }

      const result = await writeFile(args.path, args.content, { backup: true });

      updateMemory({
        lastTool: tool,
        lastToolResult: result,
      });

      return result;
    }

    case "list_files": {
      const result = await listFiles(
        args.path || "."
      );

      updateMemory({
        lastTool: tool,
        lastToolResult: result,
      });

      return result;
    }

    case "scan_project": {
      const result = await scanProject(
        args.path || "."
      );

      updateMemory({
        projectScan: result,
        lastTool: tool,
        lastToolResult: result,
      });

      return result;
    }

    case "semantic_search": {
      const q = args.query || "";
      const top = args.top || 10;
      // build a quick index from last project scan if available
      const memory = getMemory();
      const projectScan = memory.projectScan || (await scanProject("."));
      const idx = await buildIndex('.', projectScan.files);
      const result = queryIndex(idx, q, top);

      updateMemory({
        lastTool: tool,
        lastToolResult: result,
      });

      return result;
    }

    case "embeddings_index": {
      const memory = getMemory();
      const projectScan = memory.projectScan || (await scanProject('.'));
      const idx = await buildEmbeddings('.', projectScan.files);

      updateMemory({ lastTool: tool, lastToolResult: { docs: idx.docs.length } });
      updateMemory({ lastEmbeddings: idx });
      return { docs: idx.docs.length };
    }

    case "embeddings_search": {
      const q = args.query || "";
      const top = args.top || 10;
      const memory = getMemory();
      const idx = memory.lastEmbeddings || (await buildEmbeddings('.'));
      const result = queryEmbeddings(idx, q, top);

      updateMemory({ lastTool: tool, lastToolResult: result });
      return result;
    }

    case "git_create_branch": {
      const name = args.name || `zaahix-auto-${Date.now()}`;
      const dry = args.dry !== undefined ? !!args.dry : true;
      const result = createBranch(name, dry);

      updateMemory({ lastTool: tool, lastToolResult: result });
      return result;
    }

    case "git_commit_push": {
      const message = args.message || "zaahix: automated changes";
      const files = args.files || [];
      const dry = args.dry !== undefined ? !!args.dry : true;
      const result = commitAndPush(message, files, dry);

      updateMemory({ lastTool: tool, lastToolResult: result });
      return result;
    }

    case "git_create_pr": {
      const title = args.title || "zaahix automated changes";
      const body = args.body || "";
      const base = args.base || "main";
      const head = args.head;
      const dry = args.dry !== undefined ? !!args.dry : true;
      const result = createPullRequest(title, body, base, head, dry);

      updateMemory({ lastTool: tool, lastToolResult: result });
      return result;
    }

    case "git_diff": {
      const result = gitDiff(args.files);

      updateMemory({ lastTool: tool, lastToolResult: result });
      return result;
    }

    case "git_status": {
      const result = gitStatus();

      updateMemory({ lastTool: tool, lastToolResult: result });
      return result;
    }

    case "index_status": {
      const semanticStats = getIndexStats(".");
      const embeddingsStats = getEmbeddingsStats(".");
      const result = {
        semantic: semanticStats,
        embeddings: embeddingsStats,
      };

      updateMemory({ lastTool: tool, lastToolResult: result });
      return result;
    }

    case "index_rebuild": {
      const type = args.type || "all";
      let result: any;

      if (type === "semantic" || type === "all") {
        const semanticIndex = await rebuildIndex(".");
        result = { semantic: { files: Object.keys(semanticIndex.fileHashes).length } };
      }

      if (type === "embeddings" || type === "all") {
        const embeddingsIndex = await rebuildEmbeddings(".");
        result = {
          ...result,
          embeddings: { files: embeddingsIndex.docs.length },
        };
      }

      updateMemory({ lastTool: tool, lastToolResult: result });
      return result;
    }

    case "analyze_project": {
      const result = await analyzeProject(
        args.path || "."
      );

      updateMemory({
        projectAnalysis: result,
        lastTool: tool,
        lastToolResult: result,
      });

      return result;
    }

    case "patch_file": {
      const preview = `Search: ${args.search?.slice(0, 100) || ""}\nReplace: ${args.replace?.slice(0, 100) || ""}`;
      const approval = await requestApproval("patch_file", args.path, preview, rl);

      if (!approval.approved) {
        return `❌ Patch cancelled by user: ${args.path}`;
      }

      const result = await patchFile(args.path, args.search, args.replace);

      updateMemory({
        lastTool: tool,
        lastToolResult: result,
      });

      return result;
    }

    case "search_grep": {
      const result = await searchGrep(args.query, args.path || ".", args.isRegex || false);

      updateMemory({
        lastTool: tool,
        lastToolResult: result,
      });

      return result;
    }

    default:
      return `Unknown tool: ${tool}`;
  }
}