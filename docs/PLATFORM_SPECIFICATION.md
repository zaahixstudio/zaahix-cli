# Zaahix CLI - Platform Specification

**Version**: 1.0.0  
**Target**: Production-grade AI CLI agent (Google Gemini CLI equivalent)  
**Created**: 2026-07-22

---

## 1. Vision & Core Philosophy

Zaahix CLI is a terminal-native AI agent that operates as a **peer software engineer** in your development workflow. It should feel like working with a brilliant colleague who:

- Understands your entire codebase context
- Can plan, execute, and verify complex multi-step tasks
- Respects your workspace boundaries and security constraints
- Provides clear, actionable feedback without corporate speak
- Works silently and efficiently, surfacing only what matters

**Non-negotiable principles:**
1. **Safety first** - Never execute destructive operations without explicit confirmation
2. **Context awareness** - Maintain deep understanding of project structure and history
3. **Reliability** - Graceful degradation, retry logic, and clear error recovery
4. **Performance** - Stream responses, minimize latency, efficient tool usage
5. **Extensibility** - Easy to add new tools, providers, and workflows

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                            │
│  (Commander.js, argument parsing, flags, help text)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                      Agent Engine                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Planner   │  │  Executor   │  │   Synthesizer       │ │
│  │  (LLM call) │  │ (tool loop) │  │  (final response)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                      Tool Layer                             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ │
│  │ReadFile│ │Write   │ │Grep    │ │Git     │ │Semantic  │ │
│  │        │ │File    │ │Search  │ │Ops     │ │Search    │ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └──────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Provider Layer                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐ ┌──────────────┐ │
│  │OpenAI│ │Gemini│ │Groq  │ │OpenRouter│ │Local (Ollama)│ │
│  └──────┘ └──────┘ └──────┘ └──────────┘ └──────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                     Memory Layer                            │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐ │
│  │Session Memory│ │Project Memory│ │Semantic Index       │ │
│  └──────────────┘ └──────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 CLI Layer

**Requirements:**
- [ ] Single binary entry point: `zaahix`
- [ ] Subcommands: `chat`, `analyze`, `repair`, `scan`, `review`
- [ ] Flags: `--auto-approve`, `--resume`, `--provider <name>`, `--model <name>`
- [ ] Help text with examples for each command
- [ ] Version display: `zaahix --version`
- [ ] Non-interactive mode support (for CI/CD)
- [ ] Graceful shutdown on SIGINT/SIGTERM

**Current gaps:**
- Missing `--provider` and `--model` flags (requires env vars)
- No `--version` flag implementation
- No signal handling for graceful shutdown

---

### 3.2 Agent Engine

**Core Loop:**
```
1. Receive user input
2. Load context (history, project state, memory)
3. Call LLM with system prompt + context + user goal
4. Parse LLM response (JSON with action/thought/tool/args)
5. If action == "call_tool":
   a. Validate tool exists
   b. Validate arguments
   c. Execute tool with approval flow
   d. Capture result
   e. Add to step history
   f. Loop to step 3 with updated context
6. If action == "respond":
   a. Synthesize final response from execution history
   b. Return to user
```

**Requirements:**
- [ ] Maximum iteration limit: 15 (auto-approve: 45)
- [ ] Token streaming for real-time feedback
- [ ] Spinner animation during LLM calls
- [ ] Tool execution progress display
- [ ] Error recovery: retry failed tools up to 3 times
- [ ] Context window management (truncate old history)
- [ ] Parallel tool execution where possible (future)

**Current gaps:**
- No retry logic for failed tool executions
- No parallel tool execution
- Context window management is basic (just splicing old messages)

---

### 3.3 Tool System

#### 3.3.1 File Operations

| Tool | Args | Returns | Safety |
|------|------|---------|--------|
| `read_file` | `{path}` | File content (truncated at 150KB) | Path validation |
| `read_file_chunk` | `{path, start?, length?}` | Chunk + metadata | Path validation |
| `write_file` | `{path, content}` | Success/error | **Approval required** |
| `patch_file` | `{path, search, replace}` | Success/error | **Approval required** |
| `list_files` | `{path?}` | Array of entries | Path validation |

**Requirements:**
- [ ] Path validation: block `.env`, `.git`, `node_modules`, traversal attacks
- [ ] Content truncation: files > 150KB should be chunked
- [ ] Atomic writes: ensure partial writes don't corrupt files
- [ ] Backup before write: optional `.bak` creation
- [ ] Diff display for patches: show what changed

