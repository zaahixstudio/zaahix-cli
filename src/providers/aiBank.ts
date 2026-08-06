import { LLMProvider, AgentMessage, AgentResult } from "./types";

const BASE_URL = (process.env.AI_BANK_BASE_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.AI_BANK_API_KEY || "";
const MODEL = process.env.AI_BANK_MODEL || "";

interface ChatMsg {
  role: string;
  content: string;
}

function buildMessages(prompt: string, context?: string): ChatMsg[] {
  const messages: ChatMsg[] = [];
  if (context) {
    try {
      const parsed = JSON.parse(context);
      if (Array.isArray(parsed)) {
        for (const m of parsed) {
          if (m && typeof m.content === "string" && ["system", "user", "assistant"].includes(m.role)) {
            messages.push({ role: m.role, content: m.content });
          }
        }
      }
    } catch {
      // context is not a JSON array — ignore and use the prompt alone
    }
  }
  messages.push({ role: "user", content: prompt });
  return messages;
}

function mapToolCalls(msg: any): any[] {
  if (!Array.isArray(msg?.tool_calls)) return [];
  return msg.tool_calls.map((tc: any) => ({
    id: tc.id,
    name: tc.function?.name || "",
    arguments: tc.function?.arguments || "{}",
  }));
}

/**
 * AI API Bank provider — the standalone AI engine behind zaahix.
 * Uses AI_BANK_BASE_URL + AI_BANK_API_KEY (get a key at https://ai.zaahix.com).
 * Every call bills the account wallet in real time (text = ₦5/call).
 */
export class AiBankProvider implements LLMProvider {
  name = "ai-bank";

  async ask(prompt: string, context?: string, onToken?: (token: string) => void): Promise<string> {
    if (!BASE_URL || !API_KEY) {
      return "❌ AI API Bank not configured. Set AI_BANK_BASE_URL and AI_BANK_API_KEY in your .env.\n   Get a key at https://ai.zaahix.com (sign up, then Rotate to reveal your key).";
    }

    const messages = buildMessages(prompt, context);

    try {
      if (onToken) {
        return await this.stream(BASE_URL, API_KEY, messages, onToken);
      }
      return await this.single(BASE_URL, API_KEY, messages);
    } catch (err: any) {
      return `❌ AI API Bank error: ${err?.message || err}`;
    }
  }

  async askAgent(messages: AgentMessage[], tools?: object[], onToken?: (token: string) => void): Promise<AgentResult> {
    if (!BASE_URL || !API_KEY) {
      throw new Error("AI API Bank not configured. Set AI_BANK_BASE_URL and AI_BANK_API_KEY in your .env.");
    }

    const body: any = { messages };
    if (tools && tools.length > 0) body.tools = tools;
    if (MODEL) body.model = MODEL;

    const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);

    const json = await res.json();
    const msg = json?.choices?.[0]?.message || {};
    const content = msg.content || "";
    const toolCalls = mapToolCalls(msg);

    if (content && onToken) onToken(content);
    return { content, toolCalls };
  }

  private async single(base: string, key: string, messages: ChatMsg[]): Promise<string> {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    return json?.choices?.[0]?.message?.content || "";
  }

  private async stream(base: string, key: string, messages: ChatMsg[], onToken: (t: string) => void): Promise<string> {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages, stream: true }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    if (!res.body) throw new Error("No response body from AI API Bank");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload);
          const delta = chunk?.choices?.[0]?.delta?.content || "";
          if (delta) {
            full += delta;
            onToken(delta);
          }
        } catch {
          // partial / malformed chunk — skip
        }
      }
    }
    return full;
  }
}
