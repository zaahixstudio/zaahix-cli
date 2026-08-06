require("dotenv").config();
const OpenAI = require("openai");

(async () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { console.log("No GROQ_API_KEY in .env"); process.exit(1); }
  const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });

  const messages = [
    { role: "system", content: "You are a helpful agent. Use tools when needed." },
    { role: "user", content: "List the files in this directory using the list_files tool." },
  ];
  const tools = [
    { type: "function", function: { name: "list_files", description: "List directory contents", parameters: { type: "object", properties: { path: { type: "string" } } } } },
  ];

  try {
    const res = await client.chat.completions.create({ model: "llama-3.3-70b-versatile", messages, tools });
    const msg = res.choices?.[0]?.message || {};
    console.log("GROQ TOOLS OK. tool_calls:", JSON.stringify(msg.tool_calls), "content:", JSON.stringify(msg.content));
  } catch (e) {
    console.log("GROQ TOOLS FAILED:");
    console.log("status:", e.status);
    console.log("message:", e.error?.message || e.message);
  }
})();
