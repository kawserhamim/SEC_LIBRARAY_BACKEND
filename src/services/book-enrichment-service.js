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

  return { source: "llm_only", description: null, subjects: [], tableOfContents: [], snippets: [] };
}

function buildGroundingText(grounding) {
  const parts = [
    grounding.description,
    grounding.subjects?.length ? `Known subjects/categories: ${grounding.subjects.join(", ")}` : null,
    grounding.tableOfContents?.length
      ? `Table of contents:\n${grounding.tableOfContents.join("\n")}`
      : null,
    grounding.snippets?.length ? `Web search snippets:\n${grounding.snippets.join("\n---\n")}` : null,
  ].filter(Boolean);

  return parts.length
    ? parts.join("\n\n")
    : "No external information was found for this book. Use your own general knowledge, and keep things conservative and generic rather than inventing specifics you're not sure of.";
}

// Step 1: brainstorm in plain text, not JSON. JSON-mode single-shot generation
// tends to under-produce (models compress toward the bare minimum that
// satisfies the schema); giving the model room to think in prose first and
// only condense to strict JSON afterward produces meaningfully more complete
// topic coverage.
function buildBrainstormPrompt({ title, authors, category, grounding }) {
  const groundingText = buildGroundingText(grounding);

  const system = `You are a university library cataloguer with deep subject-matter knowledge. Given a book's title, authors, category, and any available source material, do two things in plain text (not JSON):

1. Write a short paragraph (roughly 100-200 words) describing what the book covers and who it's for.
2. List out EVERY distinct topic area and specific subtopic a student could plausibly search for when trying to learn something this book teaches. Be thorough and specific — for a substantial textbook, identify most of its real chapter/topic breadth (typically 4-8 broad topic areas, each with 3-8 specific subtopics), not just the 1-2 most obvious headline topics. Missing an important topic the book actually covers is a worse mistake than listing one extra. If the source material includes a table of contents or subject list, use it directly as your topic areas rather than guessing. If source material is thin, supplement carefully with your own knowledge of the book/subject, but don't invent specific chapter names you're not reasonably confident about.

Organize part 2 as broad category headings with specific subtopics listed under each.`;

  const user = `Title: ${title}
Authors: ${authors.join(", ")}
Category: ${category}

Source material:
${groundingText}`;

  return { system, user };
}

function buildFormatPrompt(brainstorm) {
  const system = `Convert the brainstorm below into a JSON object with exactly two fields:
- "description": a factual, student-facing description of the book (what it covers, who it's for), between 400 and 1200 characters. Base it on the brainstorm's descriptive paragraph.
- "topics": an array of topic groups, each { "category": "<broad subject area, 2-60 characters>", "subtopics": ["<specific topic, 2-60 characters>", ...] }. Carry over the FULL breadth from the brainstorm's topic list — do not collapse it down to just 1-2 categories. Include every category and subtopic from the brainstorm that's genuinely distinct (merge only exact duplicates or clear near-duplicates). No duplicate categories, no duplicate subtopics within a category.

Example shape (content is illustrative only, not real): { "topics": [ { "category": "Sorting Algorithms", "subtopics": ["Quick Sort", "Merge Sort", "Bubble Sort"] }, { "category": "Graph Algorithms", "subtopics": ["DFS", "BFS"] } ] }

Respond with ONLY a JSON object matching that shape, nothing else.`;

  const user = `Brainstorm to convert:\n\n${brainstorm}`;

  return { system, user };
}

async function runBrainstormStep(prompt) {
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    temperature: 0.4,
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Brainstorm step returned an empty response");
  return text;
}

async function runFormatStep(brainstorm) {
  const initialPrompt = buildFormatPrompt(brainstorm);
  const messages = [
    { role: "system", content: initialPrompt.system },
    { role: "user", content: initialPrompt.user },
  ];

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
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
      content: `Your last response was invalid: ${lastError}. Fix it and respond with ONLY a corrected JSON object. Keep the full topic breadth from the original brainstorm — don't shrink it while fixing the issue.`,
    });
  }

  throw new Error(`LLM failed to produce valid enrichment after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

async function callGroqForEnrichment(bookInfo) {
  if (!groq) {
    throw new Error("Groq client not configured (missing GROQ_API_KEY)");
  }

  const brainstorm = await runBrainstormStep(buildBrainstormPrompt(bookInfo));
  return runFormatStep(brainstorm);
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

    const { data, attempts } = await callGroqForEnrichment({
      title: book.title,
      authors: book.authors,
      category: book.category,
      grounding,
    });

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
