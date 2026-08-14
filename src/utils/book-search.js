// =====================================================
// BOOK SEARCH HELPER
// Shared multi-field search query builder used by
// admin and student search endpoints.
// =====================================================

import mongoose from "mongoose";

/**
 * Escape user input so it's safe to embed inside a regex literal.
 * Without this, characters like `.`, `*`, `(`, `?` would change meaning.
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Normalize an ISBN for search: strip hyphens/spaces and uppercase.
 * Matches how the Book model stores ISBN (see pre-save hook in book-model.js).
 */
const normalizeIsbn = (str) => (typeof str === "string" ? str.replace(/[-\s]/g, "").toUpperCase() : "");

/**
 * Build a Mongo filter that searches the user's query against multiple
 * book fields:
 *   - title      (prefix-anchored, case-insensitive, uses title index)
 *   - authors    (any element of the array, prefix-anchored)
 *   - category   (case-insensitive exact match)
 *   - isbn       (exact match against the normalized ISBN)
 *
 * Behavior:
 *   - "clean"            -> matches titles starting with "clean"
 *   - "clean code"       -> matches titles starting with "clean code"
 *   - "Robert"           -> matches authors whose name starts with "Robert"
 *   - "cse" / "CSE"      -> matches category = "CSE"
 *   - "9780132350884"    -> matches ISBN exactly (with or without hyphens)
 *
 * To support substring-style search instead of prefix search, remove the
 * leading "^" inside the regex strings below.
 */
export const buildBookSearchFilter = (rawQuery) => {
    const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
    if (!query) return { filter: null, normalizedIsbn: "" };

    const safe = escapeRegex(query);
    const isbn = normalizeIsbn(query);
    const categoryUpper = query.toUpperCase();

    // Exact match wins for ISBN and category to avoid noisy results:
    //   - ISBN exact (normalized): only books whose ISBN matches the full value
    //   - category exact (uppercased): only books whose category equals the value
    // For title and authors we do prefix-match so the existing btree index
    // on `title` (book-model.js) is used.
    const orClauses = [
        { title: { $regex: `^${safe}`, $options: "i" } },
        { authors: { $regex: `^${safe}`, $options: "i" } },
    ];

    if (isbn && mongoose.connection?.readyState === 1) {
        // only add ISBN exact-match if it could plausibly be an ISBN
        // (digits/length >= 10); otherwise skip to avoid false positives.
        if (/^[\dX]{10,13}$/i.test(isbn)) {
            orClauses.push({ isbn });
        }
    } else if (isbn) {
        if (/^[\dX]{10,13}$/i.test(isbn)) {
            orClauses.push({ isbn });
        }
    }

    // category exact-match (case-insensitive via uppercase both sides)
    const allowedCategories = [
        "CSE",
        "EEE",
        "CE",
        "PHYSICS",
        "CHEMISTRY",
        "GENERAL",
        "MATH",
        "ARTS",
    ];
    if (allowedCategories.includes(categoryUpper)) {
        orClauses.push({ category: categoryUpper });
    }

    return {
        filter: { $or: orClauses },
        normalizedIsbn: isbn,
        searchedFields: ["title", "authors", "category", "isbn"],
    };
};
