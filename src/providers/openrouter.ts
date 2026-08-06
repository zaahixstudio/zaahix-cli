import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";
import chalk from "chalk";
import { LLMProvider } from "./types";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

export class OpenRouterProvider implements LLMProvider {
  name = "openrouter";
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error("❌ OPENROUTER_API_KEY is missing in your .env file");
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://github.com/zaahix",
        "X-Title": process.env.OPENROUTER_TITLE || "Zaahix CLI",
      },
    });

    return this.client;
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
    try {
      const clientInstance = this.getClient();

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

      const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

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

      // Log actual error details for debugging
      if (err?.error) {
        console.log(chalk.gray(`\n🔍 OpenRouter response: ${JSON.stringify(err.error)}`));
      }

      if (statusCode === 429 || errStr.includes("429") || errStr.includes("Rate limit") || errStr.includes("rate_limit")) {
        if (retryCount >= 5) {
          return `❌ OpenRouter Rate Limit Error: Exceeded maximum retries (5). Please wait a moment and try again.`;
        }

        // Exponential backoff: 5s, 10s, 20s, 40s, 60s
        let waitSeconds = Math.min(5 * Math.pow(2, retryCount), 60);

        // Try to parse wait time from error message
        const minMatch = errStr.match(/try again in (?:(\d+)m)?([\d\.]+)s/i);
        if (minMatch) {
          const minutes = minMatch[1] ? parseInt(minMatch[1], 10) : 0;
          const seconds = minMatch[2] ? parseFloat(minMatch[2]) : 0;
          waitSeconds = Math.max(waitSeconds, minutes * 60 + seconds);
        } else {
          const generalMatch = errStr.match(/try again in ([\d\.]+)/i);
          if (generalMatch) {
            waitSeconds = Math.max(waitSeconds, parseFloat(generalMatch[1]));
          }
        }

        console.log(chalk.yellow(`\n⚠️ Rate limit reached. Retrying (${retryCount + 1}/5) in ${waitSeconds}s...\n`));
        await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000 + 500));
        return this.askWithRetry(prompt, context, onToken, retryCount + 1);
      }

      // Handle auth errors explicitly
      if (statusCode === 401 || statusCode === 403) {
        return `❌ OpenRouter Auth Error: Invalid API key. Check OPENROUTER_API_KEY in your .env file.`;
      }

      // Handle payment/quota errors
      if (statusCode === 402) {
        return `❌ OpenRouter Quota Error: Insufficient credits. Try a free model by setting OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free`;
      }

      return `❌ OpenRouter Error (${statusCode || "unknown"}): ${err?.message || err}`;
    }
  }
}
