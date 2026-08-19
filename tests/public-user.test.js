import { publicUser } from "../src/utils/public-user.js";

/**
 * Beginner-Friendly Test: Public User Formatter
 * 
 * Purpose: Ensure sensitive fields (like password) are NOT returned
 * when converting a user object to publicUser format.
 */
describe("Utils: publicUser", () => {
  test("should format user and only return safe public fields", () => {
    // 1. Arrange: Create a mock user object with sensitive data
    const mockUser = {
      _id: "user123",
      name: "John Doe",
      email: "john@example.com",
      regNo: "2021331001",
      phone: "01700000000",
      department: "CSE",
      Session: "2020-2021",
      gender: "Male",
      role: "student",
      fine: 0,
      password: "super_secret_hashed_password", // Should be omitted
    };

    // 2. Act: Call the function
    const result = publicUser(mockUser);

    // 3. Assert: Check that the result has expected fields
    expect(result.id).toBe("user123");
    expect(result.name).toBe("John Doe");
    expect(result.email).toBe("john@example.com");
    expect(result.role).toBe("student");

    // Check that password is NOT in the public user output
    expect(result.password).toBeUndefined();
  });
});
