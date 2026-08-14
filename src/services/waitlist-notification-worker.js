// =====================================================
// WAITLIST NOTIFICATION WORKER
//
// One function that the in-process waitlist queue
// calls per job: processWaitlistAvailability(bookId).
//
// It does the "notify every active waitlister for
// this book" work and returns the count that was
// notified.
// =====================================================

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
