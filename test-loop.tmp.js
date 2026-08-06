require("dotenv").config();
const { toolSchemas } = require("./dist/tools/schemas.js");

const BASE = process.env.AI_BANK_BASE_URL;
const KEY = process.env.AI_BANK_API_KEY;

const system = `You are Zaahix, a senior software engineer working in the terminal. Use tools to help.

CURRENT WORKSPACE DIRECTORY: "C:\\Users\\DELL\\Desktop\\Mother\\zaahix-cli"
If the user asks you to build/create/set up/implement, DO NOT stop after a few files. Keep invoking tools until the work is done. Only respond with text when the work is complete. Self-correct if a tool fails.`;

const messages = [
  { role: "system", content: system },
  { role: "user", content: "List the files in this project directory using the list_files tool, then tell me how many files there are." },
];

async function ask() {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}`, "x-debug": "1" },
    body: JSON.stringify({ messages, tools: toolSchemas }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.log("ITER ERROR:", res.status);
    console.log("UPSTREAM:", JSON.stringify(body.upstream).slice(0, 600));
    return false;
  }
  const msg = body?.choices?.[0]?.message || {};
  if (msg.tool_calls?.length) {
    console.log("TOOL_CALLS:", JSON.stringify(msg.tool_calls).slice(0, 300));
    for (const tc of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments); } catch {}
      const result = `Listed ${args.path || "."}: .env, .env.example, .gitignore, LICENSE, README.md, src/, docs/`;
      messages.push({ role: "assistant", content: msg.content || "", tool_calls: [{ id: tc.id, type: "function", function: { name: tc.function.name, arguments: tc.function.arguments } }] });
      messages.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: result });
    }
    return true;
  }
  console.log("FINAL ANSWER:", (msg.content || "").slice(0, 200));
  return false;
}

(async () => {
  let iter = 0;
  while (iter < 6 && (await ask())) iter++;
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
