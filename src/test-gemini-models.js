const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const API_KEY = process.env.GEMINI_API_KEY;
const client = new GoogleGenerativeAI(API_KEY);

const MODELS_TO_TEST = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-pro",
];

async function testModel(name) {
  try {
    const model = client.getGenerativeModel({ model: name });
    const result = await model.generateContent("Say OK");
    const text = result.response.text();
    console.log(`✅ ${name} → "${text.trim().slice(0, 40)}"`);
  } catch (err) {
    const msg = err?.message || String(err);
    const code = err?.status || "?";
    console.log(`❌ ${name} → [${code}] ${msg.split("\n")[0].slice(0, 80)}`);
  }
}

(async () => {
  console.log(`\nTesting API key: ${API_KEY?.slice(0, 12)}...\n`);
  for (const m of MODELS_TO_TEST) {
    await testModel(m);
  }
  console.log("\nDone.\n");
})();
