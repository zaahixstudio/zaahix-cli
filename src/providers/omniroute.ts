import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";
import chalk from "chalk";
import { LLMProvider } from "./types";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const OMNIRoute_BASE_URL = "http://localhost:20128/v1";

export class OmniRouteProvider implements LLMProvider {
  name = "omniroute";
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = process.env.OMNIROUTE_API_KEY || "omniroute-local";
    const baseURL = process.env.OMNIROUTE_BASE_URL || OMNIRoute_BASE_URL;

    this.client = new OpenAI({
      apiKey,
      baseURL,
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
      const model =
        mode === "chat"
          ? process.env.OMNIROUTE_CHAT_MODEL ||
            process.env.OMNIROUTE_MODEL ||
            "openai/gpt-4o-mini"
          : process.env.OMNIROUTE_CODE_MODEL ||
            process.env.OMNIROUTE_MODEL ||
            "openai/gpt-4o-mini";

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
          return `❌ OmniRoute Rate Limit: Exceeded maximum retries. OmniRoute should auto-fallback, but all providers may be rate-limited.`;
        }

        let waitSeconds = Math.min(5 * Math.pow(2, retryCount), 60);

        const retryMatch = errStr.match(/retry after (\d+)/i);
        if (retryMatch)
          waitSeconds = Math.max(waitSeconds, parseInt(retryMatch[1]));

        console.log(
          chalk.yellow(
            `\n⚠️ OmniRoute rate limit. Retrying (${retryCount + 1}/5) in ${waitSeconds}s...\n`
          )
        );
        await new Promise((r) => setTimeout(r, waitSeconds * 1000 + 500));
        return this.askWithRetry(prompt, context, onToken, retryCount + 1);
      }

      // Connection error (OmniRoute not running)
      if (
        errStr.includes("ECONNREFUSED") ||
        errStr.includes("connect") ||
        errStr.includes("fetch")
      ) {
        return (
          `❌ OmniRoute Error: Cannot connect to ${OMNIRoute_BASE_URL}\n` +
          `   Make sure OmniRoute is running:\n` +
          `   1. Install: npm install -g omniroute\n` +
          `   2. Start: omniroute\n` +
          `   3. Dashboard: http://localhost:20128`
        );
      }

      // Auth errors
      if (statusCode === 401 || statusCode === 403) {
        return `❌ OmniRoute Auth Error: Invalid API key. Check OMNIROUTE_API_KEY in your .env file.\n   Generate a key from the OmniRoute dashboard at http://localhost:20128`;
      }

      // Model not found
      if (statusCode === 404) {
        return (
          `❌ OmniRoute Model Error: "${process.env.OMNIROUTE_MODEL}" not found.\n` +
          `   Check available models at http://localhost:20128/dashboard`
        );
      }

      return `❌ OmniRoute Error (${statusCode ?? "unknown"}): ${err?.message || err}`;
    }
  }
}
