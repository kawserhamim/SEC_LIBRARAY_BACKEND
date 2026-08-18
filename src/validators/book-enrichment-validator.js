import { z } from "zod";

function dedupeCaseInsensitive(arr) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Hard gate between raw LLM output and what's allowed onto a Book document.
// Every book that reaches aiEnrichment.status === "completed" must satisfy
// these exact bounds, so the RAG indexing pipeline can treat all books uniformly.
//
// Note: confidence is NOT part of this schema. It's derived deterministically
// in book-enrichment-service.js from which grounding source was used
// (open_library/google_books/tavily/llm_only), not self-reported by the LLM —
// models are unreliable at judging their own certainty, so the pipeline
// decides confidence, not the model.
export const enrichmentSchema = z.object({
  description: z
    .string()
    .trim()
    .min(400, "description too short (min 400 characters)")
    .max(1200, "description too long (max 1200 characters)"),
  // Grouped topics, e.g. { category: "Sorting Algorithms", subtopics: ["Quick Sort", "Merge Sort", "Bubble Sort"] }
  topics: z
    .array(
      z.object({
        category: z.string().trim().min(2, "category name too short").max(60, "category name too long"),
        subtopics: z
          .array(z.string().trim().min(2, "subtopic too short").max(60, "subtopic too long"))
          .min(2, "each category needs at least 2 subtopics")
          .transform(dedupeCaseInsensitive)
          .refine((arr) => arr.length >= 2, {
            message: "each category needs at least 2 distinct subtopics",
          }),
      })
    )
    .min(3, "need at least 3 topic categories")
    .transform((categories) => {
      const seen = new Set();
      return categories.filter((c) => {
        const key = c.category.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })
    .refine((arr) => arr.length >= 3, {
      message: "need at least 3 distinct topic categories after removing duplicates",
    }),
});

export function validateEnrichment(candidate) {
  return enrichmentSchema.safeParse(candidate);
}

export function formatZodError(zodError) {
  return zodError.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}
