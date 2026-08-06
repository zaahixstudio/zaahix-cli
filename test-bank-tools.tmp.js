require("dotenv").config();
const { toolSchemas } = require("./dist/tools/schemas.js");

const BASE = process.env.AI_BANK_BASE_URL;
const KEY = process.env.AI_BANK_API_KEY;

async function callChat(tools) {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You are a helpful agent. Use tools when needed." },
        { role: "user", content: "List the files using the list_files tool." },
      ],
      tools,
    }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

(async () => {
  console.log("Testing minimal (1 tool)...");
  const minimal = [{ type: "function", function: { name: "list_files", description: "List directory contents", parameters: { type: "object", properties: { path: { type: "string" } } } } }];
  const a = await callChat(minimal);
  console.log("  status:", a.status, "| body:", JSON.stringify(a.body).slice(0, 300));

  console.log("Testing full schema (" + toolSchemas.length + " tools)...");
  const b = await callChat(toolSchemas);
  console.log("  status:", b.status, "| body:", JSON.stringify(b.body).slice(0, 300));
})().catch((e) => { console.error("TEST FAILED:", e.message); process.exit(1); });
