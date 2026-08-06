export interface LLMProvider {
  name: string;

  ask(
    prompt: string,
    context?: string,
    onToken?: (token: string) => void
  ): Promise<string>;
}

export interface ProviderConfig {
  provider: string;
  model?: string;
}