**Current gaps:**
- No atomic writes (could corrupt on failure)
- No backup creation
- No diff display for patches
- Approval flow is duplicated (should be centralized)

---

#### 3.3.2 Search Operations

| Tool | Args | Returns | Safety |
|------|------|---------|--------|
| `search_grep` | `{query, path?, isRegex?}` | Array of matches (max 100) | Path validation |
| `semantic_search` | `{query, top?}` | Ranked file list | Path validation |

**Requirements:**
- [ ] Binary file detection and skipping
- [ ] Encoding detection (UTF-8, Latin-1, etc.)
- [ ] Context lines around matches (configurable)
- [ ] File type filtering (e.g., `--include="*.ts"`)
- [ ] Case-insensitive by default, case-sensitive option

**Current gaps:**
- No context lines around matches
- No file type filtering
- No encoding detection
- Binary file detection is basic (extension-based only)

---

#### 3.3.3 Project Operations

| Tool | Args | Returns | Safety |
|------|------|---------|--------|
| `scan_project` | `{path?}` | File tree + stats | Path validation |
| `analyze_project` | `{path?}` | AI-generated review | LLM call |

**Requirements:**
- [ ] Respects `.gitignore` patterns
- [ ] Configurable ignore patterns
- [ ] Symbol extraction (functions, classes, exports)
- [ ] Dependency graph analysis
- [ ] Test coverage detection

**Current gaps:**
- No `.gitignore` respect
- No symbol extraction
- No dependency analysis
- No test coverage awareness

---

#### 3.3.4 Git Operations

| Tool | Args | Returns | Safety |
|------|------|---------|--------|
| `git_create_branch` | `{name?, dry?}` | Branch created | Dry-run default |
| `git_commit_push` | `{message?, files?, dry?}` | Commit + push | Dry-run default |
| `git_create_pr` | `{title, body?, base?, head?, dry?}` | PR created | Dry-run default |

**Requirements:**
- [ ] Git status check before operations
- [ ] Diff preview before commit
- [ ] Commit message validation
- [ ] Remote verification (prevent pushing to wrong remote)
- [ ] Branch existence check before creation

**Current gaps:**
- All git operations are dry-run by default (no actual execution)
- No diff preview
- No remote verification
- No branch existence check

---

#### 3.3.5 Memory Operations

| Tool | Args | Returns | Safety |
|------|------|---------|--------|
| `embeddings_index` | `{}` | Index built | Path validation |
| `embeddings_search` | `{query, top?}` | Ranked files | Path validation |

