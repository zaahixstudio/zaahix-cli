import readline from "readline";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { runAgent } from "../agent/engine";
import { formatError } from "../utils/errors";
import { printBanner } from "../utils/branding";

function getProviderInfo(): { provider: string; model: string } {
  const provider = process.env.ZAAHIX_PROVIDER || "openai";
  let model: string;

  switch (provider) {
    case "groq":
      model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
      break;
    case "gemini":
      model = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
      break;
    case "openrouter":
      model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
      break;
    case "sambanova":
      model = process.env.SAMBANOVA_MODEL || "Meta-Llama-3.3-70B-Instruct";
      break;
    case "longcat":
      model = process.env.LONGCAT_MODEL || "LongCat-2.0";
      break;
    case "omniroute":
      model = process.env.OMNIROUTE_MODEL || "openai/gpt-4o-mini";
      break;
    default:
      model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  // Allow global model override
  if (process.env.ZAAHIX_MODEL) {
    model = process.env.ZAAHIX_MODEL;
  }

  return { provider, model };
}

export function startChat(resume: boolean = false) {
  const { provider, model } = getProviderInfo();
  const promptStr = chalk.bold.hex("#7c5cff")("zaahix") + chalk.gray(" › ");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: promptStr,
  });

  const zaahixDir = path.join(process.cwd(), ".zaahix");
  const historyPath = path.join(zaahixDir, "history.json");
  const chatHistory: { role: "user" | "assistant"; content: string }[] = [];

  if (resume) {
    try {
      if (fs.existsSync(historyPath)) {
        const loaded = fs.readJsonSync(historyPath);
        if (Array.isArray(loaded)) {
          chatHistory.push(...loaded);
        }
      }
    } catch (e) {
      // Ignore reading error
    }
  }

  console.clear();
  printBanner({
    version: "1.0.0",
    provider,
    model,
    directory: process.cwd(),
    mode: resume ? "resume" : "chat",
  });

  if (resume && chatHistory.length > 0) {
    console.log(chalk.bold.green(`✨ Resumed previous session. Loaded ${chatHistory.length} messages from history.\n`));
  } else if (resume) {
    console.log(chalk.bold.yellow(`⚠️  No previous session history found in this folder.\n`));
  }

  rl.prompt();

  let isProcessing = false;

  // Handle graceful shutdown
  const cleanup = () => {
    console.log(chalk.bold.hex("#7c5cff")("\n\n▸ zaahix session ended. See you soon!"));
    process.exit(0);
  };

  process.on("SIGINT", () => {
    if (isProcessing) {
      console.log(chalk.yellow("\n\n⚠️  Interrupted. Please wait for the current operation to complete...\n"));
      return;
    }
    cleanup();
  });

  process.on("SIGTERM", cleanup);

  rl.on("line", async (input) => {
    if (isProcessing) return;

    const text = input.trim();

    // Handle exit commands
    if (text === "exit" || text === "/exit" || text === "/quit") {
      cleanup();
      return;
    }

    // Handle special commands
    if (text === "/help") {
      console.log(chalk.bold.hex("#7c5cff")("\n📋 Commands"));
      console.log(chalk.gray("  /help              ") + chalk.white("Show this help"));
      console.log(chalk.gray("  /clear             ") + chalk.white("Clear the screen"));
      console.log(chalk.gray("  /history           ") + chalk.white("Show conversation history"));
      console.log(chalk.gray("  /status            ") + chalk.white("Show provider & session info"));
      console.log(chalk.gray("  /cost              ") + chalk.white("Show estimated session usage"));
      console.log(chalk.gray("  exit / /exit       ") + chalk.white("Leave the session\n"));
      rl.prompt();
      return;
    }

    if (text === "/clear") {
      console.clear();
      rl.prompt();
      return;
    }

    if (text === "/history") {
      if (chatHistory.length === 0) {
        console.log(chalk.yellow("\nNo conversation history yet.\n"));
      } else {
        console.log(chalk.bold.hex("#7c5cff")("\n📜 Conversation History"));
        for (const msg of chatHistory) {
          const role = msg.role === "user" ? chalk.gray("You") : chalk.bold.hex("#7c5cff")("Zaahix");
          console.log(chalk.gray(`\n── ${role} ──`));
          console.log(msg.content.slice(0, 500) + (msg.content.length > 500 ? "…" : ""));
        }
        console.log("");
      }
      rl.prompt();
      return;
    }

    if (text === "/status") {
      console.log(chalk.bold.hex("#7c5cff")("\n📊 Status"));
      console.log(chalk.gray("  Provider        : ") + chalk.cyan(provider));
      console.log(chalk.gray("  Model           : ") + chalk.white(model));
      console.log(chalk.gray("  Auto-approve    : ") + (process.env.ZAAHIX_AUTO_APPROVE === "true" ? chalk.green("enabled") : chalk.gray("disabled")));
      console.log(chalk.gray("  History msgs    : ") + chalk.white(chatHistory.length));
      console.log(chalk.gray("  Session dir     : ") + chalk.white(zaahixDir));
      console.log(chalk.gray("  Workspace       : ") + chalk.white(process.cwd()) + "\n");
      rl.prompt();
      return;
    }

    if (text === "/cost") {
      console.log(chalk.bold.hex("#7c5cff")("\n💰 Usage"));
      console.log(chalk.gray("  This session uses the configured provider directly."));
      console.log(chalk.gray("  When connected to the AI API Bank, each request bills the"));
      console.log(chalk.gray("  wallet in real time (text = ₦5/call).\n"));
      rl.prompt();
      return;
    }

    if (!text) {
      rl.prompt();
      return;
    }

    isProcessing = true;

    // Animated spinner while waiting for first token
    const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let spinnerIdx = 0;
    let spinnerStopped = false;
    process.stdout.write("\n");
    const spinnerInterval = setInterval(() => {
      if (spinnerStopped) return;
      process.stdout.write(`\r${chalk.hex("#7c5cff")(spinnerFrames[spinnerIdx++ % spinnerFrames.length])} ${chalk.gray("Zaahix is thinking…")}`);
    }, 80);

    const clearSpinner = () => {
      if (spinnerStopped) return;
      spinnerStopped = true;
      clearInterval(spinnerInterval);
      process.stdout.write("\r\x1b[2K"); // clear spinner line
    };

    try {
      let firstToken = true;
      const result = await runAgent(text, chatHistory, rl, (token) => {
        if (firstToken) {
          clearSpinner();
          process.stdout.write("\n");
          process.stdout.write(chalk.bold.hex("#7c5cff")("Zaahix") + chalk.gray(" ▸ ") + "\n");
          firstToken = false;
        }
        process.stdout.write(token);
      });

      clearSpinner();
      if (firstToken) {
        console.log("\n" + chalk.bold.hex("#7c5cff")("Zaahix") + chalk.gray(" ▸ "));
        console.log(result);
      }
      console.log("\n");

      // Save user request and final assistant response to history
      chatHistory.push({ role: "user", content: text });
      chatHistory.push({ role: "assistant", content: result });

      // Cap history to keep context clean (last 10 messages)
      if (chatHistory.length > 20) {
        chatHistory.splice(0, 2);
      }

      // Persist history to project folder
      try {
        fs.ensureDirSync(zaahixDir);
        fs.writeJsonSync(historyPath, chatHistory, { spaces: 2 });
      } catch (e) {
        // Ignore writing error
      }
    } catch (err: any) {
      console.log(chalk.red(`\n${formatError(err)}\n`));
    } finally {
      isProcessing = false;
      rl.prompt();
    }
  });

  rl.on("close", () => {
    cleanup();
  });
}