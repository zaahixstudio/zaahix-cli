import chalk from "chalk";
import { Command } from "commander";
import { startChat } from "../agent/chat";
import { analyzeProject } from "../memory/projectAnalyzer";
import { runFixMode } from "../agent/fixer";
import { scanProject } from "../memory/projectScanner";
import { formatError, getRecoverySuggestion, ErrorCode } from "../utils/errors";
import { printModeHeader } from "../utils/branding";

const VERSION = "1.0.0";

const AVAILABLE_PROVIDERS = ["ai-bank", "openai", "gemini", "groq", "openrouter", "sambanova", "longcat", "omniroute"];

export function runCLI(argv: string[]) {
  const program = new Command();

  program
    .name("zaahix")
    .description("Zaahix CLI - AI Terminal Agent")
    .version(VERSION, "-v, --version")
    .option("-y, --auto-approve", "Auto approve tool execution")
    .option("-r, --resume", "Resume the last session in the current project")
    .option("--allow-non-interactive", "Allow writes in non-interactive shells by forcing approval")
    .option("-p, --provider <provider>", `LLM provider to use (${AVAILABLE_PROVIDERS.join(", ")})`)
    .option("-m, --model <model>", "Model name to use with the provider");

  // Apply global flags early
  const rootArgs = argv.slice(2);
  const rootFlags = ["-y", "--auto-approve", "--allow-non-interactive", "-r", "--resume", "-v", "--version"];
  const hasFlag = (arg: string) => rootFlags.some(f => arg === f || arg.startsWith(f + "="));

  // Set provider and model from flags if present
  for (const arg of rootArgs) {
    if (arg.startsWith("--provider=") || arg === "--provider") {
      const idx = rootArgs.indexOf(arg);
      const val = arg.includes("=") ? arg.split("=")[1] : rootArgs[idx + 1];
      if (val && AVAILABLE_PROVIDERS.includes(val)) {
        process.env.ZAAHIX_PROVIDER = val;
      }
    }
    if (arg.startsWith("--model=") || arg === "--model") {
      const idx = rootArgs.indexOf(arg);
      const val = arg.includes("=") ? arg.split("=")[1] : rootArgs[idx + 1];
      if (val) {
        process.env.ZAAHIX_MODEL = val;
      }
    }
  }

  const isRootChat = rootArgs.length === 0 || rootArgs.every((arg) => hasFlag(arg));

  if (rootArgs.includes("-v") || rootArgs.includes("--version")) {
    console.log(VERSION);
    process.exit(0);
  }

  if (isRootChat) {
    if (rootArgs.includes("-y") || rootArgs.includes("--auto-approve")) {
      process.env.ZAAHIX_AUTO_APPROVE = "true";
    }
    if (rootArgs.includes("--allow-non-interactive")) {
      process.env.ZAAHIX_ALLOW_NON_INTERACTIVE = "true";
    }
    const resume = rootArgs.includes("-r") || rootArgs.includes("--resume");
    startChat(resume);
    return;
  }

  program
    .command("chat")
    .description("Start AI chat mode")
    .option("-y, --auto-approve", "Auto approve tool execution")
    .option("-r, --resume", "Resume the last session in the current project")
    .option("-p, --provider <provider>", `LLM provider to use (${AVAILABLE_PROVIDERS.join(", ")})`)
    .option("-m, --model <model>", "Model name to use with the provider")
    .action((options) => {
      const isAutoApprove = !!options.autoApprove || !!program.opts().autoApprove;
      const isResume = !!options.resume || !!program.opts().resume;
      const isAllowNonInteractive = !!program.opts().allowNonInteractive;

      if (isAutoApprove) {
        process.env.ZAAHIX_AUTO_APPROVE = "true";
      }
      if (isAllowNonInteractive) {
        process.env.ZAAHIX_ALLOW_NON_INTERACTIVE = "true";
      }
      if (options.provider && AVAILABLE_PROVIDERS.includes(options.provider)) {
        process.env.ZAAHIX_PROVIDER = options.provider;
      }
      if (options.model) {
        process.env.ZAAHIX_MODEL = options.model;
      }
      startChat(isResume);
    });

  program
    .command("analyze [path]")
    .description("Analyze project structure")
    .option("-s, --style <style>", "Analysis style: human or technical", "human")
    .action(async (path, options) => {
      try {
        printModeHeader("Project Analysis", path || ".");
        const style = options.style === "technical" ? "technical" : "human";
        const result = await analyzeProject(path || ".", style);
        console.log(chalk.green("✅ Analysis complete!\n"));
        console.log(chalk.white(result.summary));
      } catch (err: any) {
        console.error(chalk.red(formatError(err)));
        process.exit(1);
      }
    });

  program
    .command("repair <issue...>")
    .description("Repair or fix a project issue using the AI agent")
    .option("-y, --auto-approve", "Auto approve tool execution")
    .option("--allow-non-interactive", "Allow writes in non-interactive shells by forcing approval")
    .action(async (issueParts: string[], options) => {
      try {
        const isAutoApprove = !!options.autoApprove || !!program.opts().autoApprove;
        const isAllowNonInteractive = !!options.allowNonInteractive || !!program.opts().allowNonInteractive;

        if (isAutoApprove) {
          process.env.ZAAHIX_AUTO_APPROVE = "true";
        }
        if (isAllowNonInteractive) {
          process.env.ZAAHIX_ALLOW_NON_INTERACTIVE = "true";
        }
        const issue = issueParts.join(" ");
        printModeHeader("Repair Mode", issue);
        const result = await runFixMode(issue, {});
        console.log(chalk.green("✅ Repair complete!\n"));
        console.log(chalk.white(result));
      } catch (err: any) {
        console.error(chalk.red(formatError(err)));
        process.exit(1);
      }
    });

  program
    .command("scan [path]")
    .description("Scan the project structure and show file metadata")
    .action(async (path: string) => {
      try {
        printModeHeader("Project Scan", path || ".");
        const result = await scanProject(path || ".");
        console.log(chalk.green("✅ Scan complete!\n"));
        console.log(chalk.white(JSON.stringify(result.fileStats, null, 2)));
      } catch (err: any) {
        console.error(chalk.red(formatError(err)));
        process.exit(1);
      }
    });

  program
    .command("review")
    .description("Run a deeper project review with scan and analysis")
    .option("-s, --style <style>", "Analysis style: human or technical", "technical")
    .action(async (options) => {
      try {
        printModeHeader("Deep Project Review");
        const result = await analyzeProject(".", options.style);
        console.log(chalk.green("✅ Review complete!\n"));
        console.log(chalk.white(result.summary));
      } catch (err: any) {
        console.error(chalk.red(formatError(err)));
        process.exit(1);
      }
    });

  program.parse(argv);

  const rootOptions = program.opts();
  if (rootOptions.autoApprove) {
    process.env.ZAAHIX_AUTO_APPROVE = "true";
  }
  if (rootOptions.allowNonInteractive) {
    process.env.ZAAHIX_ALLOW_NON_INTERACTIVE = "true";
  }

  if (process.argv.slice(2).length === 0) {
    startChat(!!rootOptions.resume);
  }
}