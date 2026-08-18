import { Book } from "../models/book-model.js";
import { groq, GROQ_MODEL } from "../config/groq.js";
import { lookupBookMetadata } from "./book-metadata-service.js";
import { searchBookOnWeb } from "./web-search-service.js";
import { validateEnrichment, formatZodError } from "../validators/book-enrichment-validator.js";

const MAX_ATTEMPTS = Number(process.env.ENRICHMENT_MAX_ATTEMPTS) || 3;

// Deterministic, not self-reported by the LLM: how much a description/topic
// list can be trusted depends on where the grounding came from, not on the
// model's own (unreliable) sense of confidence.
const CONFIDENCE_BY_SOURCE = {
  open_library: "high",
  google_books: "high",
  tavily: "medium",
  llm_only: "low",
};

async function gatherGrounding({ title, authors, isbn }) {
  const metadata = await lookupBookMetadata(isbn);
  if (metadata) return metadata;

  const webResult = await searchBookOnWeb({ title, authors, isbn });
  if (webResult) return webResult;

  return { source: "llm_only", description: null, subjects: [], snippets: [] };
}

function buildPrompt({ title, authors, category, grounding }) {
  const groundingText =
    grounding.description || grounding.subjects?.length || grounding.snippets?.length
      ? [
          grounding.description,
          grounding.subjects?.length ? `Known subjects: ${grounding.subjects.join(", ")}` : null,
          grounding.snippets?.length ? `Web search snippets:\n${grounding.snippets.join("\n---\n")}` : null,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "No external information was found for this book. Use your own general knowledge, and keep the description conservative and generic rather than inventing specifics you're not sure of.";

  const system = `You are a university library cataloguer. Given a book's title, authors, category, and any available source material, produce a JSON object with exactly two fields:
- "description": a factual, student-facing description of the book (what it covers, who it's for), between 400 and 1200 characters.
- "topics": an array of topic groups a student might search for when looking to learn something this book covers. Each group is an object: { "category": "<broad subject area, 2-60 characters>", "subtopics": ["<specific topic, 2-60 characters>", ...] }. Include at least 2 categories, each with at least 1 subtopic. No duplicate categories, no duplicate subtopics within a category.

Example shape (content is illustrative only, not real): { "topics": [ { "category": "Sorting Algorithms", "subtopics": ["Quick Sort", "Merge Sort", "Bubble Sort"] }, { "category": "Graph Algorithms", "subtopics": ["DFS", "BFS"] } ] }

Respond with ONLY a JSON object matching that shape, nothing else.`;

  const user = `Title: ${title}
Authors: ${authors.join(", ")}
Category: ${category}

Source material:
${groundingText}`;

  return { system, user };
}

async function callGroqForEnrichment({ system, user }) {
  if (!groq) {
    throw new Error("Groq client not configured (missing GROQ_API_KEY)");
  }

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      lastError = "response was not valid JSON";
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: `Your last response was not valid JSON. Respond with ONLY a JSON object matching the required shape.`,
      });
      continue;
    }

    const result = validateEnrichment(parsed);
    if (result.success) {
      return { data: result.data, attempts: attempt };
    }

    lastError = formatZodError(result.error);
    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: `Your last response was invalid: ${lastError}. Fix it and respond with ONLY a corrected JSON object.`,
    });
  }

  throw new Error(`LLM failed to produce valid enrichment after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

// Main entry point — used by the BullMQ worker and directly callable for
// standalone testing. Throws on any failure (infra or exhausted validation
// retries) so the caller (BullMQ) can apply its own backoff/retry; the
// book's aiEnrichment.status is always left in a consistent state either way.
export async function enrichBook(bookId) {
  const book = await Book.findById(bookId);
  if (!book) throw new Error(`Book ${bookId} not found`);

  book.aiEnrichment.status = "processing";
  book.aiEnrichment.statusUpdatedAt = new Date();
  await book.save();

  try {
    const grounding = await gatherGrounding({
      title: book.title,
      authors: book.authors,
      isbn: book.isbn,
    });

    const prompt = buildPrompt({
      title: book.title,
      authors: book.authors,
      category: book.category,
      grounding,
    });

    const { data, attempts } = await callGroqForEnrichment(prompt);

    book.description = data.description;
    book.topics = data.topics;
    book.aiEnrichment = {
      status: "completed",
      source: grounding.source,
      confidence: CONFIDENCE_BY_SOURCE[grounding.source] ?? "low",
      model: GROQ_MODEL,
      attempts,
      lastError: null,
      generatedAt: new Date(),
      statusUpdatedAt: new Date(),
    };
    await book.save();

    return book;
  } catch (error) {
    book.aiEnrichment.status = "failed";
    book.aiEnrichment.attempts = (book.aiEnrichment.attempts || 0) + 1;
    book.aiEnrichment.lastError = error.message;
    book.aiEnrichment.statusUpdatedAt = new Date();
    await book.save();
    throw error;
  }
}
