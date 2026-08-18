import { GoogleGenerativeAI } from "@google/generative-ai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import Groq from "groq-sdk";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// ===============================
// Configuration
// ===============================

const QDRANT_URL = process.env.QDRANT_URL_RAG;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY_RAG;
const COLLECTION_NAME = "Intelligent_University_Library_Management_System";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY_RAG || process.env.GROQ_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY || "");
const groq = new Groq({ apiKey: GROQ_API_KEY || "" });

// Prefer gemini-embedding-2-preview, fallback to gemini-embedding-001
const EMBEDDING_MODELS = ["gemini-embedding-2-preview", "gemini-embedding-001"];
const GROQ_CHAT_MODEL = "openai/gpt-oss-120b";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SYSTEM_PROMPT = `
You are an AI Library Assistant that helps students discover which books cover the topics or concepts they want to learn.

## Instructions

### 1. Topic & Book Questions
* Use the provided context to answer all book and topic-related questions.
* Never invent or assume book information, topics, or descriptions.
* When a student asks about a topic (e.g., "sorting algorithms", "database normalization"), search the context for books whose topic list or description includes that concept.
* If no book in the context covers the requested topic, respond exactly:
  "No book in the database currently covers this topic."
* If a specific book title is asked about but not found, respond exactly:
  "This book is unavailable in the database."
* If multiple books match a topic, present them as a numbered list, ranked by relevance.
* Keep answers clear, concise, and point-wise.

### 2. Required Book Details
When presenting a book, include:
* Title
* Author(s)
* Category / Subject Area
* ISBN (if available)
* Relevant Topic(s) Covered
* Short Description (1–2 lines)

### 3. General Conversation
Respond naturally to greetings and simple conversational questions (Hi, Hello, Bye, Thanks, Who built you, How do you work).

#### If asked "Who built you?":
Respond exactly:
"I was built by Kawser Hamim, who is passionate about backend development, system design, and DevOps."

#### If asked "How were you built?" or "How do you work?":
Respond exactly:
"I was built using LangChain and a RAG pipeline to help students discover which books cover the topics and concepts they want to learn."
`;

// ===============================
// Embedding Helpers
// ===============================

/**
 * Generate embedding vector for a single query text with retry/fallback
 */
export async function getQueryEmbedding(text) {
  let lastError = null;

  for (const modelName of EMBEDDING_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.embedContent(text);
      if (res?.embedding?.values?.length) {
        return res.embedding.values;
      }
    } catch (err) {
      lastError = err;
      // If 429 or error, try next model or retry
      console.warn(`Embedding attempt failed with model ${modelName}:`, err.message);
    }
  }

  throw lastError || new Error("Failed to generate embedding");
}

/**
 * Generate batch embeddings for document chunks with rate-limit backoff
 */
async function getBatchEmbeddings(chunks, retries = 5) {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODELS[0] });

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const reqs = chunks.map((chunk) => ({
        content: { role: "user", parts: [{ text: chunk.pageContent }] },
      }));
      const res = await model.batchEmbedContents({ requests: reqs });
      return res.embeddings.map((e) => e.values);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      const waitTime = err.status === 429 ? 35000 : 3000;
      console.warn(`[RAG Service] Batch embed rate-limited (attempt ${attempt + 1}/${retries}), waiting ${waitTime / 1000}s...`);
      await sleep(waitTime);
    }
  }
}

// ===============================
// Qdrant Vector Search Helpers
// ===============================

/**
 * Search Qdrant for top similar context chunks
 */
export async function searchSimilarDocuments(query, limit = 4) {
  if (!QDRANT_URL || !QDRANT_API_KEY) {
    throw new Error("Qdrant configuration is missing in environment variables.");
  }

  const queryVector = await getQueryEmbedding(query);

  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": QDRANT_API_KEY,
    },
    body: JSON.stringify({
      vector: queryVector,
      limit,
      with_payload: true,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Qdrant search failed: ${errorText}`);
  }

  const data = await res.json();
  return (data.result || []).map((item) => item.payload?.content).filter(Boolean);
}

// ===============================
// RAG Query Handler
// ===============================

export async function askLibraryAssistant(userInput) {
  const query = (userInput || "").trim();
  if (!query) {
    throw new Error("Query input cannot be empty.");
  }

  // Retrieve relevant book context
  const contextChunks = await searchSimilarDocuments(query, 4);

  if (!contextChunks.length) {
    return "No book in the database currently covers this topic.";
  }

  const contextText = contextChunks.join("\n\n---\n\n");

  // Call Groq LLM
  const completion = await groq.chat.completions.create({
    model: GROQ_CHAT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n## Book Context:\n${contextText}`,
      },
      {
        role: "user",
        content: query,
      },
    ],
  });

  const rawAnswer = completion.choices[0]?.message?.content || "";
  return rawAnswer.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// ===============================
// Document Indexing
// ===============================

/**
 * Check if the Qdrant collection already has vectors indexed
 */
async function getCollectionPointsCount() {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      headers: { "api-key": QDRANT_API_KEY },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.result?.points_count || 0;
  } catch {
    return 0;
  }
}

/**
 * Index rag.text / rag.txt into Qdrant if empty or forced
 */
export async function indexRagDocuments(force = false) {
  try {
    if (!force) {
      const existingCount = await getCollectionPointsCount();
      if (existingCount > 0) {
        console.log(`[RAG Service] Qdrant already indexed (${existingCount} points). Skipping upload.`);
        return { success: true, pointsCount: existingCount, skipped: true };
      }
    }

    const possiblePaths = [
      path.resolve(process.cwd(), "rag.text"),
      path.resolve(process.cwd(), "rag.txt"),
    ];

    const filePath = possiblePaths.find((p) => fs.existsSync(p));
    if (!filePath) {
      console.warn("[RAG Service] rag.text / rag.txt not found in project root.");
      return { success: false, message: "File not found" };
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    if (!fileContent.trim()) {
      console.warn("[RAG Service] RAG text file is empty.");
      return { success: false, message: "File is empty" };
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await splitter.createDocuments([fileContent]);
    if (!docs.length) return { success: false, message: "No chunks created" };

    console.log(`[RAG Service] Indexing ${docs.length} document chunks into Qdrant...`);

    const batchSize = 15;
    const points = [];

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const embeddings = await getBatchEmbeddings(batch);

      batch.forEach((doc, idx) => {
        points.push({
          id: i + idx + 1,
          vector: embeddings[idx],
          payload: {
            content: doc.pageContent,
            metadata: doc.metadata,
          },
        });
      });

      await sleep(1000);
    }

    // Delete previous embedding data before uploading new points to prevent overlap
    try {
      const deleteRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/delete?wait=true`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": QDRANT_API_KEY,
        },
        body: JSON.stringify({ filter: {} }),
      });
      if (deleteRes.ok) {
        console.log("[RAG Service] Cleared previous embedding data from Qdrant.");
      }
    } catch (delErr) {
      console.warn("[RAG Service] Note: Could not clear previous points:", delErr.message);
    }

    // Upload points to Qdrant in chunks of 50
    for (let i = 0; i < points.length; i += 50) {
      const batchPoints = points.slice(i, i + 50);
      const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "api-key": QDRANT_API_KEY,
        },
        body: JSON.stringify({ points: batchPoints }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to upload points to Qdrant: ${errorText}`);
      }
    }

    console.log(`[RAG Service] Successfully indexed ${points.length} chunks into Qdrant.`);
    return { success: true, pointsCount: points.length };
  } catch (error) {
    console.error("[RAG Service] Indexing failed:", error.message);
    return { success: false, error: error.message };
  }
}
