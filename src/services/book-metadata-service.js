// Free, no-key book metadata lookups, tried before any paid LLM/search call.
// Goal: ground the LLM in real description/subject/table-of-contents data
// instead of letting it recall (and potentially hallucinate, or under-cover)
// the book from memory alone.

function dedupeStrings(arr) {
  const seen = new Set();
  return arr.filter((s) => {
    const key = s.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchOpenLibrary(isbn) {
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
    if (!res.ok) return null;

    const edition = await res.json();

    const tableOfContents = Array.isArray(edition.table_of_contents)
      ? edition.table_of_contents.map((entry) => (typeof entry === "string" ? entry : entry?.title)).filter(Boolean)
      : [];
    let description =
      typeof edition.description === "string" ? edition.description : edition.description?.value || null;
    let subjects = Array.isArray(edition.subjects) ? edition.subjects : [];

    // The edition record is often sparse — the richer description/subjects
    // usually live on the associated "work" record, so fetch that too.
    const workKey = edition.works?.[0]?.key;
    if (workKey) {
      try {
        const workRes = await fetch(`https://openlibrary.org${workKey}.json`);
        if (workRes.ok) {
          const work = await workRes.json();
          const workDescription =
            typeof work.description === "string" ? work.description : work.description?.value || null;
          if (!description && workDescription) description = workDescription;
          if (Array.isArray(work.subjects)) subjects = dedupeStrings([...subjects, ...work.subjects]);
        }
      } catch {
        // work lookup is a bonus, not required — ignore failures
      }
    }

    if (!description && subjects.length === 0 && tableOfContents.length === 0) return null;

    return {
      source: "open_library",
      description,
      subjects,
      tableOfContents,
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
      tableOfContents: [],
    };
  } catch (error) {
    console.warn("[book-metadata-service] Google Books lookup failed:", error.message);
    return null;
  }
}

// Queries both free catalogs (cheap, no key) and merges whatever each has —
// they're often complementary (e.g. Open Library has a fuller subject list,
// Google Books has a fuller prose description) rather than one superseding
// the other. Returns null only if neither has anything at all.
export async function lookupBookMetadata(isbn) {
  const [openLibraryResult, googleBooksResult] = await Promise.all([
    fetchOpenLibrary(isbn),
    fetchGoogleBooks(isbn),
  ]);

  if (!openLibraryResult && !googleBooksResult) return null;

  const description = openLibraryResult?.description || googleBooksResult?.description || null;
  const subjects = dedupeStrings([
    ...(openLibraryResult?.subjects || []),
    ...(googleBooksResult?.subjects || []),
  ]);
  const tableOfContents = openLibraryResult?.tableOfContents || [];

  return {
    // Kept as a single label (matches aiEnrichment.source's enum) — prefer
    // whichever contributed, for the deterministic confidence mapping.
    source: openLibraryResult ? "open_library" : "google_books",
    description,
    subjects,
    tableOfContents,
  };
}
