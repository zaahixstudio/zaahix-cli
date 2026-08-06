import { askOpenAI } from "./openai";
import { GroqProvider } from "./groq";
import { LongCatProvider } from "./longcat";
import { OpenRouterProvider } from "./openrouter";
import { GeminiProvider } from "./gemini";
import { SambanovaProvider } from "./sambanova";
import { OmniRouteProvider } from "./omniroute";
import { AiBankProvider } from "./aiBank";
import { LLMProvider } from "./types";
import { ProviderError, ErrorCode } from "../utils/errors";

class OpenAIProvider implements LLMProvider {
  name = "openai";

  async ask(
    prompt: string,
    context?: string,
    onToken?: (token: string) => void
  ) {
    return askOpenAI(prompt, context, onToken);
  }
}

export class ProviderManager {
  private providers = new Map<string, LLMProvider>();
  private fallbackChain: string[] = ["ai-bank", "openai", "gemini", "groq", "openrouter"];

  constructor() {
    this.register(new AiBankProvider());
    this.register(new OpenAIProvider());
    this.register(new GroqProvider());
    this.register(new LongCatProvider());
    this.register(new OpenRouterProvider());
    this.register(new GeminiProvider());
    this.register(new SambanovaProvider());
    this.register(new OmniRouteProvider());
  }

  register(provider: LLMProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getCurrentProvider(): LLMProvider {
    const current = process.env.ZAAHIX_PROVIDER || "openai";
    const provider = this.providers.get(current);

    if (!provider) {
      throw new ProviderError(
        ErrorCode.PROVIDER_NOT_FOUND,
        current,
        `Unknown provider: ${current}. Available providers: ${this.getAvailableProviders().join(", ")}`,
        {
          suggestion: `Set ZAAHIX_PROVIDER to one of: ${this.getAvailableProviders().join(", ")}`,
        }
      );
    }

    return provider;
  }

  /**
   * Get the fallback provider if the primary fails.
   */
  getFallbackProvider(failedProvider: string): LLMProvider | null {
    const current = process.env.ZAAHIX_PROVIDER || "openai";
    const chain = [current, ...this.fallbackChain.filter(p => p !== current)];

    for (const name of chain) {
      if (name !== failedProvider) {
        const provider = this.providers.get(name);
        if (provider) {
          return provider;
        }
      }
    }

    return null;
  }

  async ask(
    prompt: string,
    context?: string,
    onToken?: (token: string) => void
  ) {
    const provider = this.getCurrentProvider();

    try {
      return await provider.ask(prompt, context, onToken);
    } catch (err: any) {
      // If the error is a provider error and we have a fallback, try it
      if (err instanceof ProviderError && err.isRetryable()) {
        const fallback = this.getFallbackProvider(provider.name);
        if (fallback) {
          console.log(`⚠️  Provider ${provider.name} failed, trying ${fallback.name}...`);
          return await fallback.ask(prompt, context, onToken);
        }
      }
      throw err;
    }
  }
}

export const providerManager = new ProviderManager();