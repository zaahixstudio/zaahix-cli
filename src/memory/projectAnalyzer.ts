import { scanProject } from "./projectScanner";
import { projectMemory } from "./projectMemory";
import { readFile } from "../tools/readFile";
import { providerManager } from "../providers/providerManager";
import pathModule from "path";

export async function analyzeProject(
  path: string = ".",
  style: "human" | "technical" = "human"
) {
  const result = await scanProject(path);

  // Dynamically detect important files using directory/name heuristics
  const entryPoints = new Set(["index", "main", "app", "server", "cli", "run"]);
  const srcDirs = new Set(["src", "lib", "app", "source", "core"]);

  const importantFiles = result.files.filter((file) => {
    const parts = file.split("/");
    const fileName = parts[parts.length - 1];
    const ext = pathModule.extname(fileName);
    const base = pathModule.basename(fileName, ext);

    // Block static assets & build files
    if (/\.(png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz|map|d\.ts)$/i.test(fileName)) {
      return false;
    }

    const inSrcDir = parts.some((part) => srcDirs.has(part.toLowerCase()));
    const isEntryPoint = entryPoints.has(base.toLowerCase());
    const isRootConfig = parts.length === 1 && (ext === ".json" || ext === ".js" || ext === ".ts" || fileName.startsWith("."));

    return inSrcDir || isEntryPoint || isRootConfig;
  });

  const topFiles = importantFiles.slice(0, 10);
  const codeSamples: Record<string, string> = {};

  for (const file of topFiles) {
    try {
      const content = await readFile(file);
      codeSamples[file] =
        typeof content === "string"
          ? content.slice(0, 2000)
          : JSON.stringify(content).slice(0, 2000);
    } catch {}
  }

  const dependencies = Object.keys(result.packageJson?.dependencies || {});
  const devDependencies = Object.keys(result.packageJson?.devDependencies || {});
  const tsConfigInfo = result.tsConfig
    ? `compilerOptions: ${Object.keys(result.tsConfig.compilerOptions || {}).join(", ")}`
    : "No tsconfig.json loaded.";

  const summaryContext = `
The repository has ${result.fileStats.totalFiles} files, ${result.fileStats.totalFolders} folders, ${result.fileStats.totalTypescriptFiles} TypeScript files, and a total source size of ${result.fileStats.totalSizeBytes} bytes.
File type breakdown: ${Object.entries(result.fileStats.extensionCounts)
      .map(([ext, count]) => `${ext}: ${count}`)
      .join(", ")}.
Key source areas: ${importantFiles.length ? importantFiles.join(", ") : "none identified"}.
Dependencies: ${dependencies.length ? dependencies.join(", ") : "none"}.
Dev dependencies: ${devDependencies.length ? devDependencies.join(", ") : "none"}.
TS config summary: ${tsConfigInfo}.
`;

  const humanPrompt = `
You are a friendly product analyst. Write a clear, high-level overview of this TypeScript CLI AI agent project for a non-technical reader.
Use warm, accessible language and explain what the tool is built to do and what kind of problems it solves.
Do not mention raw file names or implementation details.
Keep it concise.

${summaryContext}
`;

  const technicalPrompt = `
You are a senior software engineer performing a codebase review for a TypeScript CLI AI agent project.
Provide a concise technical summary that covers the project's purpose, core architecture, main workflows, and how the code organizes functionality.
Highlight any notable design choices that make the repository easier or harder to extend.

${summaryContext}
`;

  const prompt = style === "technical" ? technicalPrompt : humanPrompt;

  const contextPayload = {
    path,
    fileStats: result.fileStats,
    importantFiles: topFiles,
    packageJson: result.packageJson,
    tsConfig: result.tsConfig,
  };

  const analysis = await providerManager.ask(
    prompt,
    JSON.stringify(contextPayload)
  );

  projectMemory.analyzed = true;
  projectMemory.importantFiles = importantFiles;
  projectMemory.summary = analysis;
  projectMemory.packageInfo = result.packageJson;
  projectMemory.tsConfig = result.tsConfig;
  projectMemory.codeSamples = codeSamples;

  return projectMemory;
}