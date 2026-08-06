import readline from "readline";
import chalk from "chalk";

export type ApprovalLevel = "always" | "write" | "strict";

export interface ApprovalResult {
  approved: boolean;
  alwaysApprove?: boolean;
}

/**
 * Request user approval for a file operation.
 * Shows a preview and asks for confirmation.
 */
export async function requestApproval(
  toolName: string,
  filePath: string,
  contentPreview: string,
  rl?: readline.Interface,
  level: ApprovalLevel = "write"
): Promise<ApprovalResult> {
  // Auto-approve if level is "always" or if auto-approve is enabled
  if (level === "always" || process.env.ZAAHIX_AUTO_APPROVE === "true") {
    return { approved: true };
  }

  // Auto-approve reads
  if (level === "write" && (toolName === "read_file" || toolName === "read_file_chunk" || toolName === "list_files")) {
    return { approved: true };
  }

  // Need interactive confirmation
  const preview = typeof contentPreview === "string"
    ? contentPreview.slice(0, 300)
    : "(binary/large content)";

  console.log(chalk.bold.yellow(`\n⚠️  [${toolName}] Requesting permission:`));
  console.log(chalk.yellow(`📂 Path: `) + chalk.cyan(filePath));
  console.log(chalk.yellow(`📝 Content Preview (first 300 chars):`));
  console.log(chalk.gray(`--------------------------------------------------`));
  console.log(chalk.white(preview));
  console.log(chalk.gray(`--------------------------------------------------`));

  if (rl) {
    return new Promise<ApprovalResult>((resolve) => {
      rl.question(
        chalk.bold.cyan(`Do you want to allow this operation? [y]es / [n]o / [a]lways: `),
        (ans) => {
          const input = ans.trim().toLowerCase();
          const isYes = input === "y" || input === "yes";
          const isAlways = input === "a" || input === "all" || input === "always";

          if (isAlways) {
            process.env.ZAAHIX_AUTO_APPROVE = "true";
            console.log(chalk.bold.green(`✓ Always approved enabled.\n`));
            resolve({ approved: true, alwaysApprove: true });
          } else if (isYes) {
            console.log(chalk.green(`✓ Action approved.\n`));
            resolve({ approved: true });
          } else {
            console.log(chalk.red(`✗ Action denied.\n`));
            resolve({ approved: false });
          }
        }
      );
    });
  }

  // Fallback for non-interactive mode
  if (process.stdin && process.stdin.isTTY) {
    return new Promise<ApprovalResult>((resolve) => {
      const tempRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      tempRl.question(
        chalk.bold.cyan(`Do you want to allow this operation? [y]es / [n]o / [a]lways: `),
        (ans) => {
          tempRl.close();
          const input = ans.trim().toLowerCase();
          const isYes = input === "y" || input === "yes";
          const isAlways = input === "a" || input === "all" || input === "always";

          if (isAlways) {
            process.env.ZAAHIX_AUTO_APPROVE = "true";
            console.log(chalk.bold.green(`✓ Always approved enabled.\n`));
            resolve({ approved: true, alwaysApprove: true });
          } else if (isYes) {
            console.log(chalk.green(`✓ Action approved.\n`));
            resolve({ approved: true });
          } else {
            console.log(chalk.red(`✗ Action denied.\n`));
            resolve({ approved: false });
          }
        }
      );
    });
  }

  // Non-interactive mode - deny by default
  return {
    approved: false,
  };
}

/**
 * Request approval with a custom message.
 */
export async function requestApprovalWithMessage(
  toolName: string,
  message: string,
  rl?: readline.Interface,
  level: ApprovalLevel = "write"
): Promise<ApprovalResult> {
  if (level === "always" || process.env.ZAAHIX_AUTO_APPROVE === "true") {
    return { approved: true };
  }

  console.log(chalk.bold.yellow(`\n⚠️  [${toolName}] ${message}`));

  if (rl) {
    return new Promise<ApprovalResult>((resolve) => {
      rl.question(
        chalk.bold.cyan(`Continue? [y]es / [n]o / [a]lways: `),
        (ans) => {
          const input = ans.trim().toLowerCase();
          const isYes = input === "y" || input === "yes";
          const isAlways = input === "a" || input === "all" || input === "always";

          if (isAlways) {
            process.env.ZAAHIX_AUTO_APPROVE = "true";
            resolve({ approved: true, alwaysApprove: true });
          } else if (isYes) {
            resolve({ approved: true });
          } else {
            resolve({ approved: false });
          }
        }
      );
    });
  }

  if (process.stdin && process.stdin.isTTY) {
    return new Promise<ApprovalResult>((resolve) => {
      const tempRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      tempRl.question(
        chalk.bold.cyan(`Continue? [y]es / [n]o / [a]lways: `),
        (ans) => {
          tempRl.close();
          const input = ans.trim().toLowerCase();
          const isYes = input === "y" || input === "yes";
          const isAlways = input === "a" || input === "all" || input === "always";

          if (isAlways) {
            process.env.ZAAHIX_AUTO_APPROVE = "true";
            resolve({ approved: true, alwaysApprove: true });
          } else if (isYes) {
            resolve({ approved: true });
          } else {
            resolve({ approved: false });
          }
        }
      );
    });
  }

  return { approved: false };
}
