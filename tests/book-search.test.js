import { buildBookSearchFilter } from "../src/utils/book-search.js";

/**
 * Beginner-Friendly Test: Book Search Filter Builder
 * 
 * Purpose: Test that search queries are correctly turned into MongoDB query filters.
 */
describe("Utils: buildBookSearchFilter", () => {
  test("should return null filter when search query is empty", () => {
    // 1. Arrange & Act
    const result = buildBookSearchFilter("");

    // 2. Assert
    expect(result.filter).toBeNull();
    expect(result.normalizedIsbn).toBe("");
  });

  test("should create search filter with regex for book title/author", () => {
    // 1. Arrange
    const query = "Algorithms";

    // 2. Act
    const result = buildBookSearchFilter(query);

    // 3. Assert
    expect(result.filter).toBeDefined();
    expect(result.filter.$or).toBeDefined();
    expect(result.filter.$or.length).toBeGreaterThan(0);
    expect(result.searchedFields).toContain("title");
    expect(result.searchedFields).toContain("authors");
  });

  test("should match known category when valid category name is searched", () => {
    // 1. Arrange
    const query = "CSE";

    // 2. Act
    const result = buildBookSearchFilter(query);

    // 3. Assert
    const categoryClause = result.filter.$or.find((c) => c.category === "CSE");
    expect(categoryClause).toBeDefined();
  });
});
