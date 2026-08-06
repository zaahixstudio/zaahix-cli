import OpenAI from "openai";
import dotenv from "dotenv";
import { spawn } from "child_process";
import path from "path";
import chalk from "chalk";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("❌ OPENAI_API_KEY is missing in your .env file");
  }

  client = new OpenAI({ apiKey });
  return client;
}

async function askOllama(
  prompt: string,
  onToken?: (token: string) => void
): Promise<string> {
  const model = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";

  return new Promise((resolve, reject) => {
    const proc = spawn("ollama", ["run", model, prompt], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";
    let errorOutput = "";

    proc.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      output += chunk;
      if (onToken) {
        onToken(chunk);
      }
    });

    proc.stderr.on("data", (data: Buffer) => {
      errorOutput += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 && !output) {
        reject(new Error(errorOutput || `Ollama exited with code ${code}`));
      } else {
        resolve(output.trim());
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

export async function askOpenAI(
  prompt: string,
  context?: string,
  onToken?: (token: string) => void
): Promise<string> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const useOllama = process.env.USE_OLLAMA === "true";

    // Optionally prefer local Ollama if explicitly requested.
    if (useOllama) {
      try {
        return await askOllama(prompt, onToken);
      } catch (e: any) {
        const errorMessage = e?.message || String(e);
        if (openaiApiKey && openaiApiKey !== "your_openai_api_key_here") {
          console.warn("⚠️ Ollama call failed, falling back to OpenAI:", errorMessage);
        } else {
          return `❌ Ollama Error: ${errorMessage}`;
        }
      }
    }

    const clientInstance = getClient();

    const messages: ChatCompletionMessageParam[] = [];

    if (context) {
      try {
        const parsed = JSON.parse(context);
        if (Array.isArray(parsed)) {
          for (const msg of parsed) {
            if (msg.role === "user" || msg.role === "assistant" || msg.role === "system") {
              messages.push({ role: msg.role as any, content: msg.content });
            }
          }
        } else {
          messages.push({ role: "system", content: context });
        }
      } catch (e) {
        messages.push({ role: "system", content: context });
      }
    }

    messages.push({ role: "user", content: prompt });

    if (onToken) {
      const responseStream = await clientInstance.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: Number(process.env.OPENAI_TEMPERATURE || "0.2"),
        messages,
        stream: true,
      });

      let fullContent = "";
      for await (const chunk of responseStream) {
        const token = chunk.choices?.[0]?.delta?.content ?? "";
        if (token) {
          fullContent += token;
          onToken(token);
        }
      }
      return fullContent;
    } else {
      const response = await clientInstance.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: Number(process.env.OPENAI_TEMPERATURE || "0.2"),
        messages,
      });

      return response.choices?.[0]?.message?.content ?? "";
    }
  } catch (err: any) {
    const errStr = String(err?.message || err);
    if (err?.status === 429 || errStr.includes("429") || errStr.includes("Rate limit")) {
      let waitSeconds = 5;
      const minMatch = errStr.match(/try again in (?:(\d+)m)?([\d\.]+)s/i);
      if (minMatch) {
        const minutes = minMatch[1] ? parseInt(minMatch[1], 10) : 0;
        const seconds = minMatch[2] ? parseFloat(minMatch[2]) : 0;
        waitSeconds = minutes * 60 + seconds;
      } else {
        const generalMatch = errStr.match(/try again in ([\d\.]+)/i);
        if (generalMatch) {
          waitSeconds = parseFloat(generalMatch[1]);
        }
      }

      console.log(chalk.yellow(`\n⚠️ Rate limit reached. Retrying in ${waitSeconds}s...\n`));
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000 + 500));
      return askOpenAI(prompt, context, onToken);
    }
    return `❌ OpenAI Error: ${err?.message || err}`;
  }
}
