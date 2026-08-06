# Zaahix CLI - AI Terminal Agent

A production-grade TypeScript CLI tool that uses AI to plan and execute filesystem operations. Ask it to build, analyze, or modify your projects.

## Quick Start

```bash
npm install
npm run build
npm run dev -- chat
```

### Install globally or link locally

From the `zaahix-cli` project root:

```bash
npm install
npm run build
npm install -g .
```

Then from any folder:

```bash
zaahix
```

If you want a development-friendly local link instead, run:

```bash
npm install
npm run build
npm link
```

Then from any other folder:

```bash
zaahix
```

> Note: `npx zaahix` only works if the package is published to npm as `zaahix`. For local usage, install globally with `npm install -g .` or use `npm link`.

## Commands

### Chat Mode (Interactive)
```bash
npm run dev -- chat                            # Start interactive chat
npm run dev -- chat --auto-approve             # Auto-approve tool execution
npm run dev -- chat --provider gemini          # Use specific provider
npm run dev -- chat --model gemini-2.0-flash   # Use specific model
zaahix                                         # Start chat from anywhere after global install
zaahix --auto-approve                          # Start chat with auto-approve enabled
zaahix --provider gemini                       # Use Gemini provider
zaahix --model gpt-4o                          # Override default model
```

**In-chat commands:**
- `/help` - Show available commands
- `/clear` - Clear the screen
- `/history` - Show conversation history
- `/status` - Show current configuration
- `exit` - Exit the chat

### Analyze Project
```bash
npm run dev -- analyze                 # Analyze current project with summary
npm run dev -- analyze ./src           # Analyze specific path
npm run dev -- analyze --style human   # Human-friendly summary
npm run dev -- analyze --style technical # Technical summary
```

### Repair Mode
```bash
npm run dev -- repair "fix the bug in server.ts"
npm run dev -- repair "optimize the database queries"
```

### Scan Project
```bash
npm run dev -- scan                    # Scan current directory
npm run dev -- scan ./src              # Scan specific directory
```

### Deep Review
```bash
npm run dev -- review                  # Technical review
npm run dev -- review --style human    # Human-friendly review
```

## How It Works

1. **Plan**: AI decides which tool(s) you need
2. **Approve**: You confirm before execution when writing files, unless auto-approved
3. **Execute**: Runs read/write/scan/analyze tools with automatic retry on failure
4. **Respond**: Narrates results in live assistant style

Use `--auto-approve` or set `ZAAHIX_AUTO_APPROVE=true` to bypass prompts in tests or CI.

## Available Tools

| Tool | Description | Approval Required |
|------|-------------|-------------------|
| `list_files` | List directory contents | No |
| `read_file` | Read file contents (truncated at 150KB) | No |
| `read_file_chunk` | Read a chunk of a large file | No |
| `write_file` | Write new files (with backup) | Yes |
| `patch_file` | Patch existing files (search & replace) | Yes |
| `search_grep` | Pattern search across code | No |
| `scan_project` | Walk project structure | No |
| `analyze_project` | Generate engineering insights | No |
| `git_create_branch` | Create a git branch | No |
| `git_commit_push` | Commit and push changes | No |
| `git_create_pr` | Create a pull request | No |
| `git_diff` | Show git diff | No |
| `git_status` | Show git status | No |

## Providers

Zaahix supports multiple LLM providers:

| Provider | Default Model | Rate Limit Handling |
|----------|---------------|---------------------|
| **AI API Bank** ⭐ | llama-3.3-70b-versatile | Naira billing, no per-session caps |
| OpenAI | gpt-4o-mini | Retry with backoff |
| Gemini | gemini-2.0-flash-lite | Multi-key rotation |
| Groq | llama-3.3-70b-versatile | Retry with backoff |
| OpenRouter | meta-llama/llama-3.3-70b-instruct:free | Retry with backoff |
| SambaNova | Meta-Llama-3.3-70B-Instruct | Retry with backoff |
| LongCat | LongCat-2.0 | Retry with backoff |
| Ollama (local) | qwen2.5-coder:7b | N/A |