**Requirements:**
- [ ] Incremental indexing (don't rebuild entire index)
- [ ] Persistent index storage (`.zaahix/index.json`)
- [ ] Index invalidation on file changes
- [ ] Configurable similarity threshold

**Current gaps:**
- No incremental indexing (rebuilt every time)
- No persistent storage (rebuilt every session)
- No invalidation strategy
- No similarity threshold

---

### 3.4 Provider System

**Supported Providers:**

| Provider | Streaming | Multi-key | Rate Limit | Models |
|----------|-----------|-----------|------------|--------|
| OpenAI | ✅ | ❌ | Retry | GPT-4o, GPT-4o-mini |
| Gemini | ✅ | ✅ | Rotate | 2.0-flash, 1.5-pro |
| Groq | ✅ | ❌ | Retry | Llama-3.3-70b |
| OpenRouter | ✅ | ❌ | Retry | Various |
| SambaNova | ✅ | ❌ | Retry | Llama-3.3-70b |
| LongCat | ✅ | ❌ | Retry | LongCat-2.0 |
| Ollama | ❌ | N/A | None | qwen2.5-coder |

**Requirements:**
- [ ] Provider selection via flag: `--provider gemini`
- [ ] Model selection via flag: `--model gemini-2.0-flash`
- [ ] Fallback chain: try provider → fallback provider → error
- [ ] Response caching for repeated identical prompts
- [ ] Token counting and context window management
- [ ] Cost tracking (tokens used × price per token)

**Current gaps:**
- No flag-based provider/model selection
- No fallback chain
- No response caching
- No token counting
- No cost tracking
- Ollama uses `execFileSync` (blocking, no streaming)

---

### 3.5 Memory System

**Session Memory:**
- Current tool and result
- Project scan state
- Conversation history (last 20 messages)

**Project Memory:**
- Analysis results
- Important files list
- Package.json contents
- Code samples

**Semantic Memory:**
- TF-IDF index for keyword search
- Cosine similarity for semantic search

**Requirements:**
- [ ] Persistent session memory across tool restarts
- [ ] Project memory cache (invalidate on file changes)
- [ ] Semantic index persistence (`.zaahix/semantic-index.json`)
- [ ] Memory size limits (prevent memory leaks)
- [ ] Memory cleanup on session end

**Current gaps:**
- No persistent session memory
- No cache invalidation
- No index persistence
- No memory size limits
- No cleanup on session end

---

## 4. Safety & Security

### 4.1 Path Validation

**Blocked paths:**
- `.env`, `.env.*` (any environment files)
- `.git/` (git internals)
- `node_modules/` (dependencies)
- `dist/`, `build/` (build outputs)
- Parent directory traversal (`../`)

**Requirements:**
- [ ] Normalize paths before validation
- [ ] Handle symlinks (resolve to real path)
- [ ] Support custom ignore patterns via `.zaahixignore`

**Current gaps:**
- No symlink handling
- No `.zaahixignore` support
- Path validation is case-sensitive (Windows issues)

---

### 4.2 Approval Flow

**Write operations:**
```
┌─────────────────────────────────────────┐
│ ⚠️  Requesting permission to write:     │
│ 📂 Path: src/server.ts                 │
│ 📝 Content Preview (first 200 chars):  │
│ ─────────────────────────────────────── │
│ import express from 'express';...      │
│ ─────────────────────────────────────── │
│ Do you want to allow this write?       │
│ [y]es / [n]o / [a]lways:              │
└─────────────────────────────────────────┘
```

**Requirements:**
- [ ] Centralized approval flow (not duplicated per tool)
- [ ] Configurable approval levels:
  - `always` - auto-approve everything
  - `write` - auto-approve reads, approve writes
  - `strict` - approve everything
- [ ] Approval state persistence (remember "always" for session)
- [ ] Preview truncation for large content

**Current gaps:**
- Approval flow is duplicated (write_file and patch_file)
- No configurable approval levels
- No preview truncation logic

---

### 4.3 Error Handling

**Error categories:**
1. **User errors** - Invalid input, missing files
2. **Tool errors** - Path validation, permission denied
3. **Provider errors** - Rate limits, auth failures
4. **System errors** - Memory, disk space, network

**Requirements:**
- [ ] Structured error types (not just strings)
- [ ] Error recovery suggestions
- [ ] Error logging to `.zaahix/errors.log`
- [ ] Retry logic with exponential backoff
- [ ] Graceful degradation (continue with partial results)

**Current gaps:**
- Errors are strings, not structured types
- No error logging
- No retry logic for tool failures
- No recovery suggestions

---

## 5. User Experience

### 5.1 Interactive Chat

**Startup sequence:**
```
✦ Z A A H I X

──────────────────────────────────────────────────
  Version   : 1.0.0
  Directory : /path/to/project
  Provider  : openrouter (meta-llama/llama-3.3-70b-instruct:free)
──────────────────────────────────────────────────

zaahix › 
```

**Requirements:**
- [ ] Clear startup banner with provider info
- [ ] Prompt showing current directory
- [ ] Tab completion for common commands
- [ ] Command history (up/down arrows)
- [ ] Multi-line input support (for complex queries)
- [ ] Clear screen command: `/clear`
- [ ] Help command: `/help`
- [ ] Exit commands: `exit`, `/exit`, Ctrl+C

**Current gaps:**
- No tab completion
- No command history
- No multi-line input
- No `/clear` or `/help` commands

---

### 5.2 Tool Execution Display

**During execution:**
```
✦ Reading src/server.ts
  ✔ Success

✦ Writing src/routes.ts
⚠️  Requesting permission to write:
📂 Path: src/routes.ts
📝 Content Preview (first 200 chars):
──────────────────────────────────────────────────
import { Router } from 'express';
const router = Router();
router.get('/api/hello', (req, res) => {
──────────────────────────────────────────────────
Do you want to allow this write? [y]es / [n]o / [a]lways: 
```

**Requirements:**
- [ ] Tool name and arguments display
- [ ] Success/failure indicators
- [ ] Progress bars for long operations
- [ ] Collapsible output for verbose results
- [ ] Copy-to-clipboard for code blocks

**Current gaps:**
- No progress bars
- No collapsible output
- No copy-to-clipboard

---

### 5.3 Final Response

**Response format:**
```
✅ Done! Here's what I accomplished:

1. **Created** `src/routes.ts` - Express router with GET /api/hello endpoint
2. **Modified** `src/server.ts` - Added route import and middleware
3. **Updated** `package.json` - Added express dependency

**Next steps:**
- Run `npm install` to install dependencies
- Test with `npm start`
```

**Requirements:**
- [ ] Structured response with numbered actions
- [ ] File references with syntax highlighting
- [ ] Next steps suggestions
- [ ] Copy-friendly format (no terminal escape codes)

**Current gaps:**
- Response format is not structured
- No next steps suggestions

---

## 6. Testing Strategy

### 6.1 Unit Tests

**Coverage targets:**
- Tool functions: 90%
- Provider integrations: 80%
- Path validation: 100%
- Error handling: 90%

**Requirements:**
- [ ] Jest or Vitest test framework
- [ ] Mock LLM providers for agent tests
- [ ] Mock file system for tool tests
- [ ] Snapshot tests for CLI output
- [ ] CI integration (GitHub Actions)

**Current gaps:**
- No test framework configured
- No unit tests
- No CI test step (only build)

---

### 6.2 Integration Tests

**Test scenarios:**
1. Chat flow: input → tool calls → response
2. File operations: read → modify → verify
3. Git workflow: branch → commit → push → PR
4. Error recovery: invalid path → retry → success
5. Provider failover: primary → fallback → error

**Requirements:**
- [ ] End-to-end test suite
- [ ] Real filesystem operations (temp directory)
- [ ] Real LLM calls (or mocked)
- [ ] CI integration

**Current gaps:**
- No integration tests
- No end-to-end tests

---

### 6.3 Manual Testing

**Test scenarios:**
1. `zaahix chat` - Interactive mode
2. `zaahix chat --auto-approve` - Auto-approve mode
3. `zaahix chat --resume` - Resume session
4. `zaahix analyze` - Project analysis
5. `zaahix repair "fix the bug"` - Repair mode
6. `zaahix scan` - Project scan
7. `zaahix review` - Deep review

**Requirements:**
- [ ] Manual test checklist in docs
- [ ] Test script for each scenario
- [ ] Success criteria defined

**Current gaps:**
- No manual test checklist
- No test scripts

---

## 7. Performance Requirements

### 7.1 Response Time

| Operation | Target | Current |
|-----------|--------|---------|
| First token | < 2s | ~3-5s |
| Tool execution | < 500ms | Varies |
| Project scan | < 5s | ~2-3s |
| Final response | < 10s | ~5-15s |

### 7.2 Resource Usage

| Resource | Limit | Current |
|----------|-------|---------|
| Memory | < 200MB | ~50-100MB |
| CPU | < 50% | Low |
| Disk I/O | < 10MB/s | Low |

**Requirements:**
- [ ] Token streaming (already implemented)
- [ ] Lazy loading of large files
- [ ] Caching of repeated operations
- [ ] Memory leak detection

**Current gaps:**
- No caching
- No memory leak detection
- No performance monitoring

---

## 8. Documentation Requirements

### 8.1 README.md

**Sections:**
1. Overview (what is Zaahix)
2. Quick Start (3 steps)
3. Installation (global, local, npx)
4. Commands (with examples)
5. Configuration (env vars, flags)
6. Tools (available tools with examples)
7. Providers (supported providers)
8. Security (safety features)
9. Troubleshooting (common issues)
10. Contributing (how to extend)

**Current gaps:**
- Missing provider configuration details
- Missing tool examples
- Missing troubleshooting guide

---

### 8.2 API Documentation

**Tool API:**
```typescript
interface Tool {
  name: string;
  description: string;
  args: Record<string, any>;
  execute(args: any): Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}
```

**Provider API:**
```typescript
interface Provider {
  name: string;
  ask(prompt: string, context?: string, onToken?: (token: string) => void): Promise<string>;
}
```

**Current gaps:**
- No API documentation
- No TypeScript definitions for public API

---

### 8.3 Changelog

**Requirements:**
- [ ] Keep a `CHANGELOG.md` file
- [ ] Follow semver format
- [ ] Document breaking changes
- [ ] Document new features
- [ ] Document bug fixes

**Current gaps:**
- No changelog

---

## 9. Deployment

### 9.1 npm Package

**Package structure:**
```
zaahix-cli/
├── dist/           # Compiled JS
├── src/            # TypeScript source
├── package.json    # Package metadata
├── README.md       # Documentation
├── LICENSE         # License file
└── CHANGELOG.md    # Version history
```

**Requirements:**
- [ ] `npm publish` ready
- [ ] `npx zaahix` support
- [ ] Global install support
- [ ] Post-install build script

**Current gaps:**
- No LICENSE file
- No CHANGELOG.md
- `prepare` script runs build (may fail on install)

---

### 9.2 Binary Distribution

**Requirements:**
- [ ] Single executable (via `pkg` or `esbuild`)
- [ ] Cross-platform builds (Windows, macOS, Linux)
- [ ] Auto-update mechanism (optional)

**Current gaps:**
- No binary distribution
- No cross-platform builds

---

## 10. Future Enhancements

### Phase 2 (High Priority)

1. **Git integration** - Actually execute git operations (not dry-run)
2. **Tool retry logic** - Automatic retries with exponential backoff
3. **Error structured types** - Proper error classes
4. **Approval flow centralization** - Single approval handler
5. **Test framework** - Jest/Vitest with unit tests

### Phase 3 (Medium Priority)

1. **LSP integration** - Real-time code analysis
2. **Docker support** - Run in containers
3. **Plugin system** - Custom tools
4. **Multi-language support** - Not just TypeScript
5. **IDE integration** - VS Code extension

### Phase 4 (Low Priority)

1. **Team collaboration** - Shared context
2. **Knowledge base** - Learn from past sessions
3. **Cost optimization** - Token usage tracking
4. **Performance profiling** - Built-in profiler
5. **Accessibility** - Screen reader support

---

## 11. Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Build success rate | 100% | 100% |
| Test coverage | > 80% | 0% |
| First token latency | < 2s | ~3-5s |
| Tool execution success | > 95% | ~80% |
| Error recovery rate | > 90% | ~50% |
| User satisfaction | > 4/5 | Unknown |

---

## 12. Appendix

### A. Environment Variables

```bash
# Provider selection
ZAAHIX_PROVIDER=openai|gemini|groq|openrouter|sambanova|longcat
ZAAHIX_MODEL=gpt-4o-mini

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2

# Gemini (supports multiple keys)
GEMINI_API_KEY_1=...
GEMINI_API_KEY_2=...
GEMINI_MODEL=gemini-2.0-flash-lite

# Groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

# OpenRouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free

# SambaNova
SAMBANOVA_API_KEY=...
SAMBANOVA_MODEL=Meta-Llama-3.3-70B-Instruct

# LongCat
LONGCAT_API_KEY=...
LONGCAT_MODEL=LongCat-2.0

# Local Ollama
USE_OLLAMA=true
OLLAMA_MODEL=qwen2.5-coder:7b

# Agent behavior
ZAAHIX_AUTO_APPROVE=false
ZAAHIX_ALLOW_NON_INTERACTIVE=false
```

### B. CLI Commands

```bash
# Interactive chat
zaahix
zaahix chat
zaahix chat --auto-approve
zaahix chat --resume
zaahix chat --provider gemini
zaahix chat --model gemini-2.0-flash

# Project analysis
zaahix analyze
zaahix analyze ./src
zaahix analyze --style technical

# Repair mode
zaahix repair "fix the bug in server.ts"
zaahix repair "optimize the database queries"

# Project scan
zaahix scan
zaahix scan ./src

# Deep review
zaahix review
zaahix review --style technical
```

### C. Tool Schema

```typescript
// Read file
{ tool: "read_file", args: { path: "src/index.ts" } }

// Write file
{ tool: "write_file", args: { path: "src/new.ts", content: "..." } }

// Patch file
{ tool: "patch_file", args: { 
  path: "src/index.ts", 
  search: "old code", 
  replace: "new code" 
} }

// Search
{ tool: "search_grep", args: { query: "function", path: "src" } }

// Git operations
{ tool: "git_create_branch", args: { name: "feature/new-api" } }
{ tool: "git_commit_push", args: { message: "feat: add new API", files: ["src/api.ts"] } }
{ tool: "git_create_pr", args: { title: "Add new API endpoint" } }
```
