export const toolSchemas: object[] = [
  {
    type: "function",
    function: {
      name: "scan_project",
      description: "Recursively list project files and return project metadata (dependencies, sizes).",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Directory to scan (default: current)" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List the contents of a specific folder.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Folder path (default: current)" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the full content of a file (truncated at 150KB).",
      parameters: {
        type: "object",
        required: ["path"],
        properties: { path: { type: "string", description: "File path" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file_chunk",
      description: "Read a chunk of a large file.",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string" },
          start: { type: "number", description: "Byte offset (default 0)" },
          length: { type: "number", description: "Bytes to read (default 2000)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write a new file (creates a backup if it exists). Requires user approval.",
      parameters: {
        type: "object",
        required: ["path", "content"],
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "patch_file",
      description: "Patch an existing file with a search-and-replace. Requires user approval.",
      parameters: {
        type: "object",
        required: ["path", "search", "replace"],
        properties: {
          path: { type: "string" },
          search: { type: "string", description: "Exact text to find" },
          replace: { type: "string", description: "Replacement text" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_grep",
      description: "Pattern search across the codebase.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          path: { type: "string", description: "Directory (default current)" },
          isRegex: { type: "boolean", description: "Treat query as regex (default false)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "semantic_search",
      description: "Semantic keyword search across the project index.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          top: { type: "number", description: "Results to return (default 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_project",
      description: "Architecture review of the project at a path.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Directory (default current)" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_status",
      description: "Show current git status.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description: "Show the git diff of changes.",
      parameters: {
        type: "object",
        properties: { files: { type: "array", items: { type: "string" } } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_create_branch",
      description: "Create a git branch (dry-run by default).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          dry: { type: "boolean", description: "Dry run (default true)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_commit_push",
      description: "Commit and push changes (dry-run by default).",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string" },
          files: { type: "array", items: { type: "string" } },
          dry: { type: "boolean", description: "Dry run (default true)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_create_pr",
      description: "Create a pull request (dry-run by default).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          base: { type: "string" },
          head: { type: "string" },
          dry: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "index_status",
      description: "Show the status of the semantic and embeddings indexes.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "index_rebuild",
      description: "Rebuild the semantic/embeddings indexes from scratch.",
      parameters: {
        type: "object",
        properties: { type: { type: "string", enum: ["semantic", "embeddings", "all"] } },
      },
    },
  },
];