> ⭐ **AI API Bank** is the default engine behind zaahix. It routes through the standalone AI Bank (`ai.zaahix.com`) — every call bills your Naira wallet in real time (text = ₦5/call) instead of using your own provider keys. Set `AI_BANK_BASE_URL` and `AI_BANK_API_KEY` in `.env` and run `zaahix --provider ai-bank`.

### Provider Selection

```bash
# Via command line flag
zaahix --provider gemini
zaahix --provider openai --model gpt-4o

# Via environment variable
ZAAHIX_PROVIDER=gemini zaahix

# In .env file
ZAAHIX_PROVIDER=gemini
GEMINI_MODEL=gemini-2.0-flash-lite
```

## Security

- **Path sanitization**: Blocks `.env`, `.git`, `node_modules`, and traversal attacks
- **Content limits**: Truncates files >150KB to prevent token overflow
- **Workspace boundary**: All I/O confined to project directory
- **Atomic writes**: Files are written atomically to prevent corruption
- **Backup creation**: Files are backed up before modification
- **Approval flow**: Write operations require explicit confirmation

## Configuration

### Environment Variables

```bash
# Provider selection
ZAAHIX_PROVIDER=ai-bank|openai|gemini|groq|openrouter|sambanova|longcat|omniroute
ZAAHIX_MODEL=gpt-4o-mini

# AI API Bank (recommended — no provider keys needed)
AI_BANK_BASE_URL=https://ai.zaahix.com
AI_BANK_API_KEY=sk-brandai-...

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2

# Gemini (supports multiple keys for rotation)
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

### Getting API Keys

| Provider | URL | Free Tier |
|----------|-----|-----------|
| OpenAI | https://platform.openai.com | Yes (limited) |
| Gemini | https://aistudio.google.com/apikey | Yes (generous) |
| Groq | https://console.groq.com | Yes (generous) |
| OpenRouter | https://openrouter.ai | Yes (limited) |
| SambaNova | https://cloud.sambanova.ai | Yes |
| Ollama | https://ollama.com | Unlimited (local) |

## Testing

```bash
npm test                  # Run all tests
npm run test:coverage     # Run with coverage report
npm run test:watch        # Watch mode
```

## Architecture

```
src/
├── agent/          # Planning, execution, synthesis
│   ├── chat.ts     # Interactive chat loop
│   ├── engine.ts   # Main routing logic
│   ├── dynamicAgent.ts  # Tool execution loop
│   └── fixer.ts    # Repair mode
├── cli/            # Command parser
│   └── index.ts    # CLI entry point
├── memory/         # Project context & session state
│   ├── sessionMemory.ts  # Session state
│   ├── projectMemory.ts  # Project state
│   ├── projectScanner.ts # File system scanner
│   ├── projectAnalyzer.ts # Project analysis
│   ├── semanticIndex.ts  # Keyword search
│   └── embeddings.ts     # Semantic search
├── providers/      # LLM integrations
│   ├── openai.ts   # OpenAI provider
│   ├── gemini.ts   # Google Gemini provider
│   ├── groq.ts     # Groq provider
│   ├── openrouter.ts # OpenRouter provider
│   ├── sambanova.ts  # SambaNova provider
│   ├── longcat.ts    # LongCat provider
│   └── providerManager.ts # Provider management
├── tools/          # Filesystem operations
│   ├── readFile.ts
│   ├── writeFile.ts
│   ├── patchFile.ts
│   ├── listFiles.ts
│   ├── searchGrep.ts
│   └── git.ts
└── utils/          # Helpers
    ├── path.ts     # Path validation
    ├── fs.ts       # File system utilities
    ├── approval.ts # Approval flow
    └── errors.ts   # Error types
```

## Troubleshooting

**"OPENAI_API_KEY is missing"**
→ Create `.env` with your OpenAI API key

**"Access denied"**
→ You tried to read/write outside workspace or blocked path

**Permission prompt stuck**
→ Use `npm run dev -- chat --auto-approve` for testing

**"Unknown provider"**
→ Check available providers: openai, gemini, groq, openrouter, sambanova, longcat

**Rate limit errors**
→ Zaahix will automatically retry with backoff, or try a different provider

**Non-interactive shell write blocked**
→ Use `ZAAHIX_AUTO_APPROVE=true` or `--auto-approve` to force writes without confirmation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Build: `npm run build`
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with**: TypeScript, OpenAI, Gemini, Commander CLI
