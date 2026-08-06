import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";
import chalk from "chalk";
import { LLMProvider } from "./types";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

export class SambanovaProvider implements LLMProvider {
  name = "sambanova";
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = process.env.SAMBANOVA_API_KEY;

    if (!apiKey || apiKey.startsWith("your_")) {
      throw new Error(
        "❌ SAMBANOVA_API_KEY is missing in your .env file.\n   Get a free key at: https://cloud.sambanova.ai"
      );
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.sambanova.ai/v1",
    });

    return this.client;
  }

  async ask(
    prompt: string,
    context?: string,
    onToken?: (token: string) => void
  ): Promise<string> {
    return this.askWithRetry(prompt, context, onToken, 0);
  }

  private async askWithRetry(
    prompt: string,
    context?: string,
    onToken?: (token: string) => void,
    retryCount = 0
  ): Promise<string> {
    try {
      const clientInstance = this.getClient();

      const messages: ChatCompletionMessageParam[] = [];

      if (context) {
        try {
          const parsed = JSON.parse(context);
          if (Array.isArray(parsed)) {
            for (const msg of parsed) {
              if (
                msg.role === "user" ||
                msg.role === "assistant" ||
                msg.role === "system"
              ) {
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

      const mode = process.env.ZAAHIX_MODEL_MODE || "code";
      const model = mode === "chat"
        ? (process.env.SAMBANOVA_CHAT_MODEL || process.env.SAMBANOVA_MODEL || "Meta-Llama-3.1-8B-Instruct")
        : (process.env.SAMBANOVA_CODE_MODEL || process.env.SAMBANOVA_MODEL || "Meta-Llama-3.3-70B-Instruct");

      if (onToken) {
        const responseStream = await clientInstance.chat.completions.create({
          model,
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
          model,
          temperature: Number(process.env.OPENAI_TEMPERATURE || "0.2"),
          messages,
        });

        return response.choices?.[0]?.message?.content ?? "";
      }
    } catch (err: any) {
      const errStr = String(err?.message || err);
      const statusCode = err?.status || err?.statusCode;

      // Rate limit
      if (
        statusCode === 429 ||
        errStr.includes("429") ||
        errStr.includes("rate limit") ||
        errStr.includes("Rate limit") ||
        errStr.includes("too many requests")
      ) {
        if (retryCount >= 5) {
          return `❌ SambaNova Rate Limit: Exceeded maximum retries. Please wait a moment.`;
        }

        let waitSeconds = Math.min(5 * Math.pow(2, retryCount), 60);

        const retryMatch = errStr.match(/retry after (\d+)/i);
        if (retryMatch) waitSeconds = Math.max(waitSeconds, parseInt(retryMatch[1]));

        console.log(
          chalk.yellow(
            `\n⚠️ SambaNova rate limit. Retrying (${retryCount + 1}/5) in ${waitSeconds}s...\n`
          )
        );
        await new Promise((r) => setTimeout(r, waitSeconds * 1000 + 500));
        return this.askWithRetry(prompt, context, onToken, retryCount + 1);
      }

      // Auth errors
      if (statusCode === 401 || statusCode === 403) {
        return `❌ SambaNova Auth Error: Invalid API key. Check SAMBANOVA_API_KEY in your .env file.\n   Get a free key at: https://cloud.sambanova.ai`;
      }

      // Model not found
      if (statusCode === 404) {
        return `❌ SambaNova Model Error: "${process.env.SAMBANOVA_MODEL}" not found.\n   Try: Meta-Llama-3.3-70B-Instruct or DeepSeek-V3.1`;
      }

      return `❌ SambaNova Error (${statusCode ?? "unknown"}): ${err?.message || err}`;
    }
  }
}
