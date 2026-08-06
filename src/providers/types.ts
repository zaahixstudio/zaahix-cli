export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCallInfo[];
  tool_call_id?: string;
  name?: string;
}

export interface AgentResult {
  content: string;
  toolCalls?: ToolCallInfo[];
}

export interface LLMProvider {
  name: string;

  ask(
    prompt: string,
    context?: string,
    onToken?: (token: string) => void
  ): Promise<string>;

  /**
   * Native agent/tool-calling loop. Providers that support native function
   * calling implement this; the dynamic agent falls back to prompt-based JSON
   * when it is absent.
   */
  askAgent?(
    messages: AgentMessage[],
    tools?: object[],
    onToken?: (token: string) => void
  ): Promise<AgentResult>;
}

export interface ProviderConfig {
  provider: string;
  model?: string;
}
