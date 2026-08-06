import chalk from "chalk";

const ZAAHIX_LOGO = [
  "███████╗ █████╗  █████╗ ██╗  ██╗██╗██╗  ██╗",
  "╚══███╔╝██╔══██╗██╔══██╗██║  ██║██║╚██╗██╔╝",
  "  ███╔╝ ███████║███████║███████║██║ ╚███╔╝ ",
  " ███╔╝  ██╔══██║██╔══██║██╔══██║██║ ██╔██╗ ",
  "███████╗██║  ██║██║  ██║██║  ██║██║██╔╝ ██╗",
  "╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝",
];

const GRADIENT = ["#7c5cff", "#6a55e8", "#5b6bff", "#3aa8e0", "#2bc3dc", "#22d3ee"];

export function asciiLogo(): string {
  return ZAAHIX_LOGO.map((line, i) => chalk.hex(GRADIENT[Math.min(i, GRADIENT.length - 1)])(line)).join("\n");
}

export interface BannerOptions {
  provider?: string;
  model?: string;
  version?: string;
  directory?: string;
  mode?: string;
}

export function printBanner(opts: BannerOptions = {}): void {
  const hr = chalk.gray("─".repeat(58));
  console.log("");
  console.log(asciiLogo());
  console.log(chalk.gray("  AI Terminal Agent  ·  powered by the AI API Bank"));
  console.log("");
  console.log(hr);
  console.log(chalk.gray("  Version   : ") + chalk.white(opts.version || "1.0.0"));
  console.log(chalk.gray("  Directory : ") + chalk.white(opts.directory || process.cwd()));
  if (opts.provider) {
    console.log(chalk.gray("  Engine    : ") + chalk.cyan(opts.provider + (opts.model ? ` (${opts.model})` : "")));
  }
  if (opts.mode) {
    console.log(chalk.gray("  Mode      : ") + chalk.white(opts.mode));
  }
  console.log(hr);
  console.log(chalk.gray("  Type your request below. ") + chalk.cyan("/help") + chalk.gray(" for commands, ") + chalk.cyan("exit") + chalk.gray(" to quit."));
  console.log("");
}

export function printModeHeader(title: string, detail?: string): void {
  console.log("");
  console.log(chalk.bold.hex("#7c5cff")("▸ zaahix ") + chalk.white(title) + (detail ? chalk.gray("  ·  " + detail) : ""));
  console.log(chalk.gray("─".repeat(52)));
  console.log("");
}
