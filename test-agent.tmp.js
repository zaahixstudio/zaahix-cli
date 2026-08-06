require("dotenv").config();
process.env.ZAAHIX_PROVIDER = "ai-bank";
const { runDynamicAgent } = require("./dist/agent/dynamicAgent.js");

(async () => {
  if (!process.env.AI_BANK_BASE_URL || !process.env.AI_BANK_API_KEY) {
    console.log("MISSING AI_BANK vars");
    process.exit(1);
  }
  console.log("AI Bank:", process.env.AI_BANK_BASE_URL, "| key present:", !!process.env.AI_BANK_API_KEY);

  const result = await runDynamicAgent(
    "List the files in this project directory using the list_files tool, then tell me how many files there are.",
    "You are Zaahix, a senior software engineer working in the terminal. Use tools to help.",
    [],
    undefined,
    (t) => process.stdout.write(t)
  );
  console.log("\n\n=== AGENT RESULT ===");
  console.log(result);
})().catch((e) => {
  console.error("TEST FAILED:", e.message);
  process.exit(1);
});
