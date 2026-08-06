import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import chalk from "chalk";
import { LLMProvider } from "./types";

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

// Load all valid (non-placeholder) API keys from env
function loadApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && !key.startsWith("your_") && key.trim() !== "") {
      keys.push(key.trim());
    }
  }
  // Fallback: support old single-key format
  const singleKey = process.env.GEMINI_API_KEY;
  if (singleKey && !singleKey.startsWith("your_") && singleKey.trim() !== "") {
    if (!keys.includes(singleKey.trim())) keys.push(singleKey.trim());
  }
  return keys;
}

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private clients: GoogleGenerativeAI[] = [];
  private currentKeyIndex = 0;
  private rateLimitedUntil: Map<number, number> = new Map(); // index → timestamp

  private ensureClients() {
    if (this.clients.length > 0) return;
    const keys = loadApiKeys();
    if (keys.length === 0) {
      throw new Error("❌ No valid GEMINI_API_KEY_1..5 keys found in your .env file");
    }
    this.clients = keys.map((key) => new GoogleGenerativeAI(key));
    console.log(chalk.gray(`🔑 Gemini: loaded ${keys.length} API key(s)`));
  }

  // Pick the next available (non-rate-limited) client
  private getAvailableClientIndex(): number | null {
    const now = Date.now();
    const total = this.clients.length;

    for (let i = 0; i < total; i++) {
      const idx = (this.currentKeyIndex + i) % total;
      const limitedUntil = this.rateLimitedUntil.get(idx) ?? 0;
      if (now >= limitedUntil) {
        this.currentKeyIndex = idx;
        return idx;
      }
    }
    return null; // all keys are rate-limited
  }

  private markRateLimited(index: number, waitSeconds: number) {
    this.rateLimitedUntil.set(index, Date.now() + waitSeconds * 1000);
    // Advance to next key
    this.currentKeyIndex = (index + 1) % this.clients.length;
  }

  async ask(prompt: string, context?: string, onToken?: (token: string) => void): Promise<string> {
    return this.askWithRetry(prompt, context, onToken, 0);
  }

  private async askWithRetry(
    prompt: string,
    context?: string,
    onToken?: (token: string) => void,
    retryCount = 0
  ): Promise<string> {
    this.ensureClients();

    if (retryCount >= this.clients.length * 3) {
      return `❌ Gemini: All API keys are rate-limited. Please wait a minute and try again.`;
    }

    const keyIndex = this.getAvailableClientIndex();

    if (keyIndex === null) {
      // All keys rate-limited — find the soonest one to recover
      const now = Date.now();
      let minWait = Infinity;
      this.rateLimitedUntil.forEach((until) => {
        const wait = until - now;
        if (wait < minWait) minWait = wait;
      });
      const waitSec = Math.ceil(minWait / 1000) + 1;
      console.log(chalk.yellow(`\n⚠️ All Gemini keys rate-limited. Waiting ${waitSec}s for next available key...\n`));
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      return this.askWithRetry(prompt, context, onToken, retryCount + 1);
    }

    try {
      const clientInstance = this.clients[keyIndex];
      const mode = process.env.ZAAHIX_MODEL_MODE || "code";
      const modelName = mode === "chat"
        ? (process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash-lite")
        : (process.env.GEMINI_CODE_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash-lite");

      const model = clientInstance.getGenerativeModel({
        model: modelName,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        generationConfig: {
          temperature: Number(process.env.OPENAI_TEMPERATURE || "0.2"),
        },
      });

      // Build chat history from context
      const history: { role: "user" | "model"; parts: { text: string }[] }[] = [];
      let systemInstruction = "";

      if (context) {
        try {
          const parsed = JSON.parse(context);
          if (Array.isArray(parsed)) {
            for (const msg of parsed) {
              if (msg.role === "system") {
                systemInstruction += msg.content + "\n";
              } else if (msg.role === "user") {
                history.push({ role: "user", parts: [{ text: msg.content }] });
              } else if (msg.role === "assistant") {
                history.push({ role: "model", parts: [{ text: msg.content }] });
              }
            }
          } else {
            systemInstruction = context;
          }
        } catch (e) {
          systemInstruction = context;
        }
      }

      const fullPrompt = systemInstruction
        ? `${systemInstruction}\n\n${prompt}`
        : prompt;

      const chat = model.startChat({ history });

      if (onToken) {
        const result = await chat.sendMessageStream(fullPrompt);
        let fullContent = "";
        for await (const chunk of result.stream) {
          const token = chunk.text();
          if (token) {
            fullContent += token;
            onToken(token);
          }
        }
        return fullContent;
      } else {
        const result = await chat.sendMessage(fullPrompt);
        return result.response.text();
      }

    } catch (err: any) {
      const errStr = String(err?.message || err);
      const statusCode = err?.status || err?.statusCode || err?.httpStatusCode;

      // Rate limit — rotate to next key
      if (statusCode === 429 || errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED")) {
        const waitSeconds = 65; // 1 min + buffer before this key can be reused
        this.markRateLimited(keyIndex, waitSeconds);

        const nextIndex = this.getAvailableClientIndex();
        if (nextIndex !== null && nextIndex !== keyIndex) {
          console.log(chalk.yellow(`\n⚠️ Key #${keyIndex + 1} rate-limited. Switching to key #${nextIndex + 1}...\n`));
        } else {
          console.log(chalk.yellow(`\n⚠️ Key #${keyIndex + 1} rate-limited. Retrying (${retryCount + 1})...\n`));
        }

        return this.askWithRetry(prompt, context, onToken, retryCount + 1);
      }

      // Auth / invalid key
      if (
        statusCode === 400 || statusCode === 401 || statusCode === 403 ||
        errStr.includes("API_KEY_INVALID") ||
        errStr.includes("API key not valid") ||
        errStr.includes("INVALID_ARGUMENT")
      ) {
        return `❌ Gemini Auth Error: Key #${keyIndex + 1} is invalid. Check GEMINI_API_KEY_${keyIndex + 1} in your .env file.\n   Get keys at: https://aistudio.google.com/apikey`;
      }

      if (statusCode === 404) {
        return `❌ Gemini Model Error: "${process.env.GEMINI_MODEL}" not found. Try changing GEMINI_MODEL in your .env to gemini-2.0-flash-lite`;
      }

      if (statusCode === 402) {
        return `❌ Gemini Quota Exhausted on key #${keyIndex + 1}. Check https://aistudio.google.com`;
      }

      return `❌ Gemini Error (${statusCode ?? "unknown"}): ${err?.message || err}`;
    }
  }
}
