const apiKey = process.env.TAVILY_API_KEY;

if (!apiKey) {
  console.warn("[tavily] TAVILY_API_KEY not set — web-search fallback will be disabled");
}

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export async function tavilySearch(query, options = {}) {
  if (!apiKey) return null;

  const response = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: options.maxResults ?? 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const isTavilyConfigured = () => Boolean(apiKey);
