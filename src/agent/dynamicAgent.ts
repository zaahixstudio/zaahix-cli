import readline from "readline";
import chalk from "chalk";
import path from "path";
import { runTool } from "../tools";
import { toolSchemas } from "../tools/schemas";
import { providerManager } from "../providers/providerManager";
import { AgentMessage } from "../providers/types";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export interface ToolStep {
  tool: string;
  args: any;
  success: boolean;
  result?: any;
  error?: string;
  retries?: number;
}

export function parseJSONResponse(text: string): { thought?: string; action: string; tool?: string; args?: any; response?: string } {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (e) {
    // Ignore and fallback
  }

  // Try parsing the whole text
  try {
    return JSON.parse(text);
  } catch (e) {
    // Fallback to respond
  }

  return {
    action: "respond",
    response: text
  };
}

async function executeToolWithRetry(
  tool: string,
  args: any,
  rl?: readline.Interface
): Promise<{ success: boolean; result?: any; error?: string; retries: number }> {
  let lastError: string | undefined;
  let retries = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await runTool(tool, args, rl);
      return { success: true, result, retries: attempt };
    } catch (err: any) {
      lastError = err?.message || String(err);
      retries = attempt;

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.log(chalk.yellow(`  ⚠️  Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms...`));
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, error: lastError, retries };
}

function formatToolCall(tool: string, args: any): string {
  const relativePath = (filePath: string) => {
    if (!filePath) return "";
    try {
      return path.relative(process.cwd(), filePath);
    } catch {
      return filePath;
    }
  };

  switch (tool) {
    case "read_file":
    case "read_file_chunk":
      return `Reading ${chalk.blue(relativePath(args.path))}`;
    case "write_file":
      return `Writing ${chalk.blue(relativePath(args.path))}`;
    case "patch_file":
      return `Patching ${chalk.blue(relativePath(args.path))}`;
    case "scan_project":
      return `Scanning project structure at ${chalk.blue(relativePath(args.path || "."))}`;
    case "list_files":
      return `Listing files in ${chalk.blue(relativePath(args.path || "."))}`;
    case "search_grep":
      return `Searching codebase for "${chalk.yellow(args.query)}"`;
    case "semantic_search":
      return `Searching semantic index for "${chalk.yellow(args.query)}"`;
    case "analyze_project":
      return `Analyzing project at ${chalk.blue(relativePath(args.path || "."))}`;
    default:
      return `Executing ${chalk.bold(tool)}`;
  }
}

// ============================================================
// NATIVE TOOL-CALLING LOOP (providers with askAgent support)
// ============================================================
async function runNativeAgent(
  goal: string,
  systemInstructions: string,
  context: any,
  rl?: readline.Interface,
  onToken?: (token: string) => void,
  onTool?: () => void
): Promise<string> {
  const provider = providerManager.getCurrentProvider();
  if (!provider.askAgent) throw new Error("provider does not support native tool calling");

  const messages: AgentMessage[] = [];
  messages.push({
    role: "system",
    content:
      systemInstructions +
      `\n\nCURRENT WORKSPACE DIRECTORY: "${process.cwd()}"
If the user asks you to build/create/set up/implement, DO NOT stop after a few files. Keep invoking tools until the work is done, component by component, file by file.
After a tool returns results, USE those results — do NOT call the same tool again unless you need different or new information. Answer the user as soon as you have enough information.
Only respond with text when the work is complete or you must ask a clarifying question. Self-correct if a tool fails.`,
  });

  if (Array.isArray(context)) {
    for (const m of context) {
      if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }
  messages.push({ role: "user", content: goal });

  const isAutoApprove = process.env.ZAAHIX_AUTO_APPROVE === "true";
  const maxIterations = isAutoApprove ? 45 : 15;
  let iterations = 0;
  let lastCallKey = "";
  let repeatedCalls = 0;

  while (iterations < maxIterations) {
    iterations++;

    // One in-loop retry rides out transient upstream hiccups before falling back
    let result;
    try {
      result = await provider.askAgent(messages, toolSchemas);
    } catch (err: any) {
      console.log(chalk.yellow(`  ⚠️ Upstream hiccup (${err?.message || err}) — retrying…`));
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        result = await provider.askAgent(messages, toolSchemas);
      } catch (err2: any) {
        throw err2;
      }
    }

    if (result.toolCalls && result.toolCalls.length > 0) {
      // Build a signature to detect the model looping on the same action
      const callKey = result.toolCalls
        .map((tc) => {
          let a = "";
          try { a = JSON.stringify(JSON.parse(tc.arguments || "{}")); } catch { a = tc.arguments || ""; }
          return `${tc.name}:${a}`;
        })
        .join("|");

      if (callKey === lastCallKey) repeatedCalls += 1;
      else repeatedCalls = 0;
      lastCallKey = callKey;

      if (repeatedCalls >= 3) {
        const results = messages
          .filter((m) => m.role === "tool")
          .map((m) => m.content)
          .join("\n\n")
          .slice(0, 12000);
        console.log(chalk.yellow("\n⚠️ Detected a repeated tool call — finalizing your answer from the gathered results."));
        const forced = await providerManager.ask(
          `You previously executed tools and gathered this information:\n\n${results}\n\n` +
            `Now answer the user's original request using it. Do NOT call any tools — respond with text only.\n\nOriginal request: "${goal}"`,
          undefined,
          onToken
        );
        return forced || "⚠️ The agent looped on the same action. Please ask a more specific question.";
      }

      messages.push({ role: "assistant", content: result.content || "", tool_calls: result.toolCalls });

      for (const tc of result.toolCalls) {
        let args: any = {};
        try {
          args = JSON.parse(tc.arguments || "{}");
        } catch {
          args = {};
        }

        if (onTool) onTool();
        console.log(chalk.cyan(`\n✦ ${formatToolCall(tc.name, args)}`));
        const { success, result: toolResult, error, retries } = await executeToolWithRetry(tc.name, args, rl);

        if (success) {
          console.log(chalk.green(`  ✔ Success${retries > 0 ? ` (after ${retries} retries)` : ""}`));
        } else {
          console.log(chalk.red(`  ✘ Failed: ${error}`));
        }

        const content =
          typeof toolResult === "string"
            ? toolResult
            : JSON.stringify(toolResult ?? error ?? "");

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.name,
          content,
        });

        if (isAutoApprove) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
      continue;
    }

    // No tool calls → the model answered; stream it if a handler is present
    const answer = result.content || "";
    if (onToken && answer) {
      onToken(answer);
    }
    return answer;
  }

  return "⚠️ Reached the maximum number of agent steps. Try a more specific request.";
}

