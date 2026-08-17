import { triggerWaitlistAvailability } from "./notification-service.js";

export async function processWaitlistAvailability(bookId, availableCopies) {
  const result = await triggerWaitlistAvailability(bookId, availableCopies);

  return {
    bookId,
    availableCopies,
    notifiedCount: result?.notifiedCount ?? 0,
    notificationIds: (result?.notified || []).map((n) => n._id),
  };
}
