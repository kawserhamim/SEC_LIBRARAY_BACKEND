import { jest } from "@jest/globals";
import { getMyNotifications } from "../src/services/notification-service.js";
import { Notification } from "../src/models/notification-model.js";

describe("Service: notification-service (Polling)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should fetch paginated notifications for polling", async () => {
    const mockUserId = "64b0f9a2e3a1f2b3c4d5e6f7";
    const sampleNotifications = [
      {
        _id: "notif_1",
        user: mockUserId,
        type: "BOOK_AVAILABLE",
        title: "Book available",
        message: "Your book is available",
        read: false,
      },
    ];

    const countSpy = jest.spyOn(Notification, "countDocuments").mockResolvedValue(1);
    const findSpy = jest.spyOn(Notification, "find").mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: () => Promise.resolve(sampleNotifications),
          }),
        }),
      }),
    });

    const result = await getMyNotifications(mockUserId, { offset: "0", limit: "10" });

    expect(result.totalCount).toBe(1);
    expect(result.notifications).toEqual(sampleNotifications);
    expect(result.unreadCount).toBe(1);

    countSpy.mockRestore();
    findSpy.mockRestore();
  });
});
