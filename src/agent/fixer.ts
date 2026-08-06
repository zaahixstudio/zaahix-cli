import { runDynamicAgent } from "./dynamicAgent";
import readline from "readline";

/**
 * SAFE FIX ENGINE (requires approval before execution)
 */
export async function runFixMode(issue: string, context: any, rl?: readline.Interface) {
  const systemInstructions = `You are Zaahix Fix Engine, a senior software engineer.
Your job is to diagnose and execute a step-by-step fix plan for the user's issue.
Analyze the codebase using tools, locate the bug, apply necessary code changes, and verify that the issue is resolved.
Always double check filenames, path details, and patch content for accuracy.`;

  return runDynamicAgent(issue, systemInstructions, context, rl);
}