// ============================================================
// LEGACY PROMPT-BASED AGENT (fallback for providers without askAgent)
// ============================================================
async function runDynamicAgentLegacy(
  goal: string,
  systemInstructions: string,
  context: any,
  rl?: readline.Interface,
  onToken?: (token: string) => void,
  onTool?: () => void
): Promise<string> {
  const stepsHistory: ToolStep[] = [];
  let finished = false;
  let iterations = 0;
  const isAutoApprove = process.env.ZAAHIX_AUTO_APPROVE === "true";
  const maxIterations = isAutoApprove ? 45 : 15;

  let historyStr = "(No previous conversation history)";
  if (Array.isArray(context) && context.length > 0) {
    historyStr = context
      .map(
        (msg: any) =>
          `${msg.role === "user" ? "USER" : "ASSISTANT"}:\n${msg.content}`
      )
      .join("\n\n---\n\n");
  }

  while (!finished && iterations < maxIterations) {
    iterations++;

    const prompt = `
${systemInstructions}

CONVERSATION HISTORY (Previous turns in this session):
${historyStr}

USER CURRENT REQUEST:
"${goal}"

CURRENT WORKSPACE DIRECTORY:
"${process.cwd()}"

TOOL EXECUTION HISTORY IN THIS TURN:
${stepsHistory.length === 0 ? "(No tools executed in this turn yet)" : stepsHistory.map((step, idx) => `
Step ${idx + 1}:
- Tool: "${step.tool}"
- Arguments: ${JSON.stringify(step.args)}
- Status: ${step.success ? "Success" : "Failed"}
- Retries: ${step.retries || 0}
- Output/Error: ${JSON.stringify(step.result || step.error)}
`).join("\n")}

Decide your next action. You can either call a tool to gather more info or edit code, or finish and respond.

AVAILABLE TOOLS:
- scan_project (args: { path?: string }) - Recursively lists files and directories, and returns project metadata (dependencies, sizes).
- list_files (args: { path?: string }) - Lists contents of a specific folder.
- read_file (args: { path: string }) - Reads the full content of a file.
- read_file_chunk (args: { path: string, start?: number, length?: number }) - Reads a chunk of a large file.
- write_file (args: { path: string, content: string }) - Writes a new file.
- patch_file (args: { path: string, search: string, replace: string }) - Patches an existing file (search and replace).
- search_grep (args: { query: string, path?: string, isRegex?: boolean, includePattern?: string, caseSensitive?: boolean, contextLines?: number }) - Pattern search across code.
- semantic_search (args: { query: string, top?: number }) - Semantic query.
- analyze_project (args: { path?: string }) - Architect review.
- git_create_branch (args: { name?: string, dry?: boolean }) - Creates a git branch.
- git_commit_push (args: { message?: string, files?: string[], dry?: boolean }) - Commits and pushes changes.
- git_create_pr (args: { title: string, body?: string, base?: string, head?: string, dry?: boolean }) - Creates a PR.
- git_diff (args: { files?: string[] }) - Shows git diff of changes.
- git_status (args: {}) - Shows current git status.
- index_status (args: {}) - Shows status of semantic and embeddings indexes.
- index_rebuild (args: { type?: "semantic" | "embeddings" | "all" }) - Rebuilds indexes from scratch.

DECISION INSTRUCTIONS:
1. EXTREMELY IMPORTANT: Review the CONVERSATION HISTORY above. If you (ASSISTANT) already gathered information or read a file in a previous turn, DO NOT run the same tool again. Use the information already present in the history!
2. If the user asks you to build, create, set up, implement, or get to work, DO NOT write just a few files and then stop to explain. Keep invoking tools sequentially to build out the full application code, component by component, file by file. Only choose "respond" when you have done all the work requested or you need to ask the user a specific question.
3. If a tool failed in this turn, inspect the error carefully, search for the correct files/folders/patterns, and try again.
4. You MUST return a single JSON object matching this schema:
{
  "thought": "Explain your thinking",
  "action": "call_tool" | "respond",
  "tool": "tool_name_here",
  "args": { ... }
}
Do not wrap your output in anything other than this JSON block.
`;

    const decisionText = await providerManager.ask(prompt, JSON.stringify(context));
    const decision = parseJSONResponse(decisionText);

    if (decision.action === "respond") {
      finished = true;
      break;
    }

    if (decision.action === "call_tool" && decision.tool) {
      if (onTool) onTool();
      console.log(chalk.cyan(`\n✦ ${formatToolCall(decision.tool, decision.args || {})}`));

      const { success, result, error, retries } = await executeToolWithRetry(
        decision.tool,
        decision.args || {},
        rl
      );

      stepsHistory.push({
        tool: decision.tool,
        args: decision.args,
        success,
        result,
        error,
        retries
      });

      if (success) {
        console.log(chalk.green(`  ✔ Success${retries > 0 ? ` (after ${retries} retries)` : ""}`));
      } else {
        console.log(chalk.red(`  ✘ Failed: ${error}`));
      }

      if (isAutoApprove) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } else {
      finished = true;
      break;
    }
  }

  const executionContext = stepsHistory
    .map((r, idx) => {
      let outputStr = "";
      if (r.tool === "scan_project" && r.result) {
        const res = r.result;
        const filesSummary = res.files
          ? res.files.length > 50
            ? `${res.files.slice(0, 50).join(", ")}... and ${res.files.length - 50} more files`
            : res.files.join(", ")
          : "";
        outputStr = JSON.stringify(
          {
            fileStats: res.fileStats,
            filesSummary,
          },
          null,
          2
        );
      } else {
        outputStr = JSON.stringify(r.result || r.error, null, 2);
      }

      if (outputStr.length > 80000) {
        outputStr = outputStr.slice(0, 80000) + "\n... (truncated to fit model limits) ...";
      }

      return `Action ${idx + 1}: Executed "${r.tool}" with arguments ${JSON.stringify(r.args)}\nSuccess: ${r.success}\nRetries: ${r.retries || 0}\nOutput:\n${outputStr}`;
    })
    .join("\n\n");

  const finalPrompt = `
You are Zaahix, a senior software engineer working in the terminal.
Your style is direct, clear, professional, and action-oriented, similar to Google Gemini CLI.

USER GOAL:
"${goal}"

CONVERSATION HISTORY (For context):
${historyStr}

EXECUTION HISTORY & RESULTS IN THIS TURN:
${executionContext}

INSTRUCTIONS FOR YOUR RESPONSE:
1. Speak directly to the user as a software engineer who is executing their request.
2. State clearly what you have achieved in this turn (e.g. files written, folders scanned, search results found).
3. If you have created or modified code, give a brief, concise summary of what was implemented.
4. If there is more work remaining to fulfill the user's goal, explain what is missing and ask if you should continue building.
5. Keep your response focused on the actual work done. Avoid corporate speak, timeline reviews, or suggesting meetings. Keep it technical, clean, and developer-focused.
`;

  return await providerManager.ask(finalPrompt, JSON.stringify(context), onToken);
}

export async function runDynamicAgent(
  goal: string,
  systemInstructions: string,
  context: any,
  rl?: readline.Interface,
  onToken?: (token: string) => void,
  onTool?: () => void
): Promise<string> {
  const provider = providerManager.getCurrentProvider();

  if (provider.askAgent) {
    try {
      return await runNativeAgent(goal, systemInstructions, context, rl, onToken, onTool);
    } catch (err: any) {
      console.log(chalk.yellow(`\n⚠️ Native agent loop failed (${err?.message || err}); falling back to prompt-based agent.`));
    }
  }

  return runDynamicAgentLegacy(goal, systemInstructions, context, rl, onToken, onTool);
}
