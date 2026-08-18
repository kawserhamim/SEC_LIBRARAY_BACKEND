// Free, no-key book metadata lookups, tried before any paid LLM/search call.
// Goal: ground the LLM in a real description/subject list instead of letting
// it recall (and potentially hallucinate) the book from memory alone.

async function fetchOpenLibrary(isbn) {
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
    if (!res.ok) return null;

    const book = await res.json();
    const description =
      typeof book.description === "string"
        ? book.description
        : book.description?.value || null;
    const subjects = Array.isArray(book.subjects) ? book.subjects : [];

    if (!description && subjects.length === 0) return null;

    return {
      source: "open_library",
      description,
      subjects,
    };
  } catch (error) {
    console.warn("[book-metadata-service] Open Library lookup failed:", error.message);
    return null;
  }
}

async function fetchGoogleBooks(isbn) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const volume = data.items?.[0]?.volumeInfo;
    if (!volume) return null;

    const description = volume.description || null;
    const categories = Array.isArray(volume.categories) ? volume.categories : [];

    if (!description && categories.length === 0) return null;

    return {
      source: "google_books",
      description,
      subjects: categories,
    };
  } catch (error) {
    console.warn("[book-metadata-service] Google Books lookup failed:", error.message);
    return null;
  }
}

// Returns { source, description, subjects } from the first source with
// usable data, or null if neither free catalog has this ISBN.
export async function lookupBookMetadata(isbn) {
  const openLibraryResult = await fetchOpenLibrary(isbn);
  if (openLibraryResult) return openLibraryResult;

  const googleBooksResult = await fetchGoogleBooks(isbn);
  if (googleBooksResult) return googleBooksResult;

  return null;
}
