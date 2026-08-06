import readline from "readline";
import chalk from "chalk";
import { runTool } from "../tools";
import { providerManager } from "../providers/providerManager";
import { runFixMode } from "./fixer";
import { runDynamicAgent } from "./dynamicAgent";

function isRepairRequest(input: string) {
  const normalized = input.toLowerCase();
  return /\b(fix|repair|bug|issue|correct|resolve|broken|error|fail|failed)\b/.test(normalized) &&
    !/\b(feature|add|new command|implement|build)\b/.test(normalized);
}

function isHumanAnalysisRequest(input: string) {
  const normalized = input.toLowerCase();
  const reviewKeywords = ["review", "analyse", "analyze", "summary"];
  const projectKeywords = ["project", "codebase", "repo", "repository", "workspace"];

  const hasReview = reviewKeywords.some((k) => normalized.includes(k));
  const hasProject = projectKeywords.some((k) => normalized.includes(k));

  return hasReview && hasProject;
}

function isCasualGreeting(input: string) {
  const normalized = input.toLowerCase().trim().replace(/[!?\.,]+$/, "");
  const greetings = [
    "hi",
    "hello",
    "hey",
    "yo",
    "greetings",
    "sup",
    "thanks",
    "thank you",
    "good morning",
    "good afternoon",
    "good evening",
  ];

  return greetings.includes(normalized);
}

export async function runAgent(
  input: string,
  context: any,
  rl?: readline.Interface,
  onToken?: (token: string) => void
): Promise<string> {
  if (isCasualGreeting(input)) {
    process.env.ZAAHIX_MODEL_MODE = "chat";
    try {
      return await providerManager.ask(
        `You are Zaahix, a friendly AI assistant. Respond to this chat message naturally: ${input}`,
        JSON.stringify(context),
        onToken
      );
    } finally {
      delete process.env.ZAAHIX_MODEL_MODE;
    }
  }

  // ===================================
  // REPAIR PATH
  // ===================================

  if (isRepairRequest(input)) {
    process.env.ZAAHIX_MODEL_MODE = "code";
    try {
      return await runFixMode(input, context, rl);
    } finally {
      delete process.env.ZAAHIX_MODEL_MODE;
    }
  }

  // ===================================
  // DYNAMIC AGENT WORKFLOW
  // ===================================

  const systemInstructions = isHumanAnalysisRequest(input)
    ? `You are Zaahix, a senior software architect and technical reviewer.
Your goal is to inspect and produce a deep, detailed project architecture and quality review.
You should call tools to scan and analyze the project structure, and read key configuration/implementation files.
Analyze the strengths, weaknesses, technical debt, and production readiness.`
    : `You are Zaahix, a highly intelligent and accurate AI developer agent similar to Google Gemini.
Your job is to execute actions to help the user achieve their goal.
You can call tools to find files, read code, write files, patch files, perform grep searches, or analyze projects.
Be thorough, precise, self-correct if errors occur, and verify your results.`;

  process.env.ZAAHIX_MODEL_MODE = "code";
  try {
    return await runDynamicAgent(input, systemInstructions, context, rl, onToken);
  } finally {
    delete process.env.ZAAHIX_MODEL_MODE;
  }
}