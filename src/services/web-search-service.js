import { tavilySearch, isTavilyConfigured } from "../config/tavily.js";

// Fallback for books absent from Open Library / Google Books — obscure,
// local, or regional textbooks that free catalogs don't index.
export async function searchBookOnWeb({ title, authors, isbn }) {
  if (!isTavilyConfigured()) return null;

  const query = [title, authors?.join(", "), isbn].filter(Boolean).join(" ");

  try {
    const result = await tavilySearch(query, { maxResults: 5 });
    const snippets = (result?.results || [])
      .map((r) => r.content)
      .filter(Boolean);

    if (snippets.length === 0) return null;

    return {
      source: "tavily",
      snippets,
    };
  } catch (error) {
    console.warn("[web-search-service] Tavily search failed:", error.message);
    return null;
  }
}
