import { getSmartSearchResults } from "../src/controllers/student-rag-controller.js";

/**
 * Beginner-Friendly Test: Student RAG Controller
 * 
 * Purpose: Test controller validation when a user submits invalid or empty search input.
 */
describe("Controller: student-rag-controller", () => {
  test("should return 400 if search input is missing or empty", async () => {
    // 1. Arrange: Mock Request with empty input
    const req = {
      body: {
        input: "",
      },
    };

    // Mock Express Response object
    let responseStatus = null;
    let responseBody = null;

    const res = {
      status(statusCode) {
        responseStatus = statusCode;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    // 2. Act: Call the controller function
    await getSmartSearchResults(req, res);

    // 3. Assert: Check for 400 Bad Request status
    expect(responseStatus).toBe(400);
    expect(responseBody).toEqual({
      success: false,
      message: "Input is required.",
    });
  });
});
