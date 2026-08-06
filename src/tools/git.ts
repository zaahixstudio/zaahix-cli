import { execFileSync } from "child_process";
import chalk from "chalk";

function isGitRepository(): boolean {
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getGitStatus(): { hasChanges: boolean; branch: string } {
  try {
    const branch = execFileSync("git", ["branch", "--show-current"], {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    const status = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    return { hasChanges: status.length > 0, branch };
  } catch {
    return { hasChanges: false, branch: "unknown" };
  }
}

export function createBranch(branchName: string, dryRun = true) {
  if (!isGitRepository()) {
    return `❌ Not a git repository. Initialize with: git init`;
  }

  try {
    // Check if branch already exists
    try {
      execFileSync("git", ["rev-parse", "--verify", branchName], { stdio: "pipe" });
      return `❌ Branch "${branchName}" already exists. Use a different name.`;
    } catch {
      // Branch doesn't exist, good
    }

    if (dryRun) {
      return `DRY-RUN: git checkout -b ${branchName}`;
    }

    execFileSync("git", ["checkout", "-b", branchName], { stdio: "inherit" });
    return `✅ Created and switched to branch: ${branchName}`;
  } catch (err: any) {
    return `❌ Git error: ${err.message}`;
  }
}

export function commitAndPush(message: string, files: string[] = [], dryRun = true) {
  if (!isGitRepository()) {
    return `❌ Not a git repository. Initialize with: git init`;
  }

  try {
    const { hasChanges } = getGitStatus();

    if (!hasChanges && files.length === 0) {
      return `❌ No changes to commit.`;
    }

    if (dryRun) {
      // Show what would be committed
      const status = execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf-8",
        stdio: "pipe",
      });

      console.log(chalk.gray("\n📝 Changes to be committed:"));
      console.log(chalk.white(status || "(no changes)"));
      console.log(chalk.gray(`\nMessage: "${message}"`));

      return `DRY-RUN: git add ${files.join(", ")} && git commit -m "${message}" && git push`;
    }

    if (files.length) {
      execFileSync("git", ["add", ...files], { stdio: "inherit" });
    } else {
      execFileSync("git", ["add", "."], { stdio: "inherit" });
    }

    execFileSync("git", ["commit", "-m", message], { stdio: "inherit" });

    try {
      execFileSync("git", ["push"], { stdio: "inherit" });
      return `✅ Committed and pushed: ${message}`;
    } catch (pushErr: any) {
      // Push failed, but commit succeeded
      const currentBranch = getGitStatus().branch;
      return `✅ Committed changes (branch: ${currentBranch}). Push failed: ${pushErr.message}`;
    }
  } catch (err: any) {
    return `❌ Git error: ${err.message}`;
  }
}

export function createPullRequest(title: string, body = "", base = "main", head?: string, dryRun = true) {
  if (!isGitRepository()) {
    return `❌ Not a git repository. Initialize with: git init`;
  }

  try {
    if (!head) head = `zaahix-auto-${Date.now()}`;

    if (dryRun) {
      return `DRY-RUN: gh pr create --title "${title}" --body "${body}" --base ${base} --head ${head}`;
    }

    // Check if gh CLI is available
    try {
      execFileSync("gh", ["--version"], { stdio: "pipe" });
    } catch {
      return `❌ GitHub CLI (gh) is not installed. Install it from: https://cli.github.com/`;
    }

    // Check if authenticated
    try {
      execFileSync("gh", ["auth", "status"], { stdio: "pipe" });
    } catch {
      return `❌ GitHub CLI is not authenticated. Run: gh auth login`;
    }

    // Create PR using GitHub CLI
    const args = ["pr", "create", "--title", title, "--body", body, "--base", base, "--head", head];
    execFileSync("gh", args, { stdio: "inherit" });

    return `✅ Pull request created: ${title}`;
  } catch (err: any) {
    return `❌ PR error: ${err.message}`;
  }
}

export function gitDiff(files?: string[]): string {
  if (!isGitRepository()) {
    return `❌ Not a git repository.`;
  }

  try {
    const args = ["diff"];
    if (files && files.length > 0) {
      args.push("--", ...files);
    }

    const diff = execFileSync("git", args, {
      encoding: "utf-8",
      stdio: "pipe",
    });

    if (!diff.trim()) {
      return "No changes detected.";
    }

    return diff;
  } catch (err: any) {
    return `❌ Git diff error: ${err.message}`;
  }
}

export function gitStatus(): string {
  if (!isGitRepository()) {
    return `❌ Not a git repository.`;
  }

  try {
    const status = execFileSync("git", ["status", "--short"], {
      encoding: "utf-8",
      stdio: "pipe",
    });

    const branch = execFileSync("git", ["branch", "--show-current"], {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    if (!status.trim()) {
      return `On branch: ${branch}\nWorking tree clean.`;
    }

    return `On branch: ${branch}\n\nChanges:\n${status}`;
  } catch (err: any) {
    return `❌ Git status error: ${err.message}`;
  }
}
