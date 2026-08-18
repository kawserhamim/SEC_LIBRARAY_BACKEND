import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.warn("[groq] GROQ_API_KEY not set — book enrichment will be disabled");
}

export const groq = apiKey ? new Groq({ apiKey }) : null;

export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
