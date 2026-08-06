require("dotenv").config();
const { toolSchemas } = require("./dist/tools/schemas.js");

const BASE = process.env.AI_BANK_BASE_URL;
const KEY = process.env.AI_BANK_API_KEY;

(async () => {
  const system = `You are Zaahix, a senior software engineer working in the terminal. Use tools to help.

CURRENT WORKSPACE DIRECTORY: "C:\\Users\\DELL\\Desktop\\Mother\\zaahix-cli"
If the user asks you to build/create/set up/implement, DO NOT stop after a few files. Keep invoking tools until the work is done, component by component, file by file. Only respond with text when the work is complete or you must ask a clarifying question. Self-correct if a tool fails.`;

  const messages = [
    { role: "system", content: system },
    { role: "user", content: "List the files in this project directory using the list_files tool, then tell me how many files there are." },
  ];

  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}`, "x-debug": "1" },
    body: JSON.stringify({ messages, tools: toolSchemas }),
  });
  const body = await res.json();
  console.log("STATUS:", res.status);
  console.log("BODY:", JSON.stringify(body).slice(0, 800));
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
