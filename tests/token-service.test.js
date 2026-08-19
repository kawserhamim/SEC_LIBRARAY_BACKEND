import { signAuthToken, verifyAuthToken, getAuthTokenFromCookie } from "../src/services/token-service.js";

/**
 * Beginner-Friendly Test: JWT Token Service
 * 
 * Purpose: Test creating, verifying, and extracting auth tokens.
 */
describe("Service: token-service", () => {
  beforeAll(() => {
    // Set a secret for testing if not already set in environment
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test_jwt_secret_key_12345";
  });

  test("should sign and successfully verify a JWT token", () => {
    // 1. Arrange: Sample user data
    const sampleUser = {
      _id: "64b0f9a2e3a1f2b3c4d5e6f7",
      role: "student",
    };

    // 2. Act: Generate the token
    const token = signAuthToken(sampleUser);

    // 3. Assert: Token should be a non-empty string
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);

    // 4. Act: Verify the token
    const decoded = verifyAuthToken(token);

    // 5. Assert: Decoded payload should match user id and role
    expect(decoded.id).toBe(sampleUser._id);
    expect(decoded.role).toBe(sampleUser.role);
  });

  test("should extract token from Bearer authorization header", () => {
    // 1. Arrange: Mock Express request with Authorization header
    const mockReq = {
      headers: {
        authorization: "Bearer mock_jwt_token_string",
      },
    };

    // 2. Act
    const token = getAuthTokenFromCookie(mockReq);

    // 3. Assert
    expect(token).toBe("mock_jwt_token_string");
  });

  test("should return null if no token is found in cookies or headers", () => {
    // 1. Arrange: Empty request
    const mockReq = { headers: {}, cookies: {} };

    // 2. Act
    const token = getAuthTokenFromCookie(mockReq);

    // 3. Assert
    expect(token).toBeNull();
  });
});
