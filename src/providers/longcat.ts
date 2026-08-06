import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";
import chalk from "chalk";
import { LLMProvider } from "./types";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

export class LongCatProvider implements LLMProvider {
  name = "longcat";
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = process.env.LONGCAT_API_KEY;

    if (!apiKey) {
      throw new Error("❌ LONGCAT_API_KEY is missing in your .env file");
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.longcat.chat/openai/v1",
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

      if (onToken) {
        const responseStream = await clientInstance.chat.completions.create({
          model: process.env.LONGCAT_MODEL || "LongCat-2.0",
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
          model: process.env.LONGCAT_MODEL || "LongCat-2.0",
          temperature: Number(process.env.OPENAI_TEMPERATURE || "0.2"),
          messages,
        });

        return response.choices?.[0]?.message?.content ?? "";
      }
    } catch (err: any) {
      const errStr = String(err?.message || err);
      if (err?.status === 429 || errStr.includes("429") || errStr.includes("Rate limit")) {
        if (retryCount >= 5) {
          return `❌ LongCat Rate Limit Error: Exceeded maximum retries (5). Please wait a moment and try again.`;
        }
        
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

        console.log(chalk.yellow(`\n⚠️ Rate limit reached. Retrying (${retryCount + 1}/5) in ${waitSeconds}s...\n`));
        await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000 + 500));
        return this.askWithRetry(prompt, context, onToken, retryCount + 1);
      }
      return `❌ LongCat Error: ${err?.message || err}`;
    }
  }
}
