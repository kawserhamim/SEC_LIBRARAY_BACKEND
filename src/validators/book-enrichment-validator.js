import { z } from "zod";

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
  topics: z
    .array(z.string().trim().min(2, "topic too short").max(60, "topic too long"))
    .min(3, "need at least 3 topics")
    .max(8, "no more than 8 topics")
    .transform((arr) => {
      const seen = new Set();
      return arr.filter((topic) => {
        const key = topic.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })
    .refine((arr) => arr.length >= 3, {
      message: "need at least 3 distinct topics after removing duplicates",
    }),
});

export function validateEnrichment(candidate) {
  return enrichmentSchema.safeParse(candidate);
}

export function formatZodError(zodError) {
  return zodError.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}